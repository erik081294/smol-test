// Eval-gate van de assistent (AI-3, plan 24 ronde B; guidelines §6 — uitgebreid in AI-20).
//
// Draait de golden-set (tests/assistant-golden.json) tegen de Orq v3-router met
// exact de productie-prompt en -tool-schema's (beide geïmporteerd — geen kopieën),
// en meet de tool-keuze van de TE SCOREN beurt:
//   - tool-selectie-F1 (set-based, per case precision/recall over toolnamen);
//   - args-subset-match (alleen de in de golden-case genoemde args tellen);
//   - no-tool-accuracy (de irrelevance-bucket: cases waar níks mag vuren);
//   - optioneel (--tone) een NL-toon-judge over de tekstantwoorden (scripts/assistant-judge.mjs).
//
// Multi-turn (AI-20): een case mag i.p.v. `question` een `turns`-array dragen —
// eerdere beurten als {role:'user'|'assistant', content} (alleen tekst; echte
// function-call-items mocken is fragiel en drift-gevoelig). De laatste entry is
// de te scoren beurt-input en is altijd een user-turn. Een user-turn mag i.p.v.
// `content` een `follow_up_rows`-array dragen: de opgeslagen action-rijen waaruit
// de PRODUCTIE-bouwer actionFollowUpMessage (assistant/core.js) de synthetische
// vervolg-nota genereert — zo test de case exact de nota die de server bouwt en
// kan hij er nooit van driften. De history gaat door dezelfde clampHistory als
// de edge-loop.
//
// Gebruik:
//   node scripts/assistant-eval.mjs                    # run + vergelijk met baseline
//   node scripts/assistant-eval.mjs --dry-run          # geen API-calls: valideer dat elke
//                                                      #   case (incl. multi-turn) correct
//                                                      #   tot model-input samenstelt
//   node scripts/assistant-eval.mjs --tone             # + NL-toon-judge (LLM-as-judge)
//   node scripts/assistant-eval.mjs --update-baseline  # herijk assistant-eval-baseline.json
//   node scripts/assistant-eval.mjs --model=zai/glm-5.2  # ander model (experiment)
//
// Vereist ORQ_API_KEY (uit .env), behalve bij --dry-run. Kosten: ~35 korte calls
// (~$0,15 met sonnet-5; --tone verdubbelt dat ruwweg). Traces landen in Orq onder
// thread-tag 'eval' (metadata feature=assistant-eval), zodat eval-verkeer nooit
// met productie-verkeer vermengd raakt.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  SYSTEM_PROMPT, SUGGEST_TOOL, splitSuggestions, toResponsesTools, parseResponsesOutput,
  buildContextSnapshot, clampHistory, actionFollowUpMessage,
} from '../supabase/functions/assistant/core.js';
import { ASSISTANT_TOOLS, MODULE_BRIEFS } from '../supabase/functions/_shared/tools/index.js';
import { judgeTone } from './assistant-judge.mjs';

const ROUTER_URL = 'https://api.orq.ai/v3/router/responses';
const BASELINE_PATH = 'assistant-eval-baseline.json';
const TOLERANCE_PP = 2; // procentpunt speling, zelfde filosofie als de mutatie-ratchet
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const isUpdate = args.includes('--update-baseline');
const isDryRun = args.includes('--dry-run');
// NL-toon-judge is OPT-IN (--tone) zolang er geen gekalibreerde toon-baseline is:
// de baseline herijken vergt een live run met ORQ_API_KEY (open stap AI-20) —
// pas daarna kan de toon-score als harde ratchet mee-gaten. Tot die tijd draait
// de gate zonder judge en is --tone het meetinstrument om die baseline te leggen
// (--tone --update-baseline schrijft 'm dan mee).
const useTone = args.includes('--tone');
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

