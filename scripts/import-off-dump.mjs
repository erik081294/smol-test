// Importeer een opgeschoonde NL-subset van de Open Food Facts DUMP in
// public.catalog_products. Vervangt de oude API-bulk-import: OFF raadt voor meer dan
// een paar honderd producten EXPLICIET de dump aan i.p.v. de API (die is rate-limited
// en bedoeld voor losse lookups). Zie het onderzoek + huishoek-backlog.md (BOO-5/INF).
//
// Bron: de OFF JSONL-dump (één JSON-record per regel), gegzipt of plat:
//   https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz   (~7 GB)
// We STREAMEN regel-voor-regel (nooit ~43 GB in geheugen), filteren naar de NL-subset
// + kwaliteit via lib/offCatalog.transformOffProduct (puur + unit-getest), en upserten
// per `code` (idempotent → herdraaien verfrist de catalogus). Foto's worden gehotlinkt
// naar de OFF-CDN (niets in Storage). De ~27k NL-rijen kosten ~23 MB (past in free tier).
//
// Draaien (node staat off-PATH; zie memory node-on-path):
//   export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
//   curl -L -o /tmp/off.jsonl.gz https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz
//   OFF_DUMP=/tmp/off.jsonl.gz node scripts/import-off-dump.mjs
//
// Verplichte env (uit .env of shell): SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL.
// Optioneel: OFF_DUMP (pad; anders argv[2]), DRY_RUN=1 (alleen filteren, geen DB-schrijf),
//   LIMIT (max te bewaren rijen, voor een testrun), BATCH (upsert-batch, default 1000),
//   MIN_COMPLETENESS (OFF completeness-drempel 0..1.1, default 0 = uit).
//
// Licentie: OFF-data is ODbL, foto's CC-BY-SA. De UI toont de verplichte attributie
// (lib/i18n 'catalog.attribution'); zie het licentie-onderzoek voor de share-alike-nuance.

import { readFileSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { transformOffProduct } from '../lib/offCatalog.js';

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
const DUMP = env.OFF_DUMP || process.argv[2];
const BATCH = Math.max(1, Number(env.BATCH || 1000));
const LIMIT = env.LIMIT ? Number(env.LIMIT) : Infinity;
const MIN_COMPLETENESS = Number(env.MIN_COMPLETENESS || 0);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!DUMP) {
  console.error('Geef het dump-pad mee: OFF_DUMP=/pad/off.jsonl.gz node scripts/import-off-dump.mjs');
  process.exit(1);
}
if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('Ontbrekend: EXPO_PUBLIC_SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY (zet ze in .env).');
  process.exit(1);
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function upsertBatch(rows) {
  if (!rows.length || DRY_RUN) return;
  const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('catalog_products').upsert(stamped, { onConflict: 'code' });
  if (error) throw new Error(error.message);
}

// Dedup binnen een batch op code (zou bij een dump niet voorkomen — één rij per code —
// maar veilig) en upsert.
async function flush(rows, stats) {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  await upsertBatch([...byCode.values()]);
  stats.upserted += byCode.size;
}

async function main() {
  const isGz = /\.gz$/i.test(DUMP);
  const stream = isGz ? createReadStream(DUMP).pipe(createGunzip()) : createReadStream(DUMP);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const stats = { seen: 0, kept: 0, upserted: 0, skip: {} };
  const bump = (r) => { stats.skip[r] = (stats.skip[r] || 0) + 1; };
  let batch = [];
  const t0 = Date.now();
  console.log(`Importeren uit ${DUMP}${DRY_RUN ? '  (DRY RUN)' : ''}…`);

  for await (const line of rl) {
    if (!line) continue;
    stats.seen++;
    // Goedkope voorfilter: alleen regels die 'netherlands' bevatten parsen we. Scheelt
    // ~99% JSON.parse op de globale dump; transformOffProduct verifieert daarna de tag.
    if (!line.toLowerCase().includes('netherlands')) continue;

    let p;
    try { p = JSON.parse(line); } catch { bump('json-fout'); continue; }

    const out = transformOffProduct(p, { minCompleteness: MIN_COMPLETENESS });
    if (out.skip) { bump(out.skip); continue; }

    batch.push(out.row);
    stats.kept++;
    if (batch.length >= BATCH) {
      await flush(batch, stats);
      batch = [];
      process.stdout.write(`\r  gezien ${stats.seen} · bewaard ${stats.kept} · upserted ${stats.upserted}…`);
    }
    if (stats.kept >= LIMIT) break;
  }
  if (batch.length) await flush(batch, stats);

  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n\nKlaar in ${secs}s. Regels gezien: ${stats.seen}, bewaard: ${stats.kept}, `
    + `${DRY_RUN ? '(dry-run — niets weggeschreven)' : `ge-upsert: ${stats.upserted}`}.`);
  console.log('Overgeslagen (per reden):', stats.skip);
}

main().catch((e) => { console.error('\nImport mislukt:', e.message); process.exit(1); });
