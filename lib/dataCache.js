// @ts-check
// Lichte module-level cache voor stale-while-revalidate (PERF-2). Houdt de laatst
// geladen lijst per (tabel, huishouden) in het geheugen vast, zodat een tab die
// her-mount of herbezocht wordt zijn data meteen kan tonen i.p.v. eerst een leeg
// laad-skelet. De hooks seeden hun begintoestand hieruit en schrijven na elke
// geslaagde fetch/patch de verse waarheid terug.
//
// Bewust géén persistentie (alleen in-memory): bij een herstart is een koude load
// prima. Géén TTL: realtime + de revalidatie-fetch trekken stale data direct bij.
//
// Privacy: de huishouden-id zit IN de sleutel, dus data van huishouden A lekt nooit
// naar B (andere sleutel). Op uitloggen leegt clearCache() alles.

const store = new Map();

// Sleutel per collectie. Optionele suffix voor venster-gebonden collecties (bv. een
// weekvenster bij maaltijden) zodat een ander venster niet de verkeerde cache toont.
export function cacheKey(table, householdId, suffix) {
  return suffix != null ? `${table}:${householdId}:${suffix}` : `${table}:${householdId}`;
}

// undefined = "niets gecachet" (≠ een gecachete lege lijst, die we wél vertrouwen).
export function getCached(key) {
  return store.has(key) ? store.get(key) : undefined;
}

export function setCached(key, data) {
  store.set(key, data);
}

export function clearCache() {
  store.clear();
}

// Gerichte invalidatie van één huishouden (de id is het tweede sleutel-segment).
export function clearHousehold(householdId) {
  for (const k of store.keys()) {
    if (k.split(':')[1] === String(householdId)) store.delete(k);
  }
}
