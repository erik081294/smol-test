// Pure jaar-activiteit/heatmap-logica (TKN-2). Bouwt een GitHub-achtig
// bijdrage-raster + een jaarsamenvatting uit de voltooiingen-log:
//   completions: [{ completed_by, completed_at, occurrence_date, task: { category } }]
// Géén React/Supabase (unit-testbaar in node, net als lib/fairness.js / lib/agenda.js).
//
// Eén bucketing-stap (countsByDay) voedt zowel het raster (yearGrid) als de
// samenvatting (yearSummary), zodat tellen op één plek gebeurt. Bedragen zijn hele
// voltooiingen (int). Zie app/(tabs)/taken.js (Jaar-scope) + lib/YearHeatmap.js.
import {
  startOfYear, endOfYear, startOfWeek, endOfWeek, addDays, differenceInCalendarDays,
} from 'date-fns';

// Lokale dagsleutel 'YYYY-MM-DD' uit de lokale kalenderdag van een datum/ISO-string.
// Bewust lokaal (niet UTC): "vandaag" is de dag zoals de gebruiker 'm op het toestel
// ziet. De vaste, nul-gepadde vorm maakt string-vergelijking == chronologische volgorde.
export function localDayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Telt voltooiingen per lokale dag. Optioneel gefilterd op lid (completed_by) en/of
// categorie (task.category) — beide zijn aanwezig in de embedded voltooiing, dus dit
// blijft één query. Rijen zonder bruikbare datum tellen niet mee.  -> Map<dayKey, count>.
export function countsByDay(completions = [], { assigneeId = null, category = null } = {}) {
  const out = new Map();
  for (const c of completions) {
    if (!c || !c.completed_at) continue;
    if (assigneeId && c.completed_by !== assigneeId) continue;
    if (category && (c.task?.category ?? null) !== category) continue;
    const key = localDayKey(c.completed_at);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

// Intensiteitsniveau 0..4 van een dagtelling, geschaald op de drukste dag (max).
// 0 = geen activiteit; 1..4 = oplopend. Bij een lage max (bv. alleen losse dagen met
// telling 1) valt alles op niveau 1 — bewust: één tint i.p.v. een misleidende spreiding.
export function levelFor(count, max) {
  if (!count || count <= 0) return 0;
  if (max <= 1) return 1;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

// Bouwt het raster voor één kalenderjaar: kolommen = weken, rijen 0..6 = weekdagen
// vanaf de weekstart (maandag standaard, NL). Cellen vóór 1 jan / na 31 dec horen bij
// een rand-week en krijgen inYear=false (rustige opvulling, tellen niet mee in de
// schaal). `today` is injecteerbaar voor deterministische tests.
//
// -> { year, weeks: Cell[][], months: [{ monthIndex, col }], maxCount, total, weekStartsOn }
//    Cell = { key, date, count, level, inYear, isToday, isFuture }
export function yearGrid(year, counts = new Map(), { weekStartsOn = 1, today = new Date() } = {}) {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const gridStart = startOfWeek(yearStart, { weekStartsOn });
  const gridEnd = endOfWeek(yearEnd, { weekStartsOn });
  const totalDays = differenceInCalendarDays(gridEnd, gridStart) + 1; // veelvoud van 7
  const todayKey = localDayKey(today);

  // Eerste pas: cellen + schaal (max/total alléén over dagen ín het jaar).
  let maxCount = 0;
  let total = 0;
  const weeks = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = addDays(gridStart, i);
    const key = localDayKey(date);
    const inYear = date.getFullYear() === year;
    const count = inYear ? (counts.get(key) ?? 0) : 0;
    if (inYear) {
      total += count;
      if (count > maxCount) maxCount = count;
    }
    const col = Math.floor(i / 7);
    const row = i % 7;
    if (!weeks[col]) weeks[col] = [];
    weeks[col][row] = {
      key, date, count, inYear, level: 0,
      isToday: key === todayKey,
      isFuture: todayKey != null && key > todayKey, // lexicografisch == chronologisch
    };
  }

  // Tweede pas: niveau invullen (vereist de definitieve maxCount).
  for (const wk of weeks) for (const cell of wk) {
    cell.level = cell.inYear ? levelFor(cell.count, maxCount) : 0;
  }

  // Maandlabels: de kolom waar een nieuwe maand van DÍT jaar begint (op de bovenste
  // cel). De rand-weken (vorig dec / volgend jan) leveren bewust geen label.
  const months = [];
  let lastMonth = -1;
  weeks.forEach((wk, col) => {
    const top = wk[0].date;
    if (top.getFullYear() !== year) return;
    const m = top.getMonth();
    if (m !== lastMonth) { months.push({ monthIndex: m, col }); lastMonth = m; }
  });

  return { year, weeks, months, maxCount, total, weekStartsOn };
}

// Samenvatting over één kalenderjaar:
//   total          — voltooiingen in het jaar
//   activeDays     — dagen met ≥1 voltooiing
//   longestStreak  — langste aaneengesloten reeks actieve dagen in het jaar
//   currentStreak  — reeks actieve dagen die eindigt op de peildag (vandaag bij het
//                    lopende jaar, anders 31 dec); 0 bij een nog niet begonnen jaar
//   bestDay        — { key, count } met de meeste voltooiingen op één dag (of null)
//   busiestWeekday — { weekday, count } weekdag (0=zo..6=za) met de meeste (of null)
//   byWeekday      — [7] totalen per weekdag (0=zo..6=za)
// `today` injecteerbaar voor deterministische tests.
export function yearSummary(counts = new Map(), year, { today = new Date() } = {}) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const daysInYear = differenceInCalendarDays(yearEnd, yearStart) + 1;
  const dayCount = (date) => counts.get(localDayKey(date)) ?? 0;

  let total = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let run = 0;
  let bestDay = null;
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < daysInYear; i += 1) {
    const date = addDays(yearStart, i);
    const count = dayCount(date);
    total += count;
    byWeekday[date.getDay()] += count;
    if (count > 0) {
      activeDays += 1;
      run += 1;
      if (run > longestStreak) longestStreak = run;
      if (!bestDay || count > bestDay.count) bestDay = { key: localDayKey(date), count };
    } else {
      run = 0;
    }
  }

  // Huidige reeks: teruglopen vanaf de peildag. Bij een toekomstig jaar (today vóór
  // 1 jan) is er nog niets; bij een afgelopen jaar eindigt de reeks op 31 dec.
  const todayKey = localDayKey(today);
  const startKey = localDayKey(yearStart);
  const endKey = localDayKey(yearEnd);
  let currentStreak = 0;
  if (todayKey != null && todayKey >= startKey) {
    let cursor = todayKey <= endKey
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : new Date(year, 11, 31);
    while (localDayKey(cursor) >= startKey && dayCount(cursor) > 0) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let busiestWeekday = null;
  for (let w = 0; w < 7; w += 1) {
    if (byWeekday[w] > 0 && (!busiestWeekday || byWeekday[w] > busiestWeekday.count)) {
      busiestWeekday = { weekday: w, count: byWeekday[w] };
    }
  }

  return { total, activeDays, longestStreak, currentStreak, bestDay, busiestWeekday, byWeekday };
}
