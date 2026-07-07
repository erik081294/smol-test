// @ts-check
// Gebundelde, merkloze boodschappen-catalogus (Picnic-stijl) — de in-app bron die de
// externe Open Food Facts-database vervangt. Volledig offline, géén DB/netwerk: een
// verzorgde lijst generieke producten ("Melk", "Broccoli") met een schap (categorie),
// een default-eenheid en een emoji als per-product placeholder-beeld.
//
// Twee lagen vormen samen de bladerbare catalogus: déze gebundelde lijst + de eigen
// huishoud-producten (tabel `products`). De UI mengt ze; deze module is puur en testbaar.
//
// Beeld: de emoji hier is een placeholder; lib/productImage.js mag 'm vervangen door een
// (later geleverde) PNG of OpenMoji-asset op `key`. Niet elk item hééft een emoji — dan
// valt het beeld terug op de categorie-emoji.
// Mét extensie: zo is deze module edge-safe (Deno resolve't geen extensieloze
// imports) en kan het boodschappen-tool-pack 'm direct importeren (app↔edge-brug,
// zelfde patroon als lib/modules.js in assistant/index.ts). Metro/node kunnen beide.
import { normalize } from './productMatch.js';

// === De schappen (taxonomie) ============================================
// Overgenomen uit catalog_categories (migratie 0014) — van óns, niet OFF-specifiek.
// `sort` bepaalt de schap-volgorde; 'overig' altijd laatst.
export const CATEGORIES = [
  { key: 'groente-fruit', label: 'Groente & fruit', emoji: '🥦', sort: 10 },
  { key: 'zuivel', label: 'Zuivel & eieren', emoji: '🥛', sort: 20 },
  { key: 'kaas-vleeswaren', label: 'Kaas & vleeswaren', emoji: '🧀', sort: 30 },
  { key: 'vlees-vis', label: 'Vlees & vis', emoji: '🥩', sort: 40 },
  { key: 'brood', label: 'Brood & bakkerij', emoji: '🍞', sort: 50 },
  { key: 'ontbijt-beleg', label: 'Ontbijt & beleg', emoji: '🥣', sort: 60 },
  { key: 'pasta-rijst', label: 'Pasta, rijst & wereld', emoji: '🍝', sort: 70 },
  { key: 'conserven', label: 'Conserven & soep', emoji: '🥫', sort: 80 },
  { key: 'sauzen-kruiden', label: 'Sauzen & kruiden', emoji: '🧂', sort: 90 },
  { key: 'snoep-snacks', label: 'Snoep & snacks', emoji: '🍫', sort: 100 },
  { key: 'koek-gebak', label: 'Koek & gebak', emoji: '🍪', sort: 110 },
  { key: 'dranken', label: 'Dranken', emoji: '🧃', sort: 120 },
  { key: 'diepvries', label: 'Diepvries', emoji: '🧊', sort: 130 },
  { key: 'baby', label: 'Baby & kind', emoji: '🍼', sort: 140 },
  { key: 'verzorging', label: 'Verzorging & drogist', emoji: '🧴', sort: 150 },
  { key: 'huishouden', label: 'Huishouden & non-food', emoji: '🧽', sort: 160 },
  { key: 'dieren', label: 'Huisdieren', emoji: '🐾', sort: 170 },
  { key: 'overig', label: 'Overig', emoji: '🛒', sort: 999 },
];

const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// Categorie-meta met veilige terugval op 'overig' (onbekende/lege key).
export function categoryMeta(key) {
  return CATEGORY_BY_KEY[key] ?? CATEGORY_BY_KEY.overig;
}

// === De producten (merkloos, generiek) ==================================
// `key` is stabiel & uniek (kebab-case). `unit` is de default-eenheid bij toevoegen.
// `emoji` is optioneel (placeholder-beeld). Bewust generiek: "Melk", niet een merk.
const P = (key, name, category, unit, emoji) => ({ key, name, category, unit, emoji });

