import { format } from 'date-fns';
import { useCollection } from './useCollection';
import { nextDueDate } from './recurrence';

// Taken-module bovenop de generieke useCollection-hook. Alleen de taak-specifieke
// logica (afvinken met doorrollen van terugkerende taken) leeft hier nog; laden,
// realtime en de gewone CRUD komen uit useCollection.
export function useTasks() {
  const c = useCollection('tasks', {
    label: 'taken',
    order: [
      { column: 'due_date', ascending: true, nullsFirst: false },
      { column: 'created_at', ascending: true },
    ],
  });

  // Afvinken. Bij terugkerende taken: zet de volgende vervaldatum en houd 'm "open".
  const completeTask = async (task) => {
    if (task.recur_freq && task.due_date) {
      const next = nextDueDate(task);
      if (next) {
        return c.update(task.id, {
          due_date: format(next, 'yyyy-MM-dd'),
          completed_at: null,
          completed_by: null,
        });
      }
    }
    return c.update(task.id, {
      completed_at: new Date().toISOString(),
      completed_by: c.user.id,
    });
  };

  const uncompleteTask = (id) =>
    c.update(id, { completed_at: null, completed_by: null });

  return {
    tasks: c.items,
    loading: c.loading,
    reload: c.reload,
    addTask: c.create,
    updateTask: c.update,
    deleteTask: c.remove,
    completeTask,
    uncompleteTask,
  };
}
