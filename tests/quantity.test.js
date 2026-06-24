import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity, formatQuantity, mergeQuantity } from '../lib/quantity.js';

test('parseQuantity: getal + eenheid', () => {
  assert.deepEqual(parseQuantity('2 pak'), { count: 2, unit: 'pak' });
});

test('parseQuantity: getal zonder eenheid', () => {
  assert.deepEqual(parseQuantity('3'), { count: 3, unit: '' });
});

test('parseQuantity: getal kleeft aan eenheid', () => {
  assert.deepEqual(parseQuantity('2pak'), { count: 2, unit: 'pak' });
});

test('parseQuantity: eenheid zonder getal -> enkelvoud', () => {
  assert.deepEqual(parseQuantity('krop'), { count: 1, unit: 'krop' });
});

test('parseQuantity: leeg en null vallen terug op count 1, lege eenheid', () => {
  assert.deepEqual(parseQuantity(''), { count: 1, unit: '' });
  assert.deepEqual(parseQuantity(null), { count: 1, unit: '' });
  assert.deepEqual(parseQuantity(undefined), { count: 1, unit: '' });
});

test('parseQuantity: aantal is minimaal 1 (0 telt als 1)', () => {
  assert.deepEqual(parseQuantity('0 pak'), { count: 1, unit: 'pak' });
});

test('parseQuantity: trimt omliggende spaties', () => {
  assert.deepEqual(parseQuantity('  2   pak  '), { count: 2, unit: 'pak' });
});

test('parseQuantity: meercijferig aantal blijft heel', () => {
  assert.deepEqual(parseQuantity('12 pak'), { count: 12, unit: 'pak' });
});

test('parseQuantity: getal moet vooraan staan (anker) — anders telt het als naam', () => {
  // Geen getal aan het begin → de hele tekst is de "eenheid"/naam, aantal 1.
  assert.deepEqual(parseQuantity('rode appels 6'), { count: 1, unit: 'rode appels 6' });
});

test('formatQuantity: vanaf twee toont aantal + eenheid', () => {
  assert.equal(formatQuantity(2, 'pak'), '2 pak');
});

test('formatQuantity: grens ligt op 2 — één stuks toont niets (null)', () => {
  assert.equal(formatQuantity(1, 'pak'), null);
  assert.equal(formatQuantity(2, 'pak'), '2 pak');
});

test('formatQuantity: nul of negatief -> null', () => {
  assert.equal(formatQuantity(0, 'pak'), null);
  assert.equal(formatQuantity(-3, 'pak'), null);
});

test('formatQuantity: aantal zonder eenheid -> enkel het getal', () => {
  assert.equal(formatQuantity(3, ''), '3');
  assert.equal(formatQuantity(3), '3');
});

test('formatQuantity: trimt de eenheid', () => {
  assert.equal(formatQuantity(4, '  stuk  '), '4 stuk');
});

test('formatQuantity: eenheid null valt terug op leeg → enkel het getal', () => {
  assert.equal(formatQuantity(2, null), '2');
});

test('formatQuantity: kapt kommagetallen af op een heel aantal', () => {
  assert.equal(formatQuantity(2.9, 'pak'), '2 pak');
});

test('parse -> format is rondreis-stabiel voor meervoud', () => {
  const { count, unit } = parseQuantity('5 fles');
  assert.equal(formatQuantity(count, unit), '5 fles');
});

test('mergeQuantity: telt aantallen op, eenheid van bestaande wint', () => {
  assert.equal(mergeQuantity('2 pak', '1 pak'), '3 pak');
});

test('mergeQuantity: twee enkele items -> aantal 2 (geen eenheid)', () => {
  assert.equal(mergeQuantity(null, null), '2');
});

test('mergeQuantity: bestaand aantal + enkel item', () => {
  assert.equal(mergeQuantity('3', null), '4');
});

test('mergeQuantity: eenheid van nieuwe regel als bestaande er geen heeft', () => {
  assert.equal(mergeQuantity('2', '1 fles'), '3 fles');
});
