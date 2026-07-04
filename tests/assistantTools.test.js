// Unit-tests voor supabase/functions/_shared/assistantTools.js.
// Focus per CLAUDE.md-mutantenpatronen: sorteervolgorde mét omgekeerde invoer,
// grenswaarde van lowPantryItems (<= drempel, houdbaarheid exact op de horizon),
// default-params, ontbrekende velden (?? fallbacks) en de maand-doorrol in nextMonth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSISTANT_TOOLS,
  renderOpenTasks,
  renderGroceryList,
  renderExpensesSummary,
  lowPantryItems,
  renderPantryLow,
  nextMonth,
  addDays,
} from '../supabase/functions/_shared/assistantTools.js';

test('registry: alle v1-tools zijn read-only en dragen een moduleKey + schema', () => {
  assert.deepEqual(ASSISTANT_TOOLS.map((t) => t.name), [
    'get_open_tasks', 'get_grocery_list', 'get_expenses_summary', 'get_pantry_low_stock',
  ]);
  // moduleKeys exact: de filtering op ingeschakelde modules hangt hieraan.
  assert.deepEqual(ASSISTANT_TOOLS.map((t) => t.moduleKey), ['taken', 'boodschappen', 'kosten', 'voorraad']);
  for (const t of ASSISTANT_TOOLS) {
    assert.equal(t.kind, 'read', `${t.name} moet read zijn in v1`);
    assert.equal(t.parameters.type, 'object');
    assert.deepEqual(t.parameters.required, [], `${t.name}: alle params optioneel in v1`);
    assert.ok(t.description.length > 20, `${t.name}: beschrijving stuurt het model`);
    assert.equal(typeof t.run, 'function');
  }
  // Parameter-schema's exact — dit is het contract richting het model.
  const byName = Object.fromEntries(ASSISTANT_TOOLS.map((t) => [t.name, t.parameters]));
  assert.deepEqual(Object.keys(byName.get_open_tasks.properties), ['only_mine']);
  assert.equal(byName.get_open_tasks.properties.only_mine.type, 'boolean');
  assert.deepEqual(Object.keys(byName.get_expenses_summary.properties), ['month']);
  assert.equal(byName.get_expenses_summary.properties.month.type, 'string');
  assert.deepEqual(byName.get_grocery_list.properties, {});
  assert.deepEqual(byName.get_pantry_low_stock.properties, {});
});

test('renderOpenTasks: sorteert op due_date, zonder datum achteraan — ook bij omgekeerde invoer', () => {
  const rows = [
    { title: 'Zonder datum', due_date: null, assigned_to: null },
    { title: 'Later', due_date: '2026-07-10', assigned_to: 'u2' },
    { title: 'Eerst', due_date: '2026-07-05', assigned_to: 'u1' },
  ];
  const names = { u1: 'Erik', u2: 'Sam' };
  const { data, render } = renderOpenTasks(rows, names);
  assert.deepEqual(data.tasks.map((t) => t.title), ['Eerst', 'Later', 'Zonder datum']);
  // Omgekeerde invoer → zelfde volgorde (anders overleeft de sorteer-vergelijker).
  const reversed = renderOpenTasks([...rows].reverse(), names);
  assert.deepEqual(reversed.data.tasks.map((t) => t.title), ['Eerst', 'Later', 'Zonder datum']);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Open taken (3)');
  assert.deepEqual(render[0].items[0], { text: 'Eerst · 2026-07-05 · Erik' });
  assert.deepEqual(render[0].items[2], { text: 'Zonder datum' });
  assert.equal(data.tasks[2].assignee, null);
});

test('renderOpenTasks: leeg → vriendelijke kaart; default-args', () => {
  const { data, render } = renderOpenTasks();
  assert.equal(data.count, 0);
  assert.deepEqual(render, [{ type: 'card', title: 'Open taken', lines: ['Niets open — lekker bezig!'] }]);
});

test('renderOpenTasks: onbekende assignee-id valt stil weg (geen "undefined" in de regel)', () => {
  const { render } = renderOpenTasks([{ title: 'X', due_date: '2026-07-05', assigned_to: 'onbekend' }], {});
  assert.deepEqual(render[0].items[0], { text: 'X · 2026-07-05' });
});

