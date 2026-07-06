// Units voor de globaal-zoeken-logica (lib/searchRank.js, PLT-3). Puur, geen React.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRank, rankResults, routeForHit, moduleForKind } from '../lib/searchRank.js';

// ---------------------------------------------------------------------------
// matchRank — de rang-grenzen (exact=0 > prefix=1 > woordgrens=2 > substring=3 > geen=4)
// ---------------------------------------------------------------------------

test('matchRank: exacte match wint van prefix (grens 0 vs 1)', () => {
  assert.equal(matchRank('mand', 'mand'), 0);
  assert.equal(matchRank('mandarijn', 'mand'), 1);
});

test('matchRank: woordgrens wint van substring-midden-in-woord (grens 2 vs 3)', () => {
  assert.equal(matchRank('grote mand', 'mand'), 2);
  assert.equal(matchRank('boodschappenmand', 'mand'), 3);
});

test('matchRank: geen match → 4', () => {
  assert.equal(matchRank('stofzuiger', 'mand'), 4);
});

test('matchRank: case-insensitief en trimt de zoekterm', () => {
  assert.equal(matchRank('Mand', 'mand'), 0);
  assert.equal(matchRank('mandarijn', '  MAND '), 1);
});

test('matchRank: interpunctie telt als woordgrens', () => {
  assert.equal(matchRank('auto-mand', 'mand'), 2);
});

test('matchRank: ontbrekende titel/zoekterm crasht niet', () => {
  assert.equal(matchRank(undefined, 'mand'), 4);
  assert.equal(matchRank('', ''), 0);   // leeg-op-leeg is exact
  assert.equal(matchRank('mand'), 1);   // lege zoekterm = prefix-van-alles
  assert.equal(matchRank(), 0);         // beide ontbrekend → '' vs '' → exact
});

test('matchRank: woordgrens kijkt naar het teken vóór de match, niet elders in de titel', () => {
  // De spatie elders in de titel telt niet: vóór "mand" staat hier een letter.
  assert.equal(matchRank('de boodschappenmand', 'mand'), 3);
});

// ---------------------------------------------------------------------------
// rankResults — volledige volgorde, óók met omgekeerde invoer (sorteer-vergelijker)
// ---------------------------------------------------------------------------

const HITS = [
  { kind: 'grocery', id: 'g1', title: 'boodschappenmand', happened_on: '2026-07-01' }, // substring
  { kind: 'task', id: 't1', title: 'grote mand', happened_on: '2026-07-01' },          // woordgrens
  { kind: 'recipe', id: 'r1', title: 'mandarijn', happened_on: '2026-07-01' },         // prefix
  { kind: 'plant', id: 'p1', title: 'mand', happened_on: '2026-07-01' },               // exact
];

test('rankResults: exact > prefix > woordgrens > substring (hele lijst)', () => {
  const ids = rankResults(HITS, 'mand').map((r) => r.id);
  assert.deepEqual(ids, ['p1', 'r1', 't1', 'g1']);
});

test('rankResults: zelfde volgorde bij omgekeerde invoer (vergelijker beide takken)', () => {
  const ids = rankResults([...HITS].reverse(), 'mand').map((r) => r.id);
  assert.deepEqual(ids, ['p1', 'r1', 't1', 'g1']);
});

test('rankResults: bij gelijke rang wint de recentste happened_on — ook omgekeerd', () => {
  const rows = [
    { id: 'oud', title: 'mandarijn', happened_on: '2026-01-01' },
    { id: 'nieuw', title: 'mandarijn', happened_on: '2026-07-01' },
  ];
  assert.deepEqual(rankResults(rows, 'mand').map((r) => r.id), ['nieuw', 'oud']);
  assert.deepEqual(rankResults([...rows].reverse(), 'mand').map((r) => r.id), ['nieuw', 'oud']);
});

test('rankResults: ontbrekende happened_on sorteert als oudste (?? "")', () => {
  const rows = [
    { id: 'zonder', title: 'mandarijn' },
    { id: 'met', title: 'mandarijn', happened_on: '2026-07-01' },
  ];
  assert.deepEqual(rankResults(rows, 'mand').map((r) => r.id), ['met', 'zonder']);
  assert.deepEqual(rankResults([...rows].reverse(), 'mand').map((r) => r.id), ['met', 'zonder']);
});

test('rankResults: gelijke rang én datum → invoer-volgorde blijft staan (stabiel)', () => {
  const rows = [
    { id: 'a', title: 'mandarijn', happened_on: '2026-07-01' },
    { id: 'b', title: 'mandarijn', happened_on: '2026-07-01' },
  ];
  assert.deepEqual(rankResults(rows, 'mand').map((r) => r.id), ['a', 'b']);
});

