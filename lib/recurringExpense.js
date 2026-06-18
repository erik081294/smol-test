// Pure herhaal-datumlogica voor terugkerende uitgaven (KOS-4). Volgt dezelfde
// freq/interval-conventie als lib/recurrence.js. Géén React/Supabase. Zie
// docs/plans/04-kosten-autodelen.md.
import { addDays, addWeeks, addMonths, parseISO } from 'date-fns';
import { RECUR } from './constants';

const toDate = (d) => (d instanceof Date ? d : parseISO(String(d)));
const KNOWN = [RECUR.DAILY, RECUR.WEEKLY, RECUR.MONTHLY];

// Volgende datum na `date` voor een freq/interval. Onbekende freq -> ongewijzigd.
export function advance(date, freq, interval = 1) {
  const d = toDate(date);
  const n = interval || 1;
  if (freq === RECUR.DAILY) return addDays(d, n);
  if (freq === RECUR.WEEKLY) return addWeeks(d, n);
  if (freq === RECUR.MONTHLY) return addMonths(d, n);
  return d;
}

// Welke occurrences zijn verschuldigd t/m `now`, gegeven het sjabloon?
//   template: { next_date, recur_freq, recur_interval }
// -> { occurrences: [Date,…], nextDate: Date }  (cap voorkomt een stortvloed)
export function dueRun(template, now = new Date(), cap = 12) {
  const freq = template?.recur_freq;
  const interval = template?.recur_interval || 1;
  let next = toDate(template?.next_date);
  if (!KNOWN.includes(freq) || Number.isNaN(+next)) return { occurrences: [], nextDate: next };

  const occurrences = [];
  while (next <= now && occurrences.length < cap) {
    occurrences.push(next);
    const adv = advance(next, freq, interval);
    if (adv <= next) break; // veiligheid: geen vooruitgang
    next = adv;
  }
  return { occurrences, nextDate: next };
}
