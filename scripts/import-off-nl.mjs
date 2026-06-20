// Importeer de Nederlandse subset van Open Food Facts in public.catalog_products.
//
// Bron: de OFF-zoek-API gefilterd op landtag = Netherlands, gesorteerd op
// populariteit (meest-gescande producten eerst, zodat een afgekapte run tóch de
// nuttigste producten bevat). Per product mappen we naar één Huishoek-schap
// (scripts/off-category-map.js) en normaliseren we de naam met dezelfde
// lib/productMatch.normalize als de app. Upsert per `code` (EAN) → idempotent,
// dus herdraaien houdt de catalogus actueel.
//
// Draaien (node staat off-PATH; zie memory node-on-path):
//   export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
//   node scripts/import-off-nl.mjs
//
// Env (uit .env): SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL.
// Optioneel: MAX_PAGES (cap voor een testrun), PAGE_SIZE (default 100),
//            DELAY_MS (pauze tussen API-calls; default 6500 — OFF /search ~10/min),
//            DRY_RUN=1 (alleen fetch + mapping, geen DB-schrijf).
//
// Dekking: de OFF-zoek-API capt diepe paginatie op ~100 pagina's, dus met
// PAGE_SIZE=100 importeren we de ~10.000 meest-gescande NL-producten (van ~78k
// totaal). Dat dekt het dagelijkse boodschappen-assortiment ruim. Wil je álles,
// dan is de weg de bulk-dump (JSONL/Parquet) i.p.v. deze API — later op te pakken.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { normalize } from '../lib/productMatch.js';
import { mapCategory } from './off-category-map.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// .env parsen (klein en zonder dep): KEY=VALUE per regel, # = comment.
function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env optioneel — env-vars uit de shell mogen 't ook leveren */ }
  return { ...out, ...process.env };
}

const env = loadEnv();
const DRY_RUN = ['1', 'true', 'yes'].includes(String(env.DRY_RUN || '').toLowerCase());
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('Ontbrekend: EXPO_PUBLIC_SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY (zet ze in .env).');
  process.exit(1);
}

const PAGE_SIZE = Number(env.PAGE_SIZE || 100);
const MAX_PAGES = env.MAX_PAGES ? Number(env.MAX_PAGES) : Infinity;
const DELAY_MS = Number(env.DELAY_MS || 6500);
const FIELDS = [
  'code', 'product_name', 'product_name_nl', 'generic_name', 'brands', 'quantity',
  'image_small_url', 'image_front_small_url', 'categories_tags', 'categories_tags_en',
  'pnns_groups_1', 'lang', 'unique_scans_n',
].join(',');

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Eén OFF-product → één catalog_products-rij (of null als onbruikbaar).
function toRow(p) {
  const code = (p.code || '').trim();
  const name = (p.product_name_nl || p.product_name || p.generic_name || '').trim();
  if (!code || !name) return null;
  const image = p.image_small_url || p.image_front_small_url || null;
  const off = (p.categories_tags || []).slice(0, 12).join(',') || null;
  return {
    code,
    name: name.slice(0, 200),
    brands: (p.brands || '').slice(0, 160) || null,
    quantity: (p.quantity || '').slice(0, 60) || null,
    image_url: image,
    category: mapCategory(p),
    off_categories: off,
    lang: p.lang || null,
    search: normalize(name),
    popularity: Math.max(0, Math.floor(Number(p.unique_scans_n) || 0)),
    updated_at: new Date().toISOString(),
  };
}

async function upsert(rows) {
  // dedup op code binnen de batch (OFF kan dubbele codes teruggeven over pagina's)
  const byCode = new Map(rows.map((r) => [r.code, r]));
  if (DRY_RUN) return byCode.size; // proefdraai: alleen fetch + mapping, geen DB
  const { error } = await supabase
    .from('catalog_products')
    .upsert([...byCode.values()], { onConflict: 'code' });
  if (error) throw new Error(error.message);
  return byCode.size;
}

