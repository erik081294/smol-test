// Meta-test op de golden-set (AI-3, multi-turn in AI-20): bewaakt dat
// tests/assistant-golden.json structureel gezond blijft én synchroon loopt met
// de echte tool-registry — een case die een niet-bestaande tool of parameter
// verwacht is een stille eval-leugen. Draait in de gewone suite (geen
// LLM-calls; de LLM-run is scripts/assistant-eval.mjs, de samenstel-check
// zonder API is `node scripts/assistant-eval.mjs --dry-run`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSISTANT_TOOLS } from '../supabase/functions/_shared/tools/index.js';
import { actionFollowUpMessage } from '../supabase/functions/assistant/core.js';
import { materializeTurn, buildCaseMessages, validateCaseInput } from '../scripts/assistant-eval.mjs';

const golden = JSON.parse(readFileSync(new URL('./assistant-golden.json', import.meta.url), 'utf8'));
const TOOL_BY_NAME = Object.fromEntries(ASSISTANT_TOOLS.map((t) => [t.name, t]));
const TURN_ROLES = new Set(['user', 'assistant']);

test('golden-set: versie en unieke case-ids', () => {
  assert.equal(golden.v, 1);
  assert.ok(Array.isArray(golden.cases) && golden.cases.length >= 25, 'te weinig cases');
  const ids = golden.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'dubbele case-id');
});

test('golden-set: elke case heeft een vraag óf turns, en een expect.tools-array', () => {
  for (const c of golden.cases) {
    const hasQuestion = typeof c.question === 'string' && c.question.length > 3;
    const hasTurns = Array.isArray(c.turns);
    // Precies één van beide: `question` (single-turn) of `turns` (multi-turn) —
    // beide zou dubbelzinnig maken welke tekst de te scoren beurt is.
    assert.ok(hasQuestion !== hasTurns, `${c.id}: precies één van question/turns verwacht`);
    assert.ok(Array.isArray(c.expect?.tools), `${c.id}: expect.tools ontbreekt`);
  }
});

test('golden-set: turns dragen geldige rollen en eindigen op de te scoren user-beurt', () => {
  for (const c of golden.cases) {
    if (!Array.isArray(c.turns)) continue;
    assert.ok(c.turns.length >= 2, `${c.id}: een multi-turn-case heeft minstens 2 turns (anders is 't een question-case)`);
    for (const [i, turn] of c.turns.entries()) {
      assert.ok(TURN_ROLES.has(turn.role), `${c.id} turn ${i}: rol '${turn.role}' hoort user/assistant te zijn`);
      const hasContent = typeof turn.content === 'string' && turn.content.trim().length > 0;
      const hasRows = Array.isArray(turn.follow_up_rows);
      assert.ok(hasContent !== hasRows, `${c.id} turn ${i}: precies één van content/follow_up_rows verwacht`);
      if (hasRows) {
        // De vervolg-nota is per contract een user-beurt (de server stuurt 'm
        // als synthetische gebruikersbeurt in, AI-18) en moet via de ECHTE
        // productie-bouwer een niet-lege tekst opleveren.
        assert.equal(turn.role, 'user', `${c.id} turn ${i}: follow_up_rows hoort op een user-turn`);
        const text = actionFollowUpMessage(turn.follow_up_rows);
        assert.ok(text.length > 0, `${c.id} turn ${i}: follow_up_rows levert geen nota op (status 'done' + summary verplicht)`);
        assert.equal(materializeTurn(turn).content, text, `${c.id} turn ${i}: materializeTurn wijkt af van actionFollowUpMessage`);
      }
    }
    assert.equal(c.turns[c.turns.length - 1].role, 'user', `${c.id}: de laatste turn is de te scoren beurt-input en hoort een user-turn te zijn`);
  }
});

test('golden-set: multi-turn-dekking — confirm-opvolging én choice-opvolging aanwezig', () => {
  const multi = golden.cases.filter((c) => Array.isArray(c.turns));
  assert.ok(multi.length >= 4, `minstens 4 multi-turn-cases (AI-20), nu ${multi.length}`);
  const followUps = multi.filter((c) => c.turns.some((t) => Array.isArray(t.follow_up_rows)));
  assert.ok(followUps.length >= 2, 'minstens 2 confirm-vervolg-cases (follow_up_rows)');
  // De confirm-opvolging bevestigt alleen — er mag géén tool vuren.
  for (const c of followUps) {
    assert.equal(c.expect.tools.length, 0, `${c.id}: vervolg-beurt na confirm verwacht expect.tools=[]`);
  }
  const choices = multi.filter((c) => !c.turns.some((t) => Array.isArray(t.follow_up_rows)));
  assert.ok(choices.length >= 2, 'minstens 2 choice-reply-vervolg-cases');
});

test('golden-set: elke case stelt correct samen tot model-input (droge run)', () => {
  for (const c of golden.cases) {
    const problems = validateCaseInput(c);
    assert.deepEqual(problems, [], `${c.id}: ${problems.join('; ')}`);
    const messages = buildCaseMessages(c);
    const expected = Array.isArray(c.turns) ? c.turns.length : 1;
    assert.equal(messages.length, expected, `${c.id}: verwacht ${expected} berichten in de input`);
  }
});

test('golden-set: verwachte tools bestaan in de registry en args passen op het schema', () => {
  for (const c of golden.cases) {
    for (const t of c.expect.tools) {
      const tool = TOOL_BY_NAME[t.name];
      assert.ok(tool, `${c.id}: onbekende tool ${t.name}`);
      for (const key of Object.keys(t.args ?? {})) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(tool.parameters.properties, key),
          `${c.id}: arg '${key}' bestaat niet op ${t.name}`
        );
      }
    }
  }
});

test('golden-set: de irrelevance-bucket ("geen tool") is aanwezig en substantieel', () => {
  const none = golden.cases.filter((c) => c.expect.tools.length === 0);
  assert.ok(none.length >= 6, 'minstens 6 geen-tool-cases (guidelines §6 / eval-methodiek)');
});

test('golden-set: elke registry-tool wordt door minstens 2 cases gedekt', () => {
  for (const tool of ASSISTANT_TOOLS) {
    const n = golden.cases.filter((c) => c.expect.tools.some((t) => t.name === tool.name)).length;
    assert.ok(n >= 2, `${tool.name} heeft maar ${n} golden-case(s)`);
  }
});
