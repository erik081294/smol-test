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

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// notitie-/default-tekst, ongeldige datums, exacte fireAt==now-grens, de daadwerkelijke
// chronologische sortering, dedup per dag, en de leadMinutes-vervroeging — gedrag dat
// de suite uitvoerde maar niet vastpinde.

test('plannedReminders: body uit notes of default, ongeldige datum eruit, grens fireAt==now eruit, gesorteerd', () => {
  const t = [
    { id: 'a', title: 'A', due_date: '2026-06-18', due_time: '12:00:00', notes: 'Let op' }, // notes → body
    { id: 'b', title: 'B', due_date: '2026-06-18', due_time: '10:00:00' },                   // geen notes → default
    { id: 'c', title: 'C', due_date: '2026-06-18', due_time: '08:00:00' },                   // fireAt == now → eruit
    { id: 'd', title: 'D', due_date: 'onzin' },                                              // ongeldige datum → eruit
  ];
  const r = plannedReminders(t, { now });
  assert.deepEqual(r.map((x) => x.taskId), ['b', 'a'], '10:00 vóór 12:00; c (==now) en d (ongeldig) vallen weg');
  assert.equal(r.find((x) => x.taskId === 'a').body, 'Let op');
  assert.equal(r.find((x) => x.taskId === 'b').body, 'Herinnering');
});

test('dailySummary: telt alleen open taken (niet voltooide) en kiest enkel-/meervoud', () => {
  const day = new Date(2026, 5, 18);
  const t = [
    { due_date: '2026-06-18' },
    { due_date: '2026-06-18' },
    { due_date: '2026-06-18', completed_at: '2026-06-18T07:00:00Z' }, // voltooid → telt niet
  ];
  assert.equal(dailySummary(t, day).body, '2 taken voor vandaag');
  assert.equal(dailySummary([{ due_date: '2026-06-18' }], day).body, '1 taak voor vandaag');
});

test('mealReminders: alleen diner mét datum, één per dag (dedup), gesorteerd op datum, grens at==now eruit', () => {
  const meals = [
    { plan_date: '2026-06-20', meal_type: 'diner', title: 'Later' },
    { plan_date: '2026-06-19', meal_type: 'diner', title: 'Eerder' },
    { plan_date: '2026-06-19', meal_type: 'diner', title: 'Dubbel' }, // zelfde dag → genegeerd
    { plan_date: '2026-06-22', meal_type: 'lunch', title: 'Lunch' },  // geen diner → weg
    { plan_date: null, meal_type: 'diner', title: 'Geen datum' },     // geen datum → weg
  ];
  assert.deepEqual(
    mealReminders(meals, { now, time: '16:30' }).map((x) => x.id),
    ['meal:2026-06-19', 'meal:2026-06-20'],
  );
  // diner-tijdstip precies "nu" telt als geweest → valt weg.
  const atNow = new Date('2026-06-18T16:30:00');
  assert.deepEqual(mealReminders([{ plan_date: '2026-06-18', meal_type: 'diner', title: 'Nu' }], { now: atNow, time: '16:30' }), []);
});

test('pantryAlerts: grens exact op soonDays telt mee; fireAt-tijd correct geparset (uur én minuut)', () => {
  const at9 = new Date('2026-06-18T09:00:00'); // ná 08:15
  const items = [
    { name: 'Grens', best_before: '2026-06-20' }, // exact 2 dagen met soonDays 2
    { name: 'Ver', best_before: '2026-07-01' },   // telt niet mee
  ];
  const r = pantryAlerts(items, { now: at9, time: '08:15', soonDays: 2 });
  assert.equal(r.length, 1);
  assert.match(r[0].body, /1 product is/);
  // 08:15 is vandaag al voorbij → morgen 08:15 (uur én minuut moeten kloppen).
  assert.equal(r[0].fireAt.getDate(), 19);
  assert.equal(r[0].fireAt.getHours(), 8);
  assert.equal(r[0].fireAt.getMinutes(), 15);
  // tijd nog te gaan vandaag → vandaag (niet morgen).
  const at7 = new Date('2026-06-18T07:00:00');
  assert.equal(pantryAlerts([{ name: 'X', best_before: '2026-06-18' }], { now: at7, time: '08:00', soonDays: 2 })[0].fireAt.getDate(), 18);
  // tijd precies "nu" telt als geweest → morgen.
  const at8 = new Date('2026-06-18T08:00:00');
  assert.equal(pantryAlerts([{ name: 'X', best_before: '2026-06-18' }], { now: at8, time: '08:00', soonDays: 2 })[0].fireAt.getDate(), 19);
});

test('allReminders: leadMinutes vervroegt, voltooide + grens-taken eruit, voorraad-pref-gate, échte sortering', () => {
  const data = {
    tasks: [
      { id: 'open', title: 'Open', due_date: '2026-06-18', due_time: '18:00:00' },
      { id: 'done', title: 'Klaar', due_date: '2026-06-18', due_time: '19:00:00', completed_at: '2026-06-18T07:00:00Z' },
      { id: 'grens', title: 'Grens', due_date: '2026-06-18', due_time: '08:30:00' }, // 08:30 - 30 = 08:00 == now → eruit
    ],
    meals: [{ plan_date: '2026-06-18', meal_type: 'diner', title: 'Pasta' }], // 16:30
    pantry: [{ name: 'Melk', best_before: '2026-06-15' }],                    // zou alarmeren
  };
  const r = allReminders(data, { leadMinutes: 30, voorraad: false }, now);
  // maaltijd (16:30) vóór taak (18:00 - 30 = 17:30); voltooide + grens-taak weg.
  assert.deepEqual(r.map((x) => x.id), ['meal:2026-06-18', 'task:open:2026-06-18']);
  assert.ok(!r.some((x) => x.id.startsWith('pantry:')), 'voorraad-pref uit → geen alert ondanks verlopen melk');
  const taskR = r.find((x) => x.id === 'task:open:2026-06-18');
  assert.equal(taskR.fireAt.getHours(), 17);
  assert.equal(taskR.fireAt.getMinutes(), 30);
});
