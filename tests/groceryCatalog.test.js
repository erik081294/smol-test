// Units voor de gebundelde boodschappen-catalogus (lib/groceryCatalog.js). Puur, geen React.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, CATALOG, categoryMeta, itemByKey, itemByName, catalogByCategory, searchCatalog,
} from '../lib/groceryCatalog.js';

test('CATEGORIES: overig staat laatst (hoogste sort) en is uniek', () => {
  const keys = CATEGORIES.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);              // geen dubbele schappen
  assert.equal(CATEGORIES[CATEGORIES.length - 1].key, 'overig');
  assert.ok(CATEGORIES.every((c) => c.sort <= CATEGORIES.find((x) => x.key === 'overig').sort));
});

test('CATALOG: elk item heeft een bekende categorie, key en eenheid; keys uniek', () => {
  const catKeys = new Set(CATEGORIES.map((c) => c.key));
  const seen = new Set();
  for (const it of CATALOG) {
    assert.ok(it.key && it.name && it.unit, `incompleet item: ${JSON.stringify(it)}`);
    assert.ok(catKeys.has(it.category), `onbekende categorie: ${it.category} (${it.key})`);
    assert.ok(!seen.has(it.key), `dubbele key: ${it.key}`);
    seen.add(it.key);
  }
});

test('categoryMeta: bekende key → die categorie; onbekend/leeg → overig', () => {
  assert.equal(categoryMeta('zuivel').label, 'Zuivel & eieren');
  assert.equal(categoryMeta('bestaat-niet').key, 'overig');
  assert.equal(categoryMeta(undefined).key, 'overig');
});

test('itemByKey: bekende key → item; onbekend → null', () => {
  assert.equal(itemByKey('melk').name, 'Melk');
  assert.equal(itemByKey('zzz'), null);
});

test('catalogByCategory: schap-volgorde, lege schappen weg, alfabetisch, onbekend → overig', () => {
  const items = [
    { key: 'b', name: 'Bram', category: 'zuivel' },
    { key: 'a', name: 'Aart', category: 'zuivel' },
    { key: 'x', name: 'Xenia', category: 'verzonnen' }, // onbekend → overig
  ];
  const groups = catalogByCategory(items);
  const order = groups.map((g) => g.key);
  // zuivel (sort 20) staat vóór overig (sort 999)
  assert.deepEqual(order, ['zuivel', 'overig']);
  // binnen zuivel alfabetisch
  assert.deepEqual(groups[0].items.map((i) => i.name), ['Aart', 'Bram']);
  assert.deepEqual(groups[1].items.map((i) => i.key), ['x']);
});

test('searchCatalog: lege query → alle items (kopie), in oorspronkelijke volgorde', () => {
  const r = searchCatalog('', CATALOG);
  assert.equal(r.length, CATALOG.length);
  assert.notEqual(r, CATALOG); // nieuwe array, niet dezelfde referentie
  // Lege query houdt de invoer-volgorde aan (niet alfabetisch hersorteren).
  const items = [
    { key: 'z', name: 'Zeep', category: 'huishouden' },
    { key: 'a', name: 'Appel', category: 'groente-fruit' },
  ];
  assert.deepEqual(searchCatalog('', items).map((i) => i.key), ['z', 'a']);
});

test('catalogByCategory/searchCatalog: null-invoer → lege uitvoer (null-safe)', () => {
  assert.deepEqual(catalogByCategory(null), []);
  assert.deepEqual(searchCatalog('melk', null), []);
  assert.deepEqual(searchCatalog('', null), []); // lege query + null → ook leeg
});

test('searchCatalog: prefix-match staat vóór midden-in-de-naam-match', () => {
  const items = [
    { key: 'k', name: 'Karnemelk', category: 'zuivel' }, // 'melk' zit middenin
    { key: 'm', name: 'Melk', category: 'zuivel' },        // 'melk' is prefix
  ];
  assert.deepEqual(searchCatalog('melk', items).map((i) => i.key), ['m', 'k']);
});

test('searchCatalog: normaliseert (hoofdletters/diacrieten), geen match → leeg', () => {
  const items = [{ key: 'c', name: 'Crème fraîche', category: 'zuivel' }];
  assert.equal(searchCatalog('CREME', items).length, 1);
  assert.equal(searchCatalog('xyz', items).length, 0);
});

test('searchCatalog: zoekt in de standaard-catalogus via de voor-genormaliseerde namen (PERF-6)', () => {
  // Geen tweede argument → de vaste CATALOG (de voor-genormaliseerde snelle weg).
  const keys = searchCatalog('melk').map((i) => i.key);
  assert.ok(keys.includes('melk'), 'Melk moet matchen');
  // Prefix-match ('Melk') staat vóór een midden-in-de-naam-match ('Halfvolle melk').
  assert.ok(keys.indexOf('melk') < keys.indexOf('halfvolle-melk'), 'prefix vóór midden-match');
});

test('itemByName: vindt een catalogus-item op genormaliseerde naam', () => {
  const it = itemByName('  MELK ');
  assert.equal(it && it.key, 'melk');
});

test('itemByName: matcht ondanks maat-/hoeveelheidsruis in de naam', () => {
  // normalize dempt "1L" e.d. → 'halfvolle melk'
  const it = itemByName('Halfvolle melk 1L');
  assert.equal(it && it.key, 'halfvolle-melk');
});

test('itemByName: onbekende naam → null', () => {
  assert.equal(itemByName('bestaat-niet-xyz'), null);
  assert.equal(itemByName(''), null);
  assert.equal(itemByName(null), null);
});
