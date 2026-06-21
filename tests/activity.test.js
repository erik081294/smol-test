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

test('formatActivity: count 1 levert geen teller en geen count-veld', () => {
  const item = formatActivity({ id: 'c1', type: 'task_completed', at: ago(MIN), actorName: 'Tim', taskTitle: 'Stofzuigen' }, NOW, 1);
  assert.equal(item.text, "Tim vinkte 'Stofzuigen' af");
  assert.equal('count' in item, false);
});
