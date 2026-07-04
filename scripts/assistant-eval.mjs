// Eval-gate van de assistent (AI-3, plan 24 ronde B; guidelines §6).
//
// Draait de golden-set (tests/assistant-golden.json) tegen de Orq v3-router met
// exact de productie-prompt en -tool-schema's (beide geïmporteerd — geen kopieën),
// en meet de EERSTE-BEURT tool-keuze:
//   - tool-selectie-F1 (set-based, per case precision/recall over toolnamen);
//   - args-subset-match (alleen de in de golden-case genoemde args tellen);
//   - no-tool-accuracy (de irrelevance-bucket: cases waar níks mag vuren).
//
// Gebruik:
//   node scripts/assistant-eval.mjs                    # run + vergelijk met baseline
//   node scripts/assistant-eval.mjs --update-baseline  # herijk assistant-eval-baseline.json
//   node scripts/assistant-eval.mjs --model=zai/glm-5.2  # ander model (experiment)
//
// Vereist ORQ_API_KEY (uit .env). Kosten: ~30 korte calls (~$0,15 met sonnet-5).
// Traces landen in Orq onder thread-tag 'eval' (metadata feature=assistant-eval),
// zodat eval-verkeer nooit met productie-verkeer vermengd raakt.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SYSTEM_PROMPT, SUGGEST_TOOL, splitSuggestions, toResponsesTools, parseResponsesOutput } from '../supabase/functions/assistant/core.js';
import { ASSISTANT_TOOLS } from '../supabase/functions/_shared/assistantTools.js';

const ROUTER_URL = 'https://api.orq.ai/v3/router/responses';
const BASELINE_PATH = 'assistant-eval-baseline.json';
const TOLERANCE_PP = 2; // procentpunt speling, zelfde filosofie als de mutatie-ratchet
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const isUpdate = args.includes('--update-baseline');
const model = args.find((a) => a.startsWith('--model='))?.slice(8) ?? 'google/eu.claude-sonnet-5';

// .env-parse (geen dotenv-dep): alleen ORQ_API_KEY nodig.
function readApiKey() {
  if (process.env.ORQ_API_KEY) return process.env.ORQ_API_KEY;
  try {
    const line = readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('ORQ_API_KEY='));
    if (line) return line.slice('ORQ_API_KEY='.length).trim();
  } catch { /* geen .env */ }
  return null;
}

const API_KEY = readApiKey();
if (!API_KEY) {
  console.error('✗ ORQ_API_KEY ontbreekt (zet in .env of env).');
  process.exit(1);
}

const golden = JSON.parse(readFileSync('tests/assistant-golden.json', 'utf8'));
// Zelfde tool-aanbod als productie, inclusief de suggest_replies-pseudo-tool;
// de scoring filtert die er weer uit (splitSuggestions) — net als de edge-loop.
const tools = [...toResponsesTools(ASSISTANT_TOOLS), SUGGEST_TOOL];
const runId = `eval-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;

async function runCase(c) {
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nVandaag is 2026-07-04. Leden van het huishouden: Erik, Sam. Actieve modules: taken, boodschappen, kosten, voorraad.` },
        { role: 'user', content: c.question },
      ],
      max_output_tokens: 400,
      tools,
      thread: { id: runId, tags: ['eval'] },
      metadata: { feature: 'assistant-eval', case: c.id },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseResponsesOutput(await res.json());
}

// Set-based precision/recall/F1 over toolnamen; args tellen als subset-match op de
// golden-args (extra model-args zijn oké — de golden-case noemt alleen wat ertoe doet).
function scoreCase(c, parsed) {
  const { calls } = splitSuggestions(parsed.toolCalls);
  const got = calls.map((t) => t.name);
  const want = c.expect.tools.map((t) => t.name);
  const gotSet = new Set(got);
  const wantSet = new Set(want);
  if (want.length === 0) {
    return { f1: got.length === 0 ? 1 : 0, argsOk: true, got, noToolCase: true };
  }
  const hit = [...wantSet].filter((n) => gotSet.has(n)).length;
  const precision = got.length === 0 ? 0 : hit / gotSet.size;
  const recall = hit / wantSet.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  let argsOk = true;
  for (const wt of c.expect.tools) {
    if (!wt.args) continue;
    const call = parsed.toolCalls.find((t) => t.name === wt.name);
    if (!call) { argsOk = false; continue; }
    for (const [k, v] of Object.entries(wt.args)) {
      if (JSON.stringify(call.args[k]) !== JSON.stringify(v)) argsOk = false;
    }
  }
  return { f1, argsOk, got, noToolCase: false };
}

async function main() {
  console.log(`Assistent-eval: ${golden.cases.length} cases · model ${model} · run ${runId}\n`);
  const results = [];
  const queue = [...golden.cases];
  async function worker() {
    while (queue.length > 0) {
      const c = queue.shift();
      try {
        const parsed = await runCase(c);
        const score = scoreCase(c, parsed);
        results.push({ id: c.id, question: c.question, ...score });
        if (score.f1 < 1 || !score.argsOk) {
          console.log(`  ✗ ${c.id}: kreeg [${score.got.join(', ') || 'geen'}], verwachtte [${c.expect.tools.map((t) => t.name).join(', ') || 'geen'}]${score.argsOk ? '' : ' (args mismatch)'}`);
        }
      } catch (e) {
        results.push({ id: c.id, question: c.question, f1: 0, argsOk: false, got: [], error: String(e).slice(0, 150) });
        console.log(`  ✗ ${c.id}: FOUT ${String(e).slice(0, 120)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const toolCases = results.filter((r) => !r.noToolCase);
  const noToolCases = results.filter((r) => r.noToolCase);
  const meanF1 = toolCases.reduce((s, r) => s + r.f1, 0) / Math.max(1, toolCases.length);
  const argsAcc = toolCases.filter((r) => r.argsOk).length / Math.max(1, toolCases.length);
  const noToolAcc = noToolCases.reduce((s, r) => s + r.f1, 0) / Math.max(1, noToolCases.length);
  const summary = {
    model,
    cases: results.length,
    toolF1: Number((meanF1 * 100).toFixed(1)),
    argsAccuracy: Number((argsAcc * 100).toFixed(1)),
    noToolAccuracy: Number((noToolAcc * 100).toFixed(1)),
  };
  console.log(`\ntool-F1 ${summary.toolF1}% · args ${summary.argsAccuracy}% · geen-tool ${summary.noToolAccuracy}% (${results.length} cases)`);

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/assistant-eval.json', `${JSON.stringify({ runId, summary, results }, null, 2)}\n`);
  console.log('Rapport: reports/assistant-eval.json');

  if (isUpdate) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Baseline geschreven naar ${BASELINE_PATH}.`);
    return;
  }
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.log(`\n(geen ${BASELINE_PATH} — draai met --update-baseline om 'm vast te leggen)`);
    return;
  }
  const checks = [
    ['toolF1', summary.toolF1, baseline.toolF1],
    ['argsAccuracy', summary.argsAccuracy, baseline.argsAccuracy],
    ['noToolAccuracy', summary.noToolAccuracy, baseline.noToolAccuracy],
  ];
  const failures = checks.filter(([, now, base]) => now < base - TOLERANCE_PP);
  if (failures.length > 0) {
    for (const [name, now, base] of failures) console.error(`✗ ${name}: ${now}% < baseline ${base}% − ${TOLERANCE_PP}pp`);
    process.exit(1);
  }
  console.log('✓ Geen regressie t.o.v. de baseline. Eval-gate groen.');
}

main().catch((e) => { console.error(e); process.exit(1); });
