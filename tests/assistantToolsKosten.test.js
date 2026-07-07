// Unit-tests voor het Kosten-tool-pack (tools/kosten.js): euro-notatie,
// top-3-sortering en de maandgrens-compositie van de query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KOSTEN_TOOLS, KOSTEN_BRIEF, KOSTEN_MANIFEST, renderExpensesSummary, weeklyExpensePoints, trendMonths, monthlyTrendPoints } from '../supabase/functions/_shared/tools/kosten.js';
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
  assert.deepEqual(weeklyExpensePoints([], '2026-00'), []);        // maand 0 bestaat niet
  assert.deepEqual(weeklyExpensePoints([], 'x2026-07'), []);        // ^-anker: geen prefix-rommel
  assert.deepEqual(weeklyExpensePoints([], '2026-070'), []);        // $-anker: geen suffix-rommel
  assert.deepEqual(weeklyExpensePoints(), []);
});

test('weeklyExpensePoints: maandgrenzen exact — januari en december zijn gewone maanden', () => {
  assert.equal(weeklyExpensePoints([{ amount_cents: 100, spent_on: '2026-01-15' }], '2026-01')[2].value, 100);
  assert.equal(weeklyExpensePoints([{ amount_cents: 100, spent_on: '2026-12-31' }], '2026-12')[4].value, 100);
});

test('weeklyExpensePoints: kapotte dagen en rommel-rijen vervallen zonder crash', () => {
  const points = weeklyExpensePoints([
    null,                                            // rommel-rij
    { amount_cents: 100, spent_on: '2026-07-ab' },   // geen dag-getal
    { amount_cents: 100, spent_on: '2026-07-00' },   // dag 0 bestaat niet
    { amount_cents: 100, spent_on: '2026-02-30' },   // voorbij het maandeinde… van een andere maand
    { amount_cents: 100, spent_on: '2026-07-32' },   // voorbij het maandeinde
    { amount_cents: 700, spent_on: '2026-07-15' },   // de enige geldige
  ], '2026-07');
  assert.deepEqual(points.map((p) => p.value), [0, 0, 700, 0, 0]);
  // Voorbij het maandeinde binnen de eigen maand: 30 feb telt ook in februari niet mee.
  assert.deepEqual(weeklyExpensePoints([{ amount_cents: 100, spent_on: '2026-02-30' }], '2026-02').map((p) => p.value), [0, 0, 0, 0]);
});

test('renderExpensesSummary: hangt de weekgrafiek (unit euro, centen) achter de keyvalue-kaart', () => {
  const { data, render } = renderExpensesSummary([
    { description: 'Boodschappen', amount_cents: 12500, spent_on: '2026-07-02' },
    { description: 'Tuin', amount_cents: 800, spent_on: '2026-07-10' },
    { description: 'Zonder bedrag', spent_on: '2026-07-11' },
  ], '2026-07');
  // De data naar het model blijft byte-identiek aan vóór AI-16.
  assert.deepEqual(data, { count: 3, total_cents: 13300 });
  assert.deepEqual(render.map((n) => n.type), ['keyvalue', 'chart']);
  // Ontbrekend bedrag rendert als € 0,00 in de top-3 (nooit NaN de kaart in).
  assert.deepEqual(render[0].pairs[4], { k: 'Zonder bedrag', v: '€ 0,00' });
  assert.equal(render[1].title, 'Per week');
  assert.equal(render[1].unit, 'euro');
  assert.deepEqual(render[1].points.slice(0, 2), [{ label: '1–7', value: 12500 }, { label: '8–14', value: 800 }]);
  // Tekst-fallback voor oude clients: leesbaar, met euro-notatie en ·-scheiding.
  assert.equal(
    render[1].text,
    'Per week: 1–7: € 125,00 · 8–14: € 8,00 · 15–21: € 0,00 · 22–28: € 0,00 · 29–31: € 0,00'
  );
});

test('renderExpensesSummary: zonder geldig maand-label wél de samenvatting, geen grafiek', () => {
  const { render } = renderExpensesSummary([{ description: 'x', amount_cents: 100, spent_on: '2026-07-01' }], '');
  assert.deepEqual(render.map((n) => n.type), ['keyvalue']);
});

