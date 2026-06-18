// Units voor de pure notificatie-/herinneringslogica (lib/notifications.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedReminders, dailySummary, reminderId } from '../lib/notifications.js';

const now = new Date('2026-06-18T08:00:00');
const tasks = [
  { id: 't1', title: 'Vuilnis buiten', due_date: '2026-06-18', due_time: '10:00:00' }, // straks
  { id: 't2', title: 'Gisteren', due_date: '2026-06-17', due_time: '09:00:00' },        // verleden
  { id: 't3', title: 'Klaar', due_date: '2026-06-18', due_time: '11:00:00', completed_at: '2026-06-18T07:00:00Z' },
  { id: 't4', title: 'Zonder datum' },                                                  // geen datum
];

test('plannedReminders: alleen toekomstige, open, gedateerde taken; gesorteerd', () => {
  const r = plannedReminders(tasks, { now });
  assert.deepEqual(r.map((x) => x.taskId), ['t1']);
  assert.equal(r[0].title, 'Vuilnis buiten');
});

test('plannedReminders: leadMinutes vervroegt fireAt maar blijft in de toekomst', () => {
  const r = plannedReminders(tasks, { now, leadMinutes: 30 });
  assert.equal(r.length, 1);
  // 10:00 - 30 min = 09:30, nog steeds na 08:00
  assert.equal(r[0].fireAt.getHours(), 9);
  assert.equal(r[0].fireAt.getMinutes(), 30);
});

test('reminderId: stabiel per occurrence, verandert met due_date', () => {
  assert.equal(reminderId({ id: 'x', due_date: '2026-06-18' }), 'task:x:2026-06-18');
  assert.notEqual(reminderId({ id: 'x', due_date: '2026-06-18' }), reminderId({ id: 'x', due_date: '2026-06-25' }));
});

test('dailySummary: null bij 0, anders telling voor die dag', () => {
  assert.equal(dailySummary(tasks, new Date(2026, 5, 18)).body, '1 taak voor vandaag');
  assert.equal(dailySummary([], new Date(2026, 5, 18)), null);
});
