import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

// Bron-tabellen van de feed, elk met de rij-sleutel in `rows`, de kolommen en de
// sorteerkolom. Eén bron toevoegen = hier een regel + een FORMATTER (lib/activity.js).
const SOURCES = [
  { table: 'task_completions', key: 'tasks', cols: 'id, completed_by, completed_at, task:tasks!inner(title)', orderCol: 'completed_at' },
  { table: 'expenses', key: 'expenses', cols: 'id, paid_by, created_at, description, amount_cents', orderCol: 'created_at' },
  { table: 'groceries', key: 'groceries', cols: 'id, added_by, created_at, name', orderCol: 'created_at' },
  { table: 'plants', key: 'plants', cols: 'id, created_by, created_at, name', orderCol: 'created_at' },
  { table: 'pets', key: 'pets', cols: 'id, created_by, created_at, name', orderCol: 'created_at' },
  { table: 'vehicles', key: 'vehicles', cols: 'id, created_by, created_at, name', orderCol: 'created_at' },
];
const REALTIME_SOURCES = SOURCES.map((s) => s.table);
const SOURCE_DEBOUNCE_MS = 200;

export function useActivity() {
  const { activeId, members } = useHousehold();
  const [rows, setRows] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const fetchSource = useCallback((src) => run(
    supabase.from(src.table).select(src.cols).eq('household_id', activeId)
      .order(src.orderCol, { ascending: false }).limit(FEED_LIMIT),
    { fallback: [], context: `activiteit (${src.table}) laden` }), [activeId]);

  const load = useCallback(async () => {
    if (!activeId) { setRows(EMPTY); setLoading(false); return; }
    const results = await Promise.all(SOURCES.map(fetchSource));
    const next = {};
    SOURCES.forEach((s, i) => { next[s.key] = results[i] ?? []; });
    setRows(next);
    setLoading(false);
  }, [activeId, fetchSource]);

  // Bron-selectief herladen (P1): een realtime-event op één tabel herlaadt alléén die bron
  // i.p.v. alle zes queries. Zonder dit deed één afgevinkte taak 6 volledige refetches.
  const loadSource = useCallback(async (table) => {
    if (!activeId) return;
    const src = SOURCES.find((s) => s.table === table);
    if (!src) { load(); return; }
    const data = await fetchSource(src);
    setRows((prev) => ({ ...prev, [src.key]: data ?? [] }));
  }, [activeId, fetchSource, load]);

  // Per-bron debounce zodat een burst events op één tabel (bulk-insert) tot één herlaad
  // van díé bron leidt, niet tot een storm. Bij een onbekende bron: veilige volle herlaad.
  const timers = useRef({});
  const onChange = useCallback((payload) => {
    const t = timers.current;
    const table = payload?.table;
    const bucket = REALTIME_SOURCES.includes(table) ? table : '__all';
    clearTimeout(t[bucket]);
    t[bucket] = setTimeout(() => (bucket === '__all' ? load() : loadSource(table)), SOURCE_DEBOUNCE_MS);
  }, [load, loadSource]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  // Eén useRealtimeReload met alle bron-tabellen; de realtime-hub (INF-8) bundelt ze in
  // één kanaal per huishouden, dus extra bronnen kosten geen extra subscriptie. onChange
  // routeert per event naar de juiste bron (i.p.v. een full reload).
  useRealtimeReload(load, activeId,
    SOURCES.map((s) => ({ table: s.table, filter: `household_id=eq.${activeId}` })),
    { name: 'activity', onChange });

  const nameById = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m.display_name])),
    [members],
  );

  // Ruwe rijen per bron → genormaliseerde events (gedeelde shape: id/type/at/actorName/
  // subject) → geformatteerde, gesorteerde + samengevouwen feed. Bron-prefix in de id
  // houdt 'm uniek over de tabellen heen.
  // `actorId` reist mee (TML-7): de member-as van de tijdlijn-filter werkt op
  // profiel-id — weergavenamen zijn niet uniek en kunnen wijzigen.
  const feed = useMemo(() => buildFeed([
    ...rows.tasks.map((r) => ({
      id: `t:${r.id}`, type: 'task_completed', at: r.completed_at,
      actorId: r.completed_by, actorName: nameById[r.completed_by], subject: r.task?.title,
    })),
    ...rows.expenses.map((r) => ({
      id: `e:${r.id}`, type: 'expense_added', at: r.created_at,
      actorId: r.paid_by, actorName: nameById[r.paid_by], subject: r.description, amountText: formatCents(r.amount_cents),
    })),
    ...rows.groceries.map((r) => ({
      id: `g:${r.id}`, type: 'grocery_added', at: r.created_at,
      actorId: r.added_by, actorName: nameById[r.added_by], subject: r.name,
    })),
    ...rows.plants.map((r) => ({
      id: `pl:${r.id}`, type: 'plant_added', at: r.created_at, actorId: r.created_by, actorName: nameById[r.created_by], subject: r.name,
    })),
    ...rows.pets.map((r) => ({
      id: `pe:${r.id}`, type: 'pet_added', at: r.created_at, actorId: r.created_by, actorName: nameById[r.created_by], subject: r.name,
    })),
    ...rows.vehicles.map((r) => ({
      id: `v:${r.id}`, type: 'vehicle_added', at: r.created_at, actorId: r.created_by, actorName: nameById[r.created_by], subject: r.name,
    })),
  ]), [rows, nameById]);

  return { feed, loading, reload: load };
}
