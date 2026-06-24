import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countOf } from '../lib/groceryCount.js';

test('countOf: open regel met aantal → dat aantal', () => {
  assert.equal(countOf([{ name: 'Melk', quantity: '2 pak', checked: false }], 'melk'), 2);
});

test('countOf: open regel zonder expliciet aantal → 1', () => {
  assert.equal(countOf([{ name: 'Brood', checked: false }], 'Brood'), 1);
});

test('countOf: afgevinkte regel telt niet mee → 0', () => {
  assert.equal(countOf([{ name: 'Melk', quantity: '2 pak', checked: true }], 'melk'), 0);
});

test('countOf: niet op de lijst → 0', () => {
  assert.equal(countOf([{ name: 'Brood', checked: false }], 'Melk'), 0);
});

test('countOf: matcht op genormaliseerde naam (hoofdletters/ruis)', () => {
  assert.equal(countOf([{ name: 'Halfvolle melk 1L', quantity: '3', checked: false }], 'HALFVOLLE MELK'), 3);
});

test('countOf: lege/null invoer → 0', () => {
  assert.equal(countOf(null, 'melk'), 0);
  assert.equal(countOf([], 'melk'), 0);
  assert.equal(countOf([{ name: 'Melk', checked: false }], ''), 0);
});

test('countOf: lege zoeknaam matcht niet per ongeluk een leeg-genormaliseerd item', () => {
  // Zonder de !norm-early-return zou een item dat tot '' normaliseert ('  ') ten onrechte
  // matchen op een lege zoekterm. De early-return houdt dat tegen → 0.
  assert.equal(countOf([{ name: '  ', quantity: '5', checked: false }], ''), 0);
});
