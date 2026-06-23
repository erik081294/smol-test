// Units voor de PERF-1 consumer-helpers: het saldo/eerlijkheid uit server-side
// aggregaat-totalen (gebruikt zodra de data-hooks hun laad-venster raken). De SQL
// zelf (household_expense_totals/household_completion_totals) wordt tegen live
// Supabase geverifieerd; hier toetsen we de pure omzetting naar de UI-vormen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balancesFromTotals, settle, computeBalances } from '../lib/expenses.js';
import { tally, tallyFromCounts } from '../lib/fairness.js';

test('balancesFromTotals: net = paid - share per lid', () => {
  const bal = balancesFromTotals([
    { profile_id: 'a', paid_cents: 3000, share_cents: 1000 },
    { profile_id: 'b', paid_cents: 0, share_cents: 2000 },
  ]);
  assert.equal(bal.a, 2000);
  assert.equal(bal.b, -2000);
});

test('balancesFromTotals: exacte nullen worden opgeruimd', () => {
  const bal = balancesFromTotals([
    { profile_id: 'a', paid_cents: 1500, share_cents: 1500 }, // saldo 0
    { profile_id: 'b', paid_cents: 500, share_cents: 0 },
  ]);
  assert.ok(!('a' in bal));
  assert.equal(bal.b, 500);
});

test('balancesFromTotals: som van saldi is nul (zoals computeBalances)', () => {
  const totals = [
    { profile_id: 'a', paid_cents: 4500, share_cents: 1500 },
    { profile_id: 'b', paid_cents: 0, share_cents: 1500 },
    { profile_id: 'c', paid_cents: 0, share_cents: 1500 },
  ];
  const bal = balancesFromTotals(totals);
  assert.equal(Object.values(bal).reduce((a, b) => a + b, 0), 0);
});

test('balancesFromTotals voedt settle identiek aan de venster-berekening', () => {
  // Eén uitgave: a schoot €30 voor, gelijk over a/b/c (1000 elk).
  const expenses = [{ paidBy: 'a', shares: { a: 1000, b: 1000, c: 1000 } }];
  const windowBal = computeBalances(expenses);
  const totalsBal = balancesFromTotals([
    { profile_id: 'a', paid_cents: 3000, share_cents: 1000 },
    { profile_id: 'b', paid_cents: 0, share_cents: 1000 },
    { profile_id: 'c', paid_cents: 0, share_cents: 1000 },
  ]);
  assert.deepEqual(totalsBal, windowBal);
  assert.deepEqual(settle(totalsBal), settle(windowBal));
});

const MEMBERS = [
  { id: 'a', display_name: 'Ana', avatar_emoji: '😀' },
  { id: 'b', display_name: 'Bo', avatar_emoji: '😎' },
];

test('tallyFromCounts: kiest het juiste veld en geeft tally-vorm terug', () => {
  const counts = [
    { profile_id: 'a', completions: 10, cleaning_completions: 4 },
    { profile_id: 'b', completions: 2, cleaning_completions: 6 },
  ];
  const rows = tallyFromCounts(counts, MEMBERS, 'cleaning_completions');
  // Gesorteerd op count desc → b (6) vóór a (4).
  assert.deepEqual(rows.map((r) => r.profileId), ['b', 'a']);
  assert.equal(rows[0].count, 6);
  assert.equal(rows[1].count, 4);
  // pct t.o.v. totaal (10).
  assert.equal(rows[0].pct, 60);
  assert.equal(rows[1].pct, 40);
  // Draagt naam/emoji mee, net als tally().
  assert.equal(rows[0].name, 'Bo');
  assert.equal(rows[0].emoji, '😎');
});

test('tallyFromCounts: lid zonder rij telt als 0; onbekende ids worden genegeerd', () => {
  const counts = [
    { profile_id: 'a', completions: 5, cleaning_completions: 5 },
    { profile_id: 'weg', completions: 99, cleaning_completions: 99 }, // geen huidig lid
  ];
  const rows = tallyFromCounts(counts, MEMBERS, 'completions');
  const bo = rows.find((r) => r.profileId === 'b');
  assert.equal(bo.count, 0);
  assert.ok(!rows.some((r) => r.profileId === 'weg'));
});

test('tallyFromCounts matcht tally() voor dezelfde verdeling', () => {
  // Drie schoonmaakvoltooiingen door a, één door b → counts a:3 b:1.
  const completions = [
    { completed_by: 'a', task: { zone_id: 'z' } },
    { completed_by: 'a', task: { zone_id: 'z' } },
    { completed_by: 'a', task: { zone_id: 'z' } },
    { completed_by: 'b', task: { zone_id: 'z' } },
  ];
  const fromWindow = tally(completions, MEMBERS, null);
  const fromCounts = tallyFromCounts(
    [{ profile_id: 'a', completions: 3, cleaning_completions: 3 },
     { profile_id: 'b', completions: 1, cleaning_completions: 1 }],
    MEMBERS, 'cleaning_completions',
  );
  assert.deepEqual(fromCounts, fromWindow);
});
