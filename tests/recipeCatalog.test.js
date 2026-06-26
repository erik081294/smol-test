import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEAL_MOMENTS, DISH_TYPES, momentMeta, dishTypeMeta, filterRecipes,
} from '../lib/recipeCatalog.js';

const R = (title, meal_moment = null, dish_type = null) => ({ title, meal_moment, dish_type });

test('taxonomie: beide assen sluiten af met de overig-key', () => {
  assert.equal(MEAL_MOMENTS.at(-1).key, 'overig');
  assert.equal(DISH_TYPES.at(-1).key, 'overig');
});

test('momentMeta: bekende key geeft het juiste label', () => {
  assert.equal(momentMeta('diner').label, 'Diner');
});

// Hardgecodeerde labels (niet d.label, die zou met de entry mee-muteren): zo bewaakt
// de test dat élke taxonomie-entry intact is — een entry die naar {} muteert valt op de
// fallback 'Overig' terug en faalt hier.
test('momentMeta: alle eet-moment-keys leveren hun label', () => {
  assert.equal(momentMeta('ontbijt').label, 'Ontbijt');
  assert.equal(momentMeta('lunch').label, 'Lunch');
  assert.equal(momentMeta('diner').label, 'Diner');
  assert.equal(momentMeta('overig').label, 'Overig');
  assert.equal(MEAL_MOMENTS.length, 4);
});

test('dishTypeMeta: alle gerecht-type-keys leveren hun label', () => {
  const expected = {
    pasta: 'Pasta', salade: 'Salade', soep: 'Soep', 'klassiek-agv': 'Klassiek (AGV)',
    'rijst-wok': 'Rijst & wok', ovenschotel: 'Ovenschotel', wereldkeuken: 'Wereldkeuken',
    broodje: 'Broodje', bowl: 'Bowl', 'bakken-grill': 'Bakken & grill', toetje: 'Toetje',
    overig: 'Overig',
  };
  for (const [key, label] of Object.entries(expected)) assert.equal(dishTypeMeta(key).label, label);
  assert.equal(DISH_TYPES.length, Object.keys(expected).length);
});

test('momentMeta: onbekende/lege key valt terug op overig', () => {
  assert.equal(momentMeta('bestaat-niet').key, 'overig');
  assert.equal(momentMeta(null).key, 'overig');
  assert.equal(momentMeta(undefined).key, 'overig');
});

test('dishTypeMeta: bekende key geeft het juiste label', () => {
  assert.equal(dishTypeMeta('klassiek-agv').label, 'Klassiek (AGV)');
});

test('dishTypeMeta: onbekende/lege key valt terug op overig', () => {
  assert.equal(dishTypeMeta('zzz').key, 'overig');
  assert.equal(dishTypeMeta(null).key, 'overig');
});

test('filterRecipes: lege query/opts geeft alles, alfabetisch (NL)', () => {
  const out = filterRecipes([R('Zalm'), R('appeltaart'), R('Boerenkool')]);
  assert.deepEqual(out.map((r) => r.title), ['appeltaart', 'Boerenkool', 'Zalm']);
});

test('filterRecipes: zónder opts-argument geeft ook alles terug (default-param)', () => {
  const out = filterRecipes([R('Soep'), R('Brood')]);
  assert.deepEqual(out.map((r) => r.title), ['Brood', 'Soep']);
});

test('filterRecipes: geheel lege invoer -> lege lijst', () => {
  assert.deepEqual(filterRecipes(), []);
  assert.deepEqual(filterRecipes([]), []);
});

test('filterRecipes: recipes=null valt terug op een lege lijst', () => {
  assert.deepEqual(filterRecipes(null), []);
});

test('filterRecipes: query filtert niet-matchende titels eruit', () => {
  // Onderscheidt de zoek-tak van een "geef alles terug"-mutatie: Zucchini matcht niet.
  const out = filterRecipes([R('Pasta'), R('Zucchini')], { query: 'pasta' });
  assert.deepEqual(out.map((r) => r.title), ['Pasta']);
});

test('filterRecipes: prefix-match wint van een alfabetisch eerdere midden-match', () => {
  // 'to' staat vooraan in "Tomaat" (prefix) en midden in "Risotto". Alfabetisch komt
  // Risotto eerst, maar de prefix-match hoort vóór — scheidt prefix-rang van pure sort.
  const out = filterRecipes([R('Risotto'), R('Tomaat')], { query: 'to' });
  assert.deepEqual(out.map((r) => r.title), ['Tomaat', 'Risotto']);
});

test('filterRecipes: prefix-match staat vóór midden-in-de-titel-match', () => {
  // "pa" zit vooraan in "Pasta", midden in "Tapas" → Pasta eerst.
  const out = filterRecipes([R('Tapas'), R('Pasta')], { query: 'pa' });
  assert.deepEqual(out.map((r) => r.title), ['Pasta', 'Tapas']);
});

test('filterRecipes: tie-break is alfabetisch bij gelijke prefix-rang (omgekeerde invoer)', () => {
  // Beide prefix-matches; ongeacht invoervolgorde alfabetisch geordend.
  const out = filterRecipes([R('Pesto'), R('Pasta')], { query: 'p' });
  assert.deepEqual(out.map((r) => r.title), ['Pasta', 'Pesto']);
});

test('filterRecipes: query negeert hoofdletters/diacritica (normalize)', () => {
  const out = filterRecipes([R('Crème brûlée')], { query: 'creme' });
  assert.deepEqual(out.map((r) => r.title), ['Crème brûlée']);
});

test('filterRecipes: moment filtert exact op de key', () => {
  const out = filterRecipes(
    [R('Pannenkoeken', 'ontbijt'), R('Stamppot', 'diner')],
    { moment: 'diner' },
  );
  assert.deepEqual(out.map((r) => r.title), ['Stamppot']);
});

test('filterRecipes: dishType filtert exact op de key', () => {
  const out = filterRecipes(
    [R('Spaghetti', 'diner', 'pasta'), R('Caesar', 'lunch', 'salade')],
    { dishType: 'salade' },
  );
  assert.deepEqual(out.map((r) => r.title), ['Caesar']);
});

test('filterRecipes: combineert query + moment + dishType', () => {
  const recipes = [
    R('Pasta pesto', 'diner', 'pasta'),
    R('Pasta salade', 'lunch', 'salade'),
    R('Pasta bolognese', 'diner', 'pasta'),
  ];
  const out = filterRecipes(recipes, { query: 'pasta', moment: 'diner', dishType: 'pasta' });
  assert.deepEqual(out.map((r) => r.title), ['Pasta bolognese', 'Pasta pesto']);
});

test('filterRecipes: ongecategoriseerd recept valt weg zodra je op een as filtert', () => {
  const out = filterRecipes([R('Restje', null, null)], { moment: 'diner' });
  assert.deepEqual(out, []);
});
