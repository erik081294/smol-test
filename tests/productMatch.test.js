// Units voor de pure productmatching (lib/productMatch.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, similarity, suggestions, bestMatch } from '../lib/productMatch.js';

test('normalize: lowercase, diacritics, maat-/getalruis, dubbele spaties weg', () => {
  assert.equal(normalize('Halfvolle Melk 1L'), 'halfvolle melk');
  assert.equal(normalize('Café Crème'), 'cafe creme');
  assert.equal(normalize('AH  Halfvolle   melk 500 g'), 'ah halfvolle melk');
  assert.equal(normalize(''), '');
  assert.equal(normalize(null), '');
});

test('similarity: hoog voor varianten, laag voor onverwante namen, 1 bij identiek', () => {
  assert.equal(similarity('halfvolle melk', 'Halfvolle melk 1L'), 1); // gelijk na normalisatie
  assert.ok(similarity('halfvolle melk', 'volle melk') > 0.6);
  assert.ok(similarity('melk', 'fiets') < 0.3);
  assert.equal(similarity('', ''), 1);
  assert.equal(similarity('melk', ''), 0);
});

test('bestMatch: respecteert de drempel', () => {
  const products = [
    { id: 'p1', name: 'Halfvolle melk' },
    { id: 'p2', name: 'Bananen' },
  ];
  assert.equal(bestMatch('halfvolle melk 1L', products, 0.6).product.id, 'p1'); // exact na normalisatie
  assert.equal(bestMatch('volle melk', products, 0.99), null); // lijkt erop, maar haalt 0.99 niet
  assert.equal(bestMatch('volle melk', products, 0.6).product.id, 'p1'); // wél boven 0.6
  assert.equal(bestMatch('appeltaart', products, 0.6), null);
});

test('suggestions: gesorteerd op score, deterministische tie-break op id', () => {
  // Twee identieke namen met verschillende id -> gelijke score, laagste id eerst.
  const products = [
    { id: 'b', name: 'Melk' },
    { id: 'a', name: 'Melk' },
    { id: 'c', name: 'Brood' },
  ];
  const s = suggestions('melk', products, 3);
  assert.equal(s[0].product.id, 'a');
  assert.equal(s[1].product.id, 'b');
  assert.equal(s[2].product.id, 'c');
  assert.ok(s[0].score >= s[1].score && s[1].score >= s[2].score);
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// leestekens, meercijferige/decimale hoeveelheden, exacte similariteitswaarden
// (bigram-grens, telling, min vs max), top-N afkapping en de drempelgrens.

test('normalize: leestekens worden spaties (niet behouden)', () => {
  assert.equal(normalize('AH! Melk & Brood'), 'ah melk brood');
  assert.equal(normalize('Choco-pasta'), 'choco pasta');
});

test('normalize: meercijferige en decimale hoeveelheden vallen volledig weg', () => {
  assert.equal(normalize('Cola 1500 ml'), 'cola');
  assert.equal(normalize('Melk 1,50 l'), 'melk');
  assert.equal(normalize('Yoghurt 0,5kg'), 'yoghurt');
  assert.equal(normalize('Brood 1500'), 'brood'); // los meercijferig getal zonder eenheid
});

test('similarity: exacte Dice-waarden (grens, telling en doorsnede)', () => {
  // 'abc' vs 'abd': gedeelde bigram {ab}; 2*1/(2+2) = 0,5
  assert.equal(similarity('abc', 'abd'), 0.5);
  // herhaalde bigram: 'aaa' {aa:2} vs 'aa' {aa:1} → 2*min(2,1)/(2+1) = 2/3
  assert.ok(Math.abs(similarity('aaa', 'aa') - 2 / 3) < 1e-9);
});

test('suggestions: kapt af op n (niet de hele lijst)', () => {
  const products = [
    { id: 'p1', name: 'Melk' }, { id: 'p2', name: 'Melkpak' },
    { id: 'p3', name: 'Brood' }, { id: 'p4', name: 'Kaas' },
  ];
  assert.equal(suggestions('melk', products, 2).length, 2);
});

test('suggestions: id-tie-break onafhankelijk van de invoervolgorde', () => {
  const mk = (ids) => ids.map((id) => ({ id, name: 'Melk' })); // gelijke score
  assert.deepEqual(suggestions('melk', mk(['b', 'a']), 2).map((s) => s.product.id), ['a', 'b']);
  assert.deepEqual(suggestions('melk', mk(['a', 'b']), 2).map((s) => s.product.id), ['a', 'b']);
});

test('bestMatch: score precies op de drempel telt nog mee (>=)', () => {
  const products = [{ id: 'p', name: 'abd' }];
  assert.equal(bestMatch('abc', products, 0.5).product.id, 'p'); // 0,5 >= 0,5
  assert.equal(bestMatch('abc', products, 0.5000001), null);     // net te hoog
});
