import { addDays, addWeeks, addMonths, format, parseISO, isToday, isPast, isTomorrow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { RECUR } from './constants';

// Bereken de volgende vervaldatum voor een terugkerende taak.
// task: { due_date, recur_freq, recur_interval, recur_weekdays }
export function nextDueDate(task) {
  if (!task.recur_freq || !task.due_date) return null;
  const base = parseISO(task.due_date);
  const n = task.recur_interval || 1;

  if (task.recur_freq === RECUR.DAILY) return addDays(base, n);
  if (task.recur_freq === RECUR.MONTHLY) return addMonths(base, n);

  if (task.recur_freq === RECUR.WEEKLY) {
    // Met specifieke weekdagen: zoek de eerstvolgende geselecteerde dag.
    if (task.recur_weekdays?.length) {
      const days = [...task.recur_weekdays].sort((a, b) => a - b);
      let cur = addDays(base, 1);
      for (let i = 0; i < 14; i++) {
        if (days.includes(cur.getDay())) return cur;
        cur = addDays(cur, 1);
      }
    }
    return addWeeks(base, n);
  }
  return null;
}

export function recurrenceLabel(task) {
  if (!task.recur_freq) return 'Eenmalig';
  const n = task.recur_interval || 1;
  const wd = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  if (task.recur_freq === RECUR.DAILY) return n === 1 ? 'Elke dag' : `Elke ${n} dagen`;
  if (task.recur_freq === RECUR.MONTHLY) return n === 1 ? 'Elke maand' : `Elke ${n} maanden`;
  if (task.recur_freq === RECUR.WEEKLY) {
    if (task.recur_weekdays?.length) {
      const labels = task.recur_weekdays.sort((a,b)=>a-b).map((d) => wd[d]).join(', ');
      return `Wekelijks: ${labels}`;
    }
    return n === 1 ? 'Elke week' : `Elke ${n} weken`;
  }
  return 'Eenmalig';
}

export function dueLabel(task) {
  if (!task.due_date) return null;
  const d = parseISO(task.due_date);
  const time = task.due_time ? ` · ${task.due_time.slice(0, 5)}` : '';
  if (isToday(d)) return `Vandaag${time}`;
  if (isTomorrow(d)) return `Morgen${time}`;
  return format(d, 'EEE d MMM', { locale: nl }) + time;
}

export function isOverdue(task) {
  if (!task.due_date || task.completed_at) return false;
  const d = parseISO(task.due_date);
  return isPast(d) && !isToday(d);
}
