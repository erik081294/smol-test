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
const EMPTY = { tasks: [], expenses: [], groceries: [] };

export function useActivity() {
  const { activeId, members } = useHousehold();
  const [rows, setRows] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setRows(EMPTY); setLoading(false); return; }
    const [tasks, expenses, groceries] = await Promise.all([
      run(supabase.from('task_completions')
        .select('id, completed_by, completed_at, task:tasks!inner(title)')
        .eq('household_id', activeId).order('completed_at', { ascending: false }).limit(FEED_LIMIT),
      { fallback: [], context: 'activiteit (taken) laden' }),
      run(supabase.from('expenses')
        .select('id, paid_by, created_at, description, amount_cents')
        .eq('household_id', activeId).order('created_at', { ascending: false }).limit(FEED_LIMIT),
      { fallback: [], context: 'activiteit (uitgaven) laden' }),
      run(supabase.from('groceries')
        .select('id, added_by, created_at, name')
        .eq('household_id', activeId).order('created_at', { ascending: false }).limit(FEED_LIMIT),
      { fallback: [], context: 'activiteit (boodschappen) laden' }),
    ]);
    setRows({ tasks: tasks ?? [], expenses: expenses ?? [], groceries: groceries ?? [] });
    setLoading(false);
  }, [activeId]);

  useRealtimeReload(load, activeId, [
    { table: 'task_completions', filter: `household_id=eq.${activeId}` },
    { table: 'expenses', filter: `household_id=eq.${activeId}` },
    { table: 'groceries', filter: `household_id=eq.${activeId}` },
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
  ]), [rows, nameById]);

  return { feed, loading, reload: load };
}
