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

// products:   [{ id, name, search?, category?, times_added?, last_added_at? }]
// categories: [{ key, label, emoji?, sort? }] (catalog_categories)
// opts.query: vrije filtertekst (genormaliseerd, substring op search/naam)
// → [{ key, label, emoji, sort, items[] }] gesorteerd op schap-volgorde
export function groupFavorites(products = [], categories = [], { query = '' } = {}) {
  const q = normalize(query || '');
  const filtered = q
    ? products.filter((p) => (p.search || normalize(p.name || '')).includes(q))
    : products.slice();

  const meta = new Map(categories.map((c) => [c.key, c]));
  const byCat = new Map();
  for (const p of filtered) {
    const key = p.category || 'overig';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(p);
  }

  const groups = [...byCat.entries()].map(([key, items]) => {
    items.sort((a, b) =>
      (b.times_added || 0) - (a.times_added || 0)
      || recencyDesc(a.last_added_at, b.last_added_at)
      || String(a.name || '').localeCompare(String(b.name || '')));
    const m = meta.get(key);
    return { key, label: m?.label || key, emoji: m?.emoji || null, sort: m?.sort ?? 999, items };
  });

  groups.sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return groups;
}
