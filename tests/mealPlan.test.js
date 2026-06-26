// Units voor de pure weekmenu-logica (lib/mealPlan.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekRange, groupByDate, aggregateIngredients, ingredientKey, MEAL_ORDER, eaterCount, defaultServings } from '../lib/mealPlan.js';

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

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('groupByDate: zelfde maaltijdtype → tie-break op created_at (oplopend)', () => {
  const g = groupByDate([
    { plan_date: 'd', meal_type: 'diner', created_at: '2' },
    { plan_date: 'd', meal_type: 'diner', created_at: '1' },
  ]);
  assert.deepEqual(g.d.map((e) => e.created_at), ['1', '2']);
});

test('aggregateIngredients: onbekend recept of recept zonder ingrediënten-array → overslaan (geen crash)', () => {
  assert.deepEqual(aggregateIngredients([{ recipe_id: 'ghost' }], {}), []);
  assert.deepEqual(aggregateIngredients([{ recipe_id: 'r' }], { r: { servings: 2 } }), []);
});

test('aggregateIngredients: servings 0 valt terug op 1 (geen deling door nul)', () => {
  const out = aggregateIngredients(
    [{ recipe_id: 'r', servings: 3 }],
    { r: { servings: 0, ingredients: [{ name: 'X', quantity: 2, unit: 'stuk' }] } },
  );
  assert.equal(out[0].quantity, 6); // scale = 3 / 1
});

test('aggregateIngredients: catalog_product_id wordt overgenomen', () => {
  const out = aggregateIngredients(
    [{ recipe_id: 'r', servings: 1 }],
    { r: { servings: 1, ingredients: [{ catalog_product_id: 'c1', name: 'X', quantity: 1, unit: 'stuk' }] } },
  );
  assert.equal(out[0].catalogProductId, 'c1');
});

// --- "wie eet mee": eaterCount + defaultServings (MLT) -----------------------

test('eaterCount: leden + gasten', () => {
  assert.equal(eaterCount({ eater_ids: ['a', 'b'], extra_eaters: 1 }), 3);
});

test('eaterCount: alleen leden', () => {
  assert.equal(eaterCount({ eater_ids: ['a', 'b', 'c'] }), 3);
});

test('eaterCount: alleen gasten', () => {
  assert.equal(eaterCount({ extra_eaters: 2 }), 2);
});

test('eaterCount: ontbrekende velden tellen als nul', () => {
  assert.equal(eaterCount({}), 0);
  assert.equal(eaterCount(), 0); // default-param: zonder argument ook 0
});

test('eaterCount: eater_ids dat geen array is telt als nul leden', () => {
  assert.equal(eaterCount({ eater_ids: null, extra_eaters: 1 }), 1);
});

test('defaultServings: aantal eters wint', () => {
  assert.equal(defaultServings({ eater_ids: ['a', 'b'] }, 2), 2);
  assert.equal(defaultServings({ eater_ids: ['a', 'b', 'c'], extra_eaters: 1 }, 2), 4);
});

test('defaultServings: zonder eters valt het terug op de fallback', () => {
  assert.equal(defaultServings({}, 2), 2);
  assert.equal(defaultServings({ eater_ids: [] }, 5), 5);
});

test('defaultServings: fallback default is 2 (geen argument)', () => {
  assert.equal(defaultServings({}), 2);
  assert.equal(defaultServings(), 2);
});

test('defaultServings: gasten alleen tellen ook mee', () => {
  assert.equal(defaultServings({ extra_eaters: 3 }, 2), 3);
});
