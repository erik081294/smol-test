// Units voor de pure "Vaste boodschappen"-groepering/sortering (lib/favoriteGroceries.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFavorites, topFavorites, hiddenProducts, recentProducts, searchOwnProducts } from '../lib/favoriteGroceries.js';

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

test('recentProducts: sorteert op recentheid (laatst toegevoegd eerst)', () => {
  // id1 is recenter dan id2, ook al is id2 vaker gekozen → recentheid wint.
  assert.deepEqual(recentProducts(products).map((p) => p.id), ['1', '2']);
});

test('recentProducts: producten zonder last_added_at vallen weg', () => {
  // id3 (times_added 5) en id4 hebben last_added_at null → eruit, ondanks gebruik.
  const ids = recentProducts(products).map((p) => p.id);
  assert.ok(!ids.includes('3'));
  assert.ok(!ids.includes('4'));
});

test('recentProducts: verborgen producten vallen weg', () => {
  const prods = [{ id: '9', name: 'Boter', search: 'boter', times_added: 1, last_added_at: '2026-06-21T10:00:00Z', hidden: true }];
  assert.equal(recentProducts(prods).length, 0);
});

test('recentProducts: recentheid wint van gebruik én naam (tegengestelde signalen)', () => {
  // A is recenter maar minder gekozen en alfabetisch later; B is ouder, vaker, eerder.
  // Recentheid moet domineren → A vóór B.
  const prods = [
    { id: 'A', name: 'Zeep', search: 'zeep', times_added: 1, last_added_at: '2026-06-20T10:00:00Z' },
    { id: 'B', name: 'Appel', search: 'appel', times_added: 9, last_added_at: '2026-06-19T10:00:00Z' },
  ];
  assert.deepEqual(recentProducts(prods).map((p) => p.id), ['A', 'B']);
});

test('recentProducts: bij gelijke recentheid wint gebruik van naam (tegengestelde signalen)', () => {
  // Gelijke datum: Y is vaker gekozen maar alfabetisch later, X minder maar eerder.
  // Gebruik moet de naam-tie-break verslaan → Y vóór X.
  const same = '2026-06-20T10:00:00Z';
  const prods = [
    { id: 'X', name: 'Appel', search: 'appel', times_added: 1, last_added_at: same },
    { id: 'Y', name: 'Zeep', search: 'zeep', times_added: 9, last_added_at: same },
  ];
  assert.deepEqual(recentProducts(prods).map((p) => p.id), ['Y', 'X']);
});

test('recentProducts: bij gelijke recentheid én gebruik beslist de naam (NL)', () => {
  const same = '2026-06-20T10:00:00Z';
  const prods = [
    { id: 'q', name: 'Boter', search: 'boter', times_added: 3, last_added_at: same },
    { id: 'p', name: 'Appel', search: 'appel', times_added: 3, last_added_at: same },
  ];
  assert.deepEqual(recentProducts(prods).map((p) => p.id), ['p', 'q']); // Appel < Boter
});

test('recentProducts: tie-break op gebruik dan naam bij gelijke recentheid', () => {
  const same = '2026-06-20T10:00:00Z';
  const prods = [
    { id: 'b', name: 'Boter', search: 'boter', times_added: 1, last_added_at: same },
    { id: 'a', name: 'Appel', search: 'appel', times_added: 9, last_added_at: same },
    { id: 'c', name: 'Citroen', search: 'citroen', times_added: 1, last_added_at: same },
  ];
  // gelijke datum → meest gekozen eerst (a), daarna alfabetisch (b vóór c).
  assert.deepEqual(recentProducts(prods).map((p) => p.id), ['a', 'b', 'c']);
});

test('recentProducts: respecteert de cap n (default 24 zonder argument)', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: String(i), name: `P${i}`, search: `p${i}`, times_added: 1,
    last_added_at: `2026-06-${String(10 + (i % 20)).padStart(2, '0')}T10:00:00Z`,
  }));
  assert.equal(recentProducts(many, { n: 5 }).length, 5);
  assert.equal(recentProducts(many).length, 24); // default-cap
});

test('recentProducts: filtert op zoekterm (search-veld)', () => {
  const ids = recentProducts(products, { query: 'melk' }).map((p) => p.id);
  assert.deepEqual(ids, ['1']); // 'Halfvolle melk'
});

test('recentProducts() zonder argumenten → lege lijst (default-param)', () => {
  assert.deepEqual(recentProducts(), []);
});

test('searchOwnProducts: vindt een eigen product ZONDER last_added_at (de bug)', () => {
  // Kern van BOO-13: een zojuist aangemaakt product dat nog nooit gelijst is, moet tóch
  // op naam vindbaar zijn — anders krijg je "Niets gevonden" en maak je een duplicaat.
  const prods = [{ id: 'k', name: 'Kwarktest', search: 'kwarktest', times_added: 0, last_added_at: null }];
  assert.deepEqual(searchOwnProducts(prods, { query: 'kwark' }).map((p) => p.id), ['k']);
  assert.deepEqual(recentProducts(prods, { query: 'kwark' }).map((p) => p.id), []); // recent zou 'm missen
});

test('searchOwnProducts: verborgen producten vallen weg', () => {
  const prods = [{ id: 'h', name: 'Boter', search: 'boter', hidden: true }];
  assert.equal(searchOwnProducts(prods, { query: 'boter' }).length, 0);
});

test('searchOwnProducts: sorteert op gebruik → recentheid → naam', () => {
  const same = '2026-06-20T10:00:00Z';
  const prods = [
    { id: 'b', name: 'Boter', search: 'boterham', times_added: 1, last_added_at: same },
    { id: 'a', name: 'Appelstroop', search: 'appelstroop', times_added: 9, last_added_at: same },
    { id: 'c', name: 'Chocopasta', search: 'chocopasta', times_added: 1, last_added_at: same },
  ];
  // query matcht alle drie via een gedeelde substring? Nee — filter op 'o': boterham/chocopasta/appelstroop
  // bevatten allemaal een 'o'. Meest gekozen eerst (a), dan alfabetisch (b vóór c).
  assert.deepEqual(searchOwnProducts(prods, { query: 'o' }).map((p) => p.id), ['a', 'b', 'c']);
});

test('searchOwnProducts: lege/ontbrekende query → lege lijst', () => {
  const prods = [{ id: '1', name: 'Melk', search: 'melk' }];
  assert.deepEqual(searchOwnProducts(prods, { query: '' }).map((p) => p.id), []);
  assert.deepEqual(searchOwnProducts(prods).map((p) => p.id), []);
  assert.deepEqual(searchOwnProducts(), []);
});

test('searchOwnProducts: respecteert de cap n', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Pomp${i}`, search: `pomp${i}`, times_added: 1 }));
  assert.equal(searchOwnProducts(many, { query: 'pomp', n: 5 }).length, 5);
  assert.equal(searchOwnProducts(many, { query: 'pomp' }).length, 24); // default-cap
});