test('rankResults: lege zoekterm → alles gelijkwaardig, recentste eerst', () => {
  const rows = [
    { id: 'oud', title: 'appel', happened_on: '2026-01-01' },
    { id: 'nieuw', title: 'peer', happened_on: '2026-07-01' },
  ];
  assert.deepEqual(rankResults(rows, '').map((r) => r.id), ['nieuw', 'oud']);
});

test('rankResults: default-params → zonder argumenten een lege lijst', () => {
  assert.deepEqual(rankResults(), []);
  // Alleen rijen, geen zoekterm → gedraagt zich als lege zoekterm (recentste eerst).
  const rows = [
    { id: 'oud', title: 'appel', happened_on: '2026-01-01' },
    { id: 'nieuw', title: 'peer', happened_on: '2026-07-01' },
  ];
  assert.deepEqual(rankResults(rows).map((r) => r.id), ['nieuw', 'oud']);
  // De default-query is écht '' (exact op een lege titel), geen andere waarde.
  const met = [
    { id: 'leeg', title: '' },                              // exact op '' → wint
    { id: 'a', title: 'a', happened_on: '2026-07-01' },     // prefix, recenter
  ];
  assert.deepEqual(rankResults(met).map((r) => r.id), ['leeg', 'a']);
});

test('rankResults: een null-rij crasht niet (optional chaining op title/happened_on)', () => {
  const rows = [null, { id: 'p1', title: 'mand', happened_on: '2026-07-01' }];
  assert.deepEqual(rankResults(rows, 'mand')[0].id, 'p1');
});

test('rankResults: muteert de invoer-array niet', () => {
  const rows = [...HITS];
  rankResults(rows, 'mand');
  assert.deepEqual(rows.map((r) => r.id), HITS.map((r) => r.id));
});

// ---------------------------------------------------------------------------
// routeForHit — kind → interne route (echte route-structuur onder app/)
// ---------------------------------------------------------------------------

test('routeForHit: detail-soorten → hun detailscherm', () => {
  assert.equal(routeForHit({ kind: 'task', id: 't1' }), '/task/t1');
  assert.equal(routeForHit({ kind: 'recipe', id: 'r1' }), '/recipe/r1');
  assert.equal(routeForHit({ kind: 'expense', id: 'e1' }), '/expense/e1');
  assert.equal(routeForHit({ kind: 'plant', id: 'p1' }), '/plant/p1');
  assert.equal(routeForHit({ kind: 'pet', id: 'h1' }), '/pet/h1');
  assert.equal(routeForHit({ kind: 'vehicle', id: 'v1' }), '/vehicle/v1');
  assert.equal(routeForHit({ kind: 'timeline', id: 'tl1' }), '/tijdlijn/tl1');
});

test('routeForHit: boodschappen hebben geen detailscherm → de tab', () => {
  assert.equal(routeForHit({ kind: 'grocery', id: 'g1' }), '/(tabs)/boodschappen');
});

test('routeForHit: zonder id valt een detail-soort terug op de module-tab', () => {
  assert.equal(routeForHit({ kind: 'task' }), '/(tabs)/taken');
  assert.equal(routeForHit({ kind: 'recipe' }), '/(tabs)/maaltijden');
});

test('routeForHit: onbekende soort of geen hit → null (default-param)', () => {
  assert.equal(routeForHit({ kind: 'bestaat-niet', id: 'x' }), null);
  assert.equal(routeForHit(null), null);
  assert.equal(routeForHit(), null);
});

// ---------------------------------------------------------------------------
// moduleForKind — kind → module-key (groeperen/icoon)
// ---------------------------------------------------------------------------

test('moduleForKind: elke hit-soort wijst naar een bestaande module', () => {
  assert.equal(moduleForKind('task'), 'taken');
  assert.equal(moduleForKind('grocery'), 'boodschappen');
  assert.equal(moduleForKind('recipe'), 'maaltijden');
  assert.equal(moduleForKind('expense'), 'kosten');
  assert.equal(moduleForKind('plant'), 'planten');
  assert.equal(moduleForKind('pet'), 'huisdieren');
  assert.equal(moduleForKind('vehicle'), 'voertuigen');
  assert.equal(moduleForKind('timeline'), 'tijdlijn');
});

test('moduleForKind: onbekend/ontbrekend → null', () => {
  assert.equal(moduleForKind('bestaat-niet'), null);
  assert.equal(moduleForKind(), null);
});
