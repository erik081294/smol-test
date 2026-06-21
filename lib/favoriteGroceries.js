// Pure logica voor "Vaste boodschappen": groepeer de huishoud-producten per categorie-
// schap, sorteer binnen een schap op gebruik (times_added) → recency → naam, en filter
// optioneel op een zoekterm. Géén React/IO — los testbaar. De categorie-labels/emoji/
// volgorde komen uit de bestaande catalogus-taxonomie (catalog_categories).
import { normalize } from './productMatch';

function recencyDesc(a, b) {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
}

// Standaardsortering binnen "vaste boodschappen": meest gebruikt → recentst → naam.
function byUsage(a, b) {
  return (b.times_added || 0) - (a.times_added || 0)
    || recencyDesc(a.last_added_at, b.last_added_at)
    || String(a.name || '').localeCompare(String(b.name || ''));
}

const matchesQuery = (p, q) => !q || (p.search || normalize(p.name || '')).includes(q);

// De globaal meest gekozen producten (over alle schappen heen) — de snelkoppeling
// bovenaan. Alleen écht gekozen (times_added > 0) en niet-verborgen. opts.n = cap.
export function topFavorites(products = [], { n = 8 } = {}) {
  return products
    .filter((p) => !p.hidden && (p.times_added || 0) > 0)
    .sort(byUsage)
    .slice(0, Math.max(0, n));
}

// Verborgen producten (voor de beheer-sectie), optioneel gefilterd, op naam.
export function hiddenProducts(products = [], { query = '' } = {}) {
  const q = normalize(query || '');
  return products
    .filter((p) => p.hidden && matchesQuery(p, q))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

// products:   [{ id, name, search?, category?, times_added?, last_added_at?, hidden? }]
// categories: [{ key, label, emoji?, sort? }] (catalog_categories)
// opts.query: vrije filtertekst (genormaliseerd, substring op search/naam)
// → [{ key, label, emoji, sort, items[] }] gesorteerd op schap-volgorde (verborgen eruit)
export function groupFavorites(products = [], categories = [], { query = '' } = {}) {
  const q = normalize(query || '');
  const filtered = products.filter((p) => !p.hidden && matchesQuery(p, q));

  const meta = new Map(categories.map((c) => [c.key, c]));
  const byCat = new Map();
  for (const p of filtered) {
    const key = p.category || 'overig';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(p);
  }

  const groups = [...byCat.entries()].map(([key, items]) => {
    items.sort(byUsage);
    const m = meta.get(key);
    return { key, label: m?.label || key, emoji: m?.emoji || null, sort: m?.sort ?? 999, items };
  });

  groups.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return groups;
}
