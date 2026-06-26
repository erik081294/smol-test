// @ts-check
// Pure prijstracker-logica (BOO-3). Werkt op de bonregels van één product:
//   items: [{ purchased_on, store, unit_price_cents }]
// Géén React/Supabase. Bedragen in hele centen (int). Zie
// docs/plans/02-boodschappen-intelligentie.md.
import { parseISO, differenceInCalendarDays } from 'date-fns';

const toDate = (d) => (d instanceof Date ? d : parseISO(String(d)));

// Genormaliseerde, gesorteerde reeks (oud -> nieuw). Filtert regels zonder prijs/datum.
export function series(items = []) {
  return items
    .filter((i) => i && i.unit_price_cents != null && i.purchased_on)
    .map((i) => ({ date: toDate(i.purchased_on), store: i.store ?? null, cents: i.unit_price_cents }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Laatste bekende prijs per winkel. -> { [store]: { cents, date } }  (lege winkel = '').
export function latestPerStore(items = []) {
  const out = {};
  for (const p of series(items)) {
    const key = p.store ?? '';
    if (!out[key] || p.date >= out[key].date) out[key] = { cents: p.cents, date: p.date };
  }
  return out;
}

// Kerncijfers in centen. Lege input -> veilige nullen.
export function stats(items = []) {
  const s = series(items);
  if (s.length === 0) return { min: null, max: null, latest: null, count: 0 };
  const cents = s.map((p) => p.cents);
  return { min: Math.min(...cents), max: Math.max(...cents), latest: s[s.length - 1].cents, count: s.length };
}

// Trend in %: laatste vs. eerste prijs binnen `days` (of alles als days=null).
// null bij minder dan 2 datapunten of een eerste prijs van 0.
export function trendPct(items = [], days = 90, now = new Date()) {
  let s = series(items);
  if (days != null) s = s.filter((p) => differenceInCalendarDays(now, p.date) <= days);
  if (s.length < 2) return null;
  const first = s[0].cents, last = s[s.length - 1].cents;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}
