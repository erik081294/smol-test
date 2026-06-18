import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run } from './db';

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
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setCompletions([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('task_completions')
        .select('id, completed_by, completed_at, occurrence_date, task:tasks!inner(id, category, zone_id)')
        .eq('household_id', activeId)
        .order('completed_at', { ascending: false }),
      { fallback: [], context: 'voltooiingen laden' }
    );
    setCompletions(data ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: herlaad bij wijzigingen op task_completions van dit huishouden.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    if (!activeId) return;
    const topic = `task_completions:${activeId}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(topic)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions', filter: `household_id=eq.${activeId}` },
        () => loadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  return { completions, loading, reload: load, user };
}
