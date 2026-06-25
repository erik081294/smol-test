// Houd de OFF-catalogus vers met OFF's DAGELIJKSE DELTA's (incrementeel), i.p.v. telkens
// de volle ~7 GB dump te halen. Dit is de "professionele" sync: een watermerk in de DB
// (catalog_sync_state, migr. 0028), idempotente upserts, gat-detectie (self-heal → volle
// her-import), en resumable (watermerk persist na elk bestand). Bedoeld voor een dagelijkse
// scheduled run (zie .github/workflows/off-catalog-refresh.yml).
//
// Mechaniek: OFF publiceert delta-bestanden (14 dagen bewaard) op
//   https://static.openfoodfacts.org/data/delta/index.txt  (+ /{bestandsnaam})
// met de UNIX-timestamps van de eerste/laatste wijziging in de naam. We passen alleen
// bestanden toe waarvan de laatste wijziging > ons watermerk is, op volgorde, via dezelfde
// filter/transform als de volle import (scripts/off-ingest → lib/offCatalog).
//
// LET OP: delta's bevatten GEEN verwijderingen. Draai daarom periodiek (binnen 14 dagen)
// scripts/import-off-dump.mjs voor een volle reconciliatie (zet ook het watermerk).
//
// Env: SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL. Optioneel: DRY_RUN=1,
//   WATERMARK (alleen in DRY_RUN, default 0), LOCAL_DELTA_DIR (lees index+bestanden lokaal,
//   voor tests), BATCH, MIN_COMPLETENESS.

import { readFileSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ingestJsonl } from './off-ingest.mjs';
import { parseDeltaIndex, selectNewDeltas } from '../lib/offDelta.js';

const DELTA_BASE = 'https://static.openfoodfacts.org/data/delta';
const UA = 'Huishoek/1.0 (catalog delta sync; reuse@huishoek)';
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
const LOCAL = env.LOCAL_DELTA_DIR || null;
const BATCH = Math.max(1, Number(env.BATCH || 1000));
const MIN_COMPLETENESS = Number(env.MIN_COMPLETENESS || 0);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('Ontbrekend: EXPO_PUBLIC_SUPABASE_URL en/of SUPABASE_SERVICE_ROLE_KEY (zet ze in .env of als CI-secret).');
  process.exit(1);
}
const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function readIndex() {
  if (LOCAL) return readFileSync(join(LOCAL, 'index.txt'), 'utf8');
  const res = await fetch(`${DELTA_BASE}/index.txt`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`index ${res.status}`);
  return res.text();
}

// SSRF/pad-traversal-gordel (SEC-7/L3): de bestandsnamen komen uit OFF's externe
// index.txt. Sta alleen platte, simpele namen toe — geen schuine strepen, geen
// '..', geen schema/host — zodat een vervuilde index nooit een willekeurige URL of
// lokaal pad kan bereiken.
function assertSafeDeltaName(filename) {
  if (typeof filename !== 'string' || !/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    throw new Error(`onveilige deltabestandsnaam geweigerd: ${JSON.stringify(filename)}`);
  }
  return filename;
}

async function openDelta(filename) {
  assertSafeDeltaName(filename);
  if (LOCAL) return createReadStream(join(LOCAL, filename));
  const res = await fetch(`${DELTA_BASE}/${filename}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${filename} ${res.status}`);
  return Readable.fromWeb(res.body);
}

async function getWatermark() {
  if (DRY_RUN) return Number(env.WATERMARK || 0);
  const { data, error } = await supabase.from('catalog_sync_state').select('last_delta_ts').eq('id', 'off-delta').single();
  if (error) throw new Error(error.message);
  return Number(data?.last_delta_ts || 0);
}

async function setWatermark(ts, files) {
  if (DRY_RUN) return;
  const { error } = await supabase.from('catalog_sync_state')
    .upsert({ id: 'off-delta', last_delta_ts: ts, last_run_at: new Date().toISOString(), last_applied_files: files, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

async function upsertBatch(rows) {
  if (!rows.length || DRY_RUN) return;
  const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('catalog_products').upsert(stamped, { onConflict: 'code' });
  if (error) throw new Error(error.message);
}

async function main() {
  const watermark = await getWatermark();
  const { pending, gap, total } = selectNewDeltas(parseDeltaIndex(await readIndex()), watermark);
  console.log(`Delta-index: ${total} bestand(en); watermerk ${watermark}; ${pending.length} nieuw toe te passen${DRY_RUN ? '  (DRY RUN)' : ''}.`);

  if (gap) {
    console.warn('\n⚠️  GAT: het watermerk valt vóór de oudste beschikbare delta (14-daags venster overschreden).');
    console.warn('    Ontbrekende wijzigingen (incl. verwijderingen) worden niet door delta\'s gedekt.');
    console.warn('    Draai scripts/import-off-dump.mjs voor een volle her-import om bij te trekken.\n');
  }
  if (!pending.length) { console.log('Niets te doen — catalogus is bij.'); return; }

  const totals = { seen: 0, kept: 0, written: 0, skip: {} };
  let applied = 0;
  for (const d of pending) {
    process.stdout.write(`  ${d.filename}… `);
    const stream = await openDelta(d.filename);
    const s = await ingestJsonl(stream, {
      gunzip: /\.gz$/i.test(d.filename), onBatch: upsertBatch,
      transformOpts: { minCompleteness: MIN_COMPLETENESS }, batchSize: BATCH,
    });
    totals.seen += s.seen; totals.kept += s.kept; totals.written += s.written;
    for (const [k, v] of Object.entries(s.skip)) totals.skip[k] = (totals.skip[k] || 0) + v;
    applied++;
    await setWatermark(d.to, applied); // persist na elk bestand → resumable
    console.log(`bewaard ${s.kept}`);
  }

  console.log(`\nKlaar. ${applied} delta('s) toegepast, ${totals.kept} producten ${DRY_RUN ? 'zou-upserten (dry-run)' : 'geüpsert'}. `
    + `Nieuw watermerk: ${pending[pending.length - 1].to}.`);
  console.log('Overgeslagen (per reden):', totals.skip);
}

main().catch((e) => { console.error('\nDelta-refresh mislukt:', e.message); process.exit(1); });
