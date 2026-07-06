// Unit-tests voor het Kosten-tool-pack (tools/kosten.js): euro-notatie,
// top-3-sortering en de maandgrens-compositie van de query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KOSTEN_TOOLS, KOSTEN_BRIEF, KOSTEN_MANIFEST, renderExpensesSummary, weeklyExpensePoints } from '../supabase/functions/_shared/tools/kosten.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = KOSTEN_TOOLS.find((t) => t.name === 'kosten_maandoverzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

// De module-brief gaat 1-op-1 de systemprompt-snapshot in (AI-10) — exact vastpinnen.
test('module-brief: ligt exact vast', () => {
  assert.deepEqual(KOSTEN_BRIEF, { moduleKey: 'kosten', label: 'Kosten', brief: 'uitgaven van het huishouden; kan maandoverzichten en grootste kostenposten geven' });
});

// Manifest = de bron waaruit index.js ASSISTANT_TOOLS/MODULE_BRIEFS afleidt — pin de compositie.
test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(KOSTEN_MANIFEST, { moduleKey: 'kosten', label: 'Kosten', brief: KOSTEN_BRIEF.brief, tools: KOSTEN_TOOLS });
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

// --- Weekgrafiek (AI-16, plan 26): pure bucketing + de chart-node op de samenvatting.

test('weeklyExpensePoints: vaste 7-daagse buckets, lege weken blijven staan, laatste bucket tot maandeinde', () => {
  const rows = [
    { amount_cents: 100, spent_on: '2026-07-01' },   // bucket 1–7
    { amount_cents: 250, spent_on: '2026-07-07' },   // precies op de bucketgrens → 1–7
    { amount_cents: 400, spent_on: '2026-07-08' },   // precies erover → 8–14
    { amount_cents: 999, spent_on: '2026-07-31' },   // maandeinde → 29–31
    { amount_cents: 555, spent_on: '2026-06-30' },   // andere maand → telt niet mee
    { spent_on: '2026-07-02' },                       // ontbrekend bedrag telt als 0
  ];
  assert.deepEqual(weeklyExpensePoints(rows, '2026-07'), [
    { label: '1–7', value: 350 },
    { label: '8–14', value: 400 },
    { label: '15–21', value: 0 },
    { label: '22–28', value: 0 },
    { label: '29–31', value: 999 },
  ]);
});

test('weeklyExpensePoints: maandlengte bepaalt de buckets (feb = 4, geen loze vijfde)', () => {
  assert.deepEqual(weeklyExpensePoints([], '2026-02').map((p) => p.label), ['1–7', '8–14', '15–21', '22–28']);
  assert.deepEqual(weeklyExpensePoints([], '2026-09').map((p) => p.label), ['1–7', '8–14', '15–21', '22–28', '29–30']);
});

test('weeklyExpensePoints: ongeldige maand of default → [] (geen grafiek)', () => {
  assert.deepEqual(weeklyExpensePoints([{ amount_cents: 100, spent_on: '2026-07-01' }], 'juli 2026'), []);
  assert.deepEqual(weeklyExpensePoints([], '2026-13'), []);
  assert.deepEqual(weeklyExpensePoints(), []);
});

test('renderExpensesSummary: hangt de weekgrafiek (unit euro, centen) achter de keyvalue-kaart', () => {
  const { data, render } = renderExpensesSummary([{ description: 'Boodschappen', amount_cents: 12500, spent_on: '2026-07-02' }], '2026-07');
  // De data naar het model blijft byte-identiek aan vóór AI-16.
  assert.deepEqual(data, { count: 1, total_cents: 12500 });
  assert.deepEqual(render.map((n) => n.type), ['keyvalue', 'chart']);
  assert.equal(render[1].title, 'Per week');
  assert.equal(render[1].unit, 'euro');
  assert.deepEqual(render[1].points[0], { label: '1–7', value: 12500 });
  // Tekst-fallback voor oude clients: leesbaar, met euro-notatie.
  assert.match(render[1].text, /^Per week: 1–7: € 125,00/);
});

test('renderExpensesSummary: zonder geldig maand-label wél de samenvatting, geen grafiek', () => {
  const { render } = renderExpensesSummary([{ description: 'x', amount_cents: 100, spent_on: '2026-07-01' }], '');
  assert.deepEqual(render.map((n) => n.type), ['keyvalue']);
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
