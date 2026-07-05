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

import { TAKEN_TOOLS } from './taken.js';
import { BOODSCHAPPEN_TOOLS } from './boodschappen.js';
import { KOSTEN_TOOLS } from './kosten.js';
import { VOORRAAD_TOOLS } from './voorraad.js';
import { MAALTIJDEN_TOOLS } from './maaltijden.js';

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
