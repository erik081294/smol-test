// @ts-check
// Tool-pack van de Kosten-module (assistent-skill-file, guidelines §1).
// Vooralsnog alleen lezen; een kosten-write (uitgave voorstellen) volgt pas als
// daar een use-case voor is — consolidatie boven tool-wildgroei. Contract: zie taken.js.

import { fmtEuro, nextMonth, throwOnError } from './helpers.js';

/**
 * Uitgaven van één maand → weekpunten voor de staafgrafiek (AI-16, plan 26):
 * vaste 7-daagse buckets binnen de maand (1–7, 8–14, 15–21, 22–28, 29–einde).
 * Lege weken blijven staan (een week zonder uitgaven is informatie); waarden
 * in CENTEN (unit 'euro' op de chart-node). Puur en tz-vast (string-rekenen +
 * Date.UTC voor de maandlengte). Ongeldige maand → [] (geen grafiek).
 * @param {Array<{amount_cents?:number|null, spent_on?:string|null}>} [rows]
 * @param {string} [month] "YYYY-MM"
 * @returns {Array<{label:string, value:number}>}
 */
export function weeklyExpensePoints(rows = [], month = '') {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (m < 1 || m > 12) return [];
  // Date.UTC(y, m, 0) = de laatste dag van maand m (1-based) — geen lokale tz.
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const bucketCount = Math.ceil(lastDay / 7);
  const points = Array.from({ length: bucketCount }, (_, i) => ({
    label: `${i * 7 + 1}–${Math.min(i * 7 + 7, lastDay)}`,
    value: 0,
  }));
  for (const row of rows) {
    const spentOn = row?.spent_on ?? '';
    if (!spentOn.startsWith(`${month}-`)) continue; // andere maand hoort niet in deze grafiek
    const day = Number(spentOn.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > lastDay) continue;
    points[Math.min(Math.floor((day - 1) / 7), bucketCount - 1)].value += row.amount_cents ?? 0;
  }
  return points;
}

/**
 * Uitgaven-samenvatting van één maand → totalen + weekgrafiek (AI-16).
 * De `data` naar het model is byte-identiek aan vóór AI-16.
 * @param {Array<{description:string, amount_cents:number, spent_on:string}>} [rows]
 * @param {string} [monthLabel] "YYYY-MM" (voedt óók de weekgrafiek-buckets)
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
  const render = /** @type {object[]} */ ([{
    type: 'keyvalue',
    title,
    pairs: [{ k: 'Totaal', v: fmtEuro(total) }, { k: 'Aantal', v: String(rows.length) }, ...top],
  }]);
  const points = weeklyExpensePoints(rows, monthLabel);
  if (points.length > 0) {
    render.push({
      type: 'chart',
      title: 'Per week',
      unit: 'euro',
      points,
      // Fallback voor oudere clients (poortwachter degradeert naar node.text).
      text: `Per week: ${points.map((p) => `${p.label}: ${fmtEuro(p.value)}`).join(' · ')}`,
    });
  }
  return { data, render };
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
    risk: 'read',
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

// Manifest (fundament AI-actie-laag): de enige declaratie per module — brief + tools
// in één object. index.js leidt hieruit ASSISTANT_TOOLS/MODULE_BRIEFS af (guidelines §1).
export const KOSTEN_MANIFEST = {
  moduleKey: KOSTEN_BRIEF.moduleKey,
  label: KOSTEN_BRIEF.label,
  brief: KOSTEN_BRIEF.brief,
  tools: KOSTEN_TOOLS,
};
