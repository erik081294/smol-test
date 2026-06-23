// Tests voor de pure herhaallogica. Draaien met:  npm test
// Gebruikt Node's ingebouwde testrunner (node:test) — geen extra dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format, addDays } from 'date-fns';
import { nextDueDate, recurrenceLabel, dueLabel, isOverdue, snoozeDate } from '../lib/recurrence.js';
import { t } from '../lib/i18n.js';

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

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// onbekende frequentie, wekelijks-label zonder/met ongesorteerde dagen, dueLabel
// (null/vandaag/morgen/tijd-afkapping) en een toekomstige datum bij isOverdue.

test('nextDueDate: onbekende frequentie geeft null; ongeldige weekdag valt terug op +1 week', () => {
  assert.equal(nextDueDate({ recur_freq: 'yearly', due_date: '2026-06-16' }), null);
  // [9] is geen geldige weekdag → de lus vindt niets → +1 week (16 → 23 jun).
  assert.equal(ymd(nextDueDate({ recur_freq: 'weekly', due_date: '2026-06-16', recur_weekdays: [9], recur_interval: 1 })), '2026-06-23');
});

test('recurrenceLabel: wekelijks zonder dagen, en dagen worden gesorteerd', () => {
  assert.equal(recurrenceLabel({ recur_freq: 'weekly', recur_interval: 1 }), 'Elke week');
  assert.equal(recurrenceLabel({ recur_freq: 'yearly' }), 'Eenmalig'); // onbekend → eenmalig
  // ongesorteerde dagen [4,1] → label toch in dag-volgorde "ma, do"
  assert.equal(recurrenceLabel({ recur_freq: 'weekly', recur_weekdays: [4, 1] }), 'Wekelijks: ma, do');
});

test('dueLabel: null zonder datum, vandaag/morgen herkend, tijd afgekapt op uu:mm', () => {
  assert.equal(dueLabel({}), null);
  assert.equal(dueLabel({ due_date: format(new Date(), 'yyyy-MM-dd') }), t('due.today'));
  assert.equal(dueLabel({ due_date: format(addDays(new Date(), 1), 'yyyy-MM-dd') }), t('due.tomorrow'));
  assert.match(dueLabel({ due_date: '2020-01-01', due_time: '09:00:00' }), /· 09:00$/);
});

test('isOverdue: een toekomstige datum is niet achterstallig', () => {
  assert.equal(isOverdue({ due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd') }), false);
});

// --- snoozeDate (UX-17 rechts-swipe "uitstellen").
const NOW = new Date(2026, 5, 16, 10, 0); // di 16 jun 2026, 10:00

test('snoozeDate: taak van vandaag → morgen (+1)', () => {
  assert.equal(snoozeDate({ due_date: '2026-06-16' }, 1, NOW), '2026-06-17');
});

test('snoozeDate: grens — precies vandaag telt als basis, niet "vandaag" via fallback', () => {
  // due == vandaag is NIET vóór vandaag → basis = due (16) → +1 = 17, niet +2.
  assert.equal(snoozeDate({ due_date: '2026-06-16' }, 1, NOW), '2026-06-17');
});

test('snoozeDate: achterstallige taak schuift vanaf vandaag, niet vanaf de oude datum', () => {
  // due ver in het verleden → basis = vandaag (16) → +1 = 17 (niet 2020-...-+1).
  assert.equal(snoozeDate({ due_date: '2020-01-01' }, 1, NOW), '2026-06-17');
});

test('snoozeDate: toekomstige taak schuift vanaf zijn eigen datum', () => {
  assert.equal(snoozeDate({ due_date: '2026-06-20' }, 1, NOW), '2026-06-21');
});

test('snoozeDate: zonder due_date → vanaf vandaag; default-arg = +1 dag', () => {
  assert.equal(snoozeDate({}, 1, NOW), '2026-06-17');
  assert.equal(snoozeDate({ due_date: null }, 7, NOW), '2026-06-23'); // +7 telt mee
  // Aanroep met alleen een taak gebruikt de byDays-default (1).
  const expected = format(addDays(new Date(new Date().setHours(0, 0, 0, 0)), 1), 'yyyy-MM-dd');
  assert.equal(snoozeDate({}), expected);
});
