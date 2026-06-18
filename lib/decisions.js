// Pure logica voor de grote-aankopen-module (AAN-1..4): stemmen tellen, leidende
// optie, budget-labels. Géén React/Supabase. Zie docs/plans/03-grote-aankopen.md.
import { formatCents } from './expenses';

// Stemmen per optie. options:[{id,title}], votes:[{option_id, profile_id}].
// -> [{ optionId, title, count }] gesorteerd op count desc, stabiel op optionId.
export function tallyVotes(options = [], votes = []) {
  const counts = new Map(options.map((o) => [o.id, 0]));
  for (const v of votes) if (counts.has(v.option_id)) counts.set(v.option_id, counts.get(v.option_id) + 1);
  return options
    .map((o) => ({ optionId: o.id, title: o.title, count: counts.get(o.id) ?? 0 }))
    .sort((a, b) => (b.count - a.count) || (a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0));
}

// De leidende optie, of null bij 0 stemmen of een gelijkspel aan de top.
export function leadingOption(options = [], votes = []) {
  const t = tallyVotes(options, votes);
  if (t.length === 0 || t[0].count === 0) return null;
  if (t.length > 1 && t[1].count === t[0].count) return null; // gelijkspel aan kop
  return t[0];
}

// Leesbaar budgetbereik. Vier vormen: bereik / tot / vanaf / geen.
export function budgetLabel(minCents, maxCents) {
  const has = (x) => x != null;
  if (!has(minCents) && !has(maxCents)) return 'Geen budget';
  if (has(minCents) && has(maxCents)) return `${formatCents(minCents)}–${formatCents(maxCents)}`;
  if (has(maxCents)) return `tot ${formatCents(maxCents)}`;
  return `vanaf ${formatCents(minCents)}`;
}

// Past een optieprijs binnen het budget? -> 'binnen' | 'boven' | 'onbekend'.
// Onder een eventueel minimum geldt als 'binnen' (onder budget is geen probleem).
export function withinBudget(priceCents, minCents, maxCents) {
  if (priceCents == null) return 'onbekend';
  if (maxCents != null && priceCents > maxCents) return 'boven';
  return 'binnen';
}
