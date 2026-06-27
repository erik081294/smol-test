import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { run, mutate } from './db';
import { visibilityPayload } from './visibility';
import { buildCareTasks } from './petCare';
import { PET_BUCKET, diaryPhotoPath } from './petPhoto';
import { uploadPhoto, signedUrl, useSignedUrl } from './photoStorage';

// Tijdlijn-/dagboek-post bij een dier: een rij in pet_log + (optioneel) een object
// in de 'pets'-bucket onder <household_id>/<pet_id>/<key>.<ext>. Een post draagt een
// foto, een notitie en/of een gewicht (de DB eist minstens één van de drie). Een
// echte foto wordt meteen de coverfoto (pets.photo_path) — net als bij planten.
export async function addPetPhoto({ householdId, petId, userId, asset, note = null, weightGrams = null }) {
  if (!asset?.base64) throw new Error('Geen afbeeldingsdata');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = await uploadPhoto({
    bucket: PET_BUCKET,
    path: diaryPhotoPath(householdId, petId, key, asset.ext),
    base64: asset.base64, ext: asset.ext,
  });
  await mutate(
    supabase.from('pet_log').insert({ household_id: householdId, pet_id: petId, photo_path: path, note, weight_grams: weightGrams, created_by: userId }),
    { context: 'tijdlijnfoto opslaan' }
  );
  await mutate(
    supabase.from('pets').update({ photo_path: path }).eq('id', petId),
    { context: 'coverfoto bijwerken' }
  );
  return path;
}

// Notitie- en/of gewicht-post zónder foto. Verandert de coverfoto bewust niet
// (alleen echte foto's zijn cover). Minstens een notitie of een gewicht vereist.
export async function addPetLog({ householdId, petId, userId, note = null, weightGrams = null }) {
  const trimmed = note?.trim() || null;
  if (!trimmed && weightGrams == null) throw new Error('Lege post');
  await mutate(
    supabase.from('pet_log').insert({ household_id: householdId, pet_id: petId, photo_path: null, note: trimmed, weight_grams: weightGrams, created_by: userId }),
    { context: 'tijdlijn-post opslaan' }
  );
}

// Signed URL voor een private huisdierfoto (default 1 uur). Dunne wrapper met de
// pets-bucket vooringevuld op de gedeelde, gecachte signedUrl (lib/photoStorage.js) —
// zo profiteert ook dit domein van de URL-cache (geen N+1 createSignedUrl in feeds).
export function signedPhotoUrl(path, expiresIn = 3600) {
  return signedUrl(PET_BUCKET, path, expiresIn);
}

// Hook: opslagpad → toonbare (signed) URL, met de pets-bucket vooringevuld op de
// gedeelde useSignedUrl. `refreshKey` forceert een verse URL (foto vervangen).
export function usePetPhotoUrl(path, refreshKey) {
  return useSignedUrl(PET_BUCKET, path, refreshKey);
}

