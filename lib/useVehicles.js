import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { mutate } from './db';
import { visibilityPayload } from './visibility';
import { buildMaintenanceTasks } from './vehicleCare';

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
