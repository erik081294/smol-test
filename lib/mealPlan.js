// Pure logica voor het weekmenu (MLT-1). Geen React/Supabase — volledig te
// unit-testen. Zet geplande maaltijden + recepten om naar een samengevoegde
// boodschappen-behoefte; lib/pantry.js trekt daar de voorraad vanaf.
import { startOfWeek, addDays, format } from 'date-fns';
import { normalize } from './productMatch';

// Vaste weergavevolgorde van maaltijdtypen binnen een dag.
export const MEAL_ORDER = ['ontbijt', 'lunch', 'diner', 'snack'];

// Weekvenster (maandag-start) rond een datum.
// -> { start: Date, days: ['yyyy-MM-dd' × 7] }
export function weekRange(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  return { start, days };
}

// Entries gegroepeerd per dag (plan_date), elk gesorteerd op maaltijdtype.
// -> { 'yyyy-MM-dd': [entry, …] }
export function groupByDate(entries = []) {
  const out = {};
  for (const e of entries) {
    (out[e.plan_date] ??= []).push(e);
  }
  for (const date of Object.keys(out)) {
    out[date].sort((a, b) => {
      const ai = MEAL_ORDER.indexOf(a.meal_type), bi = MEAL_ORDER.indexOf(b.meal_type);
      return (ai - bi) || (String(a.created_at) < String(b.created_at) ? -1 : 1);
    });
  }
  return out;
}

// Sleutel waarop ingrediënten worden samengevoegd: per-huishouden product wint,
// dan globaal catalogusproduct, anders de genormaliseerde naam.
export function ingredientKey(ing) {
  return ing.product_id || ing.catalog_product_id || `naam:${normalize(ing.name)}`;
}

// Voeg de ingrediënten van geplande maaltijden samen en schaal op servings.
//   entries:     [{ recipe_id, servings }]
//   recipesById: { [id]: { servings, ingredients: [{ product_id?, catalog_product_id?, name, quantity, unit }] } }
// Schaal per maaltijd = entry.servings / recipe.servings (recept zonder servings → 1).
// Zelfde sleutel + zelfde unit telt op; verschillende units blijven gescheiden.
// -> [{ key, name, productId, catalogProductId, unit, quantity }]  (quantity afgerond op 0,01)
export function aggregateIngredients(entries = [], recipesById = {}) {
  const acc = new Map();
  for (const entry of entries) {
    if (!entry.recipe_id) continue;                 // vrije-tekst-maaltijd: geen ingrediënten
    const recipe = recipesById[entry.recipe_id];
    if (!recipe || !Array.isArray(recipe.ingredients)) continue;
    const base = recipe.servings > 0 ? recipe.servings : 1;
    const scale = (entry.servings ?? base) / base;
    for (const ing of recipe.ingredients) {
      const unit = ing.unit || 'stuk';
      const mapKey = `${ingredientKey(ing)}@@${unit}`;
      const add = (Number(ing.quantity) || 0) * scale;
      const cur = acc.get(mapKey);
      if (cur) {
        cur.quantity += add;
      } else {
        acc.set(mapKey, {
          key: ingredientKey(ing),
          name: ing.name,
          productId: ing.product_id ?? null,
          catalogProductId: ing.catalog_product_id ?? null,
          unit,
          quantity: add,
        });
      }
    }
  }
  return [...acc.values()].map((x) => ({ ...x, quantity: Math.round(x.quantity * 100) / 100 }));
}
