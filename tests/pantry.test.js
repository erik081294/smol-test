// Units voor de pure voorraad-logica (lib/pantry.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { status, daysUntil, shoppingGap, sortByUrgency, PANTRY_STATUS } from '../lib/pantry.js';

const now = new Date(2026, 5, 18); // 18 jun 2026

test('daysUntil: kalenderdagen tot houdbaarheid, null zonder datum', () => {
  assert.equal(daysUntil('2026-06-20', now), 2);
  assert.equal(daysUntil('2026-06-18', now), 0);
  assert.equal(daysUntil('2026-06-15', now), -3);
  assert.equal(daysUntil(null, now), null);
});

test('status: verlopen > binnenkort > bijna-op > vers; vandaag is niet verlopen', () => {
  assert.equal(status({ best_before: '2026-06-15', quantity: 5 }, { now }), PANTRY_STATUS.EXPIRED);
  assert.equal(status({ best_before: '2026-06-18', quantity: 5 }, { now }), PANTRY_STATUS.SOON, 'vandaag = binnenkort, niet verlopen');
  assert.equal(status({ best_before: '2026-06-20', quantity: 5 }, { now, soonDays: 3 }), PANTRY_STATUS.SOON);
  assert.equal(status({ best_before: '2026-07-01', quantity: 1, low_threshold: 2 }, { now }), PANTRY_STATUS.LOW);
  assert.equal(status({ best_before: '2026-07-01', quantity: 5, low_threshold: 2 }, { now }), PANTRY_STATUS.FRESH);
  assert.equal(status({ quantity: 5 }, { now }), PANTRY_STATUS.FRESH, 'geen datum/drempel = vers');
});

test('shoppingGap: trekt voorraad af per sleutel+unit, laat genoeg-in-huis weg', () => {
  const needed = [
    { key: 'p1', name: 'Melk', productId: 'p1', catalogProductId: null, unit: 'l', quantity: 3 },
    { key: 'naam:eieren', name: 'Eieren', productId: null, catalogProductId: null, unit: 'stuk', quantity: 6 },
    { key: 'p9', name: 'Boter', productId: 'p9', catalogProductId: null, unit: 'g', quantity: 200 },
  ];
  const pantry = [
    { product_id: 'p1', name: 'Melk', unit: 'l', quantity: 1 },        // 3-1 = 2 nodig
    { name: 'Eieren', unit: 'stuk', quantity: 10 },                    // genoeg → weg
    { product_id: 'p9', name: 'Boter', unit: 'stuk', quantity: 5 },    // andere unit → telt niet mee
  ];
  const gap = shoppingGap(needed, pantry);
  const byName = Object.fromEntries(gap.map((g) => [g.name, g.quantity]));
  assert.equal(byName['Melk'], 2);
  assert.equal(byName['Eieren'], undefined, 'genoeg eieren in huis');
  assert.equal(byName['Boter'], 200, 'andere unit telt niet als voorraad');
});

test('sortByUrgency: verlopen eerst, dan binnenkort, dan bijna-op, dan vers', () => {
  const items = [
    { name: 'Vers', best_before: '2026-08-01', quantity: 5 },
    { name: 'Verlopen', best_before: '2026-06-10', quantity: 5 },
    { name: 'Binnenkort', best_before: '2026-06-19', quantity: 5 },
    { name: 'BijnaOp', quantity: 1, low_threshold: 2 },
  ];
  const sorted = sortByUrgency(items, { now }).map((x) => x.name);
  assert.deepEqual(sorted, ['Verlopen', 'Binnenkort', 'BijnaOp', 'Vers']);
});
