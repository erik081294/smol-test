// Pure samenvattings-afleidingen per widget (VDG-7). Geen React/Supabase: de
// widget-componenten roepen hun module-hook aan en voeden de ruwe data hierin, zodat
// de berekening los te unit-testen is. Alle datum-logica neemt een injecteerbare
// `now` zodat tests deterministisch zijn.

import { format, parseISO, startOfDay, addDays, isBefore } from 'date-fns';
import { computeBalances } from '../expenses';
import { status, PANTRY_STATUS } from '../pantry';

const dayKey = (d) => format(d, 'yyyy-MM-dd');

// yyyy-MM-dd vergelijkt lexicaal correct, dus geen tijdzone-gedoe.
function overdueOpen(tasks, now) {
  const key = dayKey(now);
  return (tasks ?? []).filter((t) => !t.completed_at && t.due_date && t.due_date < key);
}
function todayOpen(tasks, now) {
  const key = dayKey(now);
  return (tasks ?? []).filter((t) => !t.completed_at && t.due_date === key);
}

// Taken — focus: achterstallig + vandaag (afvinkbaar in de widget).
export function taskFocusSummary(tasks, now = new Date()) {
  const overdue = overdueOpen(tasks, now);
  const today = todayOpen(tasks, now);
  return { overdue: overdue.length, today: today.length, count: overdue.length + today.length, items: [...overdue, ...today] };
}

// Taken — voortgang: hoeveel van de voor-vandaag-geplande taken al af zijn.
export function taskProgressSummary(tasks, now = new Date()) {
  const key = dayKey(now);
  const todays = (tasks ?? []).filter((t) => t.due_date === key);
  const done = todays.filter((t) => t.completed_at).length;
  return { done, total: todays.length };
}

// Boodschappen — te halen + eerste namen.
export function groceriesSummary(items) {
  const open = (items ?? []).filter((i) => !i.checked);
  return { count: open.length, names: open.slice(0, 3).map((i) => i.name) };
}

// Kosten — jouw saldo (in centen; >0 = jij krijgt, <0 = jij betaalt nog).
export function expenseBalanceSummary(expenses, userId) {
  return { cents: computeBalances(expenses ?? [])[userId] ?? 0 };
}

// Planten — planten die vandaag/achterstallig water willen (via gekoppelde taken).
export function plantsSummary(plants, tasks, now = new Date()) {
  const key = dayKey(now);
  const ids = new Set();
  for (const t of tasks ?? []) {
    if (!t.plant_id || t.completed_at || !t.due_date) continue;
    if (t.due_date <= key) ids.add(t.plant_id);
  }
  const needy = (plants ?? []).filter((p) => ids.has(p.id));
  return { count: needy.length, names: needy.slice(0, 3).map((p) => p.name) };
}

// Agenda — taken met een datum in de komende week (na vandaag).
export function agendaSummary(tasks, now = new Date()) {
  const key = dayKey(now);
  const horizon = addDays(startOfDay(now), 8);
  const upcoming = (tasks ?? [])
    .filter((t) => !t.completed_at && t.due_date && t.due_date > key)
    .filter((t) => isBefore(parseISO(`${t.due_date}T00:00:00`), horizon))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  return { count: upcoming.length, next: upcoming[0] ?? null };
}

// Voorraad — producten die bijna op / over datum zijn.
export function pantrySummary(items) {
  const urgent = (items ?? []).filter((i) => [PANTRY_STATUS.EXPIRED, PANTRY_STATUS.SOON, PANTRY_STATUS.LOW].includes(status(i)));
  return { count: urgent.length, names: urgent.slice(0, 3).map((p) => p.name) };
}

// Schoonmaak — open zone-taken.
export function cleaningSummary(tasks) {
  return { count: (tasks ?? []).filter((t) => t.zone_id && !t.completed_at).length };
}
