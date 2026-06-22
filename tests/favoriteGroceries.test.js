// Units voor de pure "Vaste boodschappen"-groepering/sortering (lib/favoriteGroceries.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFavorites, topFavorites, hiddenProducts } from '../lib/favoriteGroceries.js';

const categories = [
  { key: 'zuivel', label: 'Zuivel & eieren', emoji: '🥛', sort: 20 },
  { key: 'groente-fruit', label: 'Groente & fruit', emoji: '🥦', sort: 10 },
  { key: 'overig', label: 'Overig', emoji: '🛒', sort: 999 },
];
const products = [
  { id: '1', name: 'Halfvolle melk', search: 'halfvolle melk', category: 'zuivel', times_added: 12, last_added_at: '2026-06-20T10:00:00Z' },
  { id: '2', name: 'Yoghurt', search: 'yoghurt', category: 'zuivel', times_added: 3, last_added_at: '2026-06-19T10:00:00Z' },
  { id: '3', name: 'Appels', search: 'appels', category: 'groente-fruit', times_added: 5, last_added_at: null },
  { id: '4', name: 'Iets nieuws', search: 'iets nieuws', category: null, times_added: 0, last_added_at: null },
];

test('groupFavorites: groepeert per schap op catalogus-volgorde (sort)', () => {
  const groups = groupFavorites(products, categories);
  assert.deepEqual(groups.map((g) => g.key), ['groente-fruit', 'zuivel', 'overig']); // sort 10,20,999
  assert.equal(groups[0].label, 'Groente & fruit');
  assert.equal(groups[1].emoji, '🥛');
});

test('groupFavorites: sorteert binnen een schap op gebruik (times_added) desc', () => {
  const zuivel = groupFavorites(products, categories).find((g) => g.key === 'zuivel');
  assert.deepEqual(zuivel.items.map((p) => p.id), ['1', '2']); // 12 vóór 3
});

test('groupFavorites: onbekende/null categorie valt onder overig met fallback-label', () => {
  const overig = groupFavorites(products, categories).find((g) => g.key === 'overig');
  assert.deepEqual(overig.items.map((p) => p.id), ['4']);
});

test('groupFavorites: filtert op zoekterm (genormaliseerd, substring)', () => {
  const groups = groupFavorites(products, categories, { query: 'melk' });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'zuivel');
  assert.deepEqual(groups[0].items.map((p) => p.id), ['1']);
});

test('groupFavorites: gelijke times_added → recency (nieuwste eerst), dan naam', () => {
  const tie = [
    { id: 'a', name: 'B-naam', category: 'overig', times_added: 2, last_added_at: '2026-06-01T00:00:00Z' },
    { id: 'b', name: 'A-naam', category: 'overig', times_added: 2, last_added_at: '2026-06-10T00:00:00Z' },
    { id: 'c', name: 'C-naam', category: 'overig', times_added: 2, last_added_at: null },
  ];
  const g = groupFavorites(tie, categories)[0];
  assert.deepEqual(g.items.map((p) => p.id), ['b', 'a', 'c']); // 06-10 > 06-01 > null
});

test('groupFavorites: lege input → lege lijst', () => {
  assert.deepEqual(groupFavorites([], categories), []);
});

test('topFavorites: globaal meest gekozen, times_added>0, gecapt', () => {
  const top = topFavorites(products, { n: 2 });
  assert.deepEqual(top.map((p) => p.id), ['1', '3']); // 12, 5 (id 4 heeft 0 → eruit; cap 2)
});

test('verborgen producten vallen uit groups én top', () => {
  const withHidden = [...products, { id: '5', name: 'Verstopt', search: 'verstopt', category: 'zuivel', times_added: 99, hidden: true }];
  const groups = groupFavorites(withHidden, categories);
  const zuivel = groups.find((g) => g.key === 'zuivel');
  assert.ok(!zuivel.items.some((p) => p.id === '5'), 'verborgen niet in groups');
  assert.ok(!topFavorites(withHidden, { n: 5 }).some((p) => p.id === '5'), 'verborgen niet in top');
});

test('hiddenProducts: alleen verborgen, op naam, met filter', () => {
  const withHidden = [
    { id: 'a', name: 'Zeep', search: 'zeep', hidden: true },
    { id: 'b', name: 'Appel', search: 'appel', hidden: true },
    { id: 'c', name: 'Melk', search: 'melk', hidden: false },
  ];
  assert.deepEqual(hiddenProducts(withHidden).map((p) => p.id), ['b', 'a']); // op naam
  assert.deepEqual(hiddenProducts(withHidden, { query: 'zeep' }).map((p) => p.id), ['a']);
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// de tie-break-trap (recency vóór naam, dan naam), search-veld los van naam,
// times_added-grens en een categorie buiten de taxonomie.

test('sortering binnen schap: gelijke times_added → recency wint van alfabet', () => {
  const tie = [
    { id: 'x', name: 'Zzz', category: 'overig', times_added: 2, last_added_at: '2026-06-10T00:00:00Z' }, // recenter, naam laat
    { id: 'y', name: 'Aaa', category: 'overig', times_added: 2, last_added_at: '2026-06-01T00:00:00Z' }, // ouder, naam vroeg
  ];
  assert.deepEqual(groupFavorites(tie, categories)[0].items.map((p) => p.id), ['x', 'y']);
});

test('sortering binnen schap: gelijke recency (beide null) → op naam', () => {
  const tie = [
    { id: 'z', name: 'Zzz', category: 'overig', times_added: 2, last_added_at: null },
    { id: 'a', name: 'Aaa', category: 'overig', times_added: 2, last_added_at: null },
  ];
  assert.deepEqual(groupFavorites(tie, categories)[0].items.map((p) => p.id), ['a', 'z']);
});

test('matchesQuery: matcht op het search-veld los van de naam', () => {
  const prods = [{ id: '1', name: 'Heel iets anders', search: 'abc', category: 'overig', times_added: 1 }];
  assert.equal(groupFavorites(prods, categories, { query: 'abc' })[0].items.length, 1);
});

test('topFavorites: times_added 0 valt weg, ook bij ruime n', () => {
  assert.deepEqual(topFavorites(products, { n: 5 }).map((p) => p.id), ['1', '3', '2']); // 12,5,3; id4 (0) eruit
});

test('groupFavorites: categorie buiten de taxonomie → fallback-label = key, emoji null', () => {
  const g = groupFavorites([{ id: '1', name: 'X', category: 'onbekend-schap', times_added: 1 }], categories);
  assert.equal(g[0].key, 'onbekend-schap');
  assert.equal(g[0].label, 'onbekend-schap');
  assert.equal(g[0].emoji, null);
});
