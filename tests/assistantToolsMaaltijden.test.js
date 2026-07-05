// Unit-tests voor het Keuken-tool-pack (tools/maaltijden.js): weekmenu-render
// (recept-fallbacks, diner-verkorting), de datumvenster-query en de
// propose/execute-keten van maaltijden_plannen (AI-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAALTIJDEN_TOOLS,
  renderWeekMenu,
  proposePlanMeals,
  MAX_PROPOSED_MEALS,
  MEAL_TYPES,
} from '../supabase/functions/_shared/tools/maaltijden.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = (name) => MAALTIJDEN_TOOLS.find((t) => t.name === name);
const shape = ({ run, propose, execute, ...rest }) => rest;

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm van beide tools ligt exact vast', () => {
  assert.deepEqual(shape(tool('maaltijden_weekmenu')), {
    name: 'maaltijden_weekmenu',
    moduleKey: 'maaltijden',
    kind: 'read',
    statusLabel: 'Weekmenu erbij pakken…',
    description: 'Haal het geplande weekmenu op (vandaag + de komende dagen), inclusief gekoppelde recepten. Gebruik dit bij vragen over wat er gegeten wordt of wat er op het menu staat.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Hoeveel dagen vooruit (1-14, default 7)' } },
      required: [],
      additionalProperties: false,
    },
  });
  assert.deepEqual(shape(tool('maaltijden_plannen')), {
    name: 'maaltijden_plannen',
    moduleKey: 'maaltijden',
    kind: 'write',
    destructive: false,
    idempotent: false,
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Stel voor om één of meer maaltijden op het weekmenu te zetten (bv. "vrijdag lasagne"). De gebruiker ziet een bevestigingskaart en kan per maaltijd aan- of uitvinken; er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De in te plannen maaltijden (maximaal 14).',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'De dag als YYYY-MM-DD' },
              title: { type: 'string', description: 'Wat er gegeten wordt, bv. "Lasagne"' },
              meal_type: { type: 'string', enum: ['ontbijt', 'lunch', 'diner', 'snack'], description: 'Welk eetmoment (default: diner)' },
              servings: { type: 'integer', description: 'Optioneel aantal eters (1-12)' },
            },
            required: ['date', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  });
});

test('renderWeekMenu: diner blijft onbenoemd, andere momenten wél; titel-fallbacks recept → "Maaltijd"', () => {
  const rows = [
    { plan_date: '2026-07-06', meal_type: 'diner', title: 'Lasagne', servings: 4 },
    { plan_date: '2026-07-07', meal_type: 'lunch', title: null, recipes: { title: 'Soep' }, servings: null },
    { plan_date: '2026-07-08', meal_type: null, title: null, recipes: null },
  ];
  const { data, render } = renderWeekMenu(rows, 7);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Weekmenu (komende 7 dagen)');
  assert.deepEqual(render[0].items, [
    { text: 'ma 6 jul — Lasagne (4p)' },
    { text: 'di 7 jul · lunch — Soep' },
    { text: 'wo 8 jul — Maaltijd' },
  ]);
  assert.deepEqual(data.entries[1], { date: '2026-07-07', meal_type: 'lunch', title: 'Soep', servings: null });
});

test('renderWeekMenu: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderWeekMenu().render, [{ type: 'card', title: 'Weekmenu', lines: ['Er staat nog niets op het menu.'] }]);
});

test('maaltijden_weekmenu: datumvenster [today, today+days), recepten-join en dagen-clamp', async () => {
  const calls = [];
  await tool('maaltijden_weekmenu').run(toolCtx({ meal_plan_entries: [] }, calls), { days: 3 });
  assert.equal(calls[0].table, 'meal_plan_entries');
  assert.equal(calls[0].selected, 'plan_date, meal_type, title, servings, recipes(title)');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['gte', 'plan_date', '2026-07-04'],
    ['lt', 'plan_date', '2026-07-07'],
  ]);
  assert.deepEqual(calls[0].order, ['plan_date', { ascending: true }]);
  // Ongeldig/ontbrekend/buiten bereik → default 7 dagen.
  for (const args of [undefined, {}, { days: 0 }, { days: 15 }, { days: 2.5 }]) {
    const c2 = [];
    await tool('maaltijden_weekmenu').run(toolCtx({ meal_plan_entries: [] }, c2), args);
    assert.deepEqual(c2[0].filters[2], ['lt', 'plan_date', '2026-07-11'], `days-arg ${JSON.stringify(args)}`);
  }
});

// --- proposePlanMeals (AI-8): puur, met 1-op-1 items/args-uitlijning.

