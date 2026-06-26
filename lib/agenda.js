// @ts-check
// Pure, testbare helpers voor de Agenda-module. Géén React/Supabase en bewust
// géén externe kalender-library: het maandgrid is gewoon te berekenen met
// date-fns (al een dependency), en zo blijft de logica los te unit-testen.
//
// De agenda is een weergavelaag over `tasks`: elke taak met een due_date staat
// op de kalender. RLS heeft de zichtbaarheid al gefilterd voordat dit draait;
// filterBySubgroup() is alleen een focus-filter in de UI.
import { format, parseISO, startOfMonth, startOfWeek, addDays, isSameMonth } from 'date-fns';
import { VISIBILITY } from './constants';
import { dateLocale } from './i18n';

// === Tijdscope-helpers (TKN-1) ===========================================
// Dezelfde takenlijst, anders gegroepeerd per scope (Dag/Week/Maand). Alles puur
// en O(n) over de al-geladen lijst — geen extra queries. RLS/subgroep-filter is
// al toegepast vóór dit draait.

// Dag-scope: taken óp `date` (matchende due_date) + taken zónder datum.
export function groupByDay(tasks, date) {
  const key = dateKey(date);
  const dated = [];
  const undated = [];
  for (const tk of tasks ?? []) {
    if (!tk.due_date) undated.push(tk);
    else if (tk.due_date === key) dated.push(tk);
  }
  return { dated, undated };
}

// De 7 dagen (maandag-start) van de week rond `date`. `today` is injecteerbaar zodat
// de helper puur/testbaar blijft (de UI geeft de echte vandaag mee).
export function weekDays(date, today = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const todayKey = dateKey(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const key = dateKey(d);
    return { date: d, key, isToday: key === todayKey };
  });
}

// Week-scope: taken per dag-sleutel voor de 7 dagen van de week rond `date`.
export function groupByWeek(tasks, date) {
  const out = {};
  for (const d of weekDays(date)) out[d.key] = [];
  for (const tk of tasks ?? []) {
    if (tk.due_date && Object.prototype.hasOwnProperty.call(out, tk.due_date)) out[tk.due_date].push(tk);
  }
  return out;
}

// === Filter-helpers (TKN-3) ==============================================
// Schaalbare, compose-bare filtering over meerdere assen (categorie, persoon,
// subgroep, status). Alles puur; de UI houdt alleen de filterstaat bij.

export const isOpen = (t) => !t.completed_at;
export const isDone = (t) => !!t.completed_at;
export const inCategory = (key) => (t) => t.category === key;
export const forAssignee = (id) => (t) => t.assigned_to === id;

const asSet = (v) => (v instanceof Set ? v : new Set(v ?? []));

// "Voor mij" (UX, batch 2): een taak is voor de viewer als 'ie aan hem is toegewezen,
// door hem is gemaakt, óf expliciet met hem gedeeld (custom share_with). Een gewone
// huishoud-taak die aan niemand of aan een ander hangt valt buiten "voor mij" — maar
// blijft wel zichtbaar onder "Iedereen". Zonder viewer-id filteren we niet (alles voor
// mij). Spiegelt bewust de "gedeeld met mij"-helft van canView (lib/visibility.js).
export function forMe(task, viewerId) {
  if (!viewerId) return true;
  if (task.assigned_to === viewerId) return true;
  if (task.created_by === viewerId) return true;
  if (task.visibility === VISIBILITY.CUSTOM && (task.share_with ?? []).includes(viewerId)) return true;
  return false;
}

