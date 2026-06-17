// Pure, testbare helpers voor de Agenda-module. Géén React/Supabase en bewust
// géén externe kalender-library: het maandgrid is gewoon te berekenen met
// date-fns (al een dependency), en zo blijft de logica los te unit-testen.
//
// De agenda is een weergavelaag over `tasks`: elke taak met een due_date staat
// op de kalender. RLS heeft de zichtbaarheid al gefilterd voordat dit draait;
// filterBySubgroup() is alleen een focus-filter in de UI.
import { format, parseISO, startOfMonth, startOfWeek, addDays, isSameMonth } from 'date-fns';
import { nl } from 'date-fns/locale';

// Categorie-prioriteit voor de dag-stip: een afspraak is op de agenda het meest
// "agenda-achtig", daarna klussen/schoonmaak, dan de rest. Bepaalt welke kleur
// een dag met meerdere items krijgt.
export const AGENDA_CATEGORY_PRIORITY = ['afspraak', 'klus', 'huishouden', 'plant', 'overig'];

// Datumsleutel zoals tasks.due_date die opslaat (een `date`, lokaal, geen UTC-shift).
export function dateKey(date) {
  return typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
}

// Het maandgrid: 6 rijen × 7 dagen (ma–zo), inclusief de uitlopers van de vorige/
// volgende maand zodat de grid altijd rechthoekig is. Geeft per cel { date, key,
// inMonth }.  month is 0-gebaseerd (0 = januari), net als Date.getMonth().
// Altijd 6 rijen, ook als de maand in 5 weken past — zo springt de layout niet
// tussen maanden. De overtollige laatste week valt vanzelf in de volgende maand
// (inMonth=false) en kan in de UI gedimd worden.
export function monthMatrix(year, month) {
  const first = startOfMonth(new Date(year, month, 1));
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });

  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, key: dateKey(cursor), inMonth: isSameMonth(cursor, first) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Alleen de taken met een due_date (de rest hoort niet op de kalender).
export function datedTasks(tasks) {
  return (tasks ?? []).filter((t) => t.due_date);
}

// Groepeer dated tasks naar { 'yyyy-MM-dd': [task, ...] }.
export function groupByDate(tasks) {
  const out = {};
  for (const t of datedTasks(tasks)) {
    (out[t.due_date] ??= []).push(t);
  }
  return out;
}

// Focus-filter op subgroep. null/undefined = "Iedereen": toon alles wat zichtbaar is.
// Een concrete subgroep = alleen items die expliciet met díe subgroep zijn gedeeld
// (Tims voetbaltraining onder "Voetbal Tim"). Household-/custom-items vallen dan weg,
// die zie je onder "Iedereen".
export function filterBySubgroup(tasks, subgroupId) {
  if (!subgroupId) return tasks ?? [];
  return (tasks ?? []).filter((t) => t.share_subgroup_id === subgroupId);
}

// De "zwaarste" categorie van een set dag-taken, voor de kleur van de stip.
// null als er geen taken zijn.
export function dominantCategory(dayTasks) {
  if (!dayTasks?.length) return null;
  for (const cat of AGENDA_CATEGORY_PRIORITY) {
    if (dayTasks.some((t) => t.category === cat)) return cat;
  }
  return dayTasks[0].category ?? 'overig';
}

// Sorteer dag-taken op tijd (items zonder tijd onderaan), dan op titel.
export function sortDayTasks(dayTasks) {
  return [...(dayTasks ?? [])].sort((a, b) => {
    const ta = a.due_time ?? '99:99';
    const tb = b.due_time ?? '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

// Leesbaar maandlabel, bijv. "juni 2026".
export function monthLabel(year, month) {
  return format(new Date(year, month, 1), 'LLLL yyyy', { locale: nl });
}

// Helper voor de UI: parse een 'yyyy-MM-dd' sleutel naar een Date zonder tijdzone-gedoe.
export function parseKey(key) {
  return parseISO(key + 'T00:00:00');
}
