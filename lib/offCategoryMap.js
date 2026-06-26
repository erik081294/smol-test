// @ts-check
// Open Food Facts → Huishoek-categorie ("schap").
//
// OFF-producten dragen granulaire, crowd-sourced `categories_tags` (canoniek in
// het Engels, bv. `en:fruit-yogurts`, `en:frozen-pizzas`). Wij vouwen die samen
// tot ÉÉN van onze ~18 winkel-schappen (zie de seed in 0014).
//
// Belangrijk: we matchen op HELE tokens (woorden), niet op substrings — anders
// belandt "fruit-yogurts" bij groente-fruit (de oude bug: substring "fruit").
// En de vololgorde is bewust "producttype wint van smaak/ingrediënt": een
// yoghurt-met-fruit is zuivel, een vruchtensap is drank, melkchocolade is snoep.
// Daarom staan dranken/snoep/zuivel/… vóór groente-fruit; groente-fruit vangt
// alleen "pure" groente/fruit op (zonder ander type-signaal).
//
// Pure, dep-loze functie zodat het importscript én een unit-test 'm kunnen laden.

// Regels op vololgorde van specifiek → algemeen; de eerste die raakt wint. Elke
// waarde is een token (heel woord) dat in de gesplitste categorie-tags mag staan.
/** @type {Array<[string, string[]]>} */
const RULES = [
  ['baby',            ['baby']],
  ['dieren',          ['pet', 'petfood', 'dierenvoeding']],
  ['diepvries',       ['frozen']],
  ['dranken',         ['water', 'waters', 'soda', 'sodas', 'cola', 'juice', 'juices', 'tea', 'teas', 'coffee', 'coffees', 'beer', 'beers', 'wine', 'wines', 'smoothie', 'smoothies', 'lemonade', 'lemonades', 'limonade', 'energy', 'syrup', 'syrups', 'frisdrank', 'sap', 'sappen']],
  ['snoep-snacks',    ['chocolate', 'chocolates', 'candy', 'candies', 'sweets', 'snack', 'snacks', 'chips', 'crisps', 'popcorn', 'licorice', 'liquorice', 'confectionery', 'snoep', 'drop']],
  ['koek-gebak',      ['biscuit', 'biscuits', 'cookie', 'cookies', 'cake', 'cakes', 'pastry', 'pastries', 'viennoiserie', 'viennoiseries', 'wafer', 'wafers', 'muffin', 'muffins', 'koek', 'gebak', 'taart']],
  ['ontbijt-beleg',   ['cereal', 'cereals', 'breakfast', 'muesli', 'mueslis', 'granola', 'oat', 'oats', 'spread', 'spreads', 'jam', 'jams', 'honey', 'honeys', 'marmalade', 'hagelslag', 'peanut', 'confiture']],
  ['kaas-vleeswaren', ['cheese', 'cheeses', 'charcuterie', 'ham', 'hams', 'salami', 'deli', 'pate', 'vleeswaren', 'kaas']],
  ['zuivel',          ['yogurt', 'yogurts', 'yoghurt', 'yoghurts', 'dairy', 'dairies', 'milk', 'milks', 'cream', 'creams', 'butter', 'butters', 'margarine', 'margarines', 'egg', 'eggs', 'kwark', 'quark', 'skyr']],
  ['vlees-vis',       ['meat', 'meats', 'poultry', 'chicken', 'beef', 'pork', 'fish', 'fishes', 'seafood', 'salmon', 'tuna', 'shrimp', 'sausage', 'sausages', 'vlees', 'vis', 'gehakt']],
  ['brood',           ['bread', 'breads', 'baguette', 'baguettes', 'bakery', 'toast', 'toasts', 'rusks', 'crackers', 'crispbread', 'brood']],
  ['pasta-rijst',     ['pasta', 'pastas', 'noodle', 'noodles', 'rice', 'rices', 'couscous', 'quinoa', 'spaghetti']],
  ['conserven',       ['canned', 'tinned', 'soup', 'soups', 'meal', 'meals', 'prepared', 'composite', 'pizza', 'pizzas', 'conserve']],
  ['sauzen-kruiden',  ['sauce', 'sauces', 'condiment', 'condiments', 'ketchup', 'mayonnaise', 'mayonnaises', 'mustard', 'mustards', 'spice', 'spices', 'herb', 'herbs', 'seasoning', 'oil', 'oils', 'vinegar', 'vinegars', 'salt', 'pepper', 'saus', 'kruid', 'kruiden']],
  ['groente-fruit',   ['fruit', 'fruits', 'vegetable', 'vegetables', 'legume', 'legumes', 'salad', 'salads', 'mushroom', 'mushrooms', 'potato', 'potatoes', 'nuts', 'tomato', 'tomatoes', 'groente']],
  ['verzorging',      ['beauty', 'hygiene', 'cosmetic', 'cosmetics', 'toothpaste', 'shampoo', 'deodorant', 'verzorging']],
  ['huishouden',      ['cleaning', 'household', 'detergent', 'schoonmaak', 'wasmiddel']],
];

// pnns_groups_1 (grof, 9 waarden) als terugval wanneer de tags geen token geven.
const PNNS_FALLBACK = {
  'beverages': 'dranken',
  'cereals-and-potatoes': 'pasta-rijst',
  'composite-foods': 'conserven',
  'fat-and-sauces': 'sauzen-kruiden',
  'fish-meat-eggs': 'vlees-vis',
  'fruits-and-vegetables': 'groente-fruit',
  'milk-and-dairy-products': 'zuivel',
  'salty-snacks': 'snoep-snacks',
  'sugary-snacks': 'snoep-snacks',
};

const slug = (s) => String(s || '').toLowerCase().replace(/^[a-z]{2}:/, '').replace(/[_\s]+/g, '-');

// Splits alle categorie-tags in losse tokens (woorden), zodat we op hele woorden
// matchen: "en:fruit-yogurts" → {fruit, yogurts}.
function tokensOf(product) {
  const tags = [].concat(product.categories_tags || [], product.categories_tags_en || []);
  const set = new Set();
  for (const tag of tags) {
    for (const w of String(tag).toLowerCase().split(/[:\-_\s]+/)) {
      if (w) set.add(w);
    }
  }
  return set;
}

// product: { categories_tags?, categories_tags_en?, pnns_groups_1? } → schap-key.
export function mapCategory(product = {}) {
  const tokens = tokensOf(product);
  if (tokens.size) {
    for (const [key, words] of RULES) {
      if (words.some((w) => tokens.has(w))) return key;
    }
  }
  const pnns = slug(product.pnns_groups_1);
  if (PNNS_FALLBACK[pnns]) return PNNS_FALLBACK[pnns];
  return 'overig';
}

export const CATEGORY_KEYS = [...RULES.map(([k]) => k), 'overig'];
