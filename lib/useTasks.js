import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { nextDueDate } from './recurrence';
import { run, mutate } from './db';

export function useTasks() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setTasks([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('tasks')
        .select('*')
        .eq('household_id', activeId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      { fallback: [], context: 'taken laden' }
    );
    setTasks(data ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: luister naar wijzigingen voor dit huishouden
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`tasks:${activeId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `household_id=eq.${activeId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, load]);

  const addTask = async (payload) => {
    await mutate(
      supabase.from('tasks').insert({ ...payload, household_id: activeId, created_by: user.id }),
      { context: 'taak toevoegen' }
    );
  };

  const updateTask = async (id, patch) => {
    await mutate(supabase.from('tasks').update(patch).eq('id', id), { context: 'taak bijwerken' });
  };

  const deleteTask = async (id) => {
    await mutate(supabase.from('tasks').delete().eq('id', id), { context: 'taak verwijderen' });
  };

  // Afvinken. Bij terugkerende taken: maak de volgende op en houd deze "open".
  const completeTask = async (task) => {
    if (task.recur_freq && task.due_date) {
      const next = nextDueDate(task);
      if (next) {
        await mutate(
          supabase.from('tasks').update({
            due_date: format(next, 'yyyy-MM-dd'),
            completed_at: null,
            completed_by: null,
          }).eq('id', task.id),
          { context: 'terugkerende taak doorzetten' }
        );
        return;
      }
    }
    await mutate(
      supabase.from('tasks').update({
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      }).eq('id', task.id),
      { context: 'taak afvinken' }
    );
  };

  const uncompleteTask = async (id) => {
    await mutate(
      supabase.from('tasks').update({ completed_at: null, completed_by: null }).eq('id', id),
      { context: 'taak heropenen' }
    );
  };

  return { tasks, loading, reload: load, addTask, updateTask, deleteTask, completeTask, uncompleteTask };
}
