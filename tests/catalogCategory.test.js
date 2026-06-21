// Units voor de OFF → Huishoek-categorie-mapping (lib/offCategoryMap.js).
// De mapping vouwt granulaire Open Food Facts-tags tot één winkel-"schap"; deze
// test borgt dat de bekende gevallen in het juiste schap belanden en dat ruis op
// 'overig' terugvalt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCategory, CATEGORY_KEYS } from '../lib/offCategoryMap.js';

test('canonieke OFF-tags landen in het juiste schap', () => {
  assert.equal(mapCategory({ categories_tags: ['en:dairies', 'en:yogurts'] }), 'zuivel');
  assert.equal(mapCategory({ categories_tags: ['en:cheeses'] }), 'kaas-vleeswaren');
  assert.equal(mapCategory({ categories_tags: ['en:frozen-pizzas'] }), 'diepvries');
  assert.equal(mapCategory({ categories_tags: ['en:sodas', 'en:beverages'] }), 'dranken');
  assert.equal(mapCategory({ categories_tags: ['en:fresh-vegetables'] }), 'groente-fruit');
});

test('kaas/vis winnen van de bredere zuivel/vlees-regels', () => {
  // 'en:cheeses' bevat geen 'dairy'-trefwoord, maar de kaas-regel staat sowieso
  // vóór zuivel — een gemengde tag-set mag niet per ongeluk in zuivel vallen.
  assert.equal(mapCategory({ categories_tags: ['en:dairies', 'en:cheeses'] }), 'kaas-vleeswaren');
  assert.equal(mapCategory({ categories_tags: ['en:fish', 'en:smoked-salmons'] }), 'vlees-vis');
});

test('pnns_groups_1 is de terugval als tags niets opleveren', () => {
  assert.equal(mapCategory({ categories_tags: [], pnns_groups_1: 'Beverages' }), 'dranken');
  assert.equal(mapCategory({ pnns_groups_1: 'Fruits and vegetables' }), 'groente-fruit');
});

test('onbekend valt terug op overig en is een geldige schap-key', () => {
  assert.equal(mapCategory({ categories_tags: ['en:something-weird'] }), 'overig');
  assert.equal(mapCategory({}), 'overig');
  assert.ok(CATEGORY_KEYS.includes('overig'));
});
