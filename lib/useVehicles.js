import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { mutate, run } from './db';
import { visibilityPayload } from './visibility';
import { buildMaintenanceTasks } from './vehicleCare';
import { buildVehicleTimeline } from './vehicleTimeline';
import { computeShares, SPLIT } from './expenses';
import { diaryPhotoPath } from './plantPhoto';
import { uploadPhoto, signedUrl, useSignedUrl } from './photoStorage';

// Onderhoudsboekje-foto's leven in de private bucket 'vehicles' (0050), zelfde
// household-gescopete RLS als planten. Pad: <household_id>/<vehicle_id>/<key>.<ext>.
export const VEHICLE_BUCKET = 'vehicles';

// Signed URL voor een private boekje-foto (default 1 uur). Dunne wrapper met de
// vehicles-bucket vooringevuld op de gedeelde, gecachte signedUrl (lib/photoStorage.js) —
// zo profiteert ook dit domein van de URL-cache (geen N+1 createSignedUrl in feeds).
export function signedVehiclePhotoUrl(path, expiresIn = 3600) {
  return signedUrl(VEHICLE_BUCKET, path, expiresIn);
}

// Hook: opslagpad → toonbare (signed) URL, met de vehicles-bucket vooringevuld op de
// gedeelde useSignedUrl. `refreshKey` forceert een verse URL na een vervang-upload —
// nu consistent met plant/pet/recept (voorheen ontbrak die parameter hier).
export function useVehiclePhotoUrl(path, refreshKey) {
  return useSignedUrl(VEHICLE_BUCKET, path, refreshKey);
}

// Voertuigen bovenop de generieke useCollection-hook (VTG-1). Het toevoegen genereert
// meteen de gekozen onderhoudstaken uit de sjablonen (lib/vehicleCare.js) — die komen
// als gewone `tasks` (category 'voertuig' + vehicle_id) terug in Vandaag/Agenda/Taken.
// Kosten/historie (VTG-2), RDW-lookup (VTG-3) en delen (VTG-4) bouwen hierop voort.
export function useVehicles() {
  const c = useCollection('vehicles', {
    label: 'voertuigen',
    order: [{ column: 'created_at', ascending: false }],
  });

  //   maintenanceKeys:      welke onderhoudstaken aanvinkt zijn (default = de sjabloon-defaults)
  //   maintenanceOverrides: optioneel { [key]: interval } om een interval bij te schaven
  const addVehicle = async ({
    name, make, model, vehicleType, year, licensePlate, mileage, notes,
    visibility, shareSubgroupId, shareWith,
    color, bodyType, apkExpiresOn, firstRegistration, catalogPriceCents, curbWeightKg,
    pricePerKmCents,
    maintenanceKeys, maintenanceOverrides,
  }) => {
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    const rows = await mutate(
      supabase.from('vehicles').insert({
        household_id: c.activeId, created_by: c.user.id,
        name: name.trim(),
        make: make?.trim() || null,
        model: model?.trim() || null,
        vehicle_type: vehicleType?.trim() || null,
        year: year ?? null,
        license_plate: licensePlate?.trim() || null,
        mileage: mileage ?? null,
        notes: notes?.trim() || null,
        // RDW-verrijking (V1) — optioneel, voedt fun-factor + échte APK-datum + kosten.
        color: color ?? null,
        body_type: bodyType ?? null,
        apk_expires_on: apkExpiresOn ?? null,
        first_registration: firstRegistration ?? null,
        catalog_price_cents: catalogPriceCents ?? null,
        curb_weight_kg: curbWeightKg ?? null,
        price_per_km_cents: pricePerKmCents ?? null,
        ...vis,
      }).select(),
      { context: 'voertuig toevoegen' }
    );
    const vehicle = rows?.[0];
    if (!vehicle) return null;

    const tasks = buildMaintenanceTasks(vehicle, maintenanceKeys, {
      startDate: new Date(), overrides: maintenanceOverrides,
    });
    if (tasks.length) {
      await mutate(
        supabase.from('tasks').insert(
          tasks.map((t) => ({ ...t, household_id: c.activeId, created_by: c.user.id }))
        ),
        { context: 'onderhoudstaken aanmaken' }
      );
    }
    await c.reload();
    return vehicle;
  };

  // Delen via de Samen-module (VTG-4): idempotente RPC die de gekoppelde shared_resources-
  // rij maakt/synct (p_shared=true) of ontkoppelt+verwijdert (false, mits geen actieve
  // reserveringen). Gooit bij actieve reserveringen → de caller toont de melding.
  const setVehicleShared = async (vehicleId, shared) => {
    await mutate(
      supabase.rpc('set_vehicle_shared', { p_vehicle_id: vehicleId, p_shared: shared }),
      { context: shared ? 'voertuig delen' : 'delen stoppen' }
    );
    await c.reload();
  };

  return {
    vehicles: c.items, loading: c.loading, reload: c.reload,
    addVehicle, updateVehicle: c.update, removeVehicle: c.remove, setVehicleShared,
  };
}