export const CATALOG = [
  // Groente & fruit
  P('aardappelen', 'Aardappelen', 'groente-fruit', 'kg', '🥔'),
  P('uien', 'Uien', 'groente-fruit', 'stuk', '🧅'),
  P('tomaten', 'Tomaten', 'groente-fruit', 'stuk', '🍅'),
  P('komkommer', 'Komkommer', 'groente-fruit', 'stuk', '🥒'),
  P('paprika', 'Paprika', 'groente-fruit', 'stuk', '🫑'),
  P('broccoli', 'Broccoli', 'groente-fruit', 'stuk', '🥦'),
  P('wortels', 'Wortels', 'groente-fruit', 'zak', '🥕'),
  P('sla', 'Sla', 'groente-fruit', 'krop', '🥬'),
  P('champignons', 'Champignons', 'groente-fruit', 'bak', '🍄'),
  P('knoflook', 'Knoflook', 'groente-fruit', 'stuk', '🧄'),
  P('bananen', 'Bananen', 'groente-fruit', 'stuk', '🍌'),
  P('appels', 'Appels', 'groente-fruit', 'stuk', '🍎'),
  P('sinaasappels', 'Sinaasappels', 'groente-fruit', 'net', '🍊'),
  P('citroen', 'Citroen', 'groente-fruit', 'stuk', '🍋'),
  P('avocado', 'Avocado', 'groente-fruit', 'stuk', '🥑'),
  P('aardbeien', 'Aardbeien', 'groente-fruit', 'bak', '🍓'),
  P('druiven', 'Druiven', 'groente-fruit', 'tros', '🍇'),
  P('spinazie', 'Spinazie', 'groente-fruit', 'zak', '🥬'),

  // Zuivel & eieren
  P('melk', 'Melk', 'zuivel', 'pak', '🥛'),
  P('halfvolle-melk', 'Halfvolle melk', 'zuivel', 'pak', '🥛'),
  P('eieren', 'Eieren', 'zuivel', 'doos', '🥚'),
  P('yoghurt', 'Yoghurt', 'zuivel', 'pak', '🥛'),
  P('kwark', 'Kwark', 'zuivel', 'bak', '🥛'),
  P('roomboter', 'Roomboter', 'zuivel', 'pak', '🧈'),
  P('slagroom', 'Slagroom', 'zuivel', 'pak', '🥛'),
  P('vla', 'Vla', 'zuivel', 'pak', '🥛'),

  // Kaas & vleeswaren
  P('jonge-kaas', 'Jonge kaas', 'kaas-vleeswaren', 'stuk', '🧀'),
  P('geraspte-kaas', 'Geraspte kaas', 'kaas-vleeswaren', 'zak', '🧀'),
  P('ham', 'Ham', 'kaas-vleeswaren', 'pak', '🥓'),
  P('kipfilet-vleeswaren', 'Kipfilet (vleeswaren)', 'kaas-vleeswaren', 'pak', '🍗'),
  P('salami', 'Salami', 'kaas-vleeswaren', 'pak', '🍖'),
  P('smeerkaas', 'Smeerkaas', 'kaas-vleeswaren', 'kuipje', '🧀'),

  // Vlees & vis
  P('gehakt', 'Gehakt', 'vlees-vis', 'pak', '🥩'),
  P('kipfilet', 'Kipfilet', 'vlees-vis', 'pak', '🍗'),
  P('spekjes', 'Spekjes', 'vlees-vis', 'pak', '🥓'),
  P('zalm', 'Zalm', 'vlees-vis', 'pak', '🐟'),
  P('vissticks', 'Vissticks', 'vlees-vis', 'doos', '🐟'),
  P('worst', 'Worst', 'vlees-vis', 'stuk', '🌭'),

  // Brood & bakkerij
  P('brood', 'Brood', 'brood', 'stuk', '🍞'),
  P('volkorenbrood', 'Volkorenbrood', 'brood', 'stuk', '🍞'),
  P('croissants', 'Croissants', 'brood', 'stuk', '🥐'),
  P('bagels', 'Bagels', 'brood', 'zak', '🥯'),
  P('wraps', 'Wraps', 'brood', 'pak', '🌯'),
  P('beschuit', 'Beschuit', 'brood', 'rol', '🍘'),
  P('crackers', 'Crackers', 'brood', 'pak', '🍘'),

  // Ontbijt & beleg
  P('hagelslag', 'Hagelslag', 'ontbijt-beleg', 'pak', '🍫'),
  P('pindakaas', 'Pindakaas', 'ontbijt-beleg', 'pot', '🥜'),
  P('jam', 'Jam', 'ontbijt-beleg', 'pot', '🍓'),
  P('honing', 'Honing', 'ontbijt-beleg', 'pot', '🍯'),
  P('cruesli', 'Cruesli', 'ontbijt-beleg', 'pak', '🥣'),
  P('cornflakes', 'Cornflakes', 'ontbijt-beleg', 'pak', '🥣'),
  P('havermout', 'Havermout', 'ontbijt-beleg', 'pak', '🥣'),

  // Pasta, rijst & wereld
  P('spaghetti', 'Spaghetti', 'pasta-rijst', 'pak', '🍝'),
  P('penne', 'Penne', 'pasta-rijst', 'pak', '🍝'),
  P('rijst', 'Rijst', 'pasta-rijst', 'pak', '🍚'),
  P('noedels', 'Noedels', 'pasta-rijst', 'pak', '🍜'),
  P('couscous', 'Couscous', 'pasta-rijst', 'pak', '🍚'),
  P('wraps-tortilla', 'Tortillawraps', 'pasta-rijst', 'pak', '🌮'),
  P('sojasaus', 'Sojasaus', 'pasta-rijst', 'fles', '🍶'),

  // Conserven & soep
  P('tomatenblokjes', 'Tomatenblokjes', 'conserven', 'blik', '🥫'),
  P('mais', 'Mais', 'conserven', 'blik', '🌽'),
  P('kidneybonen', 'Kidneybonen', 'conserven', 'blik', '🫘'),
  P('kikkererwten', 'Kikkererwten', 'conserven', 'blik', '🫘'),
  P('soep', 'Soep', 'conserven', 'blik', '🥫'),
  P('tonijn-blik', 'Tonijn (blik)', 'conserven', 'blik', '🐟'),

  // Sauzen & kruiden
  P('ketchup', 'Ketchup', 'sauzen-kruiden', 'fles', '🍅'),
  P('mayonaise', 'Mayonaise', 'sauzen-kruiden', 'fles', '🥚'),
  P('pastasaus', 'Pastasaus', 'sauzen-kruiden', 'pot', '🍅'),
  P('olijfolie', 'Olijfolie', 'sauzen-kruiden', 'fles', '🫒'),
  P('zout', 'Zout', 'sauzen-kruiden', 'pak', '🧂'),
  P('peper', 'Peper', 'sauzen-kruiden', 'potje', '🧂'),
  P('suiker', 'Suiker', 'sauzen-kruiden', 'pak', '🍬'),
  P('bloem', 'Bloem', 'sauzen-kruiden', 'pak', '🌾'),

  // Snoep & snacks
  P('chips', 'Chips', 'snoep-snacks', 'zak', '🍟'),
  P('nootjes', 'Nootjes', 'snoep-snacks', 'zak', '🥜'),
  P('chocolade', 'Chocolade', 'snoep-snacks', 'reep', '🍫'),
  P('drop', 'Drop', 'snoep-snacks', 'zak', '🍬'),
  P('popcorn', 'Popcorn', 'snoep-snacks', 'zak', '🍿'),

  // Koek & gebak
  P('koekjes', 'Koekjes', 'koek-gebak', 'pak', '🍪'),
  P('ontbijtkoek', 'Ontbijtkoek', 'koek-gebak', 'stuk', '🍞'),
  P('stroopwafels', 'Stroopwafels', 'koek-gebak', 'pak', '🧇'),
  P('cake', 'Cake', 'koek-gebak', 'stuk', '🍰'),

  // Dranken
  P('koffie', 'Koffie', 'dranken', 'pak', '☕'),
  P('thee', 'Thee', 'dranken', 'doos', '🍵'),
  P('sinaasappelsap', 'Sinaasappelsap', 'dranken', 'pak', '🧃'),
  P('frisdrank', 'Frisdrank', 'dranken', 'fles', '🥤'),
  P('water', 'Water', 'dranken', 'fles', '💧'),
  P('bier', 'Bier', 'dranken', 'krat', '🍺'),
  P('wijn', 'Wijn', 'dranken', 'fles', '🍷'),

  // Diepvries
  P('diepvriespizza', 'Diepvriespizza', 'diepvries', 'stuk', '🍕'),
  P('diepvriesgroente', 'Diepvriesgroente', 'diepvries', 'zak', '🥦'),
  P('ijs', 'IJs', 'diepvries', 'bak', '🍨'),
  P('frietjes', 'Frietjes', 'diepvries', 'zak', '🍟'),

  // Baby & kind
  P('luiers', 'Luiers', 'baby', 'pak', '🍼'),
  P('babyvoeding', 'Babyvoeding', 'baby', 'potje', '🍼'),
  P('billendoekjes', 'Billendoekjes', 'baby', 'pak', '🧻'),

  // Verzorging & drogist
  P('tandpasta', 'Tandpasta', 'verzorging', 'tube', '🪥'),
  P('shampoo', 'Shampoo', 'verzorging', 'fles', '🧴'),
  P('zeep', 'Zeep', 'verzorging', 'stuk', '🧼'),
  P('deodorant', 'Deodorant', 'verzorging', 'stuk', '🧴'),
  P('toiletpapier', 'Toiletpapier', 'huishouden', 'pak', '🧻'),

  // Huishouden & non-food
  P('afwasmiddel', 'Afwasmiddel', 'huishouden', 'fles', '🧽'),
  P('wasmiddel', 'Wasmiddel', 'huishouden', 'pak', '🧺'),
  P('vuilniszakken', 'Vuilniszakken', 'huishouden', 'rol', '🗑️'),
  P('keukenrol', 'Keukenrol', 'huishouden', 'rol', '🧻'),
  P('aluminiumfolie', 'Aluminiumfolie', 'huishouden', 'rol', '🧻'),
  P('batterijen', 'Batterijen', 'huishouden', 'pak', '🔋'),

  // Huisdieren
  P('kattenvoer', 'Kattenvoer', 'dieren', 'zak', '🐱'),
  P('hondenvoer', 'Hondenvoer', 'dieren', 'zak', '🐶'),
  P('kattenbakvulling', 'Kattenbakvulling', 'dieren', 'zak', '🐾'),
];

