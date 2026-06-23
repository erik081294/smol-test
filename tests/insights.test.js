// Units voor de pure kosten-inzicht-logica (lib/insights.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byMonth, monthTotal, monthCount, byCategory, budgetStatus } from '../lib/insights.js';

const now = new Date(2026, 5, 15); // 15 jun 2026
const expenses = [
  { amount_cents: 1000, spent_on: '2026-06-01', category: 'boodschappen' },
  { amount_cents: 500, spent_on: '2026-06-20', category: 'boodschappen' },
  { amount_cents: 2500, spent_on: '2026-06-03', category: 'wonen' },
  { amount_cents: 800, spent_on: '2026-05-10', category: 'vervoer' },
  { amount_cents: 300, spent_on: '2026-01-01', category: 'overig' }, // buiten 6-mnd-venster (vanaf jan)
];

test('byMonth: laatste N maanden, oud→nieuw, incl. nul-maanden', () => {
  const r = byMonth(expenses, { months: 6, now });
  assert.equal(r.length, 6);
  assert.equal(r[r.length - 1].month, '2026-06');
  assert.equal(r[0].month, '2026-01');
  const jun = r.find((b) => b.month === '2026-06');
  assert.equal(jun.totalCents, 1000 + 500 + 2500); // 4000
  const mei = r.find((b) => b.month === '2026-05');
  assert.equal(mei.totalCents, 800);
  const apr = r.find((b) => b.month === '2026-04');
  assert.equal(apr.totalCents, 0, 'lege maand telt mee als 0');
});

test('byMonth: venster van 3 maanden sluit oudere uitgaven uit', () => {
  const r = byMonth(expenses, { months: 3, now }); // apr, mei, jun
  assert.deepEqual(r.map((b) => b.month), ['2026-04', '2026-05', '2026-06']);
  assert.equal(r.reduce((s, b) => s + b.totalCents, 0), 4000 + 800);
});

test('monthTotal: totaal van één maand', () => {
  assert.equal(monthTotal(expenses, '2026-06'), 4000);
  assert.equal(monthTotal(expenses, '2026-05'), 800);
  assert.equal(monthTotal(expenses, '2026-07'), 0);
});

test('monthCount: aantal uitgaven in één maand', () => {
  assert.equal(monthCount(expenses, '2026-06'), 3); // 1 jun, 20 jun, 3 jun
  assert.equal(monthCount(expenses, '2026-05'), 1);
  assert.equal(monthCount(expenses, '2026-07'), 0); // geen enkele in juli
  assert.equal(monthCount([], '2026-06'), 0);        // leeg / default-arg
});

test('byCategory: aflopend gesorteerd, optioneel binnen een maand', () => {
  const all = byCategory(expenses);
  assert.equal(all[0].category, 'wonen');        // 2500 hoogste
  assert.equal(all[0].totalCents, 2500);
  const jun = byCategory(expenses, { month: '2026-06' });
  const map = Object.fromEntries(jun.map((c) => [c.category, c.totalCents]));
  assert.equal(map['boodschappen'], 1500);
  assert.equal(map['wonen'], 2500);
  assert.equal(map['vervoer'], undefined, 'vervoer viel in mei, niet in juni');
});

test('budgetStatus: pct/rest/over, null zonder budget', () => {
  assert.equal(budgetStatus(4000, null), null);
  assert.equal(budgetStatus(4000, 0), null);
  const s = budgetStatus(4000, 5000);
  assert.equal(s.remainingCents, 1000);
  assert.equal(s.pct, 80);
  assert.equal(s.over, false);
  const over = budgetStatus(6000, 5000);
  assert.equal(over.over, true);
  assert.equal(over.remainingCents, -1000);
  assert.equal(over.pct, 120);
});

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('monthKeyOf werkt ook met een Date-object als spent_on', () => {
  assert.equal(monthTotal([{ amount_cents: 100, spent_on: new Date(2026, 5, 15) }], '2026-06'), 100);
});

test('budgetStatus: precies op budget is niet "over"', () => {
  assert.equal(budgetStatus(5000, 5000).over, false);
  assert.equal(budgetStatus(5001, 5000).over, true);
});
