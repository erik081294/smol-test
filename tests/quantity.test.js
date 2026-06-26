import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity, formatQuantity, mergeQuantity, parseAmount } from '../lib/quantity.js';

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

test('formatQuantity: behoudt decimalen i.p.v. afkappen (BOO-12)', () => {
  assert.equal(formatQuantity(2.9, 'pak'), '2.9 pak');
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

// --- BOO-12: decimale hoeveelheden (kg/l) blijven behouden -------------------

test('parseQuantity: decimaal met punt blijft behouden', () => {
  assert.deepEqual(parseQuantity('2.5 kg'), { count: 2.5, unit: 'kg' });
});

test('parseQuantity: komma telt óók als decimaalteken (NL-invoer)', () => {
  assert.deepEqual(parseQuantity('1,5 kg'), { count: 1.5, unit: 'kg' });
});

test('parseQuantity: decimaal zonder eenheid', () => {
  assert.deepEqual(parseQuantity('2.5'), { count: 2.5, unit: '' });
});

test('parseQuantity: positieve breuk < 1 blijft staan (niet naar 1 opgehoogd)', () => {
  assert.deepEqual(parseQuantity('0.5 kg'), { count: 0.5, unit: 'kg' });
});

test('parseQuantity: rondt af op 3 decimalen', () => {
  assert.deepEqual(parseQuantity('1.2345 kg'), { count: 1.235, unit: 'kg' });
});

test('parseQuantity: losse beginpunt zonder cijfer telt als naam (anker vereist een cijfer)', () => {
  // '.5 kg' heeft geen cijfer vóór de punt → de regex matcht niet → hele tekst is "eenheid".
  assert.deepEqual(parseQuantity('.5 kg'), { count: 1, unit: '.5 kg' });
});

test('formatQuantity: decimaal toont volledig met eenheid', () => {
  assert.equal(formatQuantity(2.5, 'kg'), '2.5 kg');
});

test('formatQuantity: breuk onder de grens (1.5) toont tóch — alleen héél 1 verbergt', () => {
  assert.equal(formatQuantity(1.5, 'kg'), '1.5 kg');
  assert.equal(formatQuantity(1, 'kg'), null);
});

test('formatQuantity: breuk < 1 toont volledig', () => {
  assert.equal(formatQuantity(0.5, 'l'), '0.5 l');
});

test('formatQuantity: negatieve breuk -> null (niet "-0.5")', () => {
  assert.equal(formatQuantity(-0.5, 'kg'), null);
});

test('formatQuantity: rondt float-ruis weg (0.1 + 0.2 -> 0.3)', () => {
  assert.equal(formatQuantity(0.1 + 0.2, 'kg'), '0.3 kg');
});

test('parse -> format is rondreis-stabiel voor een decimaal', () => {
  const { count, unit } = parseQuantity('2.5 kg');
  assert.equal(formatQuantity(count, unit), '2.5 kg');
});

test('mergeQuantity: telt decimalen correct op (regressie: was "3 .5 kg")', () => {
  assert.equal(mergeQuantity('2.5 kg', '1 kg'), '3.5 kg');
});

test('mergeQuantity: decimale som die op een heel getal uitkomt laat de fractie vallen', () => {
  assert.equal(mergeQuantity('2.5 kg', '0.5 kg'), '3 kg');
});

test('mergeQuantity: float-ruis bij optellen wordt weggerond', () => {
  assert.equal(mergeQuantity('0.1 kg', '0.2 kg'), '0.3 kg');
});

// --- parseAmount: strikt numeriek voor het typbare hoeveelheid-veld (MLT) --------

test('parseAmount: heel getal', () => {
  assert.equal(parseAmount('250'), 250);
});

test('parseAmount: decimaal met punt én komma (NL)', () => {
  assert.equal(parseAmount('1.5'), 1.5);
  assert.equal(parseAmount('1,5'), 1.5);
});

test('parseAmount: breuk < 1 blijft staan', () => {
  assert.equal(parseAmount('0.5'), 0.5);
});

test('parseAmount: trimt omliggende spaties', () => {
  assert.equal(parseAmount('  2  '), 2);
});

test('parseAmount: rondt af op 3 decimalen', () => {
  assert.equal(parseAmount('1,2345'), 1.235);
});

test('parseAmount: lege/null/undefined -> null', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
});

test('parseAmount: niet-numeriek -> null', () => {
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('2 pak'), null);   // eenheid erbij = geen schoon getal
  assert.equal(parseAmount('1.2.3'), null);
});

test('parseAmount: nul en negatief -> null (geen geldige hoeveelheid)', () => {
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-2'), null);
});
