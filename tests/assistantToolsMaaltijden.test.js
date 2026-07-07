// Unit-tests voor het Keuken-tool-pack (tools/maaltijden.js): weekmenu-render
// (recept-fallbacks, diner-verkorting), de datumvenster-query en de
// propose/execute-keten van maaltijden_plannen (AI-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAALTIJDEN_TOOLS,
  MAALTIJDEN_BRIEF,
  MAALTIJDEN_MANIFEST,
  renderWeekMenu,
  renderRecipe,
  renderRecipeMatches,
  splitSteps,
  proposePlanMeals,
  proposeSaveRecipes,
  MAX_PROPOSED_MEALS,
  MAX_PROPOSED_RECIPES,
  MAX_RECIPE_INGREDIENTS,
  MEAL_TYPES,
} from '../supabase/functions/_shared/tools/maaltijden.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = (name) => MAALTIJDEN_TOOLS.find((t) => t.name === name);
const shape = ({ run, propose, execute, ...rest }) => rest;

// De module-brief gaat 1-op-1 de systemprompt-snapshot in (AI-10) — exact vastpinnen.
test('module-brief: ligt exact vast', () => {
  assert.deepEqual(MAALTIJDEN_BRIEF, { moduleKey: 'maaltijden', label: 'Keuken', brief: 'weekmenu en receptenboek; kan menu en recepten tonen, recepten voorstellen en maaltijden inplannen' });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(MAALTIJDEN_MANIFEST, { moduleKey: 'maaltijden', label: 'Keuken', brief: MAALTIJDEN_BRIEF.brief, tools: MAALTIJDEN_TOOLS });
});

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm van de vier tools ligt exact vast', () => {
  assert.deepEqual(shape(tool('maaltijden_weekmenu')), {
    name: 'maaltijden_weekmenu',
    moduleKey: 'maaltijden',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Weekmenu erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er gegeten wordt, wat er op het menu staat of wat er gepland is om te koken. Haalt het weekmenu op (vandaag + de komende dagen), inclusief gekoppelde recepten.',
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
    risk: 'write',
    destructive: false,
    idempotent: false,
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een maaltijd op het menu wil zetten (bv. "vrijdag lasagne") — een losse titel volstaat. Hoort er een recept bij (de gebruiker wil koken of de boodschappen erbij)? Geef dan het recipe_id uit maaltijden_recept_zoeken mee; voor kaal inplannen is dat niet nodig. Stelt één of meer maaltijden voor: de gebruiker ziet een bevestigingskaart en kan per maaltijd aan- of uitvinken, er wordt nooit direct iets opgeslagen.',
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
              recipe_id: { type: 'string', description: 'Optioneel: het id van het recept uit maaltijden_recept_zoeken — koppelt de maaltijd aan het receptenboek' },
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
  assert.deepEqual(shape(tool('maaltijden_recept_zoeken')), {
    name: 'maaltijden_recept_zoeken',
    moduleKey: 'maaltijden',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Receptenboek doorbladeren…',
    description: 'Roep dit aan wanneer de gebruiker een gerecht wil kóken, of het recept of de boodschappen ervoor wil: kijk eerst of het al in het receptenboek van het huishouden staat vóórdat je zelf een recept voorstelt. Geeft treffers als recept-kaart, met het recipe_id dat maaltijden_plannen nodig heeft om de maaltijd aan het recept te koppelen. Niet nodig als de gebruiker alleen een titel op het menu wil.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Zoekterm op gerechtnaam, bv. "lasagne" (weglaten = de nieuwste recepten)' } },
      required: [],
      additionalProperties: false,
    },
  });
  assert.deepEqual(shape(tool('maaltijden_recept_opslaan')), {
    name: 'maaltijden_recept_opslaan',
    moduleKey: 'maaltijden',
    kind: 'write',
    risk: 'write',
    destructive: false,
    idempotent: false,
    statusLabel: 'Recept uitschrijven…',
    description: 'Roep dit aan om een recept in het receptenboek te zetten — óf wanneer de gebruiker zelf een recept aanlevert om te bewaren ("sla dit recept op: …"), óf wanneer een gevraagd gerecht nog niet bestaat (controleer dat eerst met maaltijden_recept_zoeken) en jij zelf een volledig recept voorstelt met ingrediënten, porties en bereiding. De gebruiker ziet de recept-kaart en beslist; er wordt nooit direct iets opgeslagen. Plan de maaltijd pas in nadat het recept is goedgekeurd.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De op te slaan recepten (meestal één, maximaal 3).',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Naam van het gerecht, bv. "Pasta pesto"' },
              servings: { type: 'integer', description: 'Aantal porties (1-20, default 2)' },
              ingredients: {
                type: 'array',
                description: 'De ingrediënten (1-30).',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Ingrediëntnaam, bv. "Penne"' },
                    quantity: { type: 'number', description: 'Hoeveelheid (default 1)' },
                    unit: { type: 'string', description: 'Eenheid, bv. "gram", "el", "stuk" (default "stuk")' },
                  },
                  required: ['name'],
                  additionalProperties: false,
                },
              },
              instructions: { type: 'string', description: 'De bereiding, één stap per regel' },
            },
            required: ['title', 'ingredients'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  });
});

