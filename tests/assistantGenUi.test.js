// Unit-tests voor lib/assistantGenUi.js — de pure interactie-logica van de
// gen-UI-componenten (AI-16, plan 26). Mutatie-gaten die we expliciet
// dichtdrukken (CLAUDE.md): grenswaarden (precies op de nice-stap, precies op
// de porties-grens), default-params, null/ontbrekend veld → fallback, en het
// rekenteken/de deling in de schaal-formule (invoer waar operanden verschillen).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  niceMax, chartLayout, lineLayout, formatChartValue, formatQuantity, progressFraction,
  MIN_SERVINGS, MAX_SERVINGS, clampServings, scaleIngredients,
} from '../lib/assistantGenUi.js';

test('niceMax: rondt op naar 1/2/2.5/5×10^k, precies-op-de-stap blijft de stap', () => {
  assert.equal(niceMax(1), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(10), 10);      // precies op de stap → niet dóórronden naar 20
  assert.equal(niceMax(11), 20);
  assert.equal(niceMax(21), 25);      // de 2.5-stap
  assert.equal(niceMax(26), 50);
  assert.equal(niceMax(51), 100);
  assert.equal(niceMax(12300), 20000);
  assert.equal(niceMax(0.7), 1);      // k kan negatief zijn (fracties)
});

test('niceMax: nul/negatief/rommel → 1 (nooit delen door nul)', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(-5), 1);
  assert.equal(niceMax(Number.NaN), 1);
  assert.equal(niceMax(Number.POSITIVE_INFINITY), 1);
});

test('chartLayout: fracties t.o.v. de nice-top + ticks [helft, top]', () => {
  const layout = chartLayout([
    { label: 'wk1', value: 100 },
    { label: 'wk2', value: 200 },
    { label: 'wk3', value: 0 },
  ]);
  assert.equal(layout.max, 200);                       // 200 is al nice
  assert.deepEqual(layout.ticks, [100, 200]);
  assert.deepEqual(layout.bars.map((b) => b.frac), [0.5, 1, 0]);
  assert.deepEqual(layout.bars.map((b) => b.label), ['wk1', 'wk2', 'wk3']);
});

test('chartLayout: negatieve/kapotte waarden klemmen op 0; leeg of zonder argument → null', () => {
  const layout = chartLayout([{ label: 'a', value: -10 }, { label: 'b', value: 40 }]);
  assert.deepEqual(layout.bars.map((b) => b.value), [0, 40]);
  assert.equal(chartLayout([]), null);
  assert.equal(chartLayout(), null);
  assert.equal(chartLayout('rommel'), null);   // niet-array → null, geen verzonnen staaf
  // Alleen nullen: de as valt terug op 1 zodat de fracties 0 blijven (geen NaN).
  const zeros = chartLayout([{ label: 'a', value: 0 }]);
  assert.equal(zeros.max, 1);
  assert.deepEqual(zeros.bars.map((b) => b.frac), [0]);
});

test('chartLayout: kapotte velden degraderen per veld (label → \'\', niet-getal → 0)', () => {
  const layout = chartLayout([null, { value: 5 }, { label: 'ok', value: '5' }]);
  assert.deepEqual(layout.bars.map((b) => b.label), ['', '', 'ok']);
  // Ontbrekend label laat de waarde intact; een string-waarde is type-strikt geen getal.
  assert.deepEqual(layout.bars.map((b) => b.value), [0, 5, 0]);
});

test('formatChartValue: euro = centen → hele euro\'s met duizendtallen-punt', () => {
  assert.equal(formatChartValue(12300, 'euro'), '€ 123');
  assert.equal(formatChartValue(125000, 'euro'), '€ 1.250');
  assert.equal(formatChartValue(123456789, 'euro'), '€ 1.234.568');
  assert.equal(formatChartValue(49, 'euro'), '€ 0');       // afronden, niet floored
  assert.equal(formatChartValue(50, 'euro'), '€ 1');
});

test('formatChartValue: zonder unit het afgeronde getal; rommel → "0"', () => {
  assert.equal(formatChartValue(7.6), '8');
  assert.equal(formatChartValue(7.6, null), '8');
  assert.equal(formatChartValue(Number.NaN), '0');
  assert.equal(formatChartValue(Number.NaN, 'euro'), '€ 0');
});

test('formatQuantity: max 2 decimalen, NL-komma, geen zwevende restjes of loze nullen', () => {
  assert.equal(formatQuantity(2), '2');
  assert.equal(formatQuantity(2.5), '2,5');
  assert.equal(formatQuantity(0.1 + 0.2), '0,3');          // 0.30000000000000004
  assert.equal(formatQuantity(1.005 * 100), '100,5');
  assert.equal(formatQuantity(2.666666), '2,67');
  assert.equal(formatQuantity(Number.NaN), '');
});

test('clampServings: klemt op de proposeSaveRecipes-grenzen; rommel → minimum', () => {
  assert.equal(MIN_SERVINGS, 1);
  assert.equal(MAX_SERVINGS, 20);
  assert.equal(clampServings(4), 4);
  assert.equal(clampServings(0), 1);      // precies onder de grens
  assert.equal(clampServings(1), 1);      // precies op de grens
  assert.equal(clampServings(20), 20);
  assert.equal(clampServings(21), 20);
  assert.equal(clampServings(2.5), 1);
  assert.equal(clampServings(Number.NaN), 1);
});

