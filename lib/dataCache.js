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

// Begintoestand van een collectie-hook uit zijn cache-waarde (PERF-2/INF-8 C3).
// Pure afleiding zodat useCollection 'm niet inline hoeft te herhalen én de regel
// onder de ratchet valt: `undefined` = "niets gecachet" → toon nog een laad-skelet
// (loading=true); een gecachete (óók lege) lijst → meteen tonen (loading=false).
/**
 * @param {unknown[] | undefined} cached
 * @returns {{ items: unknown[], loading: boolean }}
 */
export function seedFromCache(cached) {
  return { items: cached ?? [], loading: cached === undefined };
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

// In-flight dedupe (P1, review 2026-07-02). freezeOnBlur houdt bezochte tabs gemount, dus
// meerdere hook-instanties van dezelfde collectie vuren bij één realtime-event elk een
// volledige refetch af; met een join-select kan het incrementele patch-pad niet, waardoor
// dat ~7 identieke queries per event werden. Deze helper laat gelijktijdige fetches met
// dezelfde sleutel één netwerk-round-trip delen: de eerste start de fetch, de rest krijgt
// diezelfde promise. Na afronding (ook bij fout) is de sleutel weer vrij, zodat een volgend
// event opnieuw fetcht. Elke instantie verwerkt het resultaat nog steeds in z'n eigen state.
const inflight = new Map();

/**
 * @template T
 * @param {string} key
 * @param {() => T | PromiseLike<T>} fetcher
 * @returns {Promise<T>}
 */
export function dedupeFetch(key, fetcher) {
  const existing = inflight.get(key);
  if (existing) return existing;
  let started;
  try {
    started = Promise.resolve(fetcher());
  } catch (e) {
    // Synchrone worp in de fetcher: niets te dedupen, meteen afwijzen.
    return Promise.reject(e);
  }
  // Ruim alléén op als wij nog de actieve entry zijn (een latere run niet overschrijven).
  // De `=== tracked`-guard is een EQUIVALENTE mutant (→ true): door de microtask-volgorde
  // kan er nooit een nieuwere entry voor `key` in de map staan als deze finally draait — een
  // dedupeFetch in dat venster krijgt juist dít tracked terug (regel 71) i.p.v. een nieuwe te
  // maken. De guard blijft als defensieve documentatie; de mutant is onvangbaar.
  // Stryker disable next-line all
  const tracked = started.finally(() => { if (inflight.get(key) === tracked) inflight.delete(key); });
  inflight.set(key, tracked);
  return tracked;
}