test('proposePlanMeals: normaliseert moment/eters en lijnt items uit met args.items', () => {
  const out = proposePlanMeals({ items: [
    { date: '2026-07-10', title: 'Lasagne', servings: 4 },
    { date: '2026-07-11', title: 'Soep', meal_type: 'lunch' },
    { date: '2026-07-12', title: 'Pizza', meal_type: 'brunch', servings: 99 }, // onbekend moment + eters buiten bereik
  ] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, '3 maaltijden inplannen');
  assert.deepEqual(out.items, [
    'vr 10 jul — Lasagne (4p)',
    'za 11 jul · lunch — Soep',
    'zo 12 jul — Pizza',
  ]);
  assert.deepEqual(out.args.items, [
    { date: '2026-07-10', meal_type: 'diner', title: 'Lasagne', servings: 4 },
    { date: '2026-07-11', meal_type: 'lunch', title: 'Soep', servings: null },
    { date: '2026-07-12', meal_type: 'diner', title: 'Pizza', servings: null },
  ]);
  assert.equal(out.items.length, out.args.items.length);
});

test('proposePlanMeals: één maaltijd → summary met titel en dag', () => {
  const out = proposePlanMeals({ items: [{ date: '2026-07-10', title: 'Lasagne' }] });
  assert.equal(out.summary, '"Lasagne" op het menu zetten (vr 10 jul)');
});

test('proposePlanMeals: eters-grenzen 1 en 12 zijn inclusief', () => {
  const at = (servings) => proposePlanMeals({ items: [{ date: '2026-07-10', title: 'X', servings }] }).args.items[0].servings;
  assert.equal(at(1), 1);
  assert.equal(at(12), 12);
  assert.equal(at(0), null);
  assert.equal(at(13), null);
});

test('proposePlanMeals: leeg, te veel, titel-loos of foute datum → duidelijke fout; grens inclusief', () => {
  assert.equal(proposePlanMeals().ok, false);
  assert.equal(proposePlanMeals({ items: [] }).ok, false);
  const precies = { items: Array.from({ length: MAX_PROPOSED_MEALS }, () => ({ date: '2026-07-10', title: 'x' })) };
  assert.equal(proposePlanMeals(precies).ok, true);
  const teVeel = { items: Array.from({ length: MAX_PROPOSED_MEALS + 1 }, () => ({ date: '2026-07-10', title: 'x' })) };
  assert.match(proposePlanMeals(teVeel).error, /Maximaal 14/);
  assert.match(proposePlanMeals({ items: [{ date: '2026-07-10', title: ' ' }] }).error, /titel/);
  assert.equal(proposePlanMeals({ items: [{ date: '2026-07-10', title: 'x'.repeat(120) }] }).ok, true);
  assert.match(proposePlanMeals({ items: [{ date: '2026-07-10', title: 'x'.repeat(121) }] }).error, /120/);
  assert.match(proposePlanMeals({ items: [{ date: 'vrijdag', title: 'x' }] }).error, /Ongeldige datum/);
  assert.match(proposePlanMeals({ items: [{ title: 'x' }] }).error, /Ongeldige datum/);
});

test('MEAL_TYPES: het contract met de DB-check-constraint (0016)', () => {
  assert.deepEqual(MEAL_TYPES, ['ontbijt', 'lunch', 'diner', 'snack']);
});

test('maaltijden_plannen.execute: insert met household/creator; servings alleen indien gezet', async () => {
  const calls = [];
  const out = await tool('maaltijden_plannen').execute(
    toolCtx({}, calls),
    { items: [
      { date: '2026-07-10', meal_type: 'diner', title: 'Lasagne', servings: 4 },
      { date: '2026-07-11', meal_type: 'lunch', title: 'Soep', servings: null },
    ] }
  );
  assert.equal(calls[0].table, 'meal_plan_entries');
  assert.deepEqual(calls[0].inserted[0], {
    household_id: 'h1', created_by: 'u1', plan_date: '2026-07-10', meal_type: 'diner', title: 'Lasagne', servings: 4,
  });
  // Zonder eters géén servings-key: de DB-default (2) blijft dan gelden.
  assert.equal('servings' in calls[0].inserted[1], false);
  assert.equal(out.summary, '2 maaltijden op het weekmenu gezet.');
  assert.deepEqual(out.inserted, [
    { table: 'meal_plan_entries', id: 'meal_plan_entries-1' },
    { table: 'meal_plan_entries', id: 'meal_plan_entries-2' },
  ]);
});

test('maaltijden_plannen.execute: één maaltijd → enkelvoud-summary; insert-fout gooit', async () => {
  const out = await tool('maaltijden_plannen').execute(
    toolCtx({}, []),
    { items: [{ date: '2026-07-10', meal_type: 'diner', title: 'X', servings: null }] }
  );
  assert.equal(out.summary, 'Op het weekmenu gezet.');
  await assert.rejects(
    () => tool('maaltijden_plannen').execute(
      toolCtx({}, [], { insertError: { message: 'boem' } }),
      { items: [{ date: '2026-07-10', meal_type: 'diner', title: 'X', servings: null }] }
    ),
    /boem/
  );
});