test('renderOpenTasks: twee taken zonder datum behouden hun invoervolgorde (stabiele sort)', () => {
  const rows = [
    { title: 'Eerste zonder', due_date: null, assigned_to: null },
    { title: 'Met datum', due_date: '2026-07-05', assigned_to: null },
    { title: 'Tweede zonder', due_date: null, assigned_to: null },
  ];
  const { data } = renderOpenTasks(rows, {});
  assert.deepEqual(data.tasks.map((t) => t.title), ['Met datum', 'Eerste zonder', 'Tweede zonder']);
});

test('renderGroceryList: quantity tussen haakjes, zonder quantity kaal; leeg → kaart', () => {
  const { data, render } = renderGroceryList([{ name: 'Melk', quantity: '2 pak' }, { name: 'Brood', quantity: null }]);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Boodschappenlijst (2)');
  assert.deepEqual(render[0].items, [{ text: 'Melk (2 pak)' }, { text: 'Brood' }]);
  assert.deepEqual(data.items[1], { name: 'Brood', quantity: null });
  assert.deepEqual(renderGroceryList().render, [{ type: 'card', title: 'Boodschappenlijst', lines: ['De lijst is leeg.'] }]);
});

test('renderExpensesSummary: totaal + top-3 (aflopend), euro-notatie met komma', () => {
  const rows = [
    { description: 'Klein', amount_cents: 150, spent_on: '2026-07-01' },
    { description: 'Groot', amount_cents: 12500, spent_on: '2026-07-02' },
    { description: 'Middel', amount_cents: 4000, spent_on: '2026-07-03' },
    { description: 'Vierde', amount_cents: 900, spent_on: '2026-07-04' },
  ];
  const { data, render } = renderExpensesSummary(rows, '2026-07');
  assert.equal(data.total_cents, 17550);
  assert.equal(render[0].type, 'keyvalue');
  const pairs = render[0].pairs;
  assert.deepEqual(pairs[0], { k: 'Totaal', v: '€ 175,50' });
  assert.deepEqual(pairs[1], { k: 'Aantal', v: '4' });
  assert.deepEqual(pairs.slice(2).map((p) => p.k), ['Groot', 'Middel', 'Vierde']);
  assert.equal(render[0].title, 'Uitgaven 2026-07');
});

test('renderExpensesSummary: ontbrekend amount_cents telt als 0; leeg/default → kaart zonder maand', () => {
  const { data } = renderExpensesSummary([{ description: 'x', spent_on: '2026-07-01' }], '2026-07');
  assert.equal(data.total_cents, 0);
  const empty = renderExpensesSummary();
  assert.deepEqual(empty.render, [{ type: 'card', title: 'Uitgaven', lines: ['Geen uitgaven gevonden.'] }]);
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

test('nextMonth: gewone maand +1, december rolt het jaar door, enkelcijferig gepad', () => {
  assert.equal(nextMonth('2026-07'), '2026-08-01');
  assert.equal(nextMonth('2026-09'), '2026-10-01');
  assert.equal(nextMonth('2026-12'), '2027-01-01');
  assert.equal(nextMonth('2026-01'), '2026-02-01');
});

test('addDays: telt via UTC, over maand- en jaargrens heen', () => {
  assert.equal(addDays('2026-07-04', 7), '2026-07-11');
  assert.equal(addDays('2026-07-28', 7), '2026-08-04');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2026-07-04', 0), '2026-07-04');
});

// run(ctx)-compositie: met een fake RLS-client bewijzen we dat de tools de juiste
// tabel/filters raken en hun render-helpers voeden. De fake honoreert de chain-API.
function fakeDb(rowsByTable, calls) {
  const chain = (table) => {
    const rec = { table, filters: [], selected: null };
    calls.push(rec);
    const api = {
      select(cols) { rec.selected = cols; return api; },
      eq(col, val) { rec.filters.push(['eq', col, val]); return api; },
      is(col, val) { rec.filters.push(['is', col, val]); return api; },
      gte(col, val) { rec.filters.push(['gte', col, val]); return api; },
      lt(col, val) { rec.filters.push(['lt', col, val]); return api; },
      order(col, opts) { rec.order = [col, opts]; return api; },
      limit() { return Promise.resolve({ data: rowsByTable[table] ?? [], error: null }); },
    };
    return api;
  };
  return { from: chain };
}

const CTX = (rowsByTable, calls) => ({
  db: fakeDb(rowsByTable, calls),
  householdId: 'h1',
  userId: 'u1',
  today: '2026-07-04',
  memberNames: { u1: 'Erik' },
});

test('get_open_tasks: filtert op huishouden + open, only_mine voegt assignee-filter toe', async () => {
  const calls = [];
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_open_tasks');
  const out = await tool.run(CTX({ tasks: [{ title: 'T', due_date: null, assigned_to: 'u1' }] }, calls), { only_mine: true });
  assert.equal(calls[0].table, 'tasks');
  assert.equal(calls[0].selected, 'title, due_date, assigned_to');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['is', 'completed_at', null],
    ['eq', 'assigned_to', 'u1'],
  ]);
  assert.deepEqual(calls[0].order, ['due_date', { ascending: true, nullsFirst: false }]);
  assert.equal(out.render[0].items[0].text, 'T · Erik');
});

