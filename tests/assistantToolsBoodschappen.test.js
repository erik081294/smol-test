// Unit-tests voor het Boodschappen-tool-pack (tools/boodschappen.js): render,
// query-compositie en de propose/execute-keten van de multi-edit (AI-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOODSCHAPPEN_TOOLS,
  renderGroceryList,
  proposeAddGroceries,
  MAX_PROPOSED_GROCERIES,
} from '../supabase/functions/_shared/tools/boodschappen.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = (name) => BOODSCHAPPEN_TOOLS.find((t) => t.name === name);
const shape = ({ run, propose, execute, ...rest }) => rest;

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm van beide tools ligt exact vast', () => {
  assert.deepEqual(shape(tool('boodschappen_lijst')), {
    name: 'boodschappen_lijst',
    moduleKey: 'boodschappen',
    kind: 'read',
    statusLabel: 'Boodschappenlijstje erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er nog gehaald moet worden of wat er op de boodschappenlijst staat. Haalt de actuele (onafgevinkte) lijst op. Voor "wat is er in huis / bijna op" is dit niet de juiste tool — gebruik voorraad_bijna_op.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
  assert.deepEqual(shape(tool('boodschappen_toevoegen')), {
    name: 'boodschappen_toevoegen',
    moduleKey: 'boodschappen',
    kind: 'write',
    destructive: false,
    idempotent: false,
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker iets op de boodschappenlijst wil zetten of wil laten halen. Stelt één of meer items voor: de gebruiker ziet een bevestigingskaart en kan per item aan- of uitvinken, er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De toe te voegen boodschappen (maximaal 20).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Wat er gehaald moet worden, bv. "Melk"' },
              quantity: { type: 'string', description: 'Optionele hoeveelheid, bv. "2 pakken"' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  });
});

test('renderGroceryList: quantity tussen haakjes, zonder quantity kaal; leeg → kaart', () => {
  const { data, render } = renderGroceryList([{ name: 'Melk', quantity: '2 pak' }, { name: 'Brood', quantity: null }]);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Boodschappenlijst (2)');
  assert.deepEqual(render[0].items, [{ text: 'Melk (2 pak)' }, { text: 'Brood' }]);
  assert.deepEqual(data.items[1], { name: 'Brood', quantity: null });
  assert.deepEqual(renderGroceryList().render, [{ type: 'card', title: 'Boodschappenlijst', lines: ['De lijst is leeg.'] }]);
});

test('boodschappen_lijst: juiste tabel/kolommen/filters/sortering', async () => {
  const calls = [];
  await tool('boodschappen_lijst').run(toolCtx({ groceries: [{ name: 'Melk', quantity: null }] }, calls));
  assert.equal(calls[0].table, 'groceries');
  assert.equal(calls[0].selected, 'name, quantity');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'checked', false],
  ]);
  assert.deepEqual(calls[0].order, ['created_at', { ascending: true }]);
});

test('boodschappen_lijst: query-fout gooit; zonder message → fallback "query mislukt"', async () => {
  await assert.rejects(() => tool('boodschappen_lijst').run(toolCtx({}, [], { queryError: { message: 'boem' } })), /boem/);
  await assert.rejects(() => tool('boodschappen_lijst').run(toolCtx({}, [], { queryError: {} })), /query mislukt/);
});

// --- proposeAddGroceries (AI-8): puur, met 1-op-1 items/args-uitlijning.

test('proposeAddGroceries: trimt naam/hoeveelheid, lege hoeveelheid → null, uitlijning klopt', () => {
  const out = proposeAddGroceries({ items: [
    { name: ' Melk ', quantity: ' 2 pakken ' },
    { name: 'Eieren', quantity: '  ' },
    { name: 'Kaas' },
  ] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, '3 boodschappen op de lijst zetten');
  assert.deepEqual(out.items, ['Melk (2 pakken)', 'Eieren', 'Kaas']);
  assert.deepEqual(out.args.items, [
    { name: 'Melk', quantity: '2 pakken' },
    { name: 'Eieren', quantity: null },
    { name: 'Kaas', quantity: null },
  ]);
  assert.equal(out.items.length, out.args.items.length);
});

test('proposeAddGroceries: één item → summary met naam', () => {
  const out = proposeAddGroceries({ items: [{ name: 'Melk' }] });
  assert.equal(out.summary, '"Melk" op de boodschappenlijst zetten');
});

test('proposeAddGroceries: leeg, te veel, naamloos of te lang → duidelijke fout; grens is inclusief', () => {
  assert.equal(proposeAddGroceries().ok, false);
  assert.equal(proposeAddGroceries({ items: [] }).ok, false);
  assert.match(proposeAddGroceries({ items: [{ name: '' }] }).error, /naam/);
  const precies = { items: Array.from({ length: MAX_PROPOSED_GROCERIES }, () => ({ name: 'x' })) };
  assert.equal(proposeAddGroceries(precies).ok, true);
  const teVeel = { items: Array.from({ length: MAX_PROPOSED_GROCERIES + 1 }, () => ({ name: 'x' })) };
  assert.match(proposeAddGroceries(teVeel).error, /Maximaal 20/);
  assert.equal(proposeAddGroceries({ items: [{ name: 'x'.repeat(80) }] }).ok, true);
  assert.match(proposeAddGroceries({ items: [{ name: 'x'.repeat(81) }] }).error, /80/);
});

test('boodschappen_toevoegen.execute: insert met added_by + checked:false, ids terug voor undo', async () => {
  const calls = [];
  const out = await tool('boodschappen_toevoegen').execute(
    toolCtx({}, calls),
    { items: [{ name: 'Melk', quantity: '2 pakken' }, { name: 'Kaas', quantity: null }] }
  );
  assert.equal(calls[0].table, 'groceries');
  assert.deepEqual(calls[0].inserted[0], {
    household_id: 'h1', added_by: 'u1', name: 'Melk', quantity: '2 pakken', checked: false,
  });
  assert.equal(out.summary, '2 boodschappen op de lijst gezet.');
  assert.deepEqual(out.inserted, [{ table: 'groceries', id: 'groceries-1' }, { table: 'groceries', id: 'groceries-2' }]);
});

test('boodschappen_toevoegen.execute: één item → enkelvoud-summary; insert-fout gooit', async () => {
  const out = await tool('boodschappen_toevoegen').execute(toolCtx({}, []), { items: [{ name: 'Melk', quantity: null }] });
  assert.equal(out.summary, 'Op de boodschappenlijst gezet.');
  await assert.rejects(
    () => tool('boodschappen_toevoegen').execute(toolCtx({}, [], { insertError: {} }), { items: [{ name: 'Melk', quantity: null }] }),
    /query mislukt/
  );
});
