// Unit-tests voor het Huisdieren-tool-pack (tools/huisdieren.js, AI-19 fase A):
// leeftijd-spiegel (petAgeLabel), overzicht-render en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUISDIEREN_TOOLS, HUISDIEREN_BRIEF, HUISDIEREN_MANIFEST, petAgeLabel, renderPetsOverview, proposeAddPetLog } from '../supabase/functions/_shared/tools/huisdieren.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_overzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(HUISDIEREN_BRIEF, {
    moduleKey: 'huisdieren',
    label: 'Huisdieren',
    brief: 'de huisdieren en hun verzorging; kan het dierenoverzicht tonen en logboek-regels (gewicht/notitie) toevoegen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(HUISDIEREN_MANIFEST, { moduleKey: 'huisdieren', label: 'Huisdieren', brief: HUISDIEREN_BRIEF.brief, tools: HUISDIEREN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'huisdieren_overzicht',
    moduleKey: 'huisdieren',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even bij de dieren kijken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de huisdieren, hun leeftijd of gewicht, of welke dierverzorging er openstaat. Toont alle huisdieren met soort, leeftijd, laatst gelogde gewicht en het aantal open verzorgingstaken.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('petAgeLabel: maanden onder het jaar, jaren erboven, maandgrens exact', () => {
  assert.equal(petAgeLabel('2025-11-06', '2026-07-06'), '8 mnd');
  assert.equal(petAgeLabel('2025-07-06', '2026-07-06'), '1 jaar');   // precies jarig
  assert.equal(petAgeLabel('2025-07-07', '2026-07-06'), '11 mnd');   // één dag vóór de verjaardag
  assert.equal(petAgeLabel('2023-03-01', '2026-07-06'), '3 jaar');
  assert.equal(petAgeLabel('2026-07-06', '2026-07-06'), '0 mnd');    // vandaag geboren
});

test('petAgeLabel: rommel/toekomst/ontbrekend → null', () => {
  assert.equal(petAgeLabel(null, '2026-07-06'), null);
  assert.equal(petAgeLabel('geen datum', '2026-07-06'), null);
  assert.equal(petAgeLabel('2027-01-01', '2026-07-06'), null);   // toekomst
  assert.equal(petAgeLabel('2025-01-01', ''), null);
});

test('renderPetsOverview: soortlabel-voorkeur, nieuwste gewicht wint, open taken geteld', () => {
  const { data, render } = renderPetsOverview(
    [
      { id: 'd1', name: 'Nala', type: 'hond', species_label: null, birth_date: '2023-07-01' },
      { id: 'd2', name: 'Rex', type: 'anders', species_label: 'Baardagaam', birth_date: null },
    ],
    [
      { pet_id: 'd1', weight_grams: 12500, created_at: '2026-07-01' },   // nieuwste eerst aangeleverd → wint
      { pet_id: 'd1', weight_grams: 11900, created_at: '2026-06-01' },
      { pet_id: 'd2', weight_grams: 0, created_at: '2026-07-01' },       // 0 telt niet
    ],
    [{ pet_id: 'd1' }, { pet_id: 'd1' }, { pet_id: null }],
    '2026-07-06'
  );
  assert.deepEqual(data.pets, [
    { name: 'Nala', type: 'hond', age: '3 jaar', weight_grams: 12500, open_care_tasks: 2 },
    { name: 'Rex', type: 'Baardagaam', age: null, weight_grams: null, open_care_tasks: 0 },
  ]);
  assert.deepEqual(render[0].items.map((i) => i.text), [
    'Nala — hond · 3 jaar · 12,5 kg · 2 open taken',
    'Rex — Baardagaam',
  ]);
});

test('renderPetsOverview: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderPetsOverview().render, [{ type: 'card', title: 'Huisdieren', lines: ['Er staan nog geen huisdieren in de app.'] }]);
});

test('huisdieren_overzicht: juiste tabellen/kolommen/filters', async () => {
  const calls = [];
  await tool.run(toolCtx({ pets: [], pet_log: [], tasks: [] }, calls));
  assert.equal(calls.find((c) => c.table === 'pets').selected, 'id, name, type, species_label, birth_date');
  assert.deepEqual(calls.find((c) => c.table === 'pet_log').filters, [['not', 'weight_grams', 'is', null]]);
  assert.deepEqual(calls.find((c) => c.table === 'tasks').filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'category', 'huisdier'],
    ['is', 'completed_at', null],
    ['not', 'pet_id', 'is', null],
  ]);
});

// --- Fase B: huisdieren_logboek_toevoegen (HITL).

test('proposeAddPetLog: spiegelt de DB-CHECK — minstens notitie of gewicht; gewicht in grammen', () => {
  const out = proposeAddPetLog({ items: [{ pet_name: ' Nala ', weight_grams: 12500 }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, 'Logboek-regel voor Nala toevoegen');
  assert.deepEqual(out.items, ['Nala · 12,5 kg']);
  assert.deepEqual(out.args.items, [{ pet_name: 'Nala', note: null, weight_grams: 12500 }]);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'Nala' }] }).ok, false);            // niets te loggen
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'Nala', weight_grams: 0 }] }).ok, false);
  assert.equal(proposeAddPetLog({ items: [{ note: 'zonder dier' }] }).ok, false);
  assert.equal(proposeAddPetLog().ok, false);
});

test('huisdieren_logboek_toevoegen: execute matcht dier case-insensitief; onbekend → duidelijke fout', async () => {
  const tool2 = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_logboek_toevoegen');
  const calls = [];
  const out = await tool2.execute(
    toolCtx({ pets: [{ id: 'd1', name: 'Nala' }] }, calls),
    { items: [{ pet_name: 'nala', note: 'alles goed', weight_grams: null }] }
  );
  const ins = calls.find((c) => c.table === 'pet_log');
  assert.deepEqual(ins.inserted, [{ pet_id: 'd1', created_by: 'u1', note: 'alles goed' }]);
  assert.deepEqual(out.inserted, [{ table: 'pet_log', id: 'pet_log-1' }]);
  await assert.rejects(
    () => tool2.execute(toolCtx({ pets: [] }, []), { items: [{ pet_name: 'Spook', note: 'x', weight_grams: null }] }),
    /niet \(eenduidig\) gevonden/
  );
});
