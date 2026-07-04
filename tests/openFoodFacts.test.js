// Units voor de Open Food Facts-koppeling (BOO-9, lib/openFoodFacts.js). De parser
// (parseOffProduct) is puur; de fetch-wrapper (fetchOffProduct) krijgt een
// geïnjecteerde fetchImpl zodat ook die zonder netwerk testbaar is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOffProduct, fetchOffProduct } from '../lib/openFoodFacts.js';

// --- parseOffProduct: de pure map van OFF v2-respons → catalog_products-vorm ---

test('parseOffProduct: mapt een volledig product en normaliseert de zoekterm', () => {
  const json = {
    status: 1,
    product: {
      code: '8710400012345',
      product_name: 'Halfvolle Melk 1L',
      brands: 'Campina',
      quantity: '1 L',
      image_url: 'https://off.cdn/melk.jpg',
      categories_tags: ['en:dairies', 'en:milks'],
    },
  };
  const out = parseOffProduct(json, '8710400012345');
  assert.equal(out.code, '8710400012345');
  assert.equal(out.name, 'Halfvolle Melk 1L');
  assert.equal(out.brands, 'Campina');
  assert.equal(out.quantity, '1 L');
  assert.equal(out.image_url, 'https://off.cdn/melk.jpg');
  assert.equal(out.category, 'zuivel');           // via mapCategory (en:milks)
  assert.equal(out.search, 'halfvolle melk');     // via normalize (maat-ruis weg)
});

test('parseOffProduct: product_name_nl wint van product_name', () => {
  const json = { status: 1, product: { code: '111', product_name: 'Milk', product_name_nl: 'Melk' } };
  assert.equal(parseOffProduct(json, '111').name, 'Melk');
});

test('parseOffProduct: valt terug op product_name als _nl leeg is (falsy)', () => {
  // Lege string is falsy → de || pakt product_name.
  assert.equal(parseOffProduct({ status: 1, product: { code: '111', product_name: 'Bread', product_name_nl: '' } }, '111').name, 'Bread');
  // Ontbrekend _nl → idem.
  assert.equal(parseOffProduct({ status: 1, product: { code: '111', product_name: 'Bread' } }, '111').name, 'Bread');
});

test('parseOffProduct: een _nl die enkel spaties is (truthy) → null (geen naam na trim)', () => {
  // '   ' is truthy, dus || houdt 'm vast; na .trim() leeg → geen bruikbaar product.
  const json = { status: 1, product: { code: '111', product_name: 'Bread', product_name_nl: '   ' } };
  assert.equal(parseOffProduct(json, '111'), null);
});

test('parseOffProduct: trimt de naam', () => {
  const json = { status: 1, product: { code: '111', product_name: '  Kaas  ' } };
  assert.equal(parseOffProduct(json, '111').name, 'Kaas');
});

test('parseOffProduct: null wanneer er geen product-object is', () => {
  assert.equal(parseOffProduct({}, '111'), null);
  assert.equal(parseOffProduct(null, '111'), null);
  assert.equal(parseOffProduct(undefined, '111'), null);
});

test('parseOffProduct: null bij status 0 (niet gevonden), zelfs met product-payload', () => {
  const json = { status: 0, product: { code: '111', product_name: 'Spook' } };
  assert.equal(parseOffProduct(json, '111'), null);
});

test('parseOffProduct: null wanneer er geen bruikbare naam is', () => {
  assert.equal(parseOffProduct({ status: 1, product: { code: '111' } }, '111'), null);
  assert.equal(parseOffProduct({ status: 1, product: { code: '111', product_name: '   ' } }, '111'), null);
});

test('parseOffProduct: stript non-digits uit de code en valt terug op p.code', () => {
  // meegegeven code met ruis
  const a = parseOffProduct({ status: 1, product: { product_name: 'X' } }, '  871-040 0012345 ');
  assert.equal(a.code, '8710400012345');
  // geen meegegeven code → p.code
  const b = parseOffProduct({ status: 1, product: { code: '5410228', product_name: 'X' } }, null);
  assert.equal(b.code, '5410228');
});

test('parseOffProduct: null wanneer er na opschonen geen cijfercode overblijft', () => {
  const json = { status: 1, product: { product_name: 'X' } };
  assert.equal(parseOffProduct(json, 'abc-def'), null);
  assert.equal(parseOffProduct(json, ''), null);
});

test('parseOffProduct: lege/ontbrekende optionele velden → null (niet lege string)', () => {
  const json = { status: 1, product: { code: '111', product_name: 'X', brands: '  ', quantity: '' } };
  const out = parseOffProduct(json, '111');
  assert.equal(out.brands, null);
  assert.equal(out.quantity, null);
  assert.equal(out.image_url, null); // geen image_url én geen image_front_url
});

test('parseOffProduct: image_url valt terug op image_front_url', () => {
  const json = { status: 1, product: { code: '111', product_name: 'X', image_front_url: 'https://off.cdn/front.jpg' } };
  assert.equal(parseOffProduct(json, '111').image_url, 'https://off.cdn/front.jpg');
  // en image_url wint als beide er zijn
  const json2 = { status: 1, product: { code: '111', product_name: 'X', image_url: 'a', image_front_url: 'b' } };
  assert.equal(parseOffProduct(json2, '111').image_url, 'a');
});

test('parseOffProduct: categorie valt op overig als niets matcht', () => {
  const json = { status: 1, product: { code: '111', product_name: 'Mysterie' } };
  assert.equal(parseOffProduct(json, '111').category, 'overig');
});

// --- fetchOffProduct: dunne, injecteerbare fetch-schil ---

function okResponse(json) {
  return { ok: true, json: async () => json };
}

test('fetchOffProduct: haalt op, bouwt de v2-URL met de opgeschoonde code en parst', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return okResponse({ status: 1, product: { code: '5410228', product_name: 'Choco' } });
  };
  const out = await fetchOffProduct(' 5410-228 ', { fetchImpl });
  assert.ok(calledUrl.includes('/api/v2/product/5410228.json'), `URL bevat opgeschoonde code: ${calledUrl}`);
  assert.equal(out.name, 'Choco');
  assert.equal(out.code, '5410228');
});

test('fetchOffProduct: null bij lege/ongeldige code — zonder de fetch te doen', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return okResponse({}); };
  assert.equal(await fetchOffProduct('', { fetchImpl }), null);
  assert.equal(await fetchOffProduct('abc', { fetchImpl }), null);
  assert.equal(called, false, 'geen netwerkcall bij een lege code');
});

test('fetchOffProduct: null wanneer de respons niet ok is', async () => {
  const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
  assert.equal(await fetchOffProduct('111', { fetchImpl }), null);
});

test('fetchOffProduct: null (stille terugval) wanneer fetch gooit', async () => {
  const fetchImpl = async () => { throw new Error('offline'); };
  assert.equal(await fetchOffProduct('111', { fetchImpl }), null);
});

test('fetchOffProduct: null wanneer OFF status 0 teruggeeft', async () => {
  const fetchImpl = async () => okResponse({ status: 0 });
  assert.equal(await fetchOffProduct('111', { fetchImpl }), null);
});
