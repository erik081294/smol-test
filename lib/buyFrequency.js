// Pure heuristiek voor aankoopfrequentie (BOO-8). Geen React/Supabase.
//
// Uit de bonhistorie (purchase_items.product_id + purchases.purchased_on) leiden we
// af dat je een product ~elke N dagen koopt, als een **zachte, uitlegbare** suggestie
// ("meestal om de ~14 dagen — voor het laatst 12 dagen geleden"). Bewust simpel: een
// mediaan-interval (robuuster dan een gemiddelde bij uitschieters), géén voorspelling.
//
// Grens met VOO-1 (voorraad-urgentie): die kijkt naar houdbaarheid/drempel
// ("bijna op/verlopen"); BOO-8 kijkt naar het historische koopinterval ("je koopt
// dit normaal nu weer"). Complementair, niet dubbel.

import { t } from './i18n';

const DAY = 86400000;

// Datum/ISO-string → lokale dag-timestamp (middernacht) in ms, of null bij ongeldig.
function dayMs(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isoDay(ms) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Sorteer aankoopdatums tot unieke dag-timestamps (oplopend).
function sortedDays(dates) {
  return [...(dates ?? [])].map(dayMs).filter((x) => x != null).sort((a, b) => a - b);
}

// Intervallen (hele dagen) tussen opeenvolgende aankoopdatums.
export function purchaseIntervals(dates) {
  const days = sortedDays(dates);
  const out = [];
  for (let i = 1; i < days.length; i++) out.push(Math.round((days[i] - days[i - 1]) / DAY));
  return out;
}

// Schatting o.b.v. het mediaan-interval. Null bij < 2 aankopen.
//  -> { count, medianDays, lastPurchasedOn, daysSince, dueScore }
//  dueScore = daysSince / medianDays  (>= 1 ~ "weer tijd").
export function frequencyEstimate(dates, now = new Date()) {
  const days = sortedDays(dates);
  if (days.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < days.length; i++) intervals.push((days[i] - days[i - 1]) / DAY);
  const medianDays = Math.round(median(intervals));
  const last = days[days.length - 1];
  const today = dayMs(now);
  const daysSince = Math.round((today - last) / DAY);
  const dueScore = medianDays > 0 ? daysSince / medianDays : 0;
  return { count: days.length, medianDays, lastPurchasedOn: isoDay(last), daysSince, dueScore };
}

// Uitlegbaar label, of null bij geen bruikbare schatting. "meestal om de ~14 dagen".
export function frequencyLabel(est) {
  if (!est || !est.medianDays) return null;
  return t('groceries.again.label', { n: est.medianDays });
}
