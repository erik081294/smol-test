// Units voor de pure kern van de activiteitenfeed (PLT-6). Zie lib/activity.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, formatActivity, buildFeed } from '../lib/activity.js';

const NOW = new Date('2026-06-21T12:00:00Z').getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000, UUR = 60 * MIN, DAG = 24 * UUR;

test('relativeTime: NL-drempels', () => {
  assert.equal(relativeTime(ago(10_000), NOW), 'zojuist');
  assert.equal(relativeTime(ago(5 * MIN), NOW), '5 min geleden');
  assert.equal(relativeTime(ago(3 * UUR), NOW), '3 uur geleden');
  assert.equal(relativeTime(ago(1 * DAG), NOW), 'gisteren');
  assert.equal(relativeTime(ago(3 * DAG), NOW), '3 dagen geleden');
  assert.equal(relativeTime(ago(16 * DAG), NOW), '2 wk geleden');
});

test('relativeTime: ongeldige input → lege string', () => {
  assert.equal(relativeTime('niet-een-datum', NOW), '');
});

test('formatActivity: taakvoltooiing → NL-regel + icoon + tijd', () => {
  const item = formatActivity(
    { id: 'c1', type: 'task_completed', at: ago(5 * MIN), actorName: 'Tim', taskTitle: 'Stofzuigen' },
    NOW,
  );
  assert.deepEqual(item, { id: 'c1', at: ago(5 * MIN), when: '5 min geleden', icon: 'check', text: "Tim vinkte 'Stofzuigen' af" });
});

test('formatActivity: zonder actor → "Iemand"; zonder titel → null', () => {
  const noActor = formatActivity({ id: 'c2', type: 'task_completed', at: ago(MIN), taskTitle: 'Afwassen' }, NOW);
  assert.equal(noActor.text, "Iemand vinkte 'Afwassen' af");
  assert.equal(formatActivity({ id: 'c3', type: 'task_completed', at: ago(MIN), actorName: 'Tim' }, NOW), null);
});

test('formatActivity: onbekend type → null', () => {
  assert.equal(formatActivity({ id: 'x', type: 'iets_anders', at: ago(MIN) }, NOW), null);
});

