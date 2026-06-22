// Units voor het eerlijkheidsoverzicht (lib/fairness.js, SCH-3). De telling moet
// kloppen, de periode-filter moet oudere voltooiingen weglaten, en de sortering
// moet stabiel zijn — anders "springt" het overzicht bij gelijke standen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tally, sinceDate, PERIODS } from '../lib/fairness.js';

const MEMBERS = [
  { id: 'a', display_name: 'Alice', avatar_emoji: '🦊' },
  { id: 'b', display_name: 'Bob', avatar_emoji: '🐻' },
  { id: 'c', display_name: 'Carol', avatar_emoji: '🐱' },
];
const sum = (rows) => rows.reduce((acc, r) => acc + r.count, 0);

test('tally: lege completions -> elk lid count 0, pct 0', () => {
  const rows = tally([], MEMBERS);
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.count, 0);
    assert.equal(r.pct, 0);
  }
});

test('tally: telt per lid en som klopt', () => {
  const completions = [
    { completed_by: 'a', completed_at: '2026-06-10T10:00:00Z' },
    { completed_by: 'a', completed_at: '2026-06-11T10:00:00Z' },
    { completed_by: 'b', completed_at: '2026-06-12T10:00:00Z' },
  ];
  const rows = tally(completions, MEMBERS);
  assert.equal(sum(rows), 3);
  const byId = Object.fromEntries(rows.map((r) => [r.profileId, r]));
  assert.equal(byId.a.count, 2);
  assert.equal(byId.b.count, 1);
  assert.equal(byId.c.count, 0);
  // pct = count / totaal * 100
  assert.ok(Math.abs(byId.a.pct - (2 / 3) * 100) < 1e-9);
});

test('tally: since filtert oudere voltooiingen weg', () => {
  const completions = [
    { completed_by: 'a', completed_at: '2026-01-01T10:00:00Z' }, // oud
    { completed_by: 'a', completed_at: '2026-06-15T10:00:00Z' }, // recent
    { completed_by: 'b', completed_at: '2026-06-16T10:00:00Z' }, // recent
  ];
  const since = new Date('2026-06-01T00:00:00Z');
  const rows = tally(completions, MEMBERS, since);
  const byId = Object.fromEntries(rows.map((r) => [r.profileId, r]));
  assert.equal(byId.a.count, 1);
  assert.equal(byId.b.count, 1);
  assert.equal(sum(rows), 2);
});

test('tally: sortering op count desc, stabiel op profileId', () => {
  const completions = [
    { completed_by: 'b', completed_at: '2026-06-15T10:00:00Z' },
    { completed_by: 'c', completed_at: '2026-06-15T10:00:00Z' },
    { completed_by: 'b', completed_at: '2026-06-16T10:00:00Z' },
    { completed_by: 'c', completed_at: '2026-06-16T10:00:00Z' },
  ];
  // b en c hebben beide 2, a heeft 0. Volgorde: b, c (alfabetisch op id), dan a.
  const rows = tally(completions, MEMBERS);
  assert.deepEqual(rows.map((r) => r.profileId), ['b', 'c', 'a']);
});

test('tally: onbekende/verwijderde completed_by wordt overgeslagen', () => {
  const completions = [
    { completed_by: 'a', completed_at: '2026-06-15T10:00:00Z' },
    { completed_by: null, completed_at: '2026-06-15T10:00:00Z' },   // verwijderd lid
    { completed_by: 'zzz', completed_at: '2026-06-15T10:00:00Z' },  // geen huidig lid
  ];
  const rows = tally(completions, MEMBERS);
  assert.equal(sum(rows), 1);
  assert.equal(rows.find((r) => r.profileId === 'a').count, 1);
});

test('sinceDate: berekent dagen terug en respecteert ALL', () => {
  const now = new Date('2026-06-18T12:00:00Z');
  assert.equal(sinceDate(PERIODS.ALL, now), null);
  const week = sinceDate(PERIODS.WEEK, now);
  assert.equal(week.toISOString(), '2026-06-11T12:00:00.000Z');
  const month = sinceDate(PERIODS.MONTH, now);
  assert.equal(month.toISOString(), '2026-05-19T12:00:00.000Z');
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// null-entry/onbekend/datumloos vertekenen telling+pct niet, de periode-grens,
// naam/emoji-fallback en de id-tie-break in beide richtingen.

test('tally: null-entry, onbekende en datumloze rijen vertekenen telling/pct niet; grens telt mee', () => {
  const since = new Date('2026-06-01T00:00:00Z');
  const rows = tally([
    { completed_by: 'a', completed_at: '2026-06-10T10:00:00Z' },
    null,                                                          // null-entry → overslaan
    { completed_by: 'zzz', completed_at: '2026-06-10T10:00:00Z' }, // geen huidig lid → overslaan
    { completed_by: 'b', completed_at: null },                     // datumloos binnen periode → overslaan
    { completed_by: 'b', completed_at: '2026-06-01T00:00:00Z' },   // exact op de grens → telt mee
  ], MEMBERS, since);
  const byId = Object.fromEntries(rows.map((r) => [r.profileId, r]));
  assert.equal(byId.a.count, 1);
  assert.equal(byId.b.count, 1);
  assert.equal(byId.c.count, 0);
  assert.equal(sum(rows), 2);
  assert.ok(Math.abs(byId.a.pct - 50) < 1e-9, 'onbekende/datumloze rijen vertekenen het percentage niet');
});

test('tally: zonder periode tellen ook voltooiingen zónder datum mee', () => {
  const rows = tally([{ completed_by: 'a', completed_at: null }], MEMBERS); // since = null
  assert.equal(rows.find((r) => r.profileId === 'a').count, 1);
});

test('tally: naam en emoji komen van het lid, met fallback', () => {
  const rows = tally([], [{ id: 'a', display_name: 'Alice', avatar_emoji: '🦊' }, { id: 'b' }]);
  const byId = Object.fromEntries(rows.map((r) => [r.profileId, r]));
  assert.equal(byId.a.name, 'Alice');
  assert.equal(byId.a.emoji, '🦊');
  assert.equal(byId.b.name, 'Onbekend');
  assert.equal(byId.b.emoji, null);
});

test('tally: id-tie-break onafhankelijk van de leden-volgorde', () => {
  const M = (ids) => ids.map((id) => ({ id, display_name: id }));
  assert.deepEqual(tally([], M(['c', 'a', 'b'])).map((r) => r.profileId), ['a', 'b', 'c']);
  assert.deepEqual(tally([], M(['a', 'b', 'c'])).map((r) => r.profileId), ['a', 'b', 'c']);
});
