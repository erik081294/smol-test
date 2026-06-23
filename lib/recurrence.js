import { addDays, addWeeks, addMonths, format, parseISO, isToday, isPast, isTomorrow, startOfDay, isBefore } from 'date-fns';
import { RECUR } from './constants';
import { t, plural, dateLocale } from './i18n';

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
  if (!task.recur_freq) return t('recur.once');
  const n = task.recur_interval || 1;
  if (task.recur_freq === RECUR.DAILY) return plural(n, 'recur.daily.one', 'recur.daily.other');
  if (task.recur_freq === RECUR.MONTHLY) return plural(n, 'recur.monthly.one', 'recur.monthly.other');
  if (task.recur_freq === RECUR.WEEKLY) {
    if (task.recur_weekdays?.length) {
      const labels = [...task.recur_weekdays].sort((a, b) => a - b).map((d) => t(`weekday.min.${d}`)).join(', ');
      return t('recur.weekly.days', { days: labels });
    }
    return plural(n, 'recur.weekly.one', 'recur.weekly.other');
  }
  return t('recur.once');
}

export function dueLabel(task) {
  if (!task.due_date) return null;
  const d = parseISO(task.due_date);
  const time = task.due_time ? ` · ${task.due_time.slice(0, 5)}` : '';
  if (isToday(d)) return `${t('due.today')}${time}`;
  if (isTomorrow(d)) return `${t('due.tomorrow')}${time}`;
  return format(d, 'EEE d MMM', { locale: dateLocale() }) + time;
}

export function isOverdue(task) {
  if (!task.due_date || task.completed_at) return false;
  const d = parseISO(task.due_date);
  return isPast(d) && !isToday(d);
}

// "Uitstellen" (rechts-swipe op een taak): schuif de vervaldatum vooruit. Telt
// vanaf de láátste van vandaag/de huidige datum, zodat een achterstallige of
// datumloze taak naar morgen gaat (niet naar een dag in het verleden + 1) en een
// taak in de toekomst gewoon zijn eigen datum + `byDays` krijgt. Geeft een
// 'yyyy-MM-dd'-string terug (zelfde vorm als due_date).
export function snoozeDate(task = {}, byDays = 1, now = new Date()) {
  const today = startOfDay(now);
  const due = task?.due_date ? startOfDay(parseISO(task.due_date)) : null;
  const base = due && !isBefore(due, today) ? due : today;
  return format(addDays(base, byDays), 'yyyy-MM-dd');
}
