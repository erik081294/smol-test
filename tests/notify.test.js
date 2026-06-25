// Units voor de pure kern van de notify Edge Function (PLT-1, trap 2).
// Zie supabase/functions/notify/core.js — géén Deno/netwerk nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntents, parseWebhookEvent, chunk, expoMessages, EXPO_MAX_BATCH,
  clampBody, MAX_BODY,
} from '../supabase/functions/notify/core.js';

const taskInsert = (record) => ({ type: 'INSERT', table: 'tasks', record });
const taskUpdate = (record, old_record) => ({ type: 'UPDATE', table: 'tasks', record, old_record });

test('taak INSERT met assignee ≠ maker → één intent naar de toegewezene', () => {
  const intents = buildIntents(taskInsert({ id: 't1', title: 'Stofzuigen', assigned_to: 'bob', created_by: 'ann' }));
  assert.equal(intents.length, 1);
  assert.equal(intents[0].recipientId, 'bob');
  assert.equal(intents[0].kind, 'task_assigned');
  assert.equal(intents[0].dedupKey, 'task:t1:assigned:bob');
  assert.match(intents[0].body, /Stofzuigen/);
  assert.deepEqual(intents[0].data, { kind: 'task_assigned', taskId: 't1' });
});

test('taak zonder assignee of toegewezen aan zichzelf → geen intent', () => {
  assert.deepEqual(buildIntents(taskInsert({ id: 't1', title: 'x', created_by: 'ann' })), []);
  assert.deepEqual(buildIntents(taskInsert({ id: 't1', title: 'x', assigned_to: 'ann', created_by: 'ann' })), []);
});

test('taak UPDATE: alleen pushen als de toewijzing daadwerkelijk wijzigde', () => {
  const rec = { id: 't1', title: 'x', assigned_to: 'bob', created_by: 'ann' };
  assert.equal(buildIntents(taskUpdate(rec, { ...rec, assigned_to: 'ann' })).length, 1, 'gewijzigd → push');
  assert.equal(buildIntents(taskUpdate(rec, { ...rec, assigned_to: 'bob' })).length, 0, 'ongewijzigd → geen push');
  assert.equal(buildIntents(taskUpdate(rec, { ...rec, assigned_to: null })).length, 1, 'van niemand → iemand → push');
});

test('onbekende tabel of lege payload → geen intents', () => {
  assert.deepEqual(buildIntents({ type: 'INSERT', table: 'expenses', record: { id: 'e1' } }), []);
  assert.deepEqual(buildIntents({}), []);
});

test('parseWebhookEvent normaliseert ontbrekende velden', () => {
  assert.deepEqual(parseWebhookEvent({}), { type: null, table: null, record: null, old_record: null });
});

test('chunk splitst op de Expo-batchlimiet', () => {
  const arr = Array.from({ length: 250 }, (_, i) => i);
  assert.deepEqual(chunk(arr, EXPO_MAX_BATCH).map((p) => p.length), [100, 100, 50]);
  assert.deepEqual(chunk([], EXPO_MAX_BATCH), []);
});

test('expoMessages bouwt één message per token met de intent-copy en behoudt de volgorde', () => {
  const intent = { title: 'T', body: 'B', data: { kind: 'task_assigned', taskId: 't1' } };
  const msgs = expoMessages(['tokA', 'tokB'], intent);
  assert.deepEqual(msgs.map((m) => m.to), ['tokA', 'tokB']);
  assert.equal(msgs[0].title, 'T');
  assert.equal(msgs[0].body, 'B');
  assert.deepEqual(msgs[1].data, { kind: 'task_assigned', taskId: 't1' });
});

// --- SEC-5: payload-hardening -------------------------------------------------

test('taak met een niet-string assigned_to → geen intent (recipientId-guard)', () => {
  assert.deepEqual(buildIntents(taskInsert({ id: 't1', title: 'x', assigned_to: 42, created_by: 'ann' })), []);
  assert.deepEqual(buildIntents(taskInsert({ id: 't1', title: 'x', assigned_to: '', created_by: 'ann' })), []);
  assert.deepEqual(buildIntents(taskInsert({ id: 't1', title: 'x', assigned_to: { id: 'bob' }, created_by: 'ann' })), []);
});

test('lange taaktitel wordt in de push-body afgekapt op MAX_BODY', () => {
  const longTitle = 'A'.repeat(500);
  const [intent] = buildIntents(taskInsert({ id: 't1', title: longTitle, assigned_to: 'bob', created_by: 'ann' }));
  assert.ok(intent.body.length <= MAX_BODY, 'body niet langer dan MAX_BODY');
  assert.ok(intent.body.endsWith('…'), 'afgekapte body eindigt op een ellipsis');
});

test('clampBody weert controletekens, vouwt witruimte samen en behoudt koppeltekens', () => {
  assert.equal(clampBody('Stof\tzuigen\n nu'), 'Stof zuigen nu');
  assert.equal(clampBody('multi-tool   set'), 'multi-tool set');
  assert.equal(clampBody('  trim  '), 'trim');
  assert.equal(clampBody(null), '');
  assert.equal(clampBody(undefined), '');
});

test('clampBody knipt af met een ellipsis en respecteert de max-parameter', () => {
  assert.equal(clampBody('abcdef', 4), 'abc…');
  assert.equal(clampBody('abcd', 4), 'abcd'); // precies op de grens → onveranderd
});
