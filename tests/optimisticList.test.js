// Tests voor de pure lijst-transformaties onder de optimistische mutaties van
// useCollection (patch/verwijder/bulk-verwijder). Uit de hook geëxtraheerd
// (review 2026-07-02) en daarom strak onder de mutatie-ratchet. Draaien met: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchItem, removeItem, removeItems } from '../lib/optimisticList.js';

// --- patchItem ---------------------------------------------------------------
test('patchItem: patcht alléén het item met het gegeven id, rest blijft in volgorde', () => {
  const items = [{ id: 1, naam: 'a' }, { id: 2, naam: 'b' }, { id: 3, naam: 'c' }];
  assert.deepEqual(patchItem(items, 2, { naam: 'B' }), [
    { id: 1, naam: 'a' }, { id: 2, naam: 'B' }, { id: 3, naam: 'c' },
  ]);
});

test('patchItem: patch-veld overschrijft het bestaande veld, overige velden blijven staan', () => {
  const items = [{ id: 1, naam: 'a', klaar: false }];
  assert.deepEqual(patchItem(items, 1, { klaar: true }), [{ id: 1, naam: 'a', klaar: true }]);
});

test('patchItem: onbestaand id → zelfde inhoud, wél een nieuwe array', () => {
  const items = [{ id: 1, naam: 'a' }];
  const out = patchItem(items, 999, { naam: 'X' });
  assert.deepEqual(out, [{ id: 1, naam: 'a' }]);
  assert.notEqual(out, items);
});

test('patchItem: zonder argumenten → lege lijst (default-param)', () => {
  assert.deepEqual(patchItem(), []);
});

test('patchItem: laat de invoer (en het gepatchte item) ongemoeid — niet-mutatief', () => {
  const item = { id: 1, naam: 'a' };
  const items = [item];
  patchItem(items, 1, { naam: 'B' });
  assert.deepEqual(items, [{ id: 1, naam: 'a' }]);
  assert.equal(item.naam, 'a');
});

// --- removeItem ---------------------------------------------------------------
test('removeItem: verwijdert het item met het id, rest blijft in volgorde', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(removeItem(items, 2), [{ id: 1 }, { id: 3 }]);
});

test('removeItem: onbestaand id → zelfde inhoud, wél een nieuwe array', () => {
  const items = [{ id: 1 }];
  const out = removeItem(items, 999);
  assert.deepEqual(out, [{ id: 1 }]);
  assert.notEqual(out, items);
});

test('removeItem: verwijdert álle voorkomens van het id (filter, niet één)', () => {
  assert.deepEqual(removeItem([{ id: 1 }, { id: 2 }, { id: 1 }], 1), [{ id: 2 }]);
});

test('removeItem: zonder argumenten → lege lijst (default-param)', () => {
  assert.deepEqual(removeItem(), []);
});

test('removeItem: zonder lijst maar mét id → lege lijst (default is écht leeg)', () => {
  assert.deepEqual(removeItem(undefined, 999), []);
});

test('removeItem: laat de invoer ongemoeid — niet-mutatief', () => {
  const items = [{ id: 1 }, { id: 2 }];
  removeItem(items, 1);
  assert.deepEqual(items, [{ id: 1 }, { id: 2 }]);
});

// --- removeItems --------------------------------------------------------------
test('removeItems: verwijdert precies de gegeven ids, rest blijft in volgorde', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(removeItems(items, [2, 4]), [{ id: 1 }, { id: 3 }]);
});

test('removeItems: lege ids-lijst → zelfde inhoud, wél een nieuwe array', () => {
  const items = [{ id: 1 }, { id: 2 }];
  const out = removeItems(items, []);
  assert.deepEqual(out, [{ id: 1 }, { id: 2 }]);
  assert.notEqual(out, items);
});

test('removeItems: deels-onbekende ids → alleen wat matcht verdwijnt', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(removeItems(items, [2, 999]), [{ id: 1 }, { id: 3 }]);
});

test('removeItems: zonder ids-argument → zelfde inhoud (default-param)', () => {
  const items = [{ id: 1 }];
  assert.deepEqual(removeItems(items), [{ id: 1 }]);
});

test('removeItems: zonder argumenten → lege lijst (default-param)', () => {
  assert.deepEqual(removeItems(), []);
});

test('removeItems: laat de invoer ongemoeid — niet-mutatief', () => {
  const items = [{ id: 1 }, { id: 2 }];
  removeItems(items, [1, 2]);
  assert.deepEqual(items, [{ id: 1 }, { id: 2 }]);
});