test('renderWeekMenu: schedule met álle vensterdagen, today-markering, diner onbenoemd, titel-fallbacks', () => {
  const rows = [
    { plan_date: '2026-07-06', meal_type: 'diner', title: 'Lasagne', servings: 4 },
    { plan_date: '2026-07-07', meal_type: 'lunch', title: null, recipes: { title: 'Soep' }, servings: null },
    { plan_date: '2026-07-08', meal_type: null, title: null, recipes: null },
  ];
  const { data, render } = renderWeekMenu(rows, 4, '2026-07-06');
  assert.equal(render[0].type, 'schedule');
  assert.equal(render[0].title, 'Weekmenu (komende 4 dagen)');
  // Vier vensterdagen — óók de lege 9 jul (een gat in het menu is informatie).
  assert.deepEqual(render[0].days, [
    { label: 'ma 6 jul', today: true, entries: [{ text: 'Lasagne (4p)' }] },
    { label: 'di 7 jul', today: false, entries: [{ text: 'Soep · lunch' }] },
    { label: 'wo 8 jul', today: false, entries: [{ text: 'Maaltijd' }] },
    { label: 'do 9 jul', today: false, entries: [] },
  ]);
  // Tekst-fallback voor oude clients: leesbare regel per maaltijd.
  assert.equal(render[0].text, 'ma 6 jul — Lasagne (4p)\ndi 7 jul — Soep · lunch\nwo 8 jul — Maaltijd');
  // De data naar het model is byte-identiek aan vóór AI-16.
  assert.deepEqual(data.entries[1], { date: '2026-07-07', meal_type: 'lunch', title: 'Soep', servings: null });
});

