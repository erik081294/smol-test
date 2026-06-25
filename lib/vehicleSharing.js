// Pure logica voor delen-met-kosten (V4): de ritprijs uit gereden km × het tarief dat
// de eigenaar instelt. Géén React/Supabase. "Gratis" = geen tarief (null/0): dan reserveren
// kan zonder dat er kosten tegenover staan (bv. kinderen die de auto wel mogen reserveren).

// Ritprijs (centen) = km × tarief(centen/km), afgerond. Geen/0 km of geen/0 tarief → 0
// (dus geen uitgave). km mag een kommagetal zijn (usage_value is numeric).
export function tripCostCents(km, pricePerKmCents) {
  const k = Number(km);
  const rate = Number(pricePerKmCents);
  if (!Number.isFinite(k) || k <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(k * rate);
}

// Tarief-invoer (euro per km, bv. "0,25") → centen/km, of null bij leeg/onzin/negatief.
export function parseRatePerKm(text) {
  const s = String(text ?? '').trim();
  if (s === '' || s.includes('-')) return null; // het minteken wordt anders weggestript
  const cleaned = s.replace(',', '.').replace(/[^\d.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Centen/km → toonbaar "0,25" (voor in een tarief-veld). Null/leeg → ''.
export function formatRatePerKm(cents) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}
