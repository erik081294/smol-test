// Units voor de in-memory data-cache (lib/dataCache.js). Geen React/Supabase nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, getCached, setCached, clearCache, clearHousehold, dedupeFetch, seedFromCache } from '../lib/dataCache.js';

test('cacheKey: tabel+huishouden, met optionele venster-suffix', () => {
  assert.equal(cacheKey('groceries', 'hh1'), 'groceries:hh1');
  assert.equal(cacheKey('meal_plan_entries', 'hh1', '2026-06-22'), 'meal_plan_entries:hh1:2026-06-22');
});

test('set/get round-trip', () => {
  clearCache();
  const key = cacheKey('tasks', 'hh1');
  assert.equal(getCached(key), undefined); // niets gecachet
  setCached(key, [{ id: 'a' }]);
  assert.deepEqual(getCached(key), [{ id: 'a' }]);
});

test('gecachete lege lijst ≠ niets gecachet', () => {
  clearCache();
  const key = cacheKey('tasks', 'hh1');
  setCached(key, []);
  assert.deepEqual(getCached(key), []); // vertrouwde lege lijst, niet undefined
});

test('verschillende huishoudens isoleren data (geen cross-household-lek)', () => {
  clearCache();
  setCached(cacheKey('tasks', 'hhA'), [{ id: 'a' }]);
  setCached(cacheKey('tasks', 'hhB'), [{ id: 'b' }]);
  assert.deepEqual(getCached(cacheKey('tasks', 'hhA')), [{ id: 'a' }]);
  assert.deepEqual(getCached(cacheKey('tasks', 'hhB')), [{ id: 'b' }]);
});

test('clearCache() leegt alles', () => {
  setCached(cacheKey('tasks', 'hh1'), [{ id: 'a' }]);
  clearCache();
  assert.equal(getCached(cacheKey('tasks', 'hh1')), undefined);
});

test('clearHousehold() leegt alleen dat huishouden', () => {
  clearCache();
  setCached(cacheKey('tasks', 'hhA'), [{ id: 'a' }]);
  setCached(cacheKey('groceries', 'hhA'), [{ id: 'g' }]);
  setCached(cacheKey('tasks', 'hhB'), [{ id: 'b' }]);
  clearHousehold('hhA');
  assert.equal(getCached(cacheKey('tasks', 'hhA')), undefined);
  assert.equal(getCached(cacheKey('groceries', 'hhA')), undefined);
  assert.deepEqual(getCached(cacheKey('tasks', 'hhB')), [{ id: 'b' }]);
});

// --- seedFromCache (begintoestand-afleiding van useCollection) ---

test('seedFromCache: niets gecachet (undefined) → leeg + loading true (skelet)', () => {
  const s = seedFromCache(undefined);
  assert.deepEqual(s.items, []);
  assert.equal(s.loading, true);
});

test('seedFromCache: gecachete LEGE lijst → die lege lijst + loading false (geen skelet)', () => {
  const empty = [];
  const s = seedFromCache(empty);
  assert.equal(s.items, empty, 'geeft exact de gecachete lijst door');
  assert.deepEqual(s.items, []);
  assert.equal(s.loading, false);
});

test('seedFromCache: gecachete gevulde lijst → die lijst + loading false', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];
  const s = seedFromCache(rows);
  assert.equal(s.items, rows, 'geeft exact dezelfde lijst-referentie door (geen kopie)');
  assert.equal(s.loading, false);
});

// --- dedupeFetch (P1: gelijktijdige refetches delen één query) ---

test('dedupeFetch: gelijktijdige calls met dezelfde sleutel delen één fetch', async () => {
  let calls = 0;
  let resolveFetch;
  const fetcher = () => { calls++; return new Promise((res) => { resolveFetch = res; }); };
  const a = dedupeFetch('k1', fetcher);
  const b = dedupeFetch('k1', fetcher); // tweede tijdens in-flight → gedeeld
  assert.equal(calls, 1, 'fetcher maar één keer aangeroepen');
  resolveFetch({ data: [{ id: 1 }] });
  const [ra, rb] = await Promise.all([a, b]);
  assert.deepEqual(ra, { data: [{ id: 1 }] });
  assert.equal(ra, rb, 'beide callers krijgen exact dezelfde resolved waarde');
});

test('dedupeFetch: na afronding is de sleutel weer vrij (volgend event refetcht)', async () => {
  let calls = 0;
  const fetcher = () => { calls++; return Promise.resolve('v'); };
  await dedupeFetch('k2', fetcher);
  await dedupeFetch('k2', fetcher); // niet meer in-flight → opnieuw
  assert.equal(calls, 2);
});

test('dedupeFetch: verschillende sleutels lopen onafhankelijk', async () => {
  let calls = 0;
  const fetcher = () => { calls++; return Promise.resolve('v'); };
  await Promise.all([dedupeFetch('a', fetcher), dedupeFetch('b', fetcher)]);
  assert.equal(calls, 2);
});

test('dedupeFetch: sleutel ook vrijgegeven na een fout (geen vastgelopen in-flight)', async () => {
  let calls = 0;
  const fetcher = () => { calls++; return Promise.reject(new Error('boom')); };
  await assert.rejects(dedupeFetch('k3', fetcher));
  await assert.rejects(dedupeFetch('k3', fetcher)); // opnieuw gefetcht, niet dezelfde afgewezen promise hergebruikt
  assert.equal(calls, 2);
});

test('dedupeFetch: synchrone worp in de fetcher wijst netjes af', async () => {
  await assert.rejects(dedupeFetch('k4', () => { throw new Error('sync'); }));
  // en de sleutel blokkeert niet:
  await dedupeFetch('k4', () => Promise.resolve('ok'));
});
