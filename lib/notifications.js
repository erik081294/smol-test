// Pure, testbare kern voor herinneringen (PLT-1, trap 1). Bepaalt wélke
// notificaties gepland moeten worden; het daadwerkelijk plannen/cancelen en de
// permissie leven in een (impure) hook met expo-notifications. Géén React/Supabase.
// Zie docs/plans/05-notificaties.md.
import { parseISO, isSameDay, differenceInCalendarDays } from 'date-fns';

// Combineer due_date (+ optionele due_time) tot een concrete Date. Zonder tijd:
// default 09:00 lokaal. null als er geen datum is.
function dueDateTime(task) {
  if (!task.due_date) return null;
  const time = task.due_time ? task.due_time.slice(0, 5) : '09:00';
  return parseISO(`${task.due_date}T${time}:00`);
}

// Stabiele notificatie-id per taak-occurrence: bevat de due_date, zodat een
// doorrollende taak automatisch zijn oude geplande notificatie vervangt.
export function reminderId(task) {
  return `task:${task.id}:${task.due_date ?? ''}`;
}

const bodyFor = (task) => (task.notes ? task.notes : 'Herinnering');

// Welke herinneringen plannen we? Alleen open, gedateerde taken met een fireAt
// in de toekomst. leadMinutes plant de melding zoveel minuten vóór de vervaltijd.
// -> [{ taskId, fireAt: Date, title, body }] gesorteerd op fireAt.
export function plannedReminders(tasks = [], { now = new Date(), leadMinutes = 0 } = {}) {
  const out = [];
  for (const t of tasks) {
    if (t.completed_at || !t.due_date) continue;
    const at = dueDateTime(t);
    if (!at || Number.isNaN(+at)) continue;
    const fireAt = new Date(at.getTime() - leadMinutes * 60000);
    if (fireAt <= now) continue;
    out.push({ taskId: t.id, fireAt, title: t.title, body: bodyFor(t) });
  }
  out.sort((a, b) => a.fireAt - b.fireAt);
  return out;
}

// Tekst voor de dagelijkse samenvatting op `day`. null als er niets te melden is.
export function dailySummary(tasks = [], day = new Date()) {
  const due = tasks.filter((t) => !t.completed_at && t.due_date && isSameDay(parseISO(t.due_date), day));
  if (due.length === 0) return null;
  const n = due.length;
  return { title: 'Vandaag', body: `${n} ${n === 1 ? 'taak' : 'taken'} voor vandaag` };
}

// Diner-herinnering per geplande maaltijd: op een vast tijdstip (default 16:30) op
// de dag zelf. Eén per dag (eerste diner wint). Alleen toekomstige momenten.
//   entries: [{ plan_date, meal_type, title, recipe }]
// -> [{ id, fireAt, title, body }]
export function mealReminders(entries = [], { now = new Date(), time = '16:30' } = {}) {
  const out = [];
  const seen = new Set();
  for (const e of entries) {
    if (e.meal_type !== 'diner' || !e.plan_date || seen.has(e.plan_date)) continue;
    const at = parseISO(`${e.plan_date}T${time}:00`);
    if (Number.isNaN(+at) || at <= now) continue;
    seen.add(e.plan_date);
    const what = e.recipe?.title || e.title || 'Eten';
    out.push({ id: `meal:${e.plan_date}`, fireAt: at, title: 'Wat eten we?', body: `Vanavond: ${what}` });
  }
  out.sort((a, b) => a.fireAt - b.fireAt);
  return out;
}

// Voorraad-alert: één gebundelde melding als er producten (bijna) over de datum
// zijn, gepland op de eerstvolgende `time` (vandaag als die nog komt, anders morgen).
//   items: [{ best_before }]
// -> [] of [{ id, fireAt, title, body }]
export function pantryAlerts(items = [], { now = new Date(), time = '08:00', soonDays = 2 } = {}) {
  const urgent = items.filter((it) => {
    if (!it.best_before) return false;
    return differenceInCalendarDays(parseISO(it.best_before), now) <= soonDays;
  });
  if (urgent.length === 0) return [];
  const [hh, mm] = String(time).split(':').map(Number);
  let at = new Date(now); at.setHours(hh || 0, mm || 0, 0, 0);
  if (at <= now) at = new Date(at.getTime() + 86400000);
  const n = urgent.length;
  return [{
    id: 'pantry:daily', fireAt: at, title: 'Voorraad',
    body: `${n} ${n === 1 ? 'product is' : 'producten zijn'} (bijna) over de datum`,
  }];
}

// Verzamel alle te plannen herinneringen (taken/plantzorg/maaltijden/voorraad),
// gefilterd op de per-domein-voorkeuren (default-on). Eén uniforme vorm met een
// stabiele `id` zodat de hook idempotent kan herplannen.
//   prefs: { taken?, plantzorg?, maaltijden?, voorraad?, leadMinutes?, mealReminderTime?, dailySummaryTime? }
// -> [{ id, fireAt, title, body }] gesorteerd op fireAt.
export function allReminders({ tasks = [], meals = [], pantry = [] } = {}, prefs = {}, now = new Date()) {
  const on = (k) => prefs[k] !== false; // default-on
  const out = [];
  for (const t of tasks) {
    if (t.completed_at || !t.due_date) continue;
    if (!on(t.plant_id ? 'plantzorg' : 'taken')) continue;
    const at = dueDateTime(t);
    if (!at || Number.isNaN(+at)) continue;
    const fireAt = new Date(at.getTime() - (prefs.leadMinutes ?? 0) * 60000);
    if (fireAt <= now) continue;
    out.push({ id: reminderId(t), fireAt, title: t.title, body: bodyFor(t) });
  }
  if (on('maaltijden')) out.push(...mealReminders(meals, { now, time: prefs.mealReminderTime ?? '16:30' }));
  if (on('voorraad')) out.push(...pantryAlerts(pantry, { now, time: prefs.dailySummaryTime ?? '08:00' }));
  out.sort((a, b) => a.fireAt - b.fireAt);
  return out;
}
