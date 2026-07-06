// @ts-check
// Tool-pack van de Voorraad-module (assistent-skill-file, guidelines §1).
// Vooralsnog alleen lezen (wat is bijna op / loopt tegen de houdbaarheid aan);
// bijvullen loopt natuurlijker via boodschappen_toevoegen. Contract: zie taken.js.

import { addDays, throwOnError } from './helpers.js';

/**
 * Voorraad die onder de drempel zit of (bijna) over datum is.
 * "Bijna op" = quantity <= low_threshold (alleen als er een drempel is gezet);
 * "let op houdbaarheid" = best_before op of vóór `horizon` (YYYY-MM-DD).
 * @param {Array<{name:string, quantity:number, low_threshold?:number|null, best_before?:string|null}>} [rows]
 * @param {string} [horizon]
 */
export function lowPantryItems(rows = [], horizon = '') {
  return rows.filter((p) => {
    const low = p.low_threshold != null && p.quantity <= p.low_threshold;
    const expiring = Boolean(horizon) && p.best_before != null && p.best_before <= horizon;
    return low || expiring;
  });
}

/** @param {Array<{name:string, quantity:number, unit?:string|null}>} [rows] */
export function renderPantryLow(rows = []) {
  const items = rows.map((p) => ({ text: `${p.name} (${p.quantity} ${p.unit ?? 'stuk'})` }));
  const data = { count: rows.length, items: rows.map((p) => p.name) };
  const render = items.length > 0
    ? [{ type: 'list', title: 'Bijna op / let op houdbaarheid', items }]
    : [{ type: 'card', title: 'Voorraad', lines: ['Alles is voldoende op voorraad.'] }];
  return { data, render };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const VOORRAAD_BRIEF = {
  moduleKey: 'voorraad',
  label: 'Voorraad',
  brief: 'wat er in huis is; kan tonen wat bijna op is of tegen de houdbaarheidsdatum aanloopt',
};

export const VOORRAAD_TOOLS = [
  {
    name: 'voorraad_bijna_op',
    moduleKey: 'voorraad',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Voorraad nalopen…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er in huis is, wat bijna op is, of wat tegen de houdbaarheid aanloopt. Toont voorraad-items onder de drempel of die binnen een week over datum zijn. Voor de boodschappenlijst zelf: gebruik boodschappen_lijst.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const rows = throwOnError(
        await ctx.db
          .from('pantry_items')
          .select('name, quantity, unit, low_threshold, best_before')
          .eq('household_id', ctx.householdId)
          .limit(300)
      );
      return renderPantryLow(lowPantryItems(rows, addDays(ctx.today, 7)));
    },
  },
];

// Manifest (fundament AI-actie-laag): de enige declaratie per module — brief + tools
// in één object. index.js leidt hieruit ASSISTANT_TOOLS/MODULE_BRIEFS af (guidelines §1).
export const VOORRAAD_MANIFEST = {
  moduleKey: VOORRAAD_BRIEF.moduleKey,
  label: VOORRAAD_BRIEF.label,
  brief: VOORRAAD_BRIEF.brief,
  tools: VOORRAAD_TOOLS,
};
