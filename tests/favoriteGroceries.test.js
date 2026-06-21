// Units voor de pure "Vaste boodschappen"-groepering/sortering (lib/favoriteGroceries.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFavorites } from '../lib/favoriteGroceries.js';

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
