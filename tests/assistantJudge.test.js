// Meta-test op de NL-toon-judge (AI-20, plan 28 sessie 1): de pure delen van
// scripts/assistant-judge.mjs — rubric-input-bouw en score-parse. De echte
// judge-call is een netwerk-call (opt-in via `node scripts/assistant-eval.mjs
// --tone`, vergt ORQ_API_KEY) en draait hier bewust niet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TONE_JUDGE_PROMPT, TONE_FEW_SHOTS, buildToneJudgeInput, parseJudgeScore, judgeTone,
} from '../scripts/assistant-judge.mjs';

test('toon-judge: rubric is Nederlands en dekt de vier toon-kaders', () => {
  // De rubric spiegelt het BEKNOPT-/toon-blok van de productie-systemprompt;
  // deze ankers horen erin te blijven staan (herijk anders óók de baseline).
  for (const anker of ['BEKNOPT', 'JE-VORM', 'DATA-OPSOMMING', 'CALLCENTER']) {
    assert.ok(TONE_JUDGE_PROMPT.includes(anker), `rubric mist het anker '${anker}'`);
  }
  assert.ok(TONE_JUDGE_PROMPT.includes('0 tot 100'), 'rubric benoemt de schaal niet');
});

test('toon-judge: drie few-shot-ankers (goed/matig/slecht) met geldige scores', () => {
  assert.equal(TONE_FEW_SHOTS.length, 3);
  const scores = TONE_FEW_SHOTS.map((s) => s.score);
  for (const [i, shot] of TONE_FEW_SHOTS.entries()) {
    assert.ok(typeof shot.answer === 'string' && shot.answer.length > 10, `shot ${i}: antwoord ontbreekt`);
    assert.ok(Number.isInteger(shot.score) && shot.score >= 0 && shot.score <= 100, `shot ${i}: score buiten 0-100`);
  }
  // Goed > matig > slecht — anders kalibreren de ankers niets.
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2], 'few-shots horen aflopend goed → slecht te zijn');
});

test('toon-judge: buildToneJudgeInput = system + 3 few-shot-paren + het te scoren antwoord', () => {
  const input = buildToneJudgeInput('Staat voor je klaar — bevestig hieronder.');
  assert.equal(input.length, 1 + TONE_FEW_SHOTS.length * 2 + 1);
  assert.deepEqual(input[0], { role: 'system', content: TONE_JUDGE_PROMPT });
  for (const [i, shot] of TONE_FEW_SHOTS.entries()) {
    assert.equal(input[1 + i * 2].role, 'user');
    assert.ok(input[1 + i * 2].content.includes(shot.answer), `few-shot ${i}: antwoord niet in de user-turn`);
    assert.deepEqual(input[2 + i * 2], { role: 'assistant', content: String(shot.score) });
  }
  const last = input[input.length - 1];
  assert.equal(last.role, 'user');
  assert.ok(last.content.includes('Staat voor je klaar — bevestig hieronder.'));
});

test('toon-judge: parseJudgeScore pakt het eerste bruikbare getal', () => {
  assert.equal(parseJudgeScore('85'), 85);
  assert.equal(parseJudgeScore('Score: 92.'), 92);
  assert.equal(parseJudgeScore('72/100'), 72);
  // Grenzen van de schaal tellen mee.
  assert.equal(parseJudgeScore('0'), 0);
  assert.equal(parseJudgeScore('100'), 100);
  // Buiten bereik (999) → doorzoeken naar het volgende getal dat wél past.
  assert.equal(parseJudgeScore('999 nee wacht: 40'), 40);
});

test('toon-judge: parseJudgeScore → null bij rommel of ontbreken', () => {
  assert.equal(parseJudgeScore(''), null);
  assert.equal(parseJudgeScore('geen idee'), null);
  assert.equal(parseJudgeScore(undefined), null);
  assert.equal(parseJudgeScore(null), null);
});

test('toon-judge: judgeTone stuurt de rubric-input en parseert de router-respons', async () => {
  let captured = null;
  const fetchImpl = async (url, init) => {
    captured = { url, body: JSON.parse(init.body), headers: init.headers };
    return {
      ok: true,
      json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: '88' }] }] }),
    };
  };
  const score = await judgeTone('Gelukt! Wil je er nog iets bij?', {
    apiKey: 'test-key', metadata: { case: 'x-01' }, fetchImpl,
  });
  assert.equal(score, 88);
  assert.equal(captured.headers.authorization, 'Bearer test-key');
  assert.equal(captured.body.metadata.feature, 'assistant-eval-tone');
  assert.equal(captured.body.metadata.case, 'x-01');
  assert.deepEqual(captured.body.input, buildToneJudgeInput('Gelukt! Wil je er nog iets bij?'));
  assert.equal(captured.body.tools, undefined, 'de judge krijgt géén tools');
});
