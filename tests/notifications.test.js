// Units voor de pure notificatie-/herinneringslogica (lib/notifications.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedReminders, dailySummary, reminderId, mealReminders, pantryAlerts, allReminders } from '../lib/notifications.js';

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

test('mealReminders: één per dag op het diner-tijdstip, alleen toekomstig', () => {
  const meals = [
    { plan_date: '2026-06-18', meal_type: 'diner', recipe: { title: 'Pasta' } },
    { plan_date: '2026-06-18', meal_type: 'lunch', title: 'Soep' },     // geen diner → genegeerd
    { plan_date: '2026-06-17', meal_type: 'diner', title: 'Gisteren' }, // verleden → weg
  ];
  const r = mealReminders(meals, { now, time: '16:30' });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'meal:2026-06-18');
  assert.match(r[0].body, /Pasta/);
});

test('pantryAlerts: bundelt (bijna) verlopen items, leeg zonder houdbaarheid', () => {
  const items = [
    { name: 'Yoghurt', best_before: '2026-06-19' }, // binnen 2 dagen
    { name: 'Melk', best_before: '2026-06-15' },     // verlopen
    { name: 'Rijst' },                               // geen datum → telt niet
    { name: 'Kaas', best_before: '2026-07-10' },     // ver weg → telt niet
  ];
  const r = pantryAlerts(items, { now, time: '08:00', soonDays: 2 });
  assert.equal(r.length, 1);
  assert.match(r[0].body, /2 producten/);
  assert.deepEqual(pantryAlerts([], { now }), []);
});

test('allReminders: combineert domeinen en respecteert per-domein prefs', () => {
  const data = {
    tasks: [{ id: 't1', title: 'Vuilnis', due_date: '2026-06-18', due_time: '10:00:00' }],
    meals: [{ plan_date: '2026-06-18', meal_type: 'diner', title: 'Pasta' }],
    pantry: [{ name: 'Melk', best_before: '2026-06-15' }],
  };
  const all = allReminders(data, {}, now);
  assert.equal(all.length, 3, 'taak + maaltijd + voorraad');
  // sortering op tijd
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].fireAt <= all[i].fireAt);
  // maaltijden uit → 2 over
  const noMeals = allReminders(data, { maaltijden: false }, now);
  assert.equal(noMeals.length, 2);
  assert.ok(!noMeals.some((r) => r.id.startsWith('meal:')));
});

test('allReminders: plantzorg-taken vallen onder de plantzorg-pref', () => {
  const data = { tasks: [{ id: 'p1', title: 'Monstera water', due_date: '2026-06-18', due_time: '10:00:00', plant_id: 'pl1' }] };
  assert.equal(allReminders(data, {}, now).length, 1);
  assert.equal(allReminders(data, { plantzorg: false }, now).length, 0);
  assert.equal(allReminders(data, { taken: false }, now).length, 1, 'taken-pref raakt plantzorg niet');
});
