// @ts-check
// Aggregator van de assistent-tool-packs (guidelines §1): elke module levert zijn
// eigen skill-file (tools/<moduleKey>.js), dit bestand voegt ze alleen samen.
//
// Bewust dom gehouden (LangChain-toolkit-patroon): flatten + invariant-check +
// deterministische sortering. Geen dynamische discovery — op deze schaal is dat
// overhead. De conventies per pack (naming, annotaties, schema-vorm) worden
// afgedwongen door tests/assistantToolPacks.test.js, niet door runtime-magie.
//
// Sortering op naam is cache-hygiëne: tool-definities staan vooraan in de prompt,
// dus de set moet binnen een gesprek byte-stabiel zijn — nooit afhangen van
// import- of Object.keys-volgorde.

import { TAKEN_TOOLS, TAKEN_BRIEF } from './taken.js';
import { BOODSCHAPPEN_TOOLS, BOODSCHAPPEN_BRIEF } from './boodschappen.js';
import { KOSTEN_TOOLS, KOSTEN_BRIEF } from './kosten.js';
import { VOORRAAD_TOOLS, VOORRAAD_BRIEF } from './voorraad.js';
import { MAALTIJDEN_TOOLS, MAALTIJDEN_BRIEF } from './maaltijden.js';

/**
 * Voeg packs samen tot één registry: gesorteerd op naam, met een harde fout op
 * dubbele toolnamen (twee packs die dezelfde naam claimen is een bouwfout die
 * je bij de test wilt zien, niet in productie-gedrag).
 * @param {Array<Array<{name: string}>>} packs
 */
export function aggregateToolPacks(packs) {
  const all = packs.flat();
  const seen = new Set();
  for (const t of all) {
    if (seen.has(t.name)) throw new Error(`Dubbele toolnaam in de packs: ${t.name}`);
    seen.add(t.name);
  }
  // Stryker disable next-line all -- namen zijn hierboven uniek bewezen: de 0-tak
  // is onbereikbaar en <= / >= zijn dan equivalent aan < / > (onvangbare mutanten).
  return [...all].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export const ASSISTANT_TOOLS = aggregateToolPacks([
  TAKEN_TOOLS,
  BOODSCHAPPEN_TOOLS,
  KOSTEN_TOOLS,
  VOORRAAD_TOOLS,
  MAALTIJDEN_TOOLS,
]);

/**
 * Voeg module-briefs samen tot één map moduleKey → { label, brief } (AI-10):
 * de goedkope altijd-in-context-laag van de systemprompt-snapshot. Dubbele
 * moduleKeys zijn een bouwfout — hard falen, net als bij toolnamen.
 * @param {Array<{moduleKey: string, label: string, brief: string}>} briefs
 * @returns {Record<string, {label: string, brief: string}>}
 */
export function aggregateBriefs(briefs) {
  const map = /** @type {Record<string, {label: string, brief: string}>} */ ({});
  for (const b of briefs) {
    if (map[b.moduleKey]) throw new Error(`Dubbele module-brief: ${b.moduleKey}`);
    map[b.moduleKey] = { label: b.label, brief: b.brief };
  }
  return map;
}

export const MODULE_BRIEFS = aggregateBriefs([
  TAKEN_BRIEF,
  BOODSCHAPPEN_BRIEF,
  KOSTEN_BRIEF,
  VOORRAAD_BRIEF,
  MAALTIJDEN_BRIEF,
]);