// OFF is af en toe traag/overbelast (429 rate-limit of 5xx). Daarom: retry met
// exponentiële backoff i.p.v. meteen stoppen. Alleen 4xx (≠429) is hard fataal.
// Eén pagina ophalen met retry + exponentiële backoff. Geeft de JSON terug, of
// `null` als OFF na alle pogingen blijft falen (429/5xx/netwerk) — de aanroeper
// slaat die pagina dan over i.p.v. de hele run te laten klappen. Alléén een 4xx
// (≠429) is hard fataal (config-/URL-fout). Géén sort_by: dat dwingt OFF de hele
// NL-set per call te sorteren en lokte aanhoudende 503's uit.
//
// `extra` voegt een filter toe (bv. &categories_tags_en=yogurts) voor de
// shard-modus: kleinere resultaatsets blijven op ondiepe pagina's, waar OFF's
// diepe-paginatie-503's níét optreden.
async function fetchPage(page, extra = '') {
  const url = `https://world.openfoodfacts.org/api/v2/search`
    + `?countries_tags_en=netherlands${extra}`
    + `&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}`;
  const UA = 'Huishoek/1.0 (https://github.com/huishoek; catalog import)';
  const MAX_RETRIES = 6;
  let wait = 5000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA } });
    } catch (e) {
      if (attempt === MAX_RETRIES) { console.warn(`  netwerkfout op pagina ${page} — overslaan na ${MAX_RETRIES} pogingen`); return null; }
      console.warn(`  netwerkfout op pagina ${page} (poging ${attempt}) — ${Math.round(wait / 1000)}s wachten…`);
      await sleep(wait); wait = Math.min(wait * 2, 60000); continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) { console.warn(`  OFF ${res.status} op pagina ${page} — overslaan na ${MAX_RETRIES} pogingen`); return null; }
      const cool = res.status === 429 ? Math.max(wait, 30000) : wait;
      console.warn(`  OFF ${res.status} op pagina ${page} (poging ${attempt}) — ${Math.round(cool / 1000)}s wachten…`);
      await sleep(cool); wait = Math.min(wait * 2, 60000); continue;
    }
    throw new Error(`OFF API ${res.status} op pagina ${page}`); // 4xx (≠429) → niet retrybaar
  }
  return null;
}

// OFF-categorie-shards (Engelse tag-slugs). Bewust mid-niveau en overlappend: de
// idempotente upsert ontdubbelt, en elke shard blijft klein genoeg om op ondiepe
// pagina's te blijven (waar OFF stabiel is). De aisle-indeling per product loopt
// los hiervan via mapCategory() op de eigen tags van het product.
const CATEGORY_SHARDS = [
  // zuivel & eieren
  'yogurts', 'cheeses', 'milks', 'creams', 'butters', 'margarines', 'eggs', 'plant-based-milk-alternatives', 'dairy-desserts',
  // vlees & vis
  'meats', 'poultry', 'hams', 'sausages', 'charcuterie', 'fishes', 'seafood', 'meat-alternatives',
  // groente & fruit
  'fruits', 'vegetables', 'fresh-vegetables', 'fresh-fruits', 'legumes', 'salads', 'nuts', 'dried-fruits',
  // brood & bakkerij
  'breads', 'breakfast-cereals', 'crackers', 'rusks',
  // ontbijt & beleg
  'spreads', 'chocolate-spreads', 'honeys', 'jams', 'peanut-butters', 'mueslis', 'cereals',
  // pasta, rijst & wereld
  'pastas', 'rices', 'noodles', 'couscous',
  // conserven & soep & kant-en-klaar
  'canned-foods', 'soups', 'prepared-meals', 'pizzas', 'canned-vegetables',
  // sauzen & kruiden
  'sauces', 'condiments', 'ketchup', 'mayonnaises', 'mustards', 'spices', 'olive-oils', 'vegetable-oils', 'vinegars',
  // snoep & snacks
  'chocolates', 'candies', 'sweet-snacks', 'salty-snacks', 'chips-and-fries', 'crisps', 'popcorn',
  // koek & gebak
  'biscuits', 'cakes', 'viennoiseries', 'pastries',
  // dranken
  'waters', 'sodas', 'fruit-juices', 'juices', 'teas', 'coffees', 'syrups', 'energy-drinks', 'plant-based-beverages', 'beers', 'wines',
  // diepvries & ijs
  'frozen-foods', 'ice-creams',
  // baby
  'baby-foods',
];

