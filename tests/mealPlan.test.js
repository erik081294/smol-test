// Units voor de pure weekmenu-logica (lib/mealPlan.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekRange, groupByDate, aggregateIngredients, ingredientKey, MEAL_ORDER } from '../lib/mealPlan.js';

test('weekRange: maandag-start + 7 dagen', () => {
  // 18 jun 2026 is een donderdag → week begint ma 15 jun.
  const { start, days } = weekRange(new Date(2026, 5, 18));
  assert.equal(start.getDay(), 1, 'start is maandag');
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-06-15');
  assert.equal(days[6], '2026-06-21');
});

test('groupByDate: groepeert en sorteert op maaltijdtype', () => {
  const entries = [
    { plan_date: '2026-06-15', meal_type: 'diner', created_at: '1' },
    { plan_date: '2026-06-15', meal_type: 'ontbijt', created_at: '2' },
    { plan_date: '2026-06-16', meal_type: 'lunch', created_at: '3' },
  ];
  const g = groupByDate(entries);
  assert.deepEqual(g['2026-06-15'].map((e) => e.meal_type), ['ontbijt', 'diner']);
  assert.equal(g['2026-06-16'].length, 1);
  assert.deepEqual(MEAL_ORDER, ['ontbijt', 'lunch', 'diner', 'snack']);
});

test('ingredientKey: product > catalogus > genormaliseerde naam', () => {
  assert.equal(ingredientKey({ product_id: 'p1', catalog_product_id: 'c1', name: 'Melk' }), 'p1');
  assert.equal(ingredientKey({ catalog_product_id: 'c1', name: 'Melk' }), 'c1');
  assert.equal(ingredientKey({ name: 'Halfvolle Melk 1L' }), 'naam:halfvolle melk');
});

test('aggregateIngredients: telt zelfde product op en schaalt op servings', () => {
  const recipesById = {
    r1: { servings: 2, ingredients: [{ product_id: 'p1', name: 'Melk', quantity: 1, unit: 'l' }] },
    r2: { servings: 4, ingredients: [{ product_id: 'p1', name: 'Melk', quantity: 2, unit: 'l' }] },
  };
  // r1 voor 4 personen (×2 → 2 l) + r2 voor 4 personen (×1 → 2 l) = 4 l.
  const out = aggregateIngredients(
    [{ recipe_id: 'r1', servings: 4 }, { recipe_id: 'r2', servings: 4 }],
    recipesById
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 4);
  assert.equal(out[0].unit, 'l');
  assert.equal(out[0].productId, 'p1');
});

test('aggregateIngredients: verschillende units blijven gescheiden; vrije tekst bucket op naam', () => {
  const recipesById = {
    r1: { servings: 1, ingredients: [
      { name: 'Bloem', quantity: 100, unit: 'g' },
      { name: 'bloem', quantity: 1, unit: 'kg' },
    ] },
  };
  const out = aggregateIngredients([{ recipe_id: 'r1', servings: 1 }], recipesById);
  assert.equal(out.length, 2, 'g en kg apart');
  const keys = new Set(out.map((x) => x.key));
  assert.equal(keys.size, 1, 'zelfde naam-sleutel');
});

test('aggregateIngredients: vrije-tekst-maaltijd (geen recipe) levert niets', () => {
  assert.deepEqual(aggregateIngredients([{ recipe_id: null, servings: 2, title: 'Uit eten' }], {}), []);
});
