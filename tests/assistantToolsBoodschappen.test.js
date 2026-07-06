// Unit-tests voor het Boodschappen-tool-pack (tools/boodschappen.js): render,
// query-compositie en de propose/execute-keten van de multi-edit (AI-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOODSCHAPPEN_TOOLS,
  BOODSCHAPPEN_BRIEF,
  renderGroceryList,
  proposeAddGroceries,
  proposeCheckGroceries,
  MAX_PROPOSED_GROCERIES,
} from '../supabase/functions/_shared/tools/boodschappen.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = (name) => BOODSCHAPPEN_TOOLS.find((t) => t.name === name);
const shape = ({ run, propose, execute, ...rest }) => rest;

// De module-brief gaat 1-op-1 de systemprompt-snapshot in (AI-10) — exact vastpinnen.
test('module-brief: ligt exact vast', () => {
  assert.deepEqual(BOODSCHAPPEN_BRIEF, { moduleKey: 'boodschappen', label: 'Boodschappen', brief: 'de gedeelde boodschappenlijst; kan de lijst tonen, items voorstellen en afvinken' });
});

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm van beide tools ligt exact vast', () => {
  assert.deepEqual(shape(tool('boodschappen_lijst')), {
    name: 'boodschappen_lijst',
    moduleKey: 'boodschappen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Boodschappenlijstje erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er nog gehaald moet worden of wat er op de boodschappenlijst staat. Haalt de actuele (onafgevinkte) lijst op. Voor "wat is er in huis / bijna op" is dit niet de juiste tool — gebruik voorraad_bijna_op.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
  assert.deepEqual(shape(tool('boodschappen_toevoegen')), {
    name: 'boodschappen_toevoegen',
    moduleKey: 'boodschappen',
    kind: 'write',
    risk: 'write',
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

// --- boodschappen_afvinken (punt 1, device-feedback): een write-tool die op naam
//     matcht en checked=true zet; geen undo-spoor (afvinken is geen insert).

test('descriptor-contract: boodschappen_afvinken ligt exact vast', () => {
  assert.deepEqual(shape(tool('boodschappen_afvinken')), {
    name: 'boodschappen_afvinken',
    moduleKey: 'boodschappen',
    kind: 'write',
    risk: 'write',
    destructive: false,
    idempotent: true,
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een of meer boodschappen als gehaald/gekocht wil afvinken of van de lijst wil halen (bv. "ik heb melk en brood gehaald"). Gebruik de namen zoals ze op de lijst staan (haal ze zo nodig eerst op met boodschappen_lijst). De gebruiker ziet een bevestigingskaart en kan per item aan- of uitvinken. Dit is niet voor het TOEVOEGEN van items — gebruik daarvoor boodschappen_toevoegen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De af te vinken boodschappen (maximaal 20).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'De naam zoals op de lijst, bv. "Melk"' },
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

test('proposeCheckGroceries: trimt namen, 1-op-1 uitlijning, grenzen', () => {
  const out = proposeCheckGroceries({ items: [{ name: ' Melk ' }, { name: 'Brood' }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, '2 boodschappen afvinken');
  assert.deepEqual(out.items, ['Melk', 'Brood']);
  assert.deepEqual(out.args.items, [{ name: 'Melk' }, { name: 'Brood' }]);
  assert.equal(out.items.length, out.args.items.length);
  assert.equal(proposeCheckGroceries({ items: [{ name: 'Melk' }] }).summary, '"Melk" afvinken van de boodschappenlijst');
  assert.equal(proposeCheckGroceries().ok, false);
  assert.equal(proposeCheckGroceries({ items: [] }).ok, false);
  assert.match(proposeCheckGroceries({ items: [{ name: '  ' }] }).error, /naam/);
  assert.match(proposeCheckGroceries({ items: Array.from({ length: MAX_PROPOSED_GROCERIES + 1 }, () => ({ name: 'x' })) }).error, /Maximaal 20/);
});

test('boodschappen_afvinken.execute: matcht case-insensitief op naam, zet checked=true, geen undo-spoor', async () => {
  const calls = [];
  const out = await tool('boodschappen_afvinken').execute(
    toolCtx({ groceries: [{ id: 'g1', name: 'Melk' }, { id: 'g2', name: 'Brood' }, { id: 'g3', name: 'Kaas' }] }, calls),
    { items: [{ name: 'melk' }, { name: 'BROOD' }] }
  );
  // Eerst de onafgevinkte lijst ophalen…
  assert.equal(calls[0].table, 'groceries');
  assert.deepEqual(calls[0].filters, [['eq', 'household_id', 'h1'], ['eq', 'checked', false]]);
  // …dan alleen de treffers (g1 + g2, niet Kaas) op checked=true.
  assert.equal(calls[1].table, 'groceries');
  assert.deepEqual(calls[1].updated, { checked: true });
  assert.deepEqual(calls[1].filters.find((f) => f[0] === 'in'), ['in', 'id', ['g1', 'g2']]);
  assert.equal(out.summary, '2 boodschappen afgevinkt.');
  assert.deepEqual(out.inserted, []); // niet undo-baar via insert-verwijdering
});

test('boodschappen_afvinken.execute: geen match → nette melding, geen update-call', async () => {
  const calls = [];
  const out = await tool('boodschappen_afvinken').execute(
    toolCtx({ groceries: [{ id: 'g1', name: 'Melk' }] }, calls),
    { items: [{ name: 'Bananen' }] }
  );
  assert.match(out.summary, /niet \(meer\) open/);
  assert.deepEqual(out.inserted, []);
  assert.equal(calls.length, 1); // alleen de select, geen update
});
