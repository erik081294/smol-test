import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { mutate, run } from './db';
import { visibilityPayload } from './visibility';
import { buildMaintenanceTasks } from './vehicleCare';
import { computeShares, SPLIT } from './expenses';

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

  return {
    vehicles: c.items, loading: c.loading, reload: c.reload,
    addVehicle, updateVehicle: c.update, removeVehicle: c.remove,
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
  asExpense = false, members = [], paidBy,
}) {
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
      expense_id: expenseId,
    }),
    { context: 'onderhoud loggen' }
  );
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
