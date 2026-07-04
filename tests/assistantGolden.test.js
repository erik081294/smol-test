// Meta-test op de golden-set (AI-3): bewaakt dat tests/assistant-golden.json
// structureel gezond blijft én synchroon loopt met de echte tool-registry —
// een case die een niet-bestaande tool of parameter verwacht is een stille
// eval-leugen. Draait in de gewone suite (geen LLM-calls; de LLM-run is
// scripts/assistant-eval.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSISTANT_TOOLS } from '../supabase/functions/_shared/assistantTools.js';

const golden = JSON.parse(readFileSync(new URL('./assistant-golden.json', import.meta.url), 'utf8'));
const TOOL_BY_NAME = Object.fromEntries(ASSISTANT_TOOLS.map((t) => [t.name, t]));

test('golden-set: versie en unieke case-ids', () => {
  assert.equal(golden.v, 1);
  assert.ok(Array.isArray(golden.cases) && golden.cases.length >= 25, 'te weinig cases');
  const ids = golden.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'dubbele case-id');
});

test('golden-set: elke case heeft een vraag en een expect.tools-array', () => {
  for (const c of golden.cases) {
    assert.ok(typeof c.question === 'string' && c.question.length > 3, `${c.id}: vraag ontbreekt`);
    assert.ok(Array.isArray(c.expect?.tools), `${c.id}: expect.tools ontbreekt`);
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
