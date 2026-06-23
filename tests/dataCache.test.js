// Units voor de in-memory data-cache (lib/dataCache.js). Geen React/Supabase nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, getCached, setCached, clearCache, clearHousehold } from '../lib/dataCache.js';

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
