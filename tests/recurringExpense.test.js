// Units voor de pure terugkerende-uitgaven-logica (lib/recurringExpense.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';
import { advance, dueRun } from '../lib/recurringExpense.js';

const ymd = (d) => format(d, 'yyyy-MM-dd');

test('advance: dag/week/maand', () => {
  assert.equal(ymd(advance('2026-06-18', 'daily', 3)), '2026-06-21');
  assert.equal(ymd(advance('2026-06-18', 'weekly', 1)), '2026-06-25');
  assert.equal(ymd(advance('2026-06-18', 'monthly', 1)), '2026-07-18');
});

test('dueRun: levert verschuldigde occurrences en de nieuwe next_date', () => {
  const now = new Date(2026, 5, 18, 12, 0, 0); // 2026-06-18
  const { occurrences, nextDate } = dueRun(
    { next_date: '2026-03-18', recur_freq: 'monthly', recur_interval: 1 }, now);
  assert.deepEqual(occurrences.map(ymd), ['2026-03-18', '2026-04-18', '2026-05-18', '2026-06-18']);
  assert.equal(ymd(nextDate), '2026-07-18');
});

test('dueRun: cap voorkomt een stortvloed', () => {
  const now = new Date(2030, 0, 1);
  const { occurrences } = dueRun({ next_date: '2020-01-01', recur_freq: 'monthly', recur_interval: 1 }, now, 12);
  assert.equal(occurrences.length, 12);
});

test('dueRun: niets verschuldigd bij een toekomstige next_date', () => {
  const now = new Date(2026, 5, 18);
  const { occurrences, nextDate } = dueRun(
    { next_date: '2026-09-01', recur_freq: 'monthly', recur_interval: 1 }, now);
  assert.equal(occurrences.length, 0);
  assert.equal(ymd(nextDate), '2026-09-01');
});

test('dueRun: onbekende freq -> geen occurrences', () => {
  const { occurrences } = dueRun({ next_date: '2020-01-01', recur_freq: 'jaarlijks', recur_interval: 1 }, new Date());
  assert.equal(occurrences.length, 0);
});
