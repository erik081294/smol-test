import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { getCached, setCached, cacheKey } from './dataCache';

// Laad-venster: ruime veiligheidsdrempel op de voltooiingen-log (PERF-1). 2000 is
// in de praktijk "alles" (jaren huishouden); pas bij overschrijding tellen we het
// all-time-eerlijkheidsoverzicht uit een server-side aggregaat (exactCounts).
export const COMPLETION_WINDOW = 2000;

// Voltooiingen-log van het actieve huishouden (SCH-3), met realtime. Voedt het
// eerlijkheidsoverzicht (lib/fairness.js → FairnessBars). Analoog aan useExpenses,
// maar leesgericht: schrijven gebeurt in useTasks.completeTask.
//
// We embedden de parent-taak (tasks!inner) zodat het scherm kan filteren op
// schoonmaaktaken (zone_id is not null) zonder een tweede query. RLS scopet de
// payload vanzelf: een lid ziet alleen voltooiingen van taken die het mag zien.
export function useTaskCompletions() {
  const { activeId } = useHousehold();
  const { user } = useAuth();

  // Stale-while-revalidate: seed uit de cache (PERF-2).
  const key = activeId ? cacheKey('task_completions', activeId) : null;
  const initial = key ? getCached(key) : undefined;
  const [completions, setCompletions] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);
  // Exacte all-time-tellingen per lid (PERF-1). Null zolang het venster niet vol is;
  // alleen dán (>COMPLETION_WINDOW rijen) lazy via de aggregaat-RPC opgehaald.
  const [exactCounts, setExactCounts] = useState(null);

  const load = useCallback(async () => {
    if (!activeId) { setCompletions([]); setExactCounts(null); setLoading(false); return; }
    const data = await run(
      supabase
        .from('task_completions')
        .select('id, completed_by, completed_at, occurrence_date, task:tasks!inner(id, category, zone_id)')
        .eq('household_id', activeId)
        .order('completed_at', { ascending: false })
        .limit(COMPLETION_WINDOW),
      { fallback: [], context: 'voltooiingen laden' }
    );
    const rows = data ?? [];
    setCompletions(rows);
    setCached(cacheKey('task_completions', activeId), rows);
    setLoading(false);

    // Alleen bij een vol venster exacte all-time-tellingen ophalen (PERF-1). Onder
    // de drempel is de client-telling al exact, dus dan geen extra query.
    if (rows.length >= COMPLETION_WINDOW) {
      const counts = await run(
        supabase.rpc('household_completion_totals', { p_household: activeId }),
        { fallback: null, context: 'exacte voltooiingen-totalen laden' }
      );
      setExactCounts(counts ?? null);
    } else {
      setExactCounts(null);
    }
  }, [activeId]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg).
  useEffect(() => {
    if (!key) { setCompletions([]); setLoading(false); return; }
    const cached = getCached(key);
    setCompletions(cached ?? []);
    setLoading(cached === undefined);
  }, [key]);

  // Laden + realtime: herlaad bij wijzigingen op task_completions van dit huishouden.
  useRealtimeReload(load, activeId, [
    { table: 'task_completions', filter: `household_id=eq.${activeId}` },
  ], { name: 'task_completions' });

  return { completions, loading, reload: load, exactCounts, user };
}