test('scaleIngredients: herrekent alleen regels mét naam+hoeveelheid, tekst in serverformaat', () => {
  const input = [
    { text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' },
    { text: 'Zout naar smaak' },                              // ongestructureerd → ongemoeid
    { text: 'Ei · 2', name: 'Ei', quantity: 2, unit: null },  // zonder eenheid → geen hangende spatie
  ];
  const scaled = scaleIngredients(input, 4, 6);
  assert.deepEqual(scaled, [
    { text: 'Penne · 600 gram', name: 'Penne', quantity: 600, unit: 'gram' },
    { text: 'Zout naar smaak' },
    { text: 'Ei · 3', name: 'Ei', quantity: 3, unit: null },
  ]);
  // Terugschalen gebruikt de deling (niet ×): 4→2 halveert.
  assert.equal(scaleIngredients(input, 4, 2)[0].text, 'Penne · 200 gram');
  // Niet-ronde uitkomst → NL-komma via formatQuantity.
  assert.equal(scaleIngredients(input, 4, 3)[2].text, 'Ei · 1,5');
});

test('scaleIngredients: gelijke porties of onbruikbare invoer → dezelfde referentie (geen re-render)', () => {
  const input = [{ text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' }];
  assert.equal(scaleIngredients(input, 4, 4), input);
  assert.equal(scaleIngredients(input, null, 6), input);
  assert.equal(scaleIngredients(input, 0, 6), input);     // precies op de grens (0 porties bestaat niet)
  assert.equal(scaleIngredients(input, 2.5, 6), input);   // geen geheel getal
  assert.equal(scaleIngredients(input, 4, 0), input);
  assert.equal(scaleIngredients(input, 4, 2.5), input);
  assert.deepEqual(scaleIngredients(undefined, 4, 6), []);
});

test('scaleIngredients: incomplete of kapotte regels blijven exact ongemoeid (zelfde poort als de poortwachter)', () => {
  const input = [
    { text: 'Raar · -2', name: 'Raar', quantity: -2 },      // negatief → niet schalen
    { text: 'Nul · 0', name: 'Nul', quantity: 0 },          // 0 → niet schalen (grenswaarde)
    { text: 'X · 2', name: '', quantity: 2 },               // lege naam → niet schalen
    { text: 'Y · 2', name: 7, quantity: 2 },                // niet-string-naam → niet schalen
    null,                                                    // rommel-regel → ongemoeid, geen crash
    { text: 'Ei · 2', name: 'Ei', quantity: 2 },            // de enige die schaalt
  ];
  assert.deepEqual(scaleIngredients(input, 2, 4), [
    input[0], input[1], input[2], input[3], null,
    { text: 'Ei · 4', name: 'Ei', quantity: 4 },
  ]);
});

// --- Ronde 3 (plan 28 sessie 6): lijn-layout + voortgangsfractie. -----------

test('lineLayout: dots op kolom-midden, y vanaf de top, zelfde nice-as als de staaf', () => {
  const layout = lineLayout([{ label: 'jun', value: 0 }, { label: 'jul', value: 100 }], 200, 100);
  assert.deepEqual(layout.dots, [
    { label: 'jun', value: 0, x: 50, y: 100 },     // 0 → onderaan het plot-vlak
    { label: 'jul', value: 100, x: 150, y: 0 },    // nice-max (100) → bovenaan
  ]);
  assert.deepEqual(layout.ticks, [50, 100]);
  assert.equal(layout.max, 100);
});

test('lineLayout: segment ligt met zijn midden tussen de dots (rotated-View-wiskunde)', () => {
  // Horizontaal segment (gelijke waarden): lengte = dot-afstand, hoek 0.
  const vlak = lineLayout([{ label: 'a', value: 50 }, { label: 'b', value: 50 }], 100, 100);
  assert.deepEqual(vlak.segments, [{ left: 25, top: 0, length: 50, angle: 0 }]);
  // Diagonaal omhoog: lengte = hypot(dx, dy), hoek = atan2(dy, dx) (negatief = omhoog).
  const diag = lineLayout([{ label: 'a', value: 0 }, { label: 'b', value: 100 }], 200, 100);
  const l = Math.hypot(100, 100);
  assert.deepEqual(diag.segments, [{ left: 100 - l / 2, top: 50, length: l, angle: Math.atan2(-100, 100) }]);
  // Eén punt → geen segmenten, wel een dot.
  assert.equal(lineLayout([{ label: 'a', value: 1 }], 100, 100).segments.length, 0);
});

test('lineLayout: onbruikbare maat of lege punten → null (renderer tekent dan niets)', () => {
  assert.equal(lineLayout([], 100, 100), null);
  assert.equal(lineLayout([{ label: 'a', value: 1 }], 0, 100), null);
  assert.equal(lineLayout([{ label: 'a', value: 1 }], 100, 0), null);
  assert.equal(lineLayout([{ label: 'a', value: 1 }], Number.NaN, 100), null);
  assert.equal(lineLayout('rommel', 100, 100), null);
});

test('progressFraction: fractie geklemd op [0, 1]; rommel of noemer ≤ 0 → 0', () => {
  assert.equal(progressFraction(5, 12), 5 / 12);
  assert.equal(progressFraction(12, 12), 1);      // precies vol (grenswaarde)
  assert.equal(progressFraction(15, 12), 1);      // overschot klemt
  assert.equal(progressFraction(0, 12), 0);
  assert.equal(progressFraction(-3, 12), 0);
  assert.equal(progressFraction(1, 0), 0);
  assert.equal(progressFraction(Number.NaN, 12), 0);
  assert.equal(progressFraction(1, Infinity), 0); // niet-eindige noemer → 0
});
