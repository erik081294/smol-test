import { useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { run } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { buildFeed } from './activity';
import { formatCents } from './expenses';

// Activiteitenfeed (PLT-6 → TML-5). Leesgericht, afgeleid uit bestaande tabellen (geen
// nieuwe tabel/triggers): taakvoltooiingen, uitgaven en boodschappen worden samengevoegd
// tot één tijdlijn van systeem-events. RLS scopet elke bron — een lid ziet alleen wat het
// mag zien. Actor-namen mappen we uit de al-geladen huishoudleden (zoals lib/fairness.js).
// Realtime via het gedeelde useRealtimeReload-primitief, per bron-tabel.
//
// Source-agnostisch achter `buildFeed`: een extra event-type erbij = een query + een
// FORMATTER (lib/activity.js), zónder de UI te wijzigen.
const FEED_LIMIT = 50;
const EMPTY = { tasks: [], expenses: [], groceries: [], plants: [], pets: [], vehicles: [] };

export function useActivity() {
  const { activeId, members } = useHousehold();
  const [rows, setRows] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setRows(EMPTY); setLoading(false); return; }
    const sel = (table, cols) => run(
      supabase.from(table).select(cols).eq('household_id', activeId)
        .order(table === 'task_completions' ? 'completed_at' : 'created_at', { ascending: false }).limit(FEED_LIMIT),
      { fallback: [], context: `activiteit (${table}) laden` });
    const [tasks, expenses, groceries, plants, pets, vehicles] = await Promise.all([
      sel('task_completions', 'id, completed_by, completed_at, task:tasks!inner(title)'),
      sel('expenses', 'id, paid_by, created_at, description, amount_cents'),
      sel('groceries', 'id, added_by, created_at, name'),
      sel('plants', 'id, created_by, created_at, name'),
      sel('pets', 'id, created_by, created_at, name'),
      sel('vehicles', 'id, created_by, created_at, name'),
    ]);
    setRows({
      tasks: tasks ?? [], expenses: expenses ?? [], groceries: groceries ?? [],
      plants: plants ?? [], pets: pets ?? [], vehicles: vehicles ?? [],
    });
    setLoading(false);
  }, [activeId]);

  // Eén useRealtimeReload met alle bron-tabellen; de realtime-hub (INF-8) bundelt ze in
  // één kanaal per huishouden, dus extra bronnen kosten geen extra subscriptie.
  useRealtimeReload(load, activeId, [
    { table: 'task_completions', filter: `household_id=eq.${activeId}` },
    { table: 'expenses', filter: `household_id=eq.${activeId}` },
    { table: 'groceries', filter: `household_id=eq.${activeId}` },
    { table: 'plants', filter: `household_id=eq.${activeId}` },
    { table: 'pets', filter: `household_id=eq.${activeId}` },
    { table: 'vehicles', filter: `household_id=eq.${activeId}` },
  ], { name: 'activity' });

  const nameById = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m.display_name])),
    [members],
  );

  // Ruwe rijen per bron → genormaliseerde events (gedeelde shape: id/type/at/actorName/
  // subject) → geformatteerde, gesorteerde + samengevouwen feed. Bron-prefix in de id
  // houdt 'm uniek over de tabellen heen.
  const feed = useMemo(() => buildFeed([
    ...rows.tasks.map((r) => ({
      id: `t:${r.id}`, type: 'task_completed', at: r.completed_at,
      actorName: nameById[r.completed_by], subject: r.task?.title,
    })),
    ...rows.expenses.map((r) => ({
      id: `e:${r.id}`, type: 'expense_added', at: r.created_at,
      actorName: nameById[r.paid_by], subject: r.description, amountText: formatCents(r.amount_cents),
    })),
    ...rows.groceries.map((r) => ({
      id: `g:${r.id}`, type: 'grocery_added', at: r.created_at,
      actorName: nameById[r.added_by], subject: r.name,
    })),
    ...rows.plants.map((r) => ({
      id: `pl:${r.id}`, type: 'plant_added', at: r.created_at, actorName: nameById[r.created_by], subject: r.name,
    })),
    ...rows.pets.map((r) => ({
      id: `pe:${r.id}`, type: 'pet_added', at: r.created_at, actorName: nameById[r.created_by], subject: r.name,
    })),
    ...rows.vehicles.map((r) => ({
      id: `v:${r.id}`, type: 'vehicle_added', at: r.created_at, actorName: nameById[r.created_by], subject: r.name,
    })),
  ]), [rows, nameById]);

  return { feed, loading, reload: load };
}
