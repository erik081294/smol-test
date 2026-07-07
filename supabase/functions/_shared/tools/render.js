// @ts-check
// Gedeeld gen-UI-vocabulaire voor de assistent-tool-packs (AI-16 ronde 2, plan 26).
//
// Eén constructor per interactief node-type: een pack componeert zijn UI in een
// paar regels en krijgt de text-fallback (voor oudere clients — de poortwachter
// degradeert onbekende types naar `node.text`) er gratis en consistent bij.
// Zo begint een nieuwe module nooit opnieuw: client-kant (poortwachter,
// renderer, interactie) is generiek af; server-kant is compositie uit dit
// vocabulaire. De roundtrip-contracttest (tests/assistantRender.test.js)
// bewaakt dat elke constructor-output ongeschonden door de client-poortwachter
// (lib/assistantUi.js) komt — een pack kan geen node meer bouwen die op de
// client stilletjes sneuvelt.
//
// De poortwachter blijft de autoriteit (valideert/kapt af); deze constructors
// zijn bewust dun: vorm + fallback, geen tweede validatielaag.

import { fmtEuro } from './helpers.js';

/** Chart-waarde → fallback-tekst, unit-bewust ('euro' ⇒ centen). @param {number} value @param {string|null} [unit] */
const fmtChartValue = (value, unit) => (unit === 'euro' ? fmtEuro(value) : String(value));

/**
 * Grafiek-node (één serie). `unit: 'euro'` ⇒ waarden in CENTEN.
 * `variant: 'line'` ⇒ lijn-variant voor trends (AI-16 ronde 3); default staaf.
 * @param {{ title?: string|null, unit?: 'euro'|null, variant?: 'line'|null, points: Array<{label:string, value:number}> }} opts
 */
export function chartNode({ title = null, unit = null, variant = null, points }) {
  const body = points.map((p) => `${p.label}: ${fmtChartValue(p.value, unit)}`).join(' · ');
  return {
    type: 'chart',
    ...(title ? { title } : {}),
    ...(unit ? { unit } : {}),
    ...(variant === 'line' ? { variant: 'line' } : {}),
    points,
    text: title ? `${title}: ${body}` : body,
  };
}

/**
 * Foto-node (AI-16 ronde 3): een kaal opslagpad uit een eigen private bucket —
 * nooit een URL. De client signt het pad zelf (storage-RLS scopet op het
 * household-segment), de poortwachter whitelist de bucket. De fallback voor
 * oude clients is de caption (of "(foto)").
 * @param {{ bucket: string, path: string, caption?: string|null }} opts
 */
export function imageNode({ bucket, path, caption = null }) {
  return {
    type: 'image',
    bucket,
    path,
    ...(caption ? { caption } : {}),
    text: caption ?? '(foto)',
  };
}

/**
 * Voortgangs-node (AI-16 ronde 3): label + teller/noemer ("5 van 12").
 * De noemer hoort > 0 te zijn — de poortwachter dropt 'm anders.
 * @param {{ label: string, value: number, max: number }} opts
 */
export function progressNode({ label, value, max }) {
  return {
    type: 'progress',
    label,
    value,
    max,
    text: `${label}: ${value} van ${max}`,
  };
}

/**
 * Rooster-node: dag-rijen met entries; lege dagen blijven staan (gaten zijn
 * informatie). `today` bepaalt de server (ctx.today) — nooit de client.
 * De fallback noemt alleen dagen mét entries (leesbare regel per dag).
 * @param {{ title?: string|null, days: Array<{label:string, today?:boolean, entries:Array<{text:string, emoji?:string|null}>}> }} opts
 */
export function scheduleNode({ title = null, days }) {
  const lines = days
    .filter((d) => d.entries.length > 0)
    .map((d) => `${d.label} — ${d.entries.map((e) => e.text).join(', ')}`);
  return {
    type: 'schedule',
    ...(title ? { title } : {}),
    days,
    text: lines.join('\n'),
  };
}

/**
 * Beslis-kaart-node (AskUserQuestion-patroon): een tik stuurt `reply` als
 * gewone gebruikersbeurt — nooit args of tool-calls vanaf een kaart.
 * @param {{ prompt: string, options: Array<{label:string, description?:string|null, reply:string}> }} opts
 */
export function choiceNode({ prompt, options }) {
  return {
    type: 'choice',
    prompt,
    options,
    text: `${prompt} ${options.map((o) => o.label).join(' / ')}`,
  };
}
