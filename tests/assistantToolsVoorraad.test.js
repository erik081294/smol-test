// Unit-tests voor het Voorraad-tool-pack (tools/voorraad.js): drempel- en
// houdbaarheids-grenswaarden (<=), default-params en de horizon-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOORRAAD_TOOLS, VOORRAAD_BRIEF, lowPantryItems, renderPantryLow } from '../supabase/functions/_shared/tools/voorraad.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = VOORRAAD_TOOLS.find((t) => t.name === 'voorraad_bijna_op');
const shape = ({ run, propose, execute, ...rest }) => rest;

// De module-brief gaat 1-op-1 de systemprompt-snapshot in (AI-10) — exact vastpinnen.
test('module-brief: ligt exact vast', () => {
  assert.deepEqual(VOORRAAD_BRIEF, { moduleKey: 'voorraad', label: 'Voorraad', brief: 'wat er in huis is; kan tonen wat bijna op is of tegen de houdbaarheidsdatum aanloopt' });
});

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'voorraad_bijna_op',
    moduleKey: 'voorraad',
    kind: 'read',
    statusLabel: 'Voorraad nalopen…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er in huis is, wat bijna op is, of wat tegen de houdbaarheid aanloopt. Toont voorraad-items onder de drempel of die binnen een week over datum zijn. Voor de boodschappenlijst zelf: gebruik boodschappen_lijst.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('lowPantryItems: drempel is inclusief (<=), zonder drempel geen "bijna op"', () => {
  const rows = [
    { name: 'Precies op drempel', quantity: 2, low_threshold: 2 },
    { name: 'Boven drempel', quantity: 3, low_threshold: 2 },
    { name: 'Geen drempel', quantity: 0, low_threshold: null },
  ];
  assert.deepEqual(lowPantryItems(rows, '').map((p) => p.name), ['Precies op drempel']);
});

test('lowPantryItems: houdbaarheid exact op de horizon telt mee, erna niet; lege horizon telt niets', () => {
  const rows = [
    { name: 'Op horizon', quantity: 5, low_threshold: null, best_before: '2026-07-11' },
    { name: 'Na horizon', quantity: 5, low_threshold: null, best_before: '2026-07-12' },
  ];
  assert.deepEqual(lowPantryItems(rows, '2026-07-11').map((p) => p.name), ['Op horizon']);
  assert.deepEqual(lowPantryItems(rows, ''), []);
  assert.deepEqual(lowPantryItems(), []);
});

test('lowPantryItems: default-horizon is leeg — géén houdbaarheids-hits zonder horizon-argument', () => {
  // Kill voor de default-param-mutant: met een gemuteerde default (niet-lege string)
  // zou dit item wél matchen ('2026…' <= 'Stryker…').
  assert.deepEqual(lowPantryItems([{ name: 'X', quantity: 9, low_threshold: null, best_before: '2026-01-01' }]), []);
});

test('renderPantryLow: eenheid-fallback "stuk"; leeg → geruststellende kaart', () => {
  const { render } = renderPantryLow([{ name: 'Melk', quantity: 1, unit: null }, { name: 'Rijst', quantity: 0.5, unit: 'kg' }]);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Bijna op / let op houdbaarheid');
  assert.deepEqual(render[0].items, [{ text: 'Melk (1 stuk)' }, { text: 'Rijst (0.5 kg)' }]);
  assert.deepEqual(renderPantryLow().render, [{ type: 'card', title: 'Voorraad', lines: ['Alles is voldoende op voorraad.'] }]);
});

test('voorraad_bijna_op: horizon = today+7 bepaalt de houdbaarheids-selectie', async () => {
  const rows = [
    { name: 'Binnen week', quantity: 5, unit: 'stuk', low_threshold: null, best_before: '2026-07-11' },
    { name: 'Erna', quantity: 5, unit: 'stuk', low_threshold: null, best_before: '2026-07-12' },
  ];
  const out = await tool.run(toolCtx({ pantry_items: rows }, []));
  assert.deepEqual(out.data.items, ['Binnen week']);
});

test('voorraad_bijna_op: juiste tabel/kolommen', async () => {
  const calls = [];
  await tool.run(toolCtx({ pantry_items: [] }, calls));
  assert.equal(calls[0].table, 'pantry_items');
  assert.equal(calls[0].selected, 'name, quantity, unit, low_threshold, best_before');
  assert.deepEqual(calls[0].filters, [['eq', 'household_id', 'h1']]);
});