test('buildFeed: filtert ongeldige events en sorteert nieuwste eerst', () => {
  const feed = buildFeed([
    { id: 'a', type: 'task_completed', at: ago(3 * UUR), actorName: 'Tim', taskTitle: 'Oud' },
    { id: 'b', type: 'task_completed', at: ago(2 * MIN), actorName: 'Ann', taskTitle: 'Nieuw' },
    { id: 'c', type: 'onbekend', at: ago(MIN) },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['b', 'a']);
  assert.equal(feed.length, 2);
});

test('buildFeed: vouwt opeenvolgende identieke acties samen met teller', () => {
  const feed = buildFeed([
    { id: 'b1', type: 'task_completed', at: ago(1 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'b2', type: 'task_completed', at: ago(2 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'b3', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 3);
  assert.equal(feed[0].text, "Tim vinkte 'Badkamer' 3× af");
  // tijd/id van het nieuwste event in de groep
  assert.equal(feed[0].id, 'b1');
  assert.equal(feed[0].when, '1 min geleden');
});

test('buildFeed: ander event ertussen breekt de groep (chronologie blijft)', () => {
  const feed = buildFeed([
    { id: 'x1', type: 'task_completed', at: ago(1 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'y',  type: 'task_completed', at: ago(2 * MIN), actorName: 'Ann', taskTitle: 'Afwas' },
    { id: 'x2', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['x1', 'y', 'x2']);
  assert.equal(feed.every((f) => !f.count), true); // geen enkele groep > 1
});

test('formatActivity: uitgave-event → NL-regel met bedrag (subject)', () => {
  const item = formatActivity(
    { id: 'e1', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Boodschappen', amountText: '€ 12,50' },
    NOW,
  );
  assert.equal(item.icon, 'expenses');
  assert.equal(item.text, "Ann voegde uitgave 'Boodschappen' toe (€ 12,50)");
});

test('formatActivity: boodschap-event → NL-regel (subject); zonder subject → null', () => {
  const ok = formatActivity({ id: 'g1', type: 'grocery_added', at: ago(MIN), actorName: 'Tim', subject: 'Melk' }, NOW);
  assert.equal(ok.icon, 'shopping');
  assert.equal(ok.text, "Tim zette 'Melk' op de lijst");
  assert.equal(formatActivity({ id: 'g2', type: 'grocery_added', at: ago(MIN), actorName: 'Tim' }, NOW), null);
});

test('formatActivity: uitgave zonder actor → "Iemand", zonder bedrag → geen haakjes', () => {
  const item = formatActivity({ id: 'e0', type: 'expense_added', at: ago(MIN), subject: 'Benzine' }, NOW);
  assert.equal(item.text, "Iemand voegde uitgave 'Benzine' toe");
  assert.equal('count' in item, false);
});

test('formatActivity: uitgave zonder subject → null', () => {
  assert.equal(formatActivity({ id: 'e9', type: 'expense_added', at: ago(MIN), actorName: 'Ann' }, NOW), null);
});

test('formatActivity: boodschap zonder actor → "Iemand"', () => {
  const item = formatActivity({ id: 'g0', type: 'grocery_added', at: ago(MIN), subject: 'Melk' }, NOW);
  assert.equal(item.text, "Iemand zette 'Melk' op de lijst");
});

test('buildFeed: opeenvolgende identieke uitgaven vouwen samen met teller', () => {
  const feed = buildFeed([
    { id: 'e1', type: 'expense_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Benzine' },
    { id: 'e2', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Benzine' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 2);
  assert.equal(feed[0].text, "Ann voegde uitgave 'Benzine' toe 2×");
});

test('buildFeed: opeenvolgende identieke boodschappen vouwen samen met teller', () => {
  const feed = buildFeed([
    { id: 'g1', type: 'grocery_added', at: ago(1 * MIN), actorName: 'Tim', subject: 'Melk' },
    { id: 'g2', type: 'grocery_added', at: ago(2 * MIN), actorName: 'Tim', subject: 'Melk' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 2);
  assert.equal(feed[0].text, "Tim zette 'Melk' 2× op de lijst");
});

test('formatActivity: plant/huisdier/voertuig "toegevoegd" → juiste regel + icoon', () => {
  assert.deepEqual(
    { ...formatActivity({ id: 'pl1', type: 'plant_added', at: ago(MIN), actorName: 'Ann', subject: 'Monstera' }, NOW) },
    { id: 'pl1', at: ago(MIN), when: '1 min geleden', icon: 'plants', text: "Ann voegde plant 'Monstera' toe" },
  );
  assert.equal(formatActivity({ id: 'pe1', type: 'pet_added', at: ago(MIN), actorName: 'Tim', subject: 'Rex' }, NOW).text, "Tim voegde huisdier 'Rex' toe");
  assert.equal(formatActivity({ id: 'v1', type: 'vehicle_added', at: ago(MIN), actorName: 'Tim', subject: 'Clio' }, NOW).icon, 'voertuig');
  // zonder actor → "Iemand"; zonder subject → null; teller bij samenvouwen.
  assert.equal(formatActivity({ id: 'pl2', type: 'plant_added', at: ago(MIN), subject: 'Varen' }, NOW).text, "Iemand voegde plant 'Varen' toe");
  assert.equal(formatActivity({ id: 'pl3', type: 'plant_added', at: ago(MIN), actorName: 'Ann' }, NOW), null);
  assert.equal(formatActivity({ id: 'pe2', type: 'pet_added', at: ago(MIN), actorName: 'Tim', subject: 'Rex' }, NOW, 2).text, "Tim voegde huisdier 'Rex' toe 2×");
});

test('buildFeed: verschillende uitgaven van hetzelfde lid vouwen NIET samen (subject in groupKey)', () => {
  const feed = buildFeed([
    { id: 'e1', type: 'expense_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Benzine' },
    { id: 'e2', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Boodschappen' },
  ], NOW);
  assert.equal(feed.length, 2);
  assert.equal(feed.every((f) => !f.count), true);
});

test('buildFeed: mengt bronnen en sorteert nieuwste eerst', () => {
  const feed = buildFeed([
    { id: 't1', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', subject: 'Stofzuigen' },
    { id: 'g1', type: 'grocery_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Melk' },
    { id: 'e1', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Benzine' },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['g1', 'e1', 't1']);
});

test('formatActivity: count 1 levert geen teller en geen count-veld', () => {
  const item = formatActivity({ id: 'c1', type: 'task_completed', at: ago(MIN), actorName: 'Tim', taskTitle: 'Stofzuigen' }, NOW, 1);
  assert.equal(item.text, "Tim vinkte 'Stofzuigen' af");
  assert.equal('count' in item, false);
});
