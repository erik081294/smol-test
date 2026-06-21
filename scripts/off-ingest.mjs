// Gedeelde streaming-ingest voor de OFF-catalogus: leest een JSONL-bron (al dan niet
// gegzipt) regel-voor-regel, filtert/transformeert per record via lib/offCatalog, en
// roept onBatch(rows) aan per batch. Gebruikt door zowel de volle dump-import als de
// delta-refresh, zodat de filter-/batch-logica op één plek staat (DRY). Géén DB/HTTP
// hier — de aanroeper levert de stream en de schrijf-callback.

import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { transformOffProduct } from '../lib/offCatalog.js';

// Goedkope voorfilter: alleen regels die 'netherlands' bevatten parsen we (de dump is
// globaal). transformOffProduct verifieert daarna de echte countries_tags.
export const NL_PREFILTER = (line) => line.toLowerCase().includes('netherlands');

// source:      leesbare Node-stream (file body, http body, …)
// opts.gunzip  decomprimeer de stream (.gz)
// opts.onBatch async (rows) => void  — upsert of dry-run; per code ontdubbeld
// opts.transformOpts  doorgegeven aan transformOffProduct (requireNL/minCompleteness…)
// opts.preFilter      goedkope regel-filter vóór JSON.parse (default NL_PREFILTER)
// opts.batchSize, opts.limit, opts.onProgress(stats)
export async function ingestJsonl(source, {
  gunzip = false, onBatch, transformOpts = {}, preFilter = NL_PREFILTER,
  batchSize = 1000, limit = Infinity, onProgress = null,
} = {}) {
  const stream = gunzip ? source.pipe(createGunzip()) : source;
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const stats = { seen: 0, kept: 0, written: 0, skip: {} };
  const bump = (r) => { stats.skip[r] = (stats.skip[r] || 0) + 1; };
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    const byCode = new Map(batch.map((r) => [r.code, r])); // dedup binnen de batch
    const rows = [...byCode.values()];
    if (onBatch) await onBatch(rows);
    stats.written += rows.length;
    batch = [];
  };

  for await (const line of rl) {
    if (!line) continue;
    stats.seen++;
    if (preFilter && !preFilter(line)) continue;
    let p;
    try { p = JSON.parse(line); } catch { bump('json-fout'); continue; }
    const out = transformOffProduct(p, transformOpts);
    if (out.skip) { bump(out.skip); continue; }
    batch.push(out.row);
    stats.kept++;
    if (batch.length >= batchSize) { await flush(); if (onProgress) onProgress(stats); }
    if (stats.kept >= limit) break;
  }
  await flush();
  return stats;
}