const ITEM_BY_KEY = Object.fromEntries(CATALOG.map((i) => [i.key, i]));
const ITEM_BY_NORM = new Map(CATALOG.map((i) => [normalize(i.name), i]));
// PERF-6: de genormaliseerde naam van elk vast catalogus-item één keer voorbouwen,
// zodat `searchCatalog` niet bij elke toetsaanslag ~200 namen opnieuw normaliseert.
const CATALOG_NORM = CATALOG.map((it) => ({ it, norm: normalize(it.name) }));

// Eén catalogus-item op key, of null.
export function itemByKey(key) {
  return ITEM_BY_KEY[key] ?? null;
}

// Eén catalogus-item op (genormaliseerde) naam, of null. Zo kan een eigen huishoud-
// product "Melk" het beeld/de categorie van het generieke catalogus-item lenen.
export function itemByName(name) {
  return ITEM_BY_NORM.get(normalize(name)) ?? null;
}

// Groepeer items per schap, in taxonomie-volgorde; binnen een schap alfabetisch (NL).
// Lege schappen vallen weg. Onbekende categorie → 'overig'.
export function catalogByCategory(items = CATALOG) {
  /** @type {Map<string, any[]>} */
  const buckets = new Map(CATEGORIES.map((c) => [c.key, []]));
  for (const it of items ?? []) {
    const key = buckets.has(it.category) ? it.category : 'overig';
    /** @type {any[]} */ (buckets.get(key)).push(it);
  }
  const out = [];
  for (const c of CATEGORIES) {
    const arr = buckets.get(c.key);
    if (arr && arr.length) {
      out.push({ ...c, items: [...arr].sort((a, b) => a.name.localeCompare(b.name, 'nl')) });
    }
  }
  return out;
}

// Zoek in de catalogus op genormaliseerde naam (zelfde normalize als de matcher).
// Lege query → alle items ongewijzigd. Rangschikking: een prefix-match staat vóór een
// midden-in-de-naam-match, daarbinnen alfabetisch (NL).
export function searchCatalog(query, items = CATALOG) {
  const q = normalize(query);
  if (!q) return [...(items ?? [])];
  // Voor de vaste catalogus gebruiken we de voor-genormaliseerde namen (PERF-6);
  // voor een aangereikte eigen lijst normaliseren we per item zoals voorheen.
  const source = items === CATALOG ? CATALOG_NORM : (items ?? []).map((it) => ({ it, norm: normalize(it.name) }));
  const hits = [];
  for (const { it, norm } of source) {
    const idx = norm.indexOf(q);
    if (idx === -1) continue;
    hits.push({ it, prefix: idx === 0 ? 0 : 1 });
  }
  hits.sort((a, b) => a.prefix - b.prefix || a.it.name.localeCompare(b.it.name, 'nl'));
  return hits.map((h) => h.it);
}
