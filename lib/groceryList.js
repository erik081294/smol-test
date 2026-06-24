// Pure groepering van de boodschappenlijst per supermarkt-schap (UX). De volgorde +
// labels + emoji komen uit de catalogus-taxonomie (lib/groceryCatalog: CATEGORIES, op
// `sort` — groente/fruit, brood, zuivel, …). Lege schappen vallen weg. Géén React/IO.
import { CATEGORIES, itemByName } from './groceryCatalog';

const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));

// De categorie-key van een boodschap: expliciet via een gekoppeld product (categoryById)
// > generieke catalogus-match op naam > 'overig'. Een key buiten de taxonomie wordt naar
// 'overig' geklemd, zodat de groepering altijd een bekend schap gebruikt.
export function categoryKeyForGrocery(item, categoryById = {}) {
  const raw = (item?.product_id && categoryById[item.product_id]) || itemByName(item?.name)?.category || 'overig';
  return CATEGORY_KEYS.has(raw) ? raw : 'overig';
}

// Groepeer boodschappen per schap, in taxonomie-volgorde; lege schappen weg.
// → [{ key, label, emoji, data: [items] }]
export function groupGroceriesByCategory(items = [], { categoryById = {} } = {}) {
  const buckets = new Map();
  for (const it of items ?? []) {
    const key = categoryKeyForGrocery(it, categoryById);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const out = [];
  for (const c of CATEGORIES) {
    const arr = buckets.get(c.key);
    if (arr && arr.length) out.push({ key: c.key, label: c.label, emoji: c.emoji, data: arr });
  }
  return out;
}
