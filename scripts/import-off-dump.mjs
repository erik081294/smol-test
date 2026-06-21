// Importeer een opgeschoonde NL-subset van de Open Food Facts DUMP in
// public.catalog_products. OFF raadt voor meer dan een paar honderd producten EXPLICIET
// de dump aan i.p.v. de API (rate-limited; voor losse lookups). Zie docs/off-catalog.md.
//
// Bron: de OFF JSONL-dump (één JSON-record per regel), gegzipt of plat:
//   https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz   (~7 GB)
// We STREAMEN regel-voor-regel (nooit ~43 GB in geheugen) via scripts/off-ingest, filteren
// naar de NL-subset + kwaliteit (lib/offCatalog, puur + unit-getest), en upserten per `code`
// (idempotent → herdraaien verfrist). Foto's gehotlinkt naar de OFF-CDN (niets in Storage).
//
// Na afloop zetten we het delta-watermerk (catalog_sync_state) op "nu", zodat de
// scheduled delta-refresh (scripts/refresh-off-delta.mjs) naadloos verder kan zonder de
// laatste 14 dagen opnieuw te draaien. Dit is de periodieke "volle reconciliatie" die ook
// verwijderingen opschoont (delta's kunnen dat niet).
//
// Draaien (node off-PATH; zie memory):
//   export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
//   curl -L -o /tmp/off.jsonl.gz https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz
//   OFF_DUMP=/tmp/off.jsonl.gz node scripts/import-off-dump.mjs
//
// Env: SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL (uit .env of shell).
// Optioneel: OFF_DUMP (pad; anders argv[2]), DRY_RUN=1, LIMIT, BATCH, MIN_COMPLETENESS.

import { readFileSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ingestJsonl } from './off-ingest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env optioneel */ }
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

async function main() {
  const isGz = /\.gz$/i.test(DUMP);
  const t0 = Date.now();
  console.log(`Importeren uit ${DUMP}${DRY_RUN ? '  (DRY RUN)' : ''}…`);

  const stats = await ingestJsonl(createReadStream(DUMP), {
    gunzip: isGz,
    onBatch: upsertBatch,
    transformOpts: { minCompleteness: MIN_COMPLETENESS },
    batchSize: BATCH,
    limit: LIMIT,
    onProgress: (s) => process.stdout.write(`\r  gezien ${s.seen} · bewaard ${s.kept} · upserted ${s.written}…`),
  });

  // Zet het delta-watermerk op "nu": de volle import dekt alles t/m dit moment, dus de
  // delta-refresh hoeft de laatste 14 dagen niet over te doen.
  if (!DRY_RUN) {
    const now = Math.floor(Date.now() / 1000);
    const { error } = await supabase.from('catalog_sync_state')
      .upsert({ id: 'off-delta', last_delta_ts: now, last_run_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) console.warn(`  (watermerk niet bijgewerkt: ${error.message})`);
  }

  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n\nKlaar in ${secs}s. Regels gezien: ${stats.seen}, bewaard: ${stats.kept}, `
    + `${DRY_RUN ? '(dry-run — niets weggeschreven)' : `ge-upsert: ${stats.written}`}.`);
  console.log('Overgeslagen (per reden):', stats.skip);
}

main().catch((e) => { console.error('\nImport mislukt:', e.message); process.exit(1); });