// Huisdieren bovenop de generieke useCollection-hook. Het toevoegen genereert meteen
// de gekozen verzorgingstaken uit de soort-routine — die komen als gewone `tasks`
// (category 'huisdier' + pet_id) terug in Vandaag/Agenda/Taken.
export function usePets() {
  const c = useCollection('pets', {
    label: 'huisdieren',
    module: 'huisdieren',
    order: [{ column: 'created_at', ascending: false }],
  });

  //   careKeys:   welke verzorgingstaken aanvinkt zijn (default = de soort-defaults)
  //   careOverrides: optioneel { [key]: interval } om een interval bij te schaven
  //   photoAsset: optioneel { base64, ext } uit de image-picker
  const addPet = async ({
    name, type, birthDate, chipNumber, vetName, notes,
    visibility, shareSubgroupId, shareWith, photoAsset,
    careKeys, careOverrides,
  }) => {
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    const rows = await mutate(
      supabase.from('pets').insert({
        household_id: c.activeId, created_by: c.user.id,
        name, type,
        birth_date: birthDate ?? null,
        chip_number: chipNumber?.trim() || null,
        vet_name: vetName?.trim() || null,
        notes: notes?.trim() || null,
        ...vis,
      }).select(),
      { context: 'huisdier toevoegen' }
    );
    const pet = rows?.[0];
    if (!pet) return null;

    // Foto (optioneel): eerste tijdlijnfoto + meteen de cover.
    if (photoAsset?.base64) {
      try {
        pet.photo_path = await addPetPhoto({ householdId: c.activeId, petId: pet.id, userId: c.user.id, asset: photoAsset });
      } catch (e) {
        // Foto-fout mag het aanmaken niet blokkeren; log en ga door.
        console.warn('[Huishoek] Foto uploaden mislukt:', e.message);
      }
    }

    const careTasks = buildCareTasks(pet, careKeys, { startDate: new Date(), overrides: careOverrides });
    if (careTasks.length) {
      await mutate(
        supabase.from('tasks').insert(
          careTasks.map((t) => ({ ...t, household_id: c.activeId, created_by: c.user.id }))
        ),
        { context: 'verzorgingstaken aanmaken' }
      );
    }
    await c.reload();
    return pet;
  };

  return {
    pets: c.items, loading: c.loading, reload: c.reload,
    addPet, updatePet: c.update, removePet: c.remove,
  };
}

// Notitie van een tijdlijn-post bijwerken (leeg = wissen). Gewicht blijft ongemoeid.
export async function updatePetLogNote(logId, note) {
  await mutate(
    supabase.from('pet_log').update({ note: note?.trim() || null }).eq('id', logId),
    { context: 'notitie opslaan' }
  );
}

// Tijdlijn-post verwijderen: (eventueel) storage-object + rij weg. Was het de
// coverfoto, dan valt de cover terug op de eerstvolgende (nieuwste) resterende echte
// foto, of null. Geeft het nieuwe coverpad terug.
export async function deletePetLog({ entry, pet }) {
  if (entry.photo_path) {
    await supabase.storage.from(PET_BUCKET).remove([entry.photo_path]).catch(() => {});
  }
  await mutate(supabase.from('pet_log').delete().eq('id', entry.id), { context: 'tijdlijn-post verwijderen' });

  if (entry.photo_path && pet?.photo_path === entry.photo_path) {
    const remaining = await run(
      supabase.from('pet_log').select('photo_path')
        .eq('pet_id', entry.pet_id).not('photo_path', 'is', null)
        .order('created_at', { ascending: false }).limit(1),
      { fallback: [], context: 'cover herstellen' }
    );
    const next = remaining?.[0]?.photo_path ?? null;
    await mutate(supabase.from('pets').update({ photo_path: next }).eq('id', entry.pet_id), { context: 'cover bijwerken' });
    return next;
  }
  return pet?.photo_path ?? null;
}

// Tijdlijn van één dier (foto's, notities én gewicht-posts), nieuwste eerst. RLS
// filtert op de zichtbaarheid van het parent-dier.
export function usePetLog(petId) {
  const [entries, setEntries] = useState([]);
  const load = useCallback(async () => {
    if (!petId) { setEntries([]); return; }
    const data = await run(
      supabase.from('pet_log').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
      { fallback: [], context: 'huisdier-tijdlijn laden' }
    );
    setEntries(data ?? []);
  }, [petId]);
  useEffect(() => { load(); }, [load]);
  return { entries, reload: load };
}

// Cross-pet tijdlijn: de posts van álle zichtbare dieren door elkaar, nieuwste eerst,
// elk met de dier-naam erbij (join). Leunt op useCollection: gescopet laden op
// household_id + realtime op pet_log. RLS erft de zichtbaarheid van het parent-dier.
export function useHouseholdPetTimeline() {
  const c = useCollection('pet_log', {
    label: 'huisdier-tijdlijn',
    module: 'huisdieren',
    order: [{ column: 'created_at', ascending: false }],
    select: '*, pet:pets ( id, name, type )',
  });
  return { entries: c.items, loading: c.loading, reload: c.reload };
}
