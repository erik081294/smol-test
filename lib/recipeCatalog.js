// @ts-check
// Taxonomie + filter-logica voor de recepten-catalogus (MLT). Spiegelt de boodschappen-
// catalogus (lib/groceryCatalog.js): de categorieën leven hier in JS — niet als DB-CHECK —
// zodat ze uitbreiden zonder migratie. Volledig puur (geen React/IO), los unit-testbaar.
//
// Twee onafhankelijke assen categoriseren een recept:
//   • MEAL_MOMENTS — wanneer eet je het (ontbijt/lunch/diner/overig);
//   • DISH_TYPES   — wat voor gerecht is het (pasta/salade/soep/…).
// recipes.meal_moment / recipes.dish_type (migratie 0059) bewaren de gekozen `key`.
import { normalize } from './productMatch';

// === As 1: eet-moment =====================================================
export const MEAL_MOMENTS = [
  { key: 'ontbijt', label: 'Ontbijt', emoji: '🥣' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'diner', label: 'Diner', emoji: '🍽️' },
  { key: 'overig', label: 'Overig', emoji: '🍴' },
];

// === As 2: soort gerecht ==================================================
// "Klassiek (AGV)" = het klassieke Aardappel-Groente-Vlees-bord. De volgorde hier
// bepaalt de chip-volgorde; 'overig' staat altijd achteraan.
export const DISH_TYPES = [
  { key: 'pasta', label: 'Pasta', emoji: '🍝' },
  { key: 'salade', label: 'Salade', emoji: '🥗' },
  { key: 'soep', label: 'Soep', emoji: '🍲' },
  { key: 'klassiek-agv', label: 'Klassiek (AGV)', emoji: '🥔' },
  { key: 'rijst-wok', label: 'Rijst & wok', emoji: '🍚' },
  { key: 'ovenschotel', label: 'Ovenschotel', emoji: '🥘' },
  { key: 'wereldkeuken', label: 'Wereldkeuken', emoji: '🌍' },
  { key: 'broodje', label: 'Broodje', emoji: '🥪' },
  { key: 'bowl', label: 'Bowl', emoji: '🍜' },
  { key: 'bakken-grill', label: 'Bakken & grill', emoji: '🍳' },
  { key: 'toetje', label: 'Toetje', emoji: '🍰' },
  { key: 'overig', label: 'Overig', emoji: '🍴' },
];

const MOMENT_BY_KEY = Object.fromEntries(MEAL_MOMENTS.map((m) => [m.key, m]));
const DISH_BY_KEY = Object.fromEntries(DISH_TYPES.map((d) => [d.key, d]));

const MOMENT_FALLBACK = { key: 'overig', label: 'Overig', emoji: '🍴' };
const DISH_FALLBACK = { key: 'overig', label: 'Overig', emoji: '🍴' };

// Meta voor een eet-moment-key, met veilige terugval (onbekende/lege key → 'overig').
export function momentMeta(key) {
  return MOMENT_BY_KEY[key] ?? MOMENT_FALLBACK;
}

// Meta voor een gerecht-type-key, met veilige terugval (onbekende/lege key → 'overig').
export function dishTypeMeta(key) {
  return DISH_BY_KEY[key] ?? DISH_FALLBACK;
}

// Filter een receptenlijst op (optioneel) zoekterm + eet-moment + gerecht-type.
//   recipes: [{ title, meal_moment, dish_type, … }]
//   opts:    { query?, moment?, dishType? }   (lege/ontbrekende waarde = geen filter)
// Zoekt op genormaliseerde titel (zelfde normalize als de matcher); een prefix-match
// staat vóór een midden-in-de-titel-match, daarbinnen alfabetisch (NL) — net als
// searchCatalog. moment/dishType filteren exact op de opgeslagen key.
export function filterRecipes(recipes = [], { query = '', moment = null, dishType = null } = {}) {
  const base = (recipes ?? []).filter((r) => {
    if (moment && r.meal_moment !== moment) return false;
    if (dishType && r.dish_type !== dishType) return false;
    return true;
  });
  const q = normalize(query);
  if (!q) return [...base].sort((a, b) => String(a.title).localeCompare(String(b.title), 'nl'));
  const hits = [];
  for (const r of base) {
    const idx = normalize(r.title).indexOf(q);
    if (idx === -1) continue;
    hits.push({ r, prefix: idx === 0 ? 0 : 1 });
  }
  hits.sort((a, b) => a.prefix - b.prefix || String(a.r.title).localeCompare(String(b.r.title), 'nl'));
  return hits.map((h) => h.r);
}

export { normalize };