test('renderWeekMenu: zonder geldige startdatum alleen de dagen mét entries (pure fallback)', () => {
  const rows = [
    { plan_date: '2026-07-06', meal_type: 'diner', title: 'Lasagne', servings: null },
    { plan_date: '2026-07-08', meal_type: 'diner', title: 'Wraps', servings: null },
  ];
  const { render } = renderWeekMenu(rows, 7);
  assert.deepEqual(render[0].days.map((d) => d.label), ['ma 6 jul', 'wo 8 jul']);
  assert.deepEqual(render[0].days.map((d) => d.today), [false, false]);
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

// --- Recept-koppeling in maaltijden_plannen (AI-12): recipe_id-pad.

const UUID = '11111111-1111-1111-1111-111111111111';

test('proposePlanMeals: geldig recipe_id reist mee; ontbrekend recipe_id blijft weg (schone shape)', () => {
  const out = proposePlanMeals({ items: [
    { date: '2026-07-10', title: 'Pesto', recipe_id: UUID },
    { date: '2026-07-11', title: 'Vrij' },
  ] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.args.items[0], { date: '2026-07-10', meal_type: 'diner', title: 'Pesto', servings: null, recipe_id: UUID });
  // Geen recipe_id → de sleutel bestaat niet (geen recipe_id:null-vervuiling).
  assert.equal('recipe_id' in out.args.items[1], false);
});

test('proposePlanMeals: verzonnen/verminkt recipe_id → duidelijke fout (zoek eerst op)', () => {
  assert.match(proposePlanMeals({ items: [{ date: '2026-07-10', title: 'X', recipe_id: 'niet-een-uuid' }] }).error, /recept-id/);
  assert.match(proposePlanMeals({ items: [{ date: '2026-07-10', title: 'X', recipe_id: 42 }] }).error, /recept-id/);
});

test('maaltijden_plannen.execute: recipe_id gaat mee de insert in, alleen indien gezet', async () => {
  const calls = [];
  await tool('maaltijden_plannen').execute(toolCtx({}, calls), { items: [
    { date: '2026-07-10', meal_type: 'diner', title: 'Pesto', servings: null, recipe_id: UUID },
    { date: '2026-07-11', meal_type: 'diner', title: 'Vrij', servings: null },
  ] });
  assert.equal(calls[0].inserted[0].recipe_id, UUID);
  assert.equal('recipe_id' in calls[0].inserted[1], false);
});

// --- splitSteps: bereiding → losse stappen (mutantpatroon: grens/nummerprefix).

test('splitSteps: splitst op nieuwe regels, strippt nummerprefix, negeert lege regels en niet-strings', () => {
  assert.deepEqual(splitSteps('1. Kook pasta\n2) Roer pesto\n\n  3.  Meng '), ['Kook pasta', 'Roer pesto', 'Meng']);
  assert.deepEqual(splitSteps('Eén stap zonder nummer'), ['Eén stap zonder nummer']);
  assert.deepEqual(splitSteps(''), []);
  assert.deepEqual(splitSteps(null), []);
  assert.deepEqual(splitSteps(undefined), []);
});

// --- renderRecipe: recept → recept-kaart (contract met de client-poortwachter).

test('renderRecipe: ingrediëntregels met/zonder hoeveelheid, servings-fallback, stappen', () => {
  const out = renderRecipe({
    title: 'Pasta pesto', servings: 4, instructions: '1. Kook\n2. Meng',
    ingredients: [
      { name: 'Penne', quantity: 400, unit: 'gram' },
      { name: 'Basilicum' },                          // geen hoeveelheid → kale naam
      { name: 'Zout', quantity: 0 },                  // 0 telt niet als hoeveelheid
      { name: '   ' },                                // lege naam vervalt
    ],
  });
  assert.equal(out.type, 'recipe');
  assert.equal(out.title, 'Pasta pesto');
  assert.equal(out.servings, 4);
  // Mét hoeveelheid reizen de gestructureerde velden mee (AI-16: die voeden de
  // porties-stepper op de client); zonder hoeveelheid blijft het een tekstregel.
  assert.deepEqual(out.ingredients, [
    { text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' },
    { text: 'Basilicum' },
    { text: 'Zout' },
  ]);
  assert.deepEqual(out.steps, ['Kook', 'Meng']);
});

test('renderRecipe: ongeldige servings → null; default-arg geeft lege, veilige kaart', () => {
  assert.equal(renderRecipe({ title: 'X', servings: 0 }).servings, null);
  assert.equal(renderRecipe({ title: 'X', servings: 2.5 }).servings, null);
  assert.deepEqual(renderRecipe(), { type: 'recipe', title: undefined, servings: null, ingredients: [], steps: [] });
});

// --- renderRecipeMatches: zoekresultaat → data (met ids) + recept-kaarten.

test('renderRecipeMatches: filtert case-insensitief op titel, top 3, data draagt de recipe-ids', () => {
  const rows = [
    { id: 'r1', title: 'Pasta Pesto', servings: 4, instructions: 'Kook', recipe_ingredients: [{ name: 'Penne', quantity: 400, unit: 'gram' }] },
    { id: 'r2', title: 'Lasagne', servings: 6 },
    { id: 'r3', title: 'Pesto-toast', servings: 2 },
  ];
  const out = renderRecipeMatches(rows, 'PESTO');
  assert.deepEqual(out.data, { count: 2, matches: [{ id: 'r1', title: 'Pasta Pesto', servings: 4 }, { id: 'r3', title: 'Pesto-toast', servings: 2 }] });
  // ≥2 treffers → recept-kaarten + de beslis-kaart (AI-16): een tik stuurt de
  // keuze als gewone gebruikersbeurt terug het gesprek in.
  assert.equal(out.render.length, 3);
  assert.equal(out.render[0].type, 'recipe');
  assert.deepEqual(out.render[0].ingredients, [{ text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' }]);
  assert.deepEqual(out.render[2], {
    type: 'choice',
    prompt: 'Welk recept bedoel je?',
    options: [
      { label: 'Pasta Pesto', description: 'voor 4 personen', reply: 'Gebruik het recept "Pasta Pesto"' },
      { label: 'Pesto-toast', description: 'voor 2 personen', reply: 'Gebruik het recept "Pesto-toast"' },
    ],
    text: 'Welk recept bedoel je? Pasta Pesto / Pesto-toast',
  });
});

test('renderRecipeMatches: één treffer → géén beslis-kaart (niets te kiezen)', () => {
  const out = renderRecipeMatches([{ id: 'r1', title: 'Lasagne', servings: 6 }], 'lasagne');
  assert.deepEqual(out.render.map((n) => n.type), ['recipe']);
});

test('renderRecipeMatches: geen query → nieuwste paar; geen treffer → geruststellende kaart', () => {
  const rows = [{ id: 'r1', title: 'Soep' }, { id: 'r2', title: 'Stamppot' }];
  assert.equal(renderRecipeMatches(rows).data.count, 2);
  const leeg = renderRecipeMatches(rows, 'sushi');
  assert.deepEqual(leeg.data, { count: 0, matches: [] });
  assert.deepEqual(leeg.render, [{ type: 'card', title: 'Recepten', lines: ['Geen recept gevonden voor "sushi".'] }]);
  assert.deepEqual(renderRecipeMatches([]).render, [{ type: 'card', title: 'Recepten', lines: ['Er staan nog geen recepten in het boek.'] }]);
});

test('renderRecipeMatches: kapt af op de top 3, maar telt álle treffers in data.count', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, title: `Soep ${i}` }));
  const out = renderRecipeMatches(rows, 'soep');
  assert.equal(out.data.count, 5);           // alle treffers geteld
  assert.equal(out.data.matches.length, 3);  // maar hooguit 3 kaarten/ids terug
  assert.deepEqual(out.render.map((n) => n.type), ['recipe', 'recipe', 'recipe', 'choice']);
  assert.equal(out.render[3].options.length, 3);
});

test('maaltijden_recept_zoeken: juiste tabel/kolommen + JS-filter op titel', async () => {
  const calls = [];
  const out = await tool('maaltijden_recept_zoeken').run(
    toolCtx({ recipes: [{ id: 'r1', title: 'Lasagne', servings: 6 }, { id: 'r2', title: 'Soep' }] }, calls),
    { query: 'lasagne' }
  );
  assert.equal(calls[0].table, 'recipes');
  assert.equal(calls[0].selected, 'id, title, servings, instructions, recipe_ingredients(name, quantity, unit)');
  assert.deepEqual(calls[0].filters, [['eq', 'household_id', 'h1']]);
  assert.deepEqual(out.data.matches, [{ id: 'r1', title: 'Lasagne', servings: 6 }]);
});

// --- proposeSaveRecipes (AI-12): puur, met preview-kaart en items↔args-uitlijning.

test('proposeSaveRecipes: normaliseert ingrediënten/porties, bouwt preview-kaart, lijnt items uit', () => {
  const out = proposeSaveRecipes({ items: [{
    title: '  Pasta pesto  ', servings: 4, instructions: '1. Kook\n2. Meng',
    ingredients: [{ name: 'Penne', quantity: 400, unit: 'gram' }, { name: 'Pesto' }],
  }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, 'Recept "Pasta pesto" opslaan');
  assert.deepEqual(out.items, ['Pasta pesto · 2 ingrediënten · 4p']);
  assert.deepEqual(out.args.items, [{
    title: 'Pasta pesto', servings: 4, instructions: '1. Kook\n2. Meng',
    ingredients: [{ name: 'Penne', quantity: 400, unit: 'gram' }, { name: 'Pesto', quantity: 1, unit: 'stuk' }],
  }]);
  // De preview is de rijke recept-kaart die náást de bevestigingskaart wordt getoond.
  assert.equal(out.preview.length, 1);
  assert.equal(out.preview[0].type, 'recipe');
  assert.equal(out.items.length, out.args.items.length);
});

test('proposeSaveRecipes: servings-fallback 2 en grenzen 1/20 inclusief', () => {
  const s = (servings) => proposeSaveRecipes({ items: [{ title: 'X', servings, ingredients: [{ name: 'a' }] }] }).args.items[0].servings;
  assert.equal(s(undefined), 2);
  assert.equal(s(0), 2);
  assert.equal(s(21), 2);
  assert.equal(s(1), 1);
  assert.equal(s(20), 20);
});

test('proposeSaveRecipes: leeg/te veel/titel-loos/ingrediënt-loos/te lang → duidelijke fout', () => {
  assert.equal(proposeSaveRecipes().ok, false);
  assert.equal(proposeSaveRecipes({ items: [] }).ok, false);
  assert.match(proposeSaveRecipes({ items: Array.from({ length: MAX_PROPOSED_RECIPES + 1 }, () => ({ title: 'x', ingredients: [{ name: 'a' }] })) }).error, /Maximaal 3/);
  assert.match(proposeSaveRecipes({ items: [{ title: ' ', ingredients: [{ name: 'a' }] }] }).error, /titel/);
  assert.match(proposeSaveRecipes({ items: [{ title: 'x'.repeat(121), ingredients: [{ name: 'a' }] }] }).error, /120/);
  assert.match(proposeSaveRecipes({ items: [{ title: 'X', ingredients: [] }] }).error, /minstens één ingrediënt/);
  assert.match(proposeSaveRecipes({ items: [{ title: 'X', ingredients: [{ name: ' ' }] }] }).error, /naam/);
  const veelIng = Array.from({ length: MAX_RECIPE_INGREDIENTS + 1 }, () => ({ name: 'a' }));
  assert.match(proposeSaveRecipes({ items: [{ title: 'X', ingredients: veelIng }] }).error, /maximaal 30/i);
});

test('maaltijden_recept_opslaan.execute: één atomaire RPC met de genormaliseerde recepten; undo raakt alleen recipes', async () => {
  const calls = [];
  const items = [{
    title: 'Pesto', servings: 4, instructions: 'Kook',
    ingredients: [{ name: 'Penne', quantity: 400, unit: 'gram' }, { name: 'Pesto', quantity: 1, unit: 'stuk' }],
  }];
  const out = await tool('maaltijden_recept_opslaan').execute(toolCtx({}, calls), { items });
  // Eén transactie i.p.v. losse recipes-/recipe_ingredients-inserts (migr. 0073):
  // een partiële fout kan zo geen niet-undobare weesrecepten achterlaten.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rpc, 'save_recipes');
  assert.equal(calls[0].args.p_household_id, 'h1');
  assert.deepEqual(calls[0].args.p_items, items);
  // De RPC geeft de recipe-ids terug → undo-spoor (alleen recipes; ingrediënten cascaden).
  assert.deepEqual(out.inserted, [{ table: 'recipes', id: 'recipe-1' }]);
  assert.equal(out.summary, 'Recept opgeslagen in het receptenboek.');
});

test('maaltijden_recept_opslaan.execute: meerdere recepten → meervoud; een RPC-fout gooit (atomair)', async () => {
  const out = await tool('maaltijden_recept_opslaan').execute(toolCtx({}, []), { items: [
    { title: 'A', servings: 2, instructions: null, ingredients: [{ name: 'x', quantity: 1, unit: 'stuk' }] },
    { title: 'B', servings: 2, instructions: null, ingredients: [{ name: 'y', quantity: 1, unit: 'stuk' }] },
  ] });
  assert.equal(out.summary, '2 recepten opgeslagen in het receptenboek.');
  assert.deepEqual(out.inserted, [{ table: 'recipes', id: 'recipe-1' }, { table: 'recipes', id: 'recipe-2' }]);
  // Faalt de transactie, dan gooit execute — de agent-schil maakt er een nette
  // tool-fout van; er blijven geen half-ingevoegde recepten achter (RPC = 1 tx).
  await assert.rejects(
    () => tool('maaltijden_recept_opslaan').execute(
      toolCtx({}, [], { rpcError: { message: 'boem' } }),
      { items: [{ title: 'A', servings: 2, instructions: null, ingredients: [{ name: 'x', quantity: 1, unit: 'stuk' }] }] }
    ),
    /boem/
  );
});