// Onderhoudshistorie-post (VTG-2) + optioneel als gedeelde uitgave (WieBetaaltWat). De
// caller geeft members + paidBy mee (de hook kent die niet). Bij `asExpense` met kosten
// maken we eerst de uitgave (gelijk gesplitst over het huishouden, gekoppeld aan het
// voertuig via source_type 'vehicle') en linken die aan de log-rij, zodat de kosten in
// de saldo's meelopen. Faalt de uitgave, dan loggen we 'm bewust niet half — de error
// bubbelt naar de caller.
export async function addVehicleLog({
  vehicle, householdId, userId, title, performedOn, mileage, costCents, note,
  asExpense = false, members = [], paidBy, photoAsset = null,
}) {
  // Optionele boekje-foto: upload naar de private bucket onder een uniek pad.
  let photoPath = null;
  if (photoAsset?.base64) {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    photoPath = await uploadPhoto({
      bucket: VEHICLE_BUCKET,
      path: diaryPhotoPath(householdId, vehicle.id, key, photoAsset.ext),
      base64: photoAsset.base64, ext: photoAsset.ext,
    });
  }
  let expenseId = null;
  if (asExpense && costCents > 0 && paidBy) {
    const participants = members.map((m) => ({ profileId: m.id }));
    const shares = computeShares({ amountCents: costCents, splitType: SPLIT.EQUAL, participants });
    const vis = visibilityPayload({
      visibility: vehicle.visibility, shareSubgroupId: vehicle.share_subgroup_id, shareWith: vehicle.share_with,
    });
    expenseId = await mutate(
      supabase.rpc('create_expense', {
        p_household_id: householdId,
        p_description: title?.trim() || `Onderhoud ${vehicle.name}`,
        p_amount_cents: costCents,
        p_paid_by: paidBy,
        p_spent_on: performedOn ?? null,
        p_split_type: SPLIT.EQUAL,
        p_visibility: vis.visibility,
        p_share_subgroup_id: vis.share_subgroup_id,
        p_share_with: vis.share_with,
        p_shares: Object.entries(shares).map(([profile_id, amount_cents]) => ({ profile_id, amount_cents })),
        p_source_type: 'vehicle',
        p_source_id: vehicle.id,
        p_category: 'overig',
      }),
      { context: 'uitgave toevoegen' }
    );
  }
  await mutate(
    supabase.from('vehicle_log').insert({
      household_id: householdId, vehicle_id: vehicle.id, created_by: userId,
      title: title?.trim() || null,
      performed_on: performedOn ?? null,
      mileage: mileage ?? null,
      cost_cents: costCents ?? null,
      note: note?.trim() || null,
      photo_path: photoPath,
      expense_id: expenseId,
    }),
    { context: 'onderhoud loggen' }
  );
  // Km-stand bijwerken naar de gelogde stand als die hoger is (de teller loopt vooruit).
  if (mileage != null && (vehicle.mileage == null || mileage >= vehicle.mileage)) {
    await mutate(
      supabase.from('vehicles').update({ mileage }).eq('id', vehicle.id),
      { context: 'km-stand bijwerken' }
    );
  }
}

// Onderhoudshistorie van één voertuig, nieuwste eerst. RLS filtert op de zichtbaarheid
// van het parent-voertuig.
export function useVehicleLog(vehicleId) {
  const [entries, setEntries] = useState([]);
  const load = useCallback(async () => {
    if (!vehicleId) { setEntries([]); return; }
    const data = await run(
      supabase.from('vehicle_log').select('*').eq('vehicle_id', vehicleId).order('performed_on', { ascending: false }),
      { fallback: [], context: 'onderhoudshistorie laden' }
    );
    setEntries(data ?? []);
  }, [vehicleId]);
  useEffect(() => { load(); }, [load]);
  return { entries, reload: load };
}

// Onderhoudsboekje-tijdlijn (V2): vehicle_log + voltooide onderhoudstaken van dit
// voertuig + RDW-mijlpaal (eerste toelating), samengevoegd en nieuwste-eerst via de
// pure buildVehicleTimeline. RLS filtert beide bronnen op zichtbaarheid.
export function useVehicleTimeline(vehicleId, vehicle) {
  const [logs, setLogs] = useState([]);
  const [completions, setCompletions] = useState([]);
  const load = useCallback(async () => {
    if (!vehicleId) { setLogs([]); setCompletions([]); return; }
    const [l, c] = await Promise.all([
      run(
        supabase.from('vehicle_log').select('*').eq('vehicle_id', vehicleId).order('performed_on', { ascending: false }),
        { fallback: [], context: 'onderhoudsboekje laden' }
      ),
      run(
        supabase.from('task_completions')
          .select('id,completed_at,task:tasks!inner(title,vehicle_id)')
          .eq('task.vehicle_id', vehicleId)
          .order('completed_at', { ascending: false }),
        { fallback: [], context: 'voltooide onderhoudstaken laden' }
      ),
    ]);
    setLogs(l ?? []);
    setCompletions(c ?? []);
  }, [vehicleId]);
  useEffect(() => { load(); }, [load]);

  const firstReg = vehicle?.first_registration ?? null;
  const entries = useMemo(
    () => buildVehicleTimeline({ logs, completions, vehicle: { first_registration: firstReg } }),
    [logs, completions, firstReg]
  );
  return { entries, logs, reload: load };
}

// Vaste lasten gekoppeld aan dit voertuig (V3): terugkerende uitgaven met vehicle_id.
// Voedt het voertuig-kostenoverzicht (lib/vehicleCosts.js).
export function useVehicleRecurring(vehicleId) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    if (!vehicleId) { setItems([]); return; }
    const data = await run(
      supabase.from('recurring_expenses').select('*').eq('vehicle_id', vehicleId).order('next_date', { ascending: true }),
      { fallback: [], context: 'vaste lasten laden' }
    );
    setItems(data ?? []);
  }, [vehicleId]);
  useEffect(() => { load(); }, [load]);
  return { items, reload: load };
}
