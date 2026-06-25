import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryKeyForGrocery, groupGroceriesByCategory } from '../lib/groceryList.js';

test('categoryKeyForGrocery: gekoppeld product wint van naam-match', () => {
  const item = { name: 'Melk', product_id: 'p1' };
  assert.equal(categoryKeyForGrocery(item, { p1: 'dranken' }), 'dranken'); // override, niet 'zuivel'
});

test('categoryKeyForGrocery: zonder product valt terug op de catalogus-naam', () => {
  assert.equal(categoryKeyForGrocery({ name: 'Melk' }), 'zuivel'); // itemByName('Melk') → zuivel
});

test('categoryKeyForGrocery: onbekende naam → overig', () => {
  assert.equal(categoryKeyForGrocery({ name: 'Iets vaags xyz' }), 'overig');
});

test('categoryKeyForGrocery: leeg/undefined item → overig (geen crash)', () => {
  assert.equal(categoryKeyForGrocery(undefined), 'overig');
  assert.equal(categoryKeyForGrocery({}), 'overig');
});

test('categoryKeyForGrocery: product-categorie buiten de taxonomie wordt naar overig geklemd', () => {
  const item = { name: 'X', product_id: 'p9' };
  assert.equal(categoryKeyForGrocery(item, { p9: 'niet-bestaand-schap' }), 'overig');
});

test('groupGroceriesByCategory: groepeert op supermarkt-volgorde, lege schappen weg', () => {
  const items = [
    { id: '1', name: 'Brood' },     // brood (sort 50)
    { id: '2', name: 'Melk' },      // zuivel (sort 20)
    { id: '3', name: 'Appels' },    // groente-fruit (sort 10)
    { id: '4', name: 'Volkorenbrood' }, // brood
  ];
  const groups = groupGroceriesByCategory(items);
  assert.deepEqual(groups.map((g) => g.key), ['groente-fruit', 'zuivel', 'brood']); // sort 10,20,50
  assert.equal(groups[0].emoji, '🥦');
  assert.deepEqual(groups[2].data.map((i) => i.id), ['1', '4']); // beide brood, invoervolgorde
});

test('groupGroceriesByCategory: categoryById stuurt de indeling', () => {
  const items = [{ id: '1', name: 'Onbekend', product_id: 'p9' }];
  const groups = groupGroceriesByCategory(items, { categoryById: { p9: 'huishouden' } });
  assert.equal(groups[0].key, 'huishouden');
});

test('groupGroceriesByCategory: onbekende producten landen in "overig" (laatst)', () => {
  const items = [{ id: '1', name: 'Appels' }, { id: '2', name: 'Iets vaags xyz' }];
  const groups = groupGroceriesByCategory(items);
  assert.equal(groups[groups.length - 1].key, 'overig'); // overig altijd laatst (sort 999)
});

test('groupGroceriesByCategory: lege/null invoer → lege lijst', () => {
  assert.deepEqual(groupGroceriesByCategory([]), []);
  assert.deepEqual(groupGroceriesByCategory(), []);
  assert.deepEqual(groupGroceriesByCategory(null), []);
});
