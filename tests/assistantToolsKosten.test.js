// Unit-tests voor het Kosten-tool-pack (tools/kosten.js): euro-notatie,
// top-3-sortering en de maandgrens-compositie van de query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KOSTEN_TOOLS, KOSTEN_BRIEF, renderExpensesSummary } from '../supabase/functions/_shared/tools/kosten.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = KOSTEN_TOOLS.find((t) => t.name === 'kosten_maandoverzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

// De module-brief gaat 1-op-1 de systemprompt-snapshot in (AI-10) — exact vastpinnen.
test('module-brief: ligt exact vast', () => {
  assert.deepEqual(KOSTEN_BRIEF, { moduleKey: 'kosten', label: 'Kosten', brief: 'uitgaven van het huishouden; kan maandoverzichten en grootste kostenposten geven' });
});

// Descriptor-contract exact (zie assistantToolsTaken.test.js voor het waarom).
test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'kosten_maandoverzicht',
    moduleKey: 'kosten',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Uitgaven op een rijtje zetten…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er is uitgegeven, hoeveel iets kostte of waar het geld heen ging. Geeft een uitgaven-samenvatting van één maand (default: de maand van vandaag); geef month als "YYYY-MM" voor een andere maand.',
    parameters: {
      type: 'object',
      properties: { month: { type: 'string', description: 'Maand als YYYY-MM, bv. 2026-07' } },
      required: [],
      additionalProperties: false,
    },
  });
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

test('kosten_maandoverzicht: default-maand uit ctx.today, ongeldige month-arg genegeerd', async () => {
  // '2026-07-12' matcht wél een regex zonder $-anker — bewaakt het exacte YYYY-MM-formaat.
  for (const args of [{}, { month: 'onzin' }, { month: '2026-07-12' }]) {
    const calls = [];
    await tool.run(toolCtx({ expenses: [] }, calls), args);
    assert.deepEqual(calls[0].filters, [
      ['eq', 'household_id', 'h1'],
      ['gte', 'spent_on', '2026-07-01'],
      ['lt', 'spent_on', '2026-08-01'],
    ]);
  }
});

test('kosten_maandoverzicht: geldige month-arg wordt wél gebruikt', async () => {
  const calls = [];
  await tool.run(toolCtx({ expenses: [] }, calls), { month: '2026-03' });
  assert.equal(calls[0].table, 'expenses');
  assert.equal(calls[0].selected, 'description, amount_cents, spent_on');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['gte', 'spent_on', '2026-03-01'],
    ['lt', 'spent_on', '2026-04-01'],
  ]);
});