const golden = JSON.parse(readFileSync(new URL('../tests/assistant-golden.json', import.meta.url), 'utf8'));
// Zelfde tool-aanbod als productie, inclusief de suggest_replies-pseudo-tool;
// de scoring filtert die er weer uit (splitSuggestions) — net als de edge-loop.
const tools = [...toResponsesTools(ASSISTANT_TOOLS), SUGGEST_TOOL];
const runId = `eval-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;

// Snapshot via de ECHTE bouwer + briefs (AI-10): de eval test exact de context
// die productie meestuurt — geen handgetypte kopie die kan driften.
const SNAPSHOT = buildContextSnapshot({
  today: '2026-07-04',
  memberNames: ['Erik', 'Sam'],
  moduleBriefs: Object.keys(MODULE_BRIEFS).map((k) => MODULE_BRIEFS[k]),
});

/**
 * Eén golden-turn → { role, content }. Een user-turn met `follow_up_rows`
 * (i.p.v. `content`) krijgt zijn tekst van de PRODUCTIE-bouwer
 * actionFollowUpMessage — exact de synthetische nota die de server na een
 * bevestigde actie als user-beurt insturen zou (AI-18/AI-20, geen drift).
 */
export function materializeTurn(turn) {
  if (turn && Array.isArray(turn.follow_up_rows)) {
    return { role: turn.role, content: actionFollowUpMessage(turn.follow_up_rows) };
  }
  return { role: turn?.role, content: turn?.content };
}

/**
 * Golden-case → de user/assistant-berichten voor de model-input (zonder system).
 * Single-turn: alleen de vraag. Multi-turn: de eerdere beurten door dezelfde
 * clampHistory als de edge-loop, met de laatste (user-)turn als de te scoren
 * beurt-input — [system, ...clampHistory(history), user].
 */
export function buildCaseMessages(c) {
  if (Array.isArray(c.turns) && c.turns.length > 0) {
    const turns = c.turns.map(materializeTurn);
    const last = turns[turns.length - 1];
    return [...clampHistory(turns.slice(0, -1)), { role: 'user', content: last.content }];
  }
  return [{ role: 'user', content: c.question }];
}

/** Korte weergavenaam van een case (logging/rapport): de te scoren user-turn. */
export function caseQuestion(c) {
  const messages = buildCaseMessages(c);
  const content = messages[messages.length - 1]?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Droge-run-validatie van één case: stelt de input samen zonder API-call en
 * meldt alles wat het Responses-API-contract zou breken (lege content, rare
 * rol, laatste beurt geen user-turn). Lege lijst = gezond.
 */
export function validateCaseInput(c) {
  const problems = [];
  const messages = buildCaseMessages(c);
  if (messages.length === 0) problems.push('geen berichten');
  for (const [i, m] of messages.entries()) {
    if (m.role !== 'user' && m.role !== 'assistant') problems.push(`bericht ${i}: rol '${m.role}' hoort user/assistant te zijn`);
    if (typeof m.content !== 'string' || m.content.trim().length === 0) problems.push(`bericht ${i}: lege of niet-string content`);
  }
  if (messages.length > 0 && messages[messages.length - 1].role !== 'user') {
    problems.push('laatste bericht is geen user-turn (de te scoren beurt-input)');
  }
  if (Array.isArray(c.turns) && c.turns[c.turns.length - 1]?.role !== 'user') {
    problems.push('laatste turn in de golden-case is geen user-turn');
  }
  return problems;
}

async function runCase(c, apiKey) {
  const res = await fetch(ROUTER_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${SNAPSHOT}` },
        ...buildCaseMessages(c),
      ],
      // Zelfde budget als productie (index.ts MAX_OUTPUT_TOKENS): Sonnet-5's
      // reasoning-blok kan bij datum-rekenwerk 400 tokens opeten vóór de
      // tool-call — dan meet de eval een harnas-artefact, geen modelgedrag.
      max_output_tokens: 1500,
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

