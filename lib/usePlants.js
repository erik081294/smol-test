import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { run, mutate } from './db';
import { visibilityPayload } from './visibility';
import { buildCareTasks } from './plantCare';
import { PLANT_BUCKET, diaryPhotoPath } from './plantPhoto';
import { uploadPhoto, signedUrl, useSignedUrl } from './photoStorage';
export { searchSpecies } from './plantCare';

// Voegt een foto toe aan het plantendagboek: upload naar een uniek dagboek-pad,
// registreer 'm in plant_photos, en zet 'm als omslagfoto (plants.photo_path) —
// de nieuwste dagboekfoto is altijd de omslag. Geeft het opgeslagen pad terug.
// Gedeeld door de nieuwe-plant-flow én "foto toevoegen" op een bestaande plant.
export async function addPlantPhoto({ householdId, plantId, userId, asset, note = null }) {
  if (!asset?.base64) throw new Error('Geen afbeeldingsdata');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = await uploadPhoto({
    bucket: PLANT_BUCKET,
    path: diaryPhotoPath(householdId, plantId, key, asset.ext),
    base64: asset.base64, ext: asset.ext,
  });
  await mutate(
    supabase.from('plant_photos').insert({ household_id: householdId, plant_id: plantId, photo_path: path, note, created_by: userId }),
    { context: 'dagboekfoto opslaan' }
  );
  await mutate(
    supabase.from('plants').update({ photo_path: path }).eq('id', plantId),
    { context: 'omslagfoto bijwerken' }
  );
  return path;
}

// Voegt een notitie-only post toe aan de tijdlijn: een rij in plant_photos zónder
// photo_path. Verandert de omslagfoto bewust níet (alleen echte foto's zijn cover).
export async function addPlantNote({ householdId, plantId, userId, note }) {
  const trimmed = note?.trim();
  if (!trimmed) throw new Error('Lege notitie');
  await mutate(
    supabase.from('plant_photos').insert({ household_id: householdId, plant_id: plantId, photo_path: null, note: trimmed, created_by: userId }),
    { context: 'tijdlijn-notitie opslaan' }
  );
}

// Signed URL voor een private plantfoto (default 1 uur). Dunne wrapper met de
// plant-bucket vooringevuld op de gedeelde, gecachte signedUrl (lib/photoStorage.js) —
// zo profiteert ook dit domein van de URL-cache (geen N+1 createSignedUrl in feeds).
export function signedPhotoUrl(path, expiresIn = 3600) {
  return signedUrl(PLANT_BUCKET, path, expiresIn);
}

// Hook: opslagpad → toonbare (signed) URL, met de plant-bucket vooringevuld op de
// gedeelde useSignedUrl. `refreshKey` forceert een nieuwe signed URL ook als het pad
// gelijk blijft (bijv. foto vervangen met dezelfde extensie → upsert op hetzelfde pad).
export function usePlantPhotoUrl(path, refreshKey) {
  return useSignedUrl(PLANT_BUCKET, path, refreshKey);
}

// Planten bovenop de generieke useCollection-hook. Het toevoegen genereert
// meteen de verzorgingstaken (water/voeding) uit de soortregels — die komen als
// gewone `tasks` (category 'plant' + plant_id) terug in Vandaag/Agenda.
export function usePlants() {
  const c = useCollection('plants', {
    label: 'planten',
    order: [{ column: 'created_at', ascending: false }],
  });

  // species: het volledige soort-record (of null bij handmatige soortkeuze).
  // photoAsset: optioneel { base64, ext } uit de image-picker.
  const addPlant = async ({ name, speciesId, location, waterDays, visibility, shareSubgroupId, shareWith, photoAsset }, species) => {
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    const rows = await mutate(
      supabase.from('plants').insert({
        household_id: c.activeId, created_by: c.user.id,
        name, species_id: speciesId ?? null, location: location ?? null,
        water_days: speciesId ? null : (waterDays ?? null),
        ...vis,
      }).select(),
      { context: 'plant toevoegen' }
    );
    const plant = rows?.[0];
    if (!plant) return null;

    // Foto (optioneel): als eerste dagboekfoto + meteen de omslag.
    if (photoAsset?.base64) {
      try {
        plant.photo_path = await addPlantPhoto({ householdId: c.activeId, plantId: plant.id, userId: c.user.id, asset: photoAsset });
      } catch (e) {
        // Foto-fout mag het aanmaken van de plant niet blokkeren; log en ga door.
        console.warn('[Huishoek] Foto uploaden mislukt:', e.message);
      }
    }

    // Soort-object voor de schemaregels: het echte record, of een terugval op
    // het handmatige waterinterval (zelfde interval in groei én rust, geen voeding).
    const rules = species ?? (waterDays
      ? { water_days_growing: waterDays, water_days_resting: waterDays, feed_weeks_growing: null }
      : null);

    const careTasks = buildCareTasks(plant, rules, { startDate: new Date() });
    if (careTasks.length) {
      await mutate(
        supabase.from('tasks').insert(
          careTasks.map((t) => ({ ...t, household_id: c.activeId, created_by: c.user.id }))
        ),
        { context: 'verzorgingstaken aanmaken' }
      );
    }
    await c.reload();
    return plant;
  };

  return {
    plants: c.items, loading: c.loading, reload: c.reload,
    addPlant, updatePlant: c.update, removePlant: c.remove,
  };
}

