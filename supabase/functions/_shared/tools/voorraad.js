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

export const VOORRAAD_TOOLS = [
  {
    name: 'voorraad_bijna_op',
    moduleKey: 'voorraad',
    kind: 'read',
    statusLabel: 'Voorraad nalopen…',
    description: 'Welke voorraad-items zijn bijna op of lopen binnen een week tegen de houdbaarheidsdatum aan? Gebruik dit bij vragen over wat er in huis is of wat aangevuld moet worden.',
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
