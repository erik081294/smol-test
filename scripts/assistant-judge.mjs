// NL-toon-judge van de assistent-eval (AI-20, plan 28 sessie 1): LLM-as-judge
// over de TEKST-antwoorden van de golden-run. Eén gekalibreerde rubric (uit de
// systemprompt-toonkaders van assistant/core.js) + drie few-shot-ankers →
// score 0-100 per antwoord; de runner (scripts/assistant-eval.mjs) middelt dat
// tot `toneScore` in de summary.
//
// OPT-IN via `--tone` op de runner zolang er geen gekalibreerde toon-baseline in
// assistant-eval-baseline.json ligt — de eerste live `--tone --update-baseline`-run
// (vergt ORQ_API_KEY) legt die vast; daarna ratchet toneScore mee met dezelfde
// 2pp-tolerantie als de tool-metrics.
//
// Pure delen (rubric, input-bouw, score-parse) zijn geëxporteerd en meta-getest
// (tests/assistantGolden.test.js); alleen judgeTone doet een netwerk-call.
import { parseResponsesOutput } from '../supabase/functions/assistant/core.js';

export const JUDGE_MODEL = 'google/eu.claude-sonnet-5';
const DEFAULT_ROUTER_URL = 'https://api.orq.ai/v3/router/responses';

// De rubric spiegelt het BEKNOPT-/toon-blok van de productie-systemprompt
// (assistant/core.js): wijzigt dat kader, herijk dan ook deze rubric + de baseline.
export const TONE_JUDGE_PROMPT = `Je beoordeelt antwoorden van de Huishoek Assistent: een warme huisgenoot in een Nederlandse huishoud-app. De app toont data al als kaart náást het antwoord; de tekst hoeft alleen de kern te dragen.

Geef één score van 0 tot 100 voor de toon en vorm van het antwoord, langs deze rubric:
- BEKNOPT (40 punten): 1 tot 3 korte zinnen. Elke extra zin of uitweiding kost punten.
- WARM & JE-VORM (25 punten): natuurlijk Nederlands, je/jullie-vorm, als een huisgenoot. U-vorm of stijve schrijftaal kost zwaar.
- GEEN DATA-OPSOMMING (20 punten): geen lijstjes of opgesomde gegevens in lopende tekst — alleen de kern (een aantal, het belangrijkste item, wat opvalt).
- GEEN CALLCENTER-TAAL (15 punten): geen "uw verzoek is verwerkt", "aarzel niet om", "wij staan voor u klaar", overdreven excuses of joligheid.

Richtpunten: 90-100 = voorbeeldig; 60-89 = bruikbaar maar met duidelijke smetten; 30-59 = matig (meerdere rubric-punten geschonden); 0-29 = slecht (leest als callcenter of datadump).

Antwoord met UITSLUITEND het gehele getal, zonder toelichting.`;

// Drie ankers (goed / matig / slecht) — als few-shot user/assistant-paren
// meegestuurd zodat de judge stabiel op dezelfde schaal scoort.
export const TONE_FEW_SHOTS = [
  {
    // Goed: kort, warm, je-vorm, alleen de kern — de kaart toont de rest.
    answer: 'Jullie hebben nog drie open taken; de badkamer ligt het langst te wachten. Zal ik er eentje voor je inplannen?',
    score: 95,
  },
  {
    // Matig: wel vriendelijk en je-vorm, maar somt de data op in lopende tekst
    // en is te lang (schendt BEKNOPT + GEEN DATA-OPSOMMING).
    answer: 'Er staan op dit moment drie taken open: stofzuigen in de woonkamer, de afwas van gisteren en de was opvouwen. Stofzuigen staat op naam van Erik, de afwas op naam van Sam, en de was is nog niet toegewezen. Verder is er deze week niets achterstallig.',
    score: 45,
  },
  {
    // Slecht: callcenter-taal, u-vorm, opsomming én veel te lang.
    answer: 'Geachte gebruiker, uw verzoek is succesvol verwerkt. Hieronder treft u een volledig overzicht aan van alle openstaande taken binnen uw huishouden: 1) stofzuigen, 2) afwassen, 3) was opvouwen. Mocht u nog verdere vragen hebben, aarzelt u dan vooral niet om opnieuw contact met mij op te nemen. Ik sta altijd voor u klaar!',
    score: 8,
  },
];

const wrap = (answer) => `Beoordeel dit assistent-antwoord:\n\n${answer}`;

/**
 * Bouw de Responses-API-input van één judge-call: rubric-system, de drie
 * few-shot-ankers als user/assistant-paren en het te beoordelen antwoord.
 * @param {string} answer
 * @returns {Array<{role:string, content:string}>}
 */
export function buildToneJudgeInput(answer) {
  const input = [{ role: 'system', content: TONE_JUDGE_PROMPT }];
  for (const shot of TONE_FEW_SHOTS) {
    input.push({ role: 'user', content: wrap(shot.answer) });
    input.push({ role: 'assistant', content: String(shot.score) });
  }
  input.push({ role: 'user', content: wrap(typeof answer === 'string' ? answer : '') });
  return input;
}

/**
 * Trek de 0-100-score uit de judge-tekst. Pakt het eerste getal dat in het
 * bereik valt ("Score: 85" en "85/100" werken dus ook); niets bruikbaars → null.
 * @param {string} text
 * @returns {number|null}
 */
export function parseJudgeScore(text) {
  if (typeof text !== 'string') return null;
  for (const m of text.matchAll(/\d{1,3}/g)) {
    const n = Number(m[0]);
    if (n >= 0 && n <= 100) return n;
  }
  return null;
}

/**
 * Eén judge-call over één tekstantwoord → score 0-100 (of null als de judge
 * geen bruikbaar getal teruggaf). Traces landen — net als de eval zelf — onder
 * feature-metadata, gescheiden van productie-verkeer.
 * @param {string} answer
 * @param {{ apiKey: string, model?: string, routerUrl?: string,
 *           metadata?: Record<string,string>, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<number|null>}
 */
export async function judgeTone(answer, { apiKey, model = JUDGE_MODEL, routerUrl = DEFAULT_ROUTER_URL, metadata = {}, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(routerUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input: buildToneJudgeInput(answer),
      // Ruimte voor een eventueel reasoning-blok vóór het kale getal.
      max_output_tokens: 500,
      thread: { tags: ['eval'] },
      metadata: { feature: 'assistant-eval-tone', ...metadata },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseJudgeScore(parseResponsesOutput(await res.json()).text);
}