test('get_open_tasks: zonder only_mine (of false) géén assignee-filter', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_open_tasks');
  for (const args of [undefined, {}, { only_mine: false }]) {
    const calls = [];
    await tool.run(CTX({ tasks: [] }, calls), args);
    assert.deepEqual(calls[0].filters, [
      ['eq', 'household_id', 'h1'],
      ['is', 'completed_at', null],
    ]);
  }
});

test('get_grocery_list: juiste tabel/kolommen/filters/sortering', async () => {
  const calls = [];
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_grocery_list');
  await tool.run(CTX({ groceries: [{ name: 'Melk', quantity: null }] }, calls));
  assert.equal(calls[0].table, 'groceries');
  assert.equal(calls[0].selected, 'name, quantity');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'checked', false],
  ]);
  assert.deepEqual(calls[0].order, ['created_at', { ascending: true }]);
});

test('get_expenses_summary: default-maand uit ctx.today, ongeldige month-arg genegeerd', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_expenses_summary');
  // '2026-07-12' matcht wél een regex zonder $-anker — bewaakt het exacte YYYY-MM-formaat.
  for (const args of [{}, { month: 'onzin' }, { month: '2026-07-12' }]) {
    const calls = [];
    await tool.run(CTX({ expenses: [] }, calls), args);
    assert.deepEqual(calls[0].filters, [
      ['eq', 'household_id', 'h1'],
      ['gte', 'spent_on', '2026-07-01'],
      ['lt', 'spent_on', '2026-08-01'],
    ]);
  }
});

test('get_pantry_low_stock: horizon = today+7 bepaalt de houdbaarheids-selectie', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_pantry_low_stock');
  const rows = [
    { name: 'Binnen week', quantity: 5, unit: 'stuk', low_threshold: null, best_before: '2026-07-11' },
    { name: 'Erna', quantity: 5, unit: 'stuk', low_threshold: null, best_before: '2026-07-12' },
  ];
  const out = await tool.run(CTX({ pantry_items: rows }, []));
  assert.deepEqual(out.data.items, ['Binnen week']);
});

test('run gooit bij een query-fout (de schil vertaalt naar {error})', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_grocery_list');
  const failingDb = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'boem' } }) }) }) }) }) }) };
  await assert.rejects(
    () => tool.run({ db: failingDb, householdId: 'h1', userId: 'u1', today: '2026-07-04' }),
    /boem/
  );
});

test('run: query-fout zónder message → fallback-melding "query mislukt"', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_grocery_list');
  const failingDb = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: {} }) }) }) }) }) }) };
  await assert.rejects(
    () => tool.run({ db: failingDb, householdId: 'h1', userId: 'u1', today: '2026-07-04' }),
    /query mislukt/
  );
});

test('get_expenses_summary: geldige month-arg wordt wél gebruikt', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_expenses_summary');
  const calls = [];
  await tool.run(CTX({ expenses: [] }, calls), { month: '2026-03' });
  assert.equal(calls[0].table, 'expenses');
  assert.equal(calls[0].selected, 'description, amount_cents, spent_on');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['gte', 'spent_on', '2026-03-01'],
    ['lt', 'spent_on', '2026-04-01'],
  ]);
});

test('get_pantry_low_stock: juiste tabel/kolommen', async () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'get_pantry_low_stock');
  const calls = [];
  await tool.run(CTX({ pantry_items: [] }, calls));
  assert.equal(calls[0].table, 'pantry_items');
  assert.equal(calls[0].selected, 'name, quantity, unit, low_threshold, best_before');
  assert.deepEqual(calls[0].filters, [['eq', 'household_id', 'h1']]);
});