test('kosten_maandoverzicht: default-maand uit ctx.today, ongeldige month-arg genegeerd', async () => {
  // '2026-07-12' matcht wél een regex zonder $-anker en 'x2026-06' wél één
  // zonder ^-anker — samen bewaken ze het exacte YYYY-MM-formaat.
  for (const args of [{}, { month: 'onzin' }, { month: '2026-07-12' }, { month: 'x2026-06' }]) {
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

// --- Maandtrend (AI-16 ronde 3): pure maand-lijst + -totalen en de lijn-node.

test('trendMonths: 6 maanden t/m de maand, oudste eerst, over de jaargrens heen', () => {
  assert.deepEqual(trendMonths('2026-07'), ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
  assert.deepEqual(trendMonths('2026-02'), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(trendMonths('2026-07', 2), ['2026-06', '2026-07']);
  assert.deepEqual(trendMonths('juli'), []);
  assert.deepEqual(trendMonths('2026-13'), []);
  assert.deepEqual(trendMonths(), []);
});

test('monthlyTrendPoints: som per maand (NL-label), buiten het venster telt niet, lege maand blijft 0', () => {
  const months = trendMonths('2026-07', 3);           // mei, jun, jul
  const points = monthlyTrendPoints([
    { amount_cents: 100, spent_on: '2026-05-10' },
    { amount_cents: 250, spent_on: '2026-05-20' },
    { amount_cents: 999, spent_on: '2026-07-01' },
    { amount_cents: 555, spent_on: '2026-04-30' },    // vóór het venster → weg
    { spent_on: '2026-07-02' },                        // ontbrekend bedrag telt als 0
    { amount_cents: 100 },                             // geen datum → weg
    null,                                              // rommel-rij → geen crash
  ], months);
  assert.deepEqual(points, [
    { label: 'mei', value: 350 },
    { label: 'jun', value: 0 },
    { label: 'jul', value: 999 },
  ]);
  assert.deepEqual(monthlyTrendPoints(), []);
});

test('kosten_maandoverzicht: aparte trend-query (6 maanden) + lijn-node bij ≥2 maanden met uitgaven', async () => {
  const calls = [];
  const expenses = [
    { description: 'Juni', amount_cents: 500, spent_on: '2026-06-10' },
    { description: 'Juli', amount_cents: 800, spent_on: '2026-07-02' },
  ];
  const { render } = await tool.run(toolCtx({ expenses }, calls), {});
  const queries = calls.filter((c) => c.table === 'expenses');
  assert.equal(queries.length, 2);
  assert.equal(queries[1].selected, 'amount_cents, spent_on');
  assert.deepEqual(queries[1].filters, [
    ['eq', 'household_id', 'h1'],
    ['gte', 'spent_on', '2026-02-01'],
    ['lt', 'spent_on', '2026-08-01'],
  ]);
  const trend = render[render.length - 1];
  assert.equal(trend.type, 'chart');
  assert.equal(trend.variant, 'line');
  assert.equal(trend.title, 'Trend per maand');
  assert.equal(trend.unit, 'euro');
  assert.deepEqual(trend.points.map((p) => p.label), ['feb', 'mrt', 'apr', 'mei', 'jun', 'jul']);
  assert.deepEqual(trend.points.slice(4), [{ label: 'jun', value: 500 }, { label: 'jul', value: 800 }]);
});

test('kosten_maandoverzicht: één maand met uitgaven → géén trend-node (er is geen trend)', async () => {
  const expenses = [{ description: 'Juli', amount_cents: 800, spent_on: '2026-07-02' }];
  const { render } = await tool.run(toolCtx({ expenses }, []), {});
  assert.equal(render.some((n) => n.variant === 'line'), false);
});

test('monthlyTrendPoints: alle 12 maandnamen komen uit de juiste tabel (zelfde patroon als dayLabel)', () => {
  const labels = monthlyTrendPoints([], trendMonths('2026-12', 12)).map((p) => p.label);
  assert.deepEqual(labels, ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']);
});

test('trendMonths: maandgrenzen exact (01 en 12 zijn geldig) en de ankers van het formaat', () => {
  assert.equal(trendMonths('2026-01')[5], '2026-01');    // precies op de ondergrens
  assert.equal(trendMonths('2026-12')[5], '2026-12');    // precies op de bovengrens
  assert.deepEqual(trendMonths('2026-00'), []);          // maand 0 bestaat niet
  assert.deepEqual(trendMonths('x2026-07'), []);         // ^-anker: geen prefix-rommel
  assert.deepEqual(trendMonths('2026-070'), []);         // $-anker: geen suffix-rommel
});
