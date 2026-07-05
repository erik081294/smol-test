// @ts-check
// Tool-pack van de Kosten-module (assistent-skill-file, guidelines §1).
// Vooralsnog alleen lezen; een kosten-write (uitgave voorstellen) volgt pas als
// daar een use-case voor is — consolidatie boven tool-wildgroei. Contract: zie taken.js.

import { fmtEuro, nextMonth, throwOnError } from './helpers.js';

/**
 * Uitgaven-samenvatting van één maand → totalen per categorie-loos overzicht.
 * @param {Array<{description:string, amount_cents:number, spent_on:string}>} [rows]
 * @param {string} [monthLabel] bv. "juli 2026"
 */
export function renderExpensesSummary(rows = [], monthLabel = '') {
  const total = rows.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
  const top = [...rows]
    .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
    .slice(0, 3)
    .map((e) => ({ k: e.description, v: fmtEuro(e.amount_cents ?? 0) }));
  const title = monthLabel ? `Uitgaven ${monthLabel}` : 'Uitgaven';
  const data = { count: rows.length, total_cents: total };
  if (rows.length === 0) return { data, render: [{ type: 'card', title, lines: ['Geen uitgaven gevonden.'] }] };
  return {
    data,
    render: [{
      type: 'keyvalue',
      title,
      pairs: [{ k: 'Totaal', v: fmtEuro(total) }, { k: 'Aantal', v: String(rows.length) }, ...top],
    }],
  };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const KOSTEN_BRIEF = {
  moduleKey: 'kosten',
  label: 'Kosten',
  brief: 'uitgaven van het huishouden; kan maandoverzichten en grootste kostenposten geven',
};

export const KOSTEN_TOOLS = [
  {
    name: 'kosten_maandoverzicht',
    moduleKey: 'kosten',
    kind: 'read',
    statusLabel: 'Uitgaven op een rijtje zetten…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er is uitgegeven, hoeveel iets kostte of waar het geld heen ging. Geeft een uitgaven-samenvatting van één maand (default: de maand van vandaag); geef month als "YYYY-MM" voor een andere maand.',
    parameters: {
      type: 'object',
      properties: { month: { type: 'string', description: 'Maand als YYYY-MM, bv. 2026-07' } },
      required: [],
      additionalProperties: false,
    },
    async run(ctx, args = {}) {
      const month = /^\d{4}-\d{2}$/.test(args.month ?? '') ? args.month : ctx.today.slice(0, 7);
      const rows = throwOnError(
        await ctx.db
          .from('expenses')
          .select('description, amount_cents, spent_on')
          .eq('household_id', ctx.householdId)
          .gte('spent_on', `${month}-01`)
          .lt('spent_on', nextMonth(month))
          .limit(500)
      );
      return renderExpensesSummary(rows, month);
    },
  },
];
