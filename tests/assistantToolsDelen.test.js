// Unit-tests voor het Samen/Delen-tool-pack (tools/delen.js, AI-19 fase A):
// reserveringen-rooster (dag-groepering, tijd-notatie) en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DELEN_TOOLS, DELEN_BRIEF, DELEN_MANIFEST, renderUpcomingReservations, proposeReserve } from '../supabase/functions/_shared/tools/delen.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = DELEN_TOOLS.find((t) => t.name === 'delen_reserveringen');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(DELEN_BRIEF, {
    moduleKey: 'delen',
    label: 'Samen',
    brief: 'gedeelde spullen (auto, gereedschap) en hun reserveringen; kan tonen wat bezet is en kan reserveren',
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

// --- Fase B: delen_reserveren (HITL; conflictcheck verplicht in execute).

test('proposeReserve: componeert UTC-instants via de client-offset; eindtijd na begintijd', () => {
  const out = proposeReserve(
    { items: [{ resource_name: ' Deelauto ', date: '2026-07-11', from: '14:00', to: '16:00', note: ' ophalen ' }] },
    { today: '2026-07-06', tzOffsetMinutes: 120 }
  );
  assert.equal(out.ok, true);
  assert.deepEqual(out.args.items, [{
    resource_name: 'Deelauto',
    starts_at: '2026-07-11T12:00:00.000Z',   // 14:00 NL-zomertijd = 12:00 UTC
    ends_at: '2026-07-11T14:00:00.000Z',
    note: 'ophalen',
  }]);
  assert.deepEqual(out.items, ['Deelauto — za 11 jul 14:00–16:00']);
  assert.equal(proposeReserve({ items: [{ resource_name: 'A', date: '2026-07-11', from: '16:00', to: '14:00' }] }, {}).ok, false);
  assert.equal(proposeReserve({ items: [{ resource_name: 'A', date: 'morgen', from: '14:00', to: '16:00' }] }, {}).ok, false);
  assert.equal(proposeReserve({ items: [{ resource_name: 'A', date: '2026-07-11', from: '25:00', to: '26:00' }] }, {}).ok, false);
  assert.equal(proposeReserve().ok, false);
});

test('delen_reserveren: execute weigert een overlappend tijdvak (de DB dwingt dit niet af)', async () => {
  const tool2 = DELEN_TOOLS.find((t) => t.name === 'delen_reserveren');
  const bezet = {
    shared_resources: [{ id: 'r1', name: 'Deelauto' }],
    reservations: [{ id: 'x', starts_at: '2026-07-11T11:00:00.000Z', ends_at: '2026-07-11T13:00:00.000Z' }],
  };
  await assert.rejects(
    () => tool2.execute(toolCtx(bezet, []), { items: [{ resource_name: 'deelauto', starts_at: '2026-07-11T12:00:00.000Z', ends_at: '2026-07-11T14:00:00.000Z', note: null }] }),
    /al gereserveerd/
  );
  // Rakend (eind == begin) telt niet als conflict — half-open interval.
  const calls = [];
  const vrij = {
    shared_resources: [{ id: 'r1', name: 'Deelauto' }],
    reservations: [{ id: 'x', starts_at: '2026-07-11T10:00:00.000Z', ends_at: '2026-07-11T12:00:00.000Z' }],
  };
  const out = await tool2.execute(toolCtx(vrij, calls), { items: [{ resource_name: 'Deelauto', starts_at: '2026-07-11T12:00:00.000Z', ends_at: '2026-07-11T14:00:00.000Z', note: null }] });
  assert.deepEqual(out.inserted, [{ table: 'reservations', id: 'reservations-1' }]);
  const ins = calls.find((c) => c.table === 'reservations' && c.inserted);
  assert.equal(ins.inserted[0].profile_id, 'u1');
});

// Descriptor-contract van de write-tool exact vastpinnen (zelfde reden als bij
// de read-tool: een gewijzigde description verandert de tool-selectie en hoort
// een test te breken — en gaat daarna door de eval-gate).
test('descriptor-contract (write): statische vorm ligt exact vast', () => {
  const w = DELEN_TOOLS.find((t) => t.name === 'delen_reserveren');
  assert.deepEqual(shape(w), {
      "name": "delen_reserveren",
      "moduleKey": "delen",
      "kind": "write",
      "risk": "write",
      "destructive": false,
      "idempotent": false,
      "statusLabel": "Reservering klaarzetten…",
      "description": "Roep dit aan wanneer de gebruiker de deelauto of iets anders gedeelds wil reserveren of vastleggen voor een tijdvak (bv. \"reserveer de auto zaterdag van 14 tot 16\"). Kijk zo nodig eerst met delen_reserveringen wat er al bezet is. Stelt de reservering voor: de gebruiker beslist op de bevestigingskaart; een tijdvak dat toch al bezet blijkt wordt bij uitvoeren geweigerd. Rit-kosten boeken hoort hier niet bij.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "description": "De te plaatsen reserveringen (meestal één, maximaal 3).",
            "items": {
              "type": "object",
              "properties": {
                "resource_name": {
                  "type": "string",
                  "description": "Wat er gereserveerd wordt, zoals het in de app heet (bv. \"Deelauto\")"
                },
                "date": {
                  "type": "string",
                  "description": "De dag als YYYY-MM-DD"
                },
                "from": {
                  "type": "string",
                  "description": "Begintijd als HH:MM (24-uurs, lokale tijd)"
                },
                "to": {
                  "type": "string",
                  "description": "Eindtijd als HH:MM (24-uurs, lokale tijd)"
                },
                "note": {
                  "type": "string",
                  "description": "Optionele notitie, bv. het doel van de rit"
                }
              },
              "required": [
                "resource_name",
                "date",
                "from",
                "to"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "items"
        ],
        "additionalProperties": false
      }
    });
});