// Droge run (AI-20): alle cases door de input-bouw halen zonder één API-call —
// bewijst dat elke (multi-turn-)case correct samenstelt vóór de dure live gate.
function dryRun() {
  const multi = golden.cases.filter((c) => Array.isArray(c.turns));
  let bad = 0;
  for (const c of golden.cases) {
    const problems = validateCaseInput(c);
    if (problems.length > 0) {
      bad += 1;
      console.log(`  ✗ ${c.id}: ${problems.join('; ')}`);
    }
  }
  for (const c of multi) {
    const n = buildCaseMessages(c).length;
    console.log(`  ✓ ${c.id}: ${c.turns.length} turns → ${n} berichten, te scoren beurt: "${caseQuestion(c).slice(0, 80)}"`);
  }
  console.log(`\nDroge run: ${golden.cases.length} cases (${multi.length} multi-turn) · ${bad === 0 ? '✓ alle inputs stellen correct samen' : `✗ ${bad} case(s) kapot`}`);
  process.exit(bad === 0 ? 0 : 1);
}

async function main() {
  if (isDryRun) return dryRun();

  const apiKey = readApiKey();
  if (!apiKey) {
    console.error('✗ ORQ_API_KEY ontbreekt (zet in .env of env). Zonder key kan alleen --dry-run.');
    process.exit(1);
  }

  console.log(`Assistent-eval: ${golden.cases.length} cases · model ${model} · run ${runId}${useTone ? ' · +toon-judge' : ''}\n`);
  const results = [];
  const queue = [...golden.cases];
  async function worker() {
    while (queue.length > 0) {
      const c = queue.shift();
      try {
        const parsed = await runCase(c, apiKey);
        const score = scoreCase(c, parsed);
        const result = { id: c.id, question: caseQuestion(c), ...score };
        // NL-toon-judge (opt-in): tweede model-call over het tekstantwoord.
        // Een judge-fout laat de case niet falen (tone blijft dan null) — de
        // toon-score is een gemiddelde over de wél gescoorde antwoorden.
        if (useTone && typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
          result.answer = parsed.text;
          try {
            result.tone = await judgeTone(parsed.text, { apiKey, routerUrl: ROUTER_URL, metadata: { case: c.id } });
          } catch (e) {
            result.tone = null;
            console.log(`  ⚠ ${c.id}: toon-judge faalde (${String(e).slice(0, 100)})`);
          }
        }
        results.push(result);
        if (score.f1 < 1 || !score.argsOk) {
          console.log(`  ✗ ${c.id}: kreeg [${score.got.join(', ') || 'geen'}], verwachtte [${c.expect.tools.map((t) => t.name).join(', ') || 'geen'}]${score.argsOk ? '' : ' (args mismatch)'}`);
        }
      } catch (e) {
        results.push({ id: c.id, question: caseQuestion(c), f1: 0, argsOk: false, got: [], error: String(e).slice(0, 150) });
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
  if (useTone) {
    const toned = results.filter((r) => typeof r.tone === 'number');
    summary.toneScore = toned.length > 0
      ? Number((toned.reduce((s, r) => s + r.tone, 0) / toned.length).toFixed(1))
      : null;
  }
  console.log(`\ntool-F1 ${summary.toolF1}% · args ${summary.argsAccuracy}% · geen-tool ${summary.noToolAccuracy}%${useTone ? ` · toon ${summary.toneScore ?? '—'}` : ''} (${results.length} cases)`);

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
  // toneScore ratchet alleen mee als de baseline 'm al draagt (na de eerste
  // gekalibreerde --tone --update-baseline-run) én deze run 'm mat — anders
  // zou een run zonder --tone tegen een toon-baseline vals alarm slaan.
  if (typeof summary.toneScore === 'number' && typeof baseline.toneScore === 'number') {
    checks.push(['toneScore', summary.toneScore, baseline.toneScore]);
  }
  const failures = checks.filter(([, now, base]) => now < base - TOLERANCE_PP);
  if (failures.length > 0) {
    for (const [name, now, base] of failures) console.error(`✗ ${name}: ${now}% < baseline ${base}% − ${TOLERANCE_PP}pp`);
    process.exit(1);
  }
  console.log('✓ Geen regressie t.o.v. de baseline. Eval-gate groen.');
}

// Alleen draaien als het script direct wordt aangeroepen — de meta-tests
// (tests/assistantGolden.test.js) importeren de input-bouwers hierboven.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
