// Unit-tests voor lib/assistantGenUi.js — de pure interactie-logica van de
// gen-UI-componenten (AI-16, plan 26). Mutatie-gaten die we expliciet
// dichtdrukken (CLAUDE.md): grenswaarden (precies op de nice-stap, precies op
// de porties-grens), default-params, null/ontbrekend veld → fallback, en het
// rekenteken/de deling in de schaal-formule (invoer waar operanden verschillen).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  niceMax, chartLayout, formatChartValue, formatQuantity,
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
  // Alleen nullen: de as valt terug op 1 zodat de fracties 0 blijven (geen NaN).
  const zeros = chartLayout([{ label: 'a', value: 0 }]);
  assert.equal(zeros.max, 1);
  assert.deepEqual(zeros.bars.map((b) => b.frac), [0]);
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
  assert.equal(scaleIngredients(input, 0, 6), input);
  assert.equal(scaleIngredients(input, 4, 0), input);
  assert.deepEqual(scaleIngredients(undefined, 4, 6), []);
});
