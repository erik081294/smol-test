// Unit-tests voor het Samen/Delen-tool-pack (tools/delen.js, AI-19 fase A):
// reserveringen-rooster (dag-groepering, tijd-notatie) en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DELEN_TOOLS, DELEN_BRIEF, DELEN_MANIFEST, renderUpcomingReservations } from '../supabase/functions/_shared/tools/delen.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = DELEN_TOOLS.find((t) => t.name === 'delen_reserveringen');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(DELEN_BRIEF, {
    moduleKey: 'delen',
    label: 'Samen',
    brief: 'gedeelde spullen (auto, gereedschap) en hun reserveringen; kan tonen wat wanneer bezet of vrij is',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(DELEN_MANIFEST, { moduleKey: 'delen', label: 'Samen', brief: DELEN_BRIEF.brief, tools: DELEN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'delen_reserveringen',
    moduleKey: 'delen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Reserveringen nakijken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt of de (deel)auto of iets anders gedeelds vrij of bezet is, of wie iets wanneer heeft gereserveerd. Toont de komende reserveringen per dag.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('renderUpcomingReservations: groepeert per dag (schedule-node), vandaag gemarkeerd, tijden uit de timestamp', () => {
  const { data, render } = renderUpcomingReservations(
    [
      { resource_id: 'r1', profile_id: 'u1', starts_at: '2026-07-06T09:00:00+00:00', ends_at: '2026-07-06T12:30:00+00:00' },
      { resource_id: 'r1', profile_id: 'u2', starts_at: '2026-07-06T14:00:00+00:00', ends_at: '2026-07-06T16:00:00+00:00' },
      { resource_id: 'r2', profile_id: null, starts_at: '2026-07-08T10:00:00+00:00', ends_at: '2026-07-08T11:00:00+00:00' },
      { resource_id: 'r1', profile_id: 'u1', starts_at: null, ends_at: '2026-07-09T10:00:00+00:00' },   // kapot → weg
    ],
    { r1: 'Deelauto', r2: 'Aanhanger' },
    { u1: 'Erik', u2: 'Sam' },
    '2026-07-06'
  );
  assert.equal(data.count, 3);
  const node = render[0];
  assert.equal(node.type, 'schedule');
  assert.deepEqual(node.days.map((d) => [d.label, d.today]), [['ma 6 jul', true], ['wo 8 jul', false]]);
  assert.deepEqual(node.days[0].entries.map((e) => e.text), [
    'Deelauto 09:00–12:30 (Erik)',
    'Deelauto 14:00–16:00 (Sam)',
  ]);
  assert.deepEqual(node.days[1].entries.map((e) => e.text), ['Aanhanger 10:00–11:00']);
  // Text-fallback voor oude clients komt uit de scheduleNode-constructor mee.
  assert.equal(typeof node.text, 'string');
  assert.ok(node.text.length > 0);
});

test('renderUpcomingReservations: cap op 7 dagen; leeg/default → rustige kaart', () => {
  const veel = Array.from({ length: 10 }, (_, i) => ({
    resource_id: 'r1',
    starts_at: `2026-07-${String(10 + i).padStart(2, '0')}T10:00:00+00:00`,
    ends_at: `2026-07-${String(10 + i).padStart(2, '0')}T11:00:00+00:00`,
  }));
  assert.equal(renderUpcomingReservations(veel, { r1: 'Auto' }).render[0].days.length, 7);
  assert.deepEqual(renderUpcomingReservations().render, [{ type: 'card', title: 'Reserveringen', lines: ['Er staat niets gereserveerd.'] }]);
});

test('delen_reserveringen: juiste tabellen/filters (alleen nog-lopende boekingen, oplopend)', async () => {
  const calls = [];
  await tool.run(toolCtx({ shared_resources: [], reservations: [] }, calls));
  const resCall = calls.find((c) => c.table === 'reservations');
  assert.deepEqual(resCall.filters, [
    ['eq', 'household_id', 'h1'],
    ['gt', 'ends_at', '2026-07-04T00:00:00Z'],
  ]);
  assert.deepEqual(resCall.order, ['starts_at', { ascending: true }]);
});