// Eén categorie volledig binnenhalen (ondiepe pagina's tot uitputting of een
// pagina die OFF na retries niet geeft). Geeft het aantal bewaarde producten terug.
async function importShard(cat, cats) {
  const extra = `&categories_tags_en=${encodeURIComponent(cat)}`;
  let page = 1;
  let saved = 0;
  while (page <= 25) { // cap: een categorie die >2500 NL-producten heeft, raakt anders alsnog de diepe-503-zone
    const data = await fetchPage(page, extra);
    if (data == null) { console.warn(`  [${cat}] pagina ${page} overgeslagen`); break; }
    const products = data.products || [];
    if (products.length === 0) break;
    const rows = products.map(toRow).filter(Boolean);
    for (const r of rows) cats[r.category] = (cats[r.category] || 0) + 1;
    saved += rows.length ? await upsert(rows) : 0;
    if (data.page_count != null && page >= data.page_count) break;
    page += 1;
    await sleep(DELAY_MS);
  }
  return saved;
}

async function main() {
  const SHARD = ['1', 'true', 'yes'].includes(String(env.SHARD || '').toLowerCase());
  const cats = {};
  let total = 0;

  if (SHARD) {
    const shards = env.SHARD_LIMIT ? CATEGORY_SHARDS.slice(0, Number(env.SHARD_LIMIT)) : CATEGORY_SHARDS;
    console.log(`OFF → catalog_products${DRY_RUN ? ' [DRY-RUN]' : ''} | SHARD-modus | ${shards.length} categorieën | page_size=${PAGE_SIZE} delay=${DELAY_MS}ms`);
    let i = 0;
    for (const cat of shards) {
      i += 1;
      const n = await importShard(cat, cats);
      total += n;
      console.log(`[${i}/${shards.length}] ${cat.padEnd(26)} +${String(n).padStart(4)}  (totaal deze run ${total})`);
      await sleep(DELAY_MS);
    }
  } else {
    const startPage = Number(env.START_PAGE || 1);
    const endPage = MAX_PAGES === Infinity ? Infinity : startPage + MAX_PAGES - 1;
    console.log(`OFF → catalog_products${DRY_RUN ? ' [DRY-RUN]' : ''} | breed | page_size=${PAGE_SIZE} delay=${DELAY_MS}ms start_page=${startPage}`);
    let page = startPage;
    let consecutiveFails = 0;
    const failed = [];
    while (page <= endPage) {
      const data = await fetchPage(page);
      if (data == null) {
        failed.push(page);
        if (++consecutiveFails >= 3) { console.warn(`\nGestopt: ${consecutiveFails} pagina's op rij mislukt (OFF overbelast). Hervat met START_PAGE=${page - consecutiveFails + 1}, of gebruik SHARD=1.`); break; }
        page += 1; await sleep(DELAY_MS); continue;
      }
      consecutiveFails = 0;
      const products = data.products || [];
      if (products.length === 0) { console.log('Geen producten meer — klaar.'); break; }
      const rows = products.map(toRow).filter(Boolean);
      for (const r of rows) cats[r.category] = (cats[r.category] || 0) + 1;
      const n = rows.length ? await upsert(rows) : 0;
      total += n;
      console.log(`pagina ${page}${data.page_count != null ? `/${data.page_count}` : ''}: ${products.length} op, ${n} bewaard (totaal ${total})`);
      if (data.page_count != null && page >= data.page_count) { console.log('Laatste pagina bereikt.'); break; }
      page += 1;
      await sleep(DELAY_MS);
    }
    if (failed.length) console.log(`\nOvergeslagen pagina's: ${failed.join(', ')}`);
  }

  console.log('\nKlaar. Bijgedragen per aisle (deze run):');
  for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);
  console.log(`\nTotaal bewaard/bijgewerkt deze run: ${total}`);
}

main().catch((e) => { console.error('Import faalde:', e.message); process.exit(1); });
