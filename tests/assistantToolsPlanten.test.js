// Unit-tests voor het Planten-tool-pack (tools/planten.js, AI-19 fase A):
// overzicht-render (eerstvolgende verzorgingstaak per plant) + query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANTEN_TOOLS, PLANTEN_BRIEF, PLANTEN_MANIFEST, renderPlantsOverview, proposeAddPlants, MAX_PROPOSED_PLANTS } from '../supabase/functions/_shared/tools/planten.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = PLANTEN_TOOLS.find((t) => t.name === 'planten_overzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(PLANTEN_BRIEF, {
    moduleKey: 'planten',
    label: 'Planten',
    brief: 'de kamerplanten en hun verzorging; kan het overzicht tonen en planten toevoegen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(PLANTEN_MANIFEST, { moduleKey: 'planten', label: 'Planten', brief: PLANTEN_BRIEF.brief, tools: PLANTEN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'planten_overzicht',
    moduleKey: 'planten',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even langs de planten…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de planten, welke plant water of voeding nodig heeft, of wat er aan plantverzorging openstaat. Toont alle planten met locatie en de eerstvolgende verzorgingstaak.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('renderPlantsOverview: eerstvolgende taak per plant (vroegste due_date wint), locatie optioneel', () => {
  const { data, render } = renderPlantsOverview(
    [
      { id: 'p1', name: 'Monstera', location: 'woonkamer' },
      { id: 'p2', name: 'Ficus', location: null },
    ],
    [
      { plant_id: 'p1', title: 'Water geven', due_date: '2026-07-10' },
      { plant_id: 'p1', title: 'Voeden', due_date: '2026-07-08' },     // vroeger → wint
      { plant_id: 'p1', title: 'Zonder datum', due_date: null },        // telt niet als "volgende"
      { plant_id: null, title: 'Los', due_date: '2026-07-07' },         // geen plant → weg
    ]
  );
  assert.deepEqual(data, {
    count: 2,
    plants: [
      { name: 'Monstera', location: 'woonkamer', next_care: { title: 'Voeden', due_date: '2026-07-08' } },
      { name: 'Ficus', location: null, next_care: null },
    ],
  });
  assert.deepEqual(render[0].items.map((i) => i.text), [
    'Monstera (woonkamer) — Voeden wo 8 jul',
    'Ficus',
  ]);
});

test('renderPlantsOverview: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderPlantsOverview().render, [{ type: 'card', title: 'Planten', lines: ['Er staan nog geen planten in de app.'] }]);
});

test('planten_overzicht: juiste tabellen/kolommen/filters (RLS-scoped, category plant, open taken)', async () => {
  const calls = [];
  await tool.run(toolCtx({ plants: [], tasks: [] }, calls));
  const plantsCall = calls.find((c) => c.table === 'plants');
  const tasksCall = calls.find((c) => c.table === 'tasks');
  assert.equal(plantsCall.selected, 'id, name, location');
  assert.deepEqual(plantsCall.filters, [['eq', 'household_id', 'h1']]);
  assert.equal(tasksCall.selected, 'plant_id, title, due_date');
  assert.deepEqual(tasksCall.filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'category', 'plant'],
    ['is', 'completed_at', null],
    ['not', 'plant_id', 'is', null],
  ]);
});

// --- Fase B: planten_toevoegen (HITL).

test('proposeAddPlants: normaliseert naam/locatie/water_days, items 1-op-1 met args', () => {
  const out = proposeAddPlants({ items: [
    { name: '  Monstera  ', location: ' woonkamer ', water_days: 7 },
    { name: 'Ficus' },
  ] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, '2 planten toevoegen');
  assert.deepEqual(out.items, ['Monstera · woonkamer · water elke 7 dgn', 'Ficus']);
  assert.deepEqual(out.args.items, [
    { name: 'Monstera', location: 'woonkamer', water_days: 7 },
    { name: 'Ficus', location: null, water_days: null },
  ]);
});

test('proposeAddPlants: grenzen — lege naam, te lang, water_days buiten 1-60, cap en default-arg', () => {
  assert.equal(proposeAddPlants({ items: [{ name: '' }] }).ok, false);
  assert.equal(proposeAddPlants({ items: [{ name: 'x'.repeat(81) }] }).ok, false);
  assert.deepEqual(proposeAddPlants({ items: [{ name: 'A', water_days: 0 }] }).args.items[0].water_days, null);
  assert.deepEqual(proposeAddPlants({ items: [{ name: 'A', water_days: 61 }] }).args.items[0].water_days, null);
  assert.equal(proposeAddPlants({ items: [{ name: 'A', water_days: 1 }] }).args.items[0].water_days, 1);
  assert.equal(proposeAddPlants({ items: Array.from({ length: MAX_PROPOSED_PLANTS + 1 }, () => ({ name: 'p' })) }).ok, false);
  assert.equal(proposeAddPlants().ok, false);
});

test('planten_toevoegen: execute schrijft plant + eerste water-taak (undo-spoor beide)', async () => {
  const calls = [];
  const tool2 = PLANTEN_TOOLS.find((t) => t.name === 'planten_toevoegen');
  const out = await tool2.execute(toolCtx({}, calls), { items: [{ name: 'Monstera', location: 'woonkamer', water_days: 7 }] });
  const plantIns = calls.find((c) => c.table === 'plants');
  const taskIns = calls.find((c) => c.table === 'tasks');
  assert.deepEqual(plantIns.inserted, [{ household_id: 'h1', created_by: 'u1', name: 'Monstera', location: 'woonkamer', water_days: 7 }]);
  assert.equal(taskIns.inserted[0].plant_id, 'plants-1');
  assert.equal(taskIns.inserted[0].due_date, '2026-07-11'); // today (2026-07-04) + 7
  assert.equal(taskIns.inserted[0].recur_interval, 7);
  assert.deepEqual(out.inserted, [{ table: 'plants', id: 'plants-1' }, { table: 'tasks', id: 'tasks-1' }]);
});
