// @ts-check
// Pure, onveranderlijke array-helpers voor de terugkerende lijst-patronen in de
// entity-editors: het toggelen van een lid in een selectie (shareWith, weekdagen,
// deelnemers, labels …) en het muteren van een dynamische regellijst (bon-regels).
// Vóór dit module herschreef élk scherm `arr.includes(x) ? arr.filter(...) : [...arr, x]`
// en `arr.map((it, i) => i === idx ? { ...it, ...patch } : it)` met de hand — ~16 kopieën.
// Eén geteste, ratchet-bewaakte plek maakt dat DRY en vangt de grens-/immutability-fouten
// af (zie docs/architectuur.md, ARCH-1). Elke helper geeft een NIEUWE array terug; de
// invoer blijft ongemoeid. Een ontbrekende lijst (null/undefined) telt als leeg.

/**
 * Toggle een waarde in een lijst: zit 'ie erin → eruit, anders erbij (achteraan).
 * @template T
 * @param {T[] | null | undefined} list
 * @param {T} value
 * @returns {T[]}
 */
export function toggleValue(list, value) {
  const arr = list ?? [];
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/**
 * Voeg een item achteraan toe.
 * @template T
 * @param {T[] | null | undefined} list
 * @param {T} item
 * @returns {T[]}
 */
export function addItem(list, item) {
  return [...(list ?? []), item];
}

/**
 * Verwijder het item op `index` (out-of-range → onveranderde kopie).
 * @template T
 * @param {T[] | null | undefined} list
 * @param {number} index
 * @returns {T[]}
 */
export function removeAt(list, index) {
  return (list ?? []).filter((_, i) => i !== index);
}

/**
 * Werk het item op `index` bij door `patch` erin te mergen (out-of-range → onveranderde
 * kopie). Voor objecten-in-een-lijst; laat de overige items ongemoeid.
 * @template {Record<string, unknown>} T
 * @param {T[] | null | undefined} list
 * @param {number} index
 * @param {Partial<T>} patch
 * @returns {T[]}
 */
export function updateAt(list, index, patch) {
  return (list ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item));
}
