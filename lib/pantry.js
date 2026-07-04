// @ts-check
// Pure logica voor de voorraad (VOO-1). Geen React/Supabase — volledig te
// unit-testen. Houdbaarheids-/drempelstatus, de "wat moet er nog gekocht
// worden"-berekening (behoefte − voorraad) en een urgentie-sortering voor het scherm.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { normalize } from './productMatch';
import { ingredientKey } from './mealPlan';

export const PANTRY_STATUS = { FRESH: 'vers', LOW: 'bijna-op', SOON: 'binnenkort', EXPIRED: 'verlopen' };

// Urgentie-rangorde (laag = urgenter). Eén bron voor zowel status-precedentie als
// de schermsortering: verlopen > binnenkort-over-datum > bijna-op > vers.
const RANK = { [PANTRY_STATUS.EXPIRED]: 0, [PANTRY_STATUS.SOON]: 1, [PANTRY_STATUS.LOW]: 2, [PANTRY_STATUS.FRESH]: 3 };

// Hele kalenderdagen tot de houdbaarheidsdatum (negatief = al verlopen). null als
// er geen datum is. Accepteert 'yyyy-MM-dd' of een Date.
export function daysUntil(bestBefore, now = new Date()) {
  if (!bestBefore) return null;
  const d = typeof bestBefore === 'string' ? parseISO(bestBefore) : bestBefore;
  return differenceInCalendarDays(d, now);
}

// Status van één voorraad-item. Vandaag = nog niet verlopen (daysUntil 0 → niet EXPIRED).
//   item: { quantity, low_threshold, best_before }
export function status(item, { now = new Date(), soonDays = 3 } = {}) {
  const days = daysUntil(item?.best_before, now);
  if (days != null && days < 0) return PANTRY_STATUS.EXPIRED;
  if (days != null && days <= soonDays) return PANTRY_STATUS.SOON;
  if (item?.low_threshold != null && Number(item.quantity) <= Number(item.low_threshold)) return PANTRY_STATUS.LOW;
  return PANTRY_STATUS.FRESH;
}

// Sleutel waarop voorraad en behoefte worden vergeleken (zelfde regels als
// mealPlan.ingredientKey: product wint, dan catalogus, anders genormaliseerde naam).
function pantryKey(item) {
  return item.product_id || item.catalog_product_id || `naam:${normalize(item.name)}`;
}

// Wat moet er nog gekocht worden = behoefte (uit aggregateIngredients) minus de
// voorraad, vergeleken op sleutel + unit. Items waarvan genoeg in huis is vallen weg.
//   needed:      [{ key, name, productId, catalogProductId, unit, quantity }]
//   pantryItems: [{ product_id?, catalog_product_id?, name, unit, quantity }]
// -> dezelfde vorm als `needed`, alleen met resterende quantity > 0.
export function shoppingGap(needed = [], pantryItems = []) {
  const onHand = new Map();
  for (const p of pantryItems) {
    const k = `${pantryKey(p)}@@${p.unit || 'stuk'}`;
    onHand.set(k, (onHand.get(k) ?? 0) + (Number(p.quantity) || 0));
  }
  const out = [];
  for (const n of needed) {
    const k = `${n.key}@@${n.unit || 'stuk'}`;
    const have = onHand.get(k) ?? 0;
    const remaining = (Number(n.quantity) || 0) - have;
    if (remaining > 0) out.push({ ...n, quantity: Math.round(remaining * 100) / 100 });
  }
  return out;
}

// Sleutel waarop een bon-regel en een voorraadregel samenvallen (zelfde regels als
// pantryKey): product wint, dan catalogus, anders genormaliseerde naam — plus de unit.
export function purchaseItemKey(x) {
  return `${x?.product_id || x?.catalog_product_id || `naam:${normalize(x?.name ?? '')}`}@@${x?.unit || 'stuk'}`;
}

// Tel bon-regels die op hetzelfde product+unit vallen vooraf bij elkaar op. Zonder dit
// schrijft een bon met 2× hetzelfde product twee losse ophogingen vanuit dezelfde
// voorraad-snapshot → de laatste overschrijft de eerste en er gaat hoeveelheid verloren
// (voorraad +3 i.p.v. +5, review P4). Regels zonder naam vallen weg; een ontbrekend
// aantal telt als 1 (spiegelt het oude `Number(i.quantity) || 1`). Volgorde = 1e voorkomen.
//   items: [{ product_id?, catalog_product_id?, name, unit?, quantity? }]
// -> [{ key, name, product_id, catalog_product_id, unit, quantity }] (quantity = som)
export function aggregatePurchaseItems(items = []) {
  const out = [];
  const idx = new Map();
  for (const i of items) {
    if (!(i?.name ?? '').trim()) continue;
    const key = purchaseItemKey(i);
    const qty = Number(i.quantity) || 1;
    if (idx.has(key)) {
      out[idx.get(key)].quantity += qty;
    } else {
      idx.set(key, out.length);
      out.push({
        key,
        name: i.name,
        product_id: i.product_id ?? null,
        catalog_product_id: i.catalog_product_id ?? null,
        unit: i.unit || 'stuk',
        quantity: qty,
      });
    }
  }
  return out;
}

// Sorteer voorraad op urgentie (verlopen → binnenkort → bijna-op → vers), bij
// gelijke status op houdbaarheidsdatum (vroegst eerst), dan op naam. Niet-mutatief.
export function sortByUrgency(items = [], opts = {}) {
  return [...items].sort((a, b) => {
    const ra = RANK[status(a, opts)], rb = RANK[status(b, opts)];
    if (ra !== rb) return ra - rb;
    const da = daysUntil(a.best_before, opts.now), db = daysUntil(b.best_before, opts.now);
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });
}
