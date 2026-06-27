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

test('dueRun: cap=1 levert exact één occurrence (scherpe `< cap`-grens)', () => {
  const now = new Date(2030, 0, 1);
  const { occurrences } = dueRun({ next_date: '2020-01-01', recur_freq: 'monthly', recur_interval: 1 }, now, 1);
  assert.equal(occurrences.length, 1);
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

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('advance: onbekende frequentie laat de datum ongewijzigd', () => {
  assert.equal(ymd(advance('2026-06-18', 'jaarlijks', 1)), '2026-06-18');
});

test('dueRun: tolerant voor een ontbrekend/leeg sjabloon', () => {
  assert.deepEqual(dueRun(undefined, new Date(2026, 5, 18)).occurrences, []);
  assert.deepEqual(dueRun({}, new Date(2026, 5, 18)).occurrences, []);
});

test('dueRun: respecteert recur_interval (elke 2 maanden)', () => {
  const { occurrences } = dueRun(
    { next_date: '2026-01-01', recur_freq: 'monthly', recur_interval: 2 }, new Date(2026, 5, 1));
  assert.deepEqual(occurrences.map(ymd), ['2026-01-01', '2026-03-01', '2026-05-01']);
});

test('dueRun: een occurrence exact op `now` telt nog mee (grens)', () => {
  const now = new Date(2026, 5, 18); // lokale middernacht 2026-06-18
  const { occurrences } = dueRun({ next_date: '2026-06-18', recur_freq: 'monthly', recur_interval: 1 }, now);
  assert.deepEqual(occurrences.map(ymd), ['2026-06-18']);
});
