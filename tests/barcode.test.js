// Units voor de barcode- + Open Food Facts-helpers (BOO-9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBarcode, isValidBarcode, toEan13 } from '../lib/barcode.js';
import { parseOffProduct, fetchOffProduct } from '../lib/openFoodFacts.js';

test('normalizeBarcode: houdt alleen cijfers over', () => {
  assert.equal(normalizeBarcode(' 40 06381-333931 '), '4006381333931');
  assert.equal(normalizeBarcode(null), '');
});

test('isValidBarcode: canonieke geldige codes (EAN-13/UPC-A/EAN-8)', () => {
  assert.equal(isValidBarcode('4006381333931'), true); // EAN-13 (Wikipedia)
  assert.equal(isValidBarcode('036000291452'), true);  // UPC-A (Wikipedia)
  assert.equal(isValidBarcode('73513537'), true);      // EAN-8 (Wikipedia)
});

test('isValidBarcode: verkeerd controlecijfer / lengte → ongeldig', () => {
  assert.equal(isValidBarcode('4006381333930'), false); // check-digit fout
  assert.equal(isValidBarcode('123'), false);            // te kort
  assert.equal(isValidBarcode('abcd'), false);
});

test('toEan13: UPC-A (12) krijgt een leidende 0; EAN-13 blijft gelijk', () => {
  assert.equal(toEan13('036000291452'), '0036000291452');
  assert.equal(toEan13('4006381333931'), '4006381333931');
});

test('parseOffProduct: mapt naar de catalog-vorm (NL-naam wint)', () => {
  const out = parseOffProduct({
    status: 1,
    product: {
      product_name: 'Semi-skimmed milk', product_name_nl: 'Halfvolle melk',
      brands: ' AH ', quantity: '1 L', image_url: 'https://off/img.jpg',
    },
  }, '4006381333931');
  assert.deepEqual(out, {
    code: '4006381333931', name: 'Halfvolle melk', brands: 'AH', quantity: '1 L',
    image_url: 'https://off/img.jpg', category: 'overig', search: 'halfvolle melk',
  });
});

test('parseOffProduct: categorie wordt gemapt uit categories_tags (zelfde brein als de dump)', () => {
  const out = parseOffProduct({
    status: 1,
    product: { product_name_nl: 'Halfvolle melk', categories_tags: ['en:dairies', 'en:milks'] },
  }, '4006381333931');
  assert.equal(out.category, 'zuivel');
});

test('parseOffProduct: niet gevonden / geen naam → null', () => {
  assert.equal(parseOffProduct({ status: 0 }, '123'), null);
  assert.equal(parseOffProduct({ status: 1, product: { product_name: '  ' } }, '123'), null);
});

test('fetchOffProduct: faalt stil bij not-ok of exception', async () => {
  assert.equal(await fetchOffProduct('123', { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await fetchOffProduct('123', { fetchImpl: async () => { throw new Error('offline'); } }), null);
  const ok = await fetchOffProduct('4006381333931', {
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 1, product: { product_name: 'Melk' } }) }),
  });
  assert.equal(ok.name, 'Melk');
});
