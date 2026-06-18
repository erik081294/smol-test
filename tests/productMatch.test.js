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