// Notitie van een dagboekfoto bijwerken (leeg = wissen).
export async function updatePlantPhotoNote(photoId, note) {
  await mutate(
    supabase.from('plant_photos').update({ note: note?.trim() || null }).eq('id', photoId),
    { context: 'notitie opslaan' }
  );
}

// Tijdlijnpost verwijderen: (eventueel) storage-object + rij weg. Een notitie-only
// post heeft geen foto, dus dan slaan we de storage-verwijdering over. Was het de
// omslagfoto, dan valt de omslag terug op de eerstvolgende (nieuwste) resterende
// echte foto, of null. Geeft het nieuwe omslagpad terug.
export async function deletePlantPhoto({ photo, plant }) {
  if (photo.photo_path) {
    await supabase.storage.from(PLANT_BUCKET).remove([photo.photo_path]).catch(() => {});
  }
  await mutate(supabase.from('plant_photos').delete().eq('id', photo.id), { context: 'tijdlijnpost verwijderen' });

  if (photo.photo_path && plant?.photo_path === photo.photo_path) {
    const remaining = await run(
      supabase.from('plant_photos').select('photo_path')
        .eq('plant_id', photo.plant_id).not('photo_path', 'is', null)
        .order('created_at', { ascending: false }).limit(1),
      { fallback: [], context: 'omslag herstellen' }
    );
    const next = remaining?.[0]?.photo_path ?? null;
    await mutate(supabase.from('plants').update({ photo_path: next }).eq('id', photo.plant_id), { context: 'omslag bijwerken' });
    return next;
  }
  return plant?.photo_path ?? null;
}

// Plant-tijdlijn: de posts van één plant (foto's én losse notities), nieuwste
// eerst. RLS filtert op de zichtbaarheid van de parent-plant, dus dit lekt niets
// buiten wat je mag zien.
export function usePlantDiary(plantId) {
  const [photos, setPhotos] = useState([]);
  const load = useCallback(async () => {
    if (!plantId) { setPhotos([]); return; }
    const data = await run(
      supabase.from('plant_photos').select('*').eq('plant_id', plantId).order('created_at', { ascending: false }),
      { fallback: [], context: 'plantendagboek laden' }
    );
    setPhotos(data ?? []);
  }, [plantId]);
  useEffect(() => { load(); }, [load]);
  return { photos, reload: load };
}

// Cross-plant tijdlijn (PLA-8): de tijdlijn-posts (foto's én losse notities) van
// álle zichtbare planten door elkaar, nieuwste eerst, elk met de plantnaam erbij
// (join). Leunt op de generieke useCollection-hook: gescopet laden op household_id
// + realtime op plant_photos. RLS erft de zichtbaarheid van de parent-plant, dus
// posts van planten die je niet mag zien (subgroep) verschijnen hier niet.
export function useHouseholdPlantTimeline() {
  const c = useCollection('plant_photos', {
    label: 'plant-tijdlijn',
    order: [{ column: 'created_at', ascending: false }],
    select: '*, plant:plants ( id, name )',
  });
  return { entries: c.items, loading: c.loading, reload: c.reload };
}

// Globale soortdatabase (read-only). Klein genoeg om in één keer te laden en
// client-side op te zoeken.
export function usePlantSpecies() {
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    run(supabase.from('plant_species').select('*').order('common_name'), { fallback: [], context: 'soorten laden' })
      .then((data) => { if (on) { setSpecies(data ?? []); setLoading(false); } });
    return () => { on = false; };
  }, []);
  return { species, loading };
}
