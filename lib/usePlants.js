import { useEffect, useState, useCallback } from 'react';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { run, mutate } from './db';
import { visibilityPayload } from './visibility';
import { buildCareTasks } from './plantCare';
import { PLANT_BUCKET, diaryPhotoPath, contentTypeForExt } from './plantPhoto';
export { searchSpecies } from './plantCare';

// Voegt een foto toe aan het plantendagboek: upload naar een uniek dagboek-pad,
// registreer 'm in plant_photos, en zet 'm als omslagfoto (plants.photo_path) —
// de nieuwste dagboekfoto is altijd de omslag. Geeft het opgeslagen pad terug.
// Gedeeld door de nieuwe-plant-flow én "foto toevoegen" op een bestaande plant.
export async function addPlantPhoto({ householdId, plantId, userId, asset, note = null }) {
  if (!asset?.base64) throw new Error('Geen afbeeldingsdata');
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = diaryPhotoPath(householdId, plantId, key, asset.ext);
  const { error } = await supabase.storage.from(PLANT_BUCKET).upload(
    path, decode(asset.base64),
    { contentType: contentTypeForExt(asset.ext), upsert: true },
  );
  if (error) throw new Error(error.message);
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

// Signed URL voor een private foto (default 1 uur geldig).
export async function signedPhotoUrl(path, expiresIn = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(PLANT_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

// Hook: zet een opslagpad om naar een toonbare (signed) URL. Herresolved als het
// pad verandert; null zolang er geen foto/URL is. `refreshKey` forceert een
// nieuwe signed URL ook als het pad gelijk blijft (bijv. foto vervangen met
// dezelfde extensie → upsert op hetzelfde pad).
export function usePlantPhotoUrl(path, refreshKey) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    if (!path) { setUrl(null); return; }
    signedPhotoUrl(path).then((u) => { if (on) setUrl(u); });
    return () => { on = false; };
  }, [path, refreshKey]);
  return url;
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

// Plantendagboek: de foto's van één plant, nieuwste eerst. RLS filtert op de
// zichtbaarheid van de parent-plant, dus dit lekt niets buiten wat je mag zien.
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