// Eén filter-object toepassen. Een lege/default as wordt genegeerd, zodat assen
// vrij te combineren zijn. `status`: 'open' (default) | 'done' | 'all'.
// `audience`: 'all' (default) | 'mine' — bij 'mine' blijft alleen forMe() over.
export function applyTaskFilters(tasks, { categories = [], assignees = [], subgroupId = null, tagIds = [], status = 'open', audience = 'all', viewerId = null } = {}) {
  const cats = asSet(categories);
  const asgn = asSet(assignees);
  const tags = asSet(tagIds);
  return (tasks ?? []).filter((t) => {
    if (status === 'open' && t.completed_at) return false;
    if (status === 'done' && !t.completed_at) return false;
    if (cats.size && !cats.has(t.category)) return false;
    if (asgn.size && !asgn.has(t.assigned_to)) return false;
    if (subgroupId && t.share_subgroup_id !== subgroupId) return false;
    // Tags: OR binnen de as — een taak matcht als 'ie minstens één gekozen tag draagt.
    if (tags.size && !(t.tag_ids ?? []).some((id) => tags.has(id))) return false;
    if (audience === 'mine' && !forMe(t, viewerId)) return false;
    return true;
  });
}

// Generieke teller voor badge-getallen: keyFn → { [key]: aantal }. Null-keys tellen niet.
export function countBy(tasks, keyFn) {
  const out = {};
  for (const t of tasks ?? []) {
    const k = keyFn(t);
    if (k == null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// Aantal niet-default assen — de teller op de filterknop. 'open' is de default-status.
export function activeFilterCount({ categories = [], assignees = [], subgroupId = null, tagIds = [], status = 'open' } = {}) {
  let n = 0;
  if (asSet(categories).size) n += 1;
  if (asSet(assignees).size) n += 1;
  if (subgroupId) n += 1;
  if (asSet(tagIds).size) n += 1;
  if (status !== 'open') n += 1;
  return n;
}

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
  return format(new Date(year, month, 1), 'LLLL yyyy', { locale: dateLocale() });
}

// Helper voor de UI: parse een 'yyyy-MM-dd' sleutel naar een Date zonder tijdzone-gedoe.
export function parseKey(key) {
  return parseISO(key + 'T00:00:00');
}

// === Maand-/Jaar-lijst (TKN-1, UX-32) ====================================
// De Maand- en Jaar-scope van Taken tonen géén kalender meer maar een gewone
// lijst, net als Dag/Week. Deze helpers leveren de te tonen periodes (per dag in
// een maand, per maand in een jaar) zodat het scherm er secties van kan maken.

// Maandsleutel 'yyyy-MM' (de eerste 7 tekens van een datumsleutel).
export function monthKey(date) {
  return dateKey(date).slice(0, 7);
}

// De échte dagen van een maand (1..laatste), als { date, key } — geen uitlopers,
// anders dan monthMatrix (dat is voor het grid). month is 0-gebaseerd.
export function monthDays(year, month) {
  const count = new Date(year, month + 1, 0).getDate();
  const out = [];
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d);
    out.push({ date, key: dateKey(date) });
  }
  return out;
}

// De twaalf maanden van een jaar, als { month, key:'yyyy-MM', date, label }.
export function yearMonths(year) {
  const out = [];
  for (let m = 0; m < 12; m++) {
    const date = new Date(year, m, 1);
    out.push({ month: m, key: monthKey(date), date, label: monthLabel(year, m) });
  }
  return out;
}

// Groepeer dated tasks naar { 'yyyy-MM': [task, ...] } (maand-granulariteit).
export function groupByMonth(tasks) {
  const out = {};
  for (const t of datedTasks(tasks)) {
    const k = monthKey(t.due_date);
    (out[k] ??= []).push(t);
  }
  return out;
}

// === Navigatie (UX-28) ===================================================
// Waar een taak naartoe navigeert bij tikken. Een taak die via een module is
// ontstaan opent het bron-element in díe module (plant/huisdier-detail, of het
// Schoonmaak-scherm voor een zone-taak); een handmatige afspraak opent de editor.
// Zo voorkomen we "parallelle werelden" (een plant-taak losgezongen van zijn plant).
export function taskHref(task) {
  if (!task) return null;
  if (task.plant_id) return `/plant/${task.plant_id}`;
  if (task.pet_id) return `/pet/${task.pet_id}`;
  if (task.zone_id) return '/(tabs)/schoonmaak';
  return `/task/${task.id}`;
}
