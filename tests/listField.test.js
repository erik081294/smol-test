// Tests voor de pure array-helpers van de entity-editors (toggle-selectie + dynamische
// regellijst). Vervangen ~16 hand-gekopieerde `includes ? filter : [...]`- en `map`-blokken
// (ARCH-1); daarom strak onder de mutatie-ratchet. Draaien met:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleValue, addItem, removeAt, updateAt } from '../lib/listField.js';

// --- toggleValue ------------------------------------------------------------
test('toggleValue: afwezige waarde → toegevoegd (achteraan, volgorde behouden)', () => {
  assert.deepEqual(toggleValue([1, 2], 3), [1, 2, 3]);
});

test('toggleValue: aanwezige waarde → verwijderd, rest in volgorde', () => {
  assert.deepEqual(toggleValue([1, 2, 3], 2), [1, 3]);
});

test('toggleValue: twee keer togglen → terug bij af (idempotent paar)', () => {
  assert.deepEqual(toggleValue(toggleValue([1, 2], 3), 3), [1, 2]);
});

test('toggleValue: zonder lijst-argument → nieuwe lijst met alleen de waarde (default-param)', () => {
  assert.deepEqual(toggleValue(undefined, 'x'), ['x']);
});

test('toggleValue: verwijdert álle voorkomens van de waarde (filter, niet één)', () => {
  assert.deepEqual(toggleValue([1, 2, 1], 1), [2]);
});

test('toggleValue: laat de invoer ongemoeid (onveranderlijk)', () => {
  const input = [1, 2];
  const out = toggleValue(input, 3);
  assert.deepEqual(input, [1, 2]);
  assert.notEqual(out, input);
});

// --- addItem ----------------------------------------------------------------
test('addItem: voegt achteraan toe (volgorde)', () => {
  assert.deepEqual(addItem([1, 2], 3), [1, 2, 3]);
});

test('addItem: zonder lijst-argument → [item] (default-param)', () => {
  assert.deepEqual(addItem(undefined, 'a'), ['a']);
});

test('addItem: laat de invoer ongemoeid (onveranderlijk)', () => {
  const input = [1];
  const out = addItem(input, 2);
  assert.deepEqual(input, [1]);
  assert.notEqual(out, input);
});

// --- removeAt ---------------------------------------------------------------
test('removeAt: verwijdert het item op de index (midden)', () => {
  assert.deepEqual(removeAt(['a', 'b', 'c'], 1), ['a', 'c']);
});

test('removeAt: grens — eerste (0) en laatste index', () => {
  assert.deepEqual(removeAt(['a', 'b', 'c'], 0), ['b', 'c']);
  assert.deepEqual(removeAt(['a', 'b', 'c'], 2), ['a', 'b']);
});

test('removeAt: out-of-range index → onveranderde kopie', () => {
  assert.deepEqual(removeAt(['a', 'b'], 5), ['a', 'b']);
  assert.deepEqual(removeAt(['a', 'b'], -1), ['a', 'b']);
});

test('removeAt: zonder lijst-argument → lege lijst (default/fallback). Index ≠ 0 zodat de fallback echt leeg moet zijn, niet "toevallig weggefilterd"', () => {
  assert.deepEqual(removeAt(undefined, 0), []);
  assert.deepEqual(removeAt(undefined, 3), []);
});

test('removeAt: laat de invoer ongemoeid (onveranderlijk)', () => {
  const input = ['a', 'b'];
  const out = removeAt(input, 0);
  assert.deepEqual(input, ['a', 'b']);
  assert.notEqual(out, input);
});

// --- updateAt ---------------------------------------------------------------
test('updateAt: mergt de patch in het item op de index (rest ongemoeid)', () => {
  assert.deepEqual(
    updateAt([{ n: 'a', q: 1 }, { n: 'b', q: 2 }], 1, { q: 5 }),
    [{ n: 'a', q: 1 }, { n: 'b', q: 5 }],
  );
});

test('updateAt: mergt (vervangt het item niet volledig)', () => {
  const out = updateAt([{ n: 'a', q: 1 }], 0, { q: 9 });
  assert.deepEqual(out[0], { n: 'a', q: 9 });
});

test('updateAt: grens — eerste en laatste index', () => {
  assert.deepEqual(updateAt([{ v: 1 }, { v: 2 }], 0, { v: 9 }), [{ v: 9 }, { v: 2 }]);
  assert.deepEqual(updateAt([{ v: 1 }, { v: 2 }], 1, { v: 9 }), [{ v: 1 }, { v: 9 }]);
});

test('updateAt: out-of-range index → onveranderde kopie', () => {
  assert.deepEqual(updateAt([{ v: 1 }], 3, { v: 9 }), [{ v: 1 }]);
});

test('updateAt: zonder lijst-argument → lege lijst (default-param)', () => {
  assert.deepEqual(updateAt(undefined, 0, { v: 1 }), []);
});

test('updateAt: laat de invoer + de niet-geraakte items ongemoeid (onveranderlijk)', () => {
  const input = [{ v: 1 }, { v: 2 }];
  const out = updateAt(input, 0, { v: 9 });
  assert.deepEqual(input, [{ v: 1 }, { v: 2 }]);
  assert.notEqual(out, input);
  assert.equal(out[1], input[1]); // niet-geraakt item = zelfde referentie
});
