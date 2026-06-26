// @ts-check
// Pure productnaam-normalisatie + fuzzy matching voor de boodschappen-catalogus
// (BOO-5). Géén React/Supabase, geen externe API — regelgebaseerd en testbaar.
// Zie docs/plans/02-boodschappen-intelligentie.md.

// Normaliseer een productnaam voor opslag/vergelijking: lowercase, diacritics weg,
// maat-/hoeveelheidsruis dempen ("1L", "500 g", "2x"), leestekens en losse getallen
// weg, dubbele spaties samenvouwen. 'Halfvolle Melk 1L' -> 'halfvolle melk'.
export function normalize(name) {
  if (!name) return '';
  let s = String(name).toLowerCase();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // combining diacritics weg
  s = s.replace(/[^a-z0-9\s]/g, ' ');                     // leestekens -> spatie
  // hoeveelheid + eenheid (250ml, 1 l, 6 stuks, 2x, 1kg, 500 g)
  s = s.replace(/\b\d+([.,]\d+)?\s*(gram|gr|kg|g|ml|cl|ltr|liter|l|stuks|stuk|st|pak|x)\b/g, ' ');
  s = s.replace(/\b\d+([.,]\d+)?\b/g, ' ');               // overgebleven losse getallen
  return s.replace(/\s+/g, ' ').trim();
}

// Tel-map van karakter-bigrams (voor de Dice-coëfficiënt).
function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

// Dice-coëfficiënt op twee al-genormaliseerde strings (hot path: roept géén
// normalize meer aan, zodat de caller zelf één keer kan normaliseren). 1 = gelijk,
// 0 = niets gemeen.
function diceNorm(na, nb) {
  if (na === nb) return 1; // ook beide-leeg telt als gelijk
  if (!na || !nb) return 0;
  const A = bigrams(na), B = bigrams(nb);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const [g, ca] of A) { const cb = B.get(g); if (cb) inter += Math.min(ca, cb); }
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return (2 * inter) / total;
}

// Similariteit 0..1 tussen twee namen (Dice-coëfficiënt op bigrams van de
// genormaliseerde vorm). 1 = identiek na normalisatie, 0 = niets gemeen.
export function similarity(a, b) {
  return diceNorm(normalize(a), normalize(b));
}

const idOf = (x) => x?.product?.id ?? '';

// Top-N kandidaten uit de catalogus, gesorteerd op score (stabiel op product-id).
//   products: [{ id, name, search? }] — gebruikt het voor-genormaliseerde `search`
// indien aanwezig, anders `name`.
//
// PERF-6: de zoekterm wordt hier één keer genormaliseerd (i.p.v. per product binnen
// `similarity`), en een reeds-genormaliseerd `p.search` gaat ongewijzigd door naar de
// Dice-vergelijking. `normalize` is idempotent, dus de uitkomst is identiek aan het
// oude `similarity(name, p.search ?? p.name)` — alleen zonder de N× her-normalisatie
// per toetsaanslag.
export function suggestions(name, products = [], n = 3) {
  const nq = normalize(name);
  const scored = products.map((p) => ({ product: p, score: diceNorm(nq, p.search ?? normalize(p.name)) }));
  scored.sort((a, b) => (b.score - a.score) || (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0));
  return scored.slice(0, n);
}

// Beste match boven een drempel (default 0.6), of null. -> { product, score }
export function bestMatch(name, products = [], threshold = 0.6) {
  const top = suggestions(name, products, 1)[0];
  return top && top.score >= threshold ? top : null;
}
