// Tests voor de pure herhaallogica. Draaien met:  npm test
// Gebruikt Node's ingebouwde testrunner (node:test) — geen extra dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';
import { nextDueDate, recurrenceLabel, isOverdue } from '../lib/recurrence.js';

const ymd = (d) => (d ? format(d, 'yyyy-MM-dd') : null);

test('eenmalig: geen volgende datum', () => {
  assert.equal(nextDueDate({ due_date: '2026-06-16' }), null);
  assert.equal(nextDueDate({ recur_freq: 'daily' }), null); // zonder datum
});

test('dagelijks: +1 dag, en interval', () => {
  assert.equal(ymd(nextDueDate({ recur_freq: 'daily', due_date: '2026-06-16', recur_interval: 1 })), '2026-06-17');
  assert.equal(ymd(nextDueDate({ recur_freq: 'daily', due_date: '2026-06-16', recur_interval: 3 })), '2026-06-19');
});

test('wekelijks zonder dagen: +1 week', () => {
  assert.equal(ymd(nextDueDate({ recur_freq: 'weekly', due_date: '2026-06-16', recur_interval: 1 })), '2026-06-23');
});

test('wekelijks met dagen: eerstvolgende geselecteerde dag', () => {
  // 16 jun 2026 = dinsdag. Ma(1)+Do(4) => eerstvolgende is do 18 jun.
  assert.equal(ymd(nextDueDate({ recur_freq: 'weekly', due_date: '2026-06-16', recur_weekdays: [1, 4] })), '2026-06-18');
  // Vanaf do 18 jun => eerstvolgende is ma 22 jun (alterneert correct).
  assert.equal(ymd(nextDueDate({ recur_freq: 'weekly', due_date: '2026-06-18', recur_weekdays: [1, 4] })), '2026-06-22');
});

test('maandelijks: +1 maand', () => {
  assert.equal(ymd(nextDueDate({ recur_freq: 'monthly', due_date: '2026-06-16', recur_interval: 1 })), '2026-07-16');
});

test('recurrenceLabel: leesbare NL-labels', () => {
  assert.equal(recurrenceLabel({}), 'Eenmalig');
  assert.equal(recurrenceLabel({ recur_freq: 'daily', recur_interval: 1 }), 'Elke dag');
  assert.equal(recurrenceLabel({ recur_freq: 'daily', recur_interval: 3 }), 'Elke 3 dagen');
  assert.equal(recurrenceLabel({ recur_freq: 'monthly', recur_interval: 1 }), 'Elke maand');
  assert.equal(recurrenceLabel({ recur_freq: 'weekly', recur_weekdays: [1, 4] }), 'Wekelijks: ma, do');
});

test('isOverdue: afgevinkt of zonder datum nooit achterstallig', () => {
  assert.equal(isOverdue({ due_date: '2020-01-01', completed_at: '2020-01-02' }), false);
  assert.equal(isOverdue({ completed_at: null }), false);
  assert.equal(isOverdue({ due_date: '2020-01-01' }), true); // ver in het verleden
});
