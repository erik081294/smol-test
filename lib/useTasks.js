import { format } from 'date-fns';
import { supabase } from './supabase';
import { mutate } from './db';
import { useCollection } from './useCollection';
import { nextDueDate } from './recurrence';
import { nextAssignee } from './rotation';

// Taken-module bovenop de generieke useCollection-hook. Alleen de taak-specifieke
// logica (afvinken met doorrollen van terugkerende taken, voltooiingen-log en
// beurtrotatie) leeft hier nog; laden, realtime en de gewone CRUD komen uit
// useCollection.
export function useTasks() {
  const c = useCollection('tasks', {
    label: 'taken',
    // Embed de zone (naam/emoji) zodat een schoonmaaktaak overal — Taken, Vandaag,
    // Agenda — herkenbaar bij zijn ruimte hoort, niet alleen op het Schoonmaak-scherm.
    select: '*, zone:zones ( id, name, emoji )',
    order: [
      { column: 'due_date', ascending: true, nullsFirst: false },
      { column: 'created_at', ascending: true },
    ],
  });

  // Schrijft één rij in de voltooiingen-log (SCH-3). Eén rij per afvink-actie,
  // ook voor doorrollende terugkerende taken — die zouden anders geen historie
  // achterlaten, want completeTask wist completed_at/by bij het doorrollen.
  const logCompletion = (task) => mutate(
    supabase.from('task_completions').insert({
      household_id: task.household_id,
      task_id: task.id,
      completed_by: c.user.id,
      occurrence_date: task.due_date ?? null,
    }),
    { context: 'voltooiing loggen' }
  );

  // Afvinken. Bij terugkerende taken: zet de volgende vervaldatum en houd 'm "open".
  // De zichtbare statuswijziging (c.update) gaat optimistisch eerst zodat de tik
  // direct voelt; het loggen van de beurt volgt erna. Faalt het loggen, dan is de
  // taak al afgevinkt maar de beurt niet gelogd — een zeldzaam, niet-kritiek gat
  // dat we accepteren in ruil voor een responsieve afvinkactie.
  const completeTask = async (task) => {
    let patch;
    if (task.recur_freq && task.due_date) {
      const next = nextDueDate(task);
      if (next) {
        patch = { due_date: format(next, 'yyyy-MM-dd'), completed_at: null, completed_by: null };
        // Beurtrotatie (KLU-4): bij het doorrollen springt de toewijzing naar
        // de volgende in de lijst. Alleen zinvol bij een doorrollende taak.
        if (task.rotation?.length) {
          patch.assigned_to = nextAssignee(task.rotation, task.assigned_to);
        }
      }
    }
    if (!patch) {
      patch = { completed_at: new Date().toISOString(), completed_by: c.user.id };
    }
    const updated = c.update(task.id, patch);
    await logCompletion(task);
    return updated;
  };

  // Terugdraaien van een eenmalige afvink-actie: wis de markering én verwijder de
  // laatste log-rij (anders telt een per ongeluk afgevinkte taak mee in SCH-3).
  // Terugkerende taken rollen door en hebben geen completed_at om te wissen.
  const uncompleteTask = async (id) => {
    const updated = c.update(id, { completed_at: null, completed_by: null });
    await mutate(
      supabase.from('task_completions')
        .delete().eq('task_id', id)
        .order('completed_at', { ascending: false }).limit(1),
      { context: 'voltooiing terugdraaien' }
    );
    return updated;
  };

  return {
    tasks: c.items,
    loading: c.loading,
    reload: c.reload,
    addTask: c.create,
    updateTask: c.update,
    deleteTask: c.remove,
    deleteTasks: c.removeMany,
    completeTask,
    uncompleteTask,
  };
}
