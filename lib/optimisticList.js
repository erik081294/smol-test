// @ts-check
// Pure lijst-transformaties onder de optimistische mutaties van useCollection
// (review 2026-07-02, P-refactor): de hook deed deze map/filter-logica inline in
// zijn setState-updaters, waardoor ze niet los testbaar was en buiten de
// mutatie-ratchet viel. Hier leven alléén de transformaties: niet-mutatief,
// altijd een nieuwe array terug. De React-kant (prev-capture + rollback-.catch)
// blijft in lib/useCollection.js — dat is schil, dit is kern.

/**
 * Patch één item (op id) met een gedeeltelijke wijziging. Onbekend id → zelfde
 * inhoud (wel een nieuwe array); patch-velden overschrijven bestaande velden.
 * @template {{ id: * }} T
 * @param {T[]} [items]
 * @param {*} [id]
 * @param {object} [patch]
 * @returns {T[]}
 */
export function patchItem(items = [], id, patch) {
  return items.map((it) => (it.id === id ? { ...it, ...patch } : it));
}

/**
 * Verwijder één item op id (álle voorkomens). Onbekend id → zelfde inhoud.
 * @template {{ id: * }} T
 * @param {T[]} [items]
 * @param {*} [id]
 * @returns {T[]}
 */
export function removeItem(items = [], id) {
  return items.filter((it) => it.id !== id);
}

/**
 * Verwijder meerdere items op id (bulk-delete). Lege of deels-onbekende ids
 * zijn veilig: alleen wat matcht verdwijnt, de rest blijft in volgorde staan.
 * @template {{ id: * }} T
 * @param {T[]} [items]
 * @param {*[]} [ids]
 * @returns {T[]}
 */
export function removeItems(items = [], ids = []) {
  const idSet = new Set(ids);
  return items.filter((it) => !idSet.has(it.id));
}
