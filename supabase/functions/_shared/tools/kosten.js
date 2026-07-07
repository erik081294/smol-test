// @ts-check
// Tool-pack van de Kosten-module (assistent-skill-file, guidelines §1).
// Vooralsnog alleen lezen; een kosten-write (uitgave voorstellen) volgt pas als
// daar een use-case voor is — consolidatie boven tool-wildgroei. Contract: zie taken.js.

import { fmtEuro, nextMonth, throwOnError } from './helpers.js';
import { chartNode } from './render.js';

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
// Stryker disable next-line all -- default-params: elk niet-"YYYY-MM"-argument
// (ook een gemuteerde default) faalt de maand-parse en geeft [], en junk-rows
// vallen op de typeof-check; de mutanten zijn equivalent.
export function weeklyExpensePoints(rows = [], month = '') {
  const parsed = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (!parsed) return [];
  const y = Number(parsed[1]);
  const m = Number(parsed[2]);
  if (m < 1 || m > 12) return [];
  // Date.UTC(y, m, 0) = de laatste dag van maand m (1-based) — geen lokale tz.
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const points = Array.from({ length: Math.ceil(lastDay / 7) }, (_, i) => ({
    label: `${i * 7 + 1}–${Math.min(i * 7 + 7, lastDay)}`,
    value: 0,
  }));
  for (const row of rows) {
    // Andere maand (of rommel) hoort niet in deze grafiek.
    if (typeof row?.spent_on !== 'string' || !row.spent_on.startsWith(`${month}-`)) continue;
    const day = Number(row.spent_on.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > lastDay) continue;
    // day ≤ lastDay borgt dat de bucket-index binnen points valt (geen clamp nodig).
    points[Math.floor((day - 1) / 7)].value += row.amount_cents ?? 0;
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
  // Compositie uit het gedeelde vocabulaire (render.js): text-fallback voor
  // oudere clients komt uit de constructor mee.
  if (points.length > 0) render.push(chartNode({ title: 'Per week', unit: 'euro', points }));
  return { data, render };
}

// NL-maandafkortingen voor de trend-labels (spiegel van de dayLabel-stijl).
const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/**
 * De n maanden t/m `month` als "YYYY-MM"-lijst (oudste eerst) — puur string/
 * getal-rekenen, geen Date (tz-vast). Ongeldige maand → [].
 * @param {string} [month] "YYYY-MM"
 * @param {number} [n]
 * @returns {string[]}
 */
export function trendMonths(month = '', n = 6) {
  const parsed = /^(\d{4})-(\d{2})$/.exec(month ?? '');
  if (!parsed) return [];
  let y = Number(parsed[1]);
  let m = Number(parsed[2]);
  if (m < 1 || m > 12) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/**
 * Uitgaven-rijen → maandtotalen voor de lijn-grafiek (AI-16 ronde 3): één punt
 * per maand uit `months` (label = NL-maandafkorting, waarde in CENTEN). Lege
 * maanden blijven 0 — een maand zonder uitgaven is informatie; rijen buiten
 * het venster (of rommel) tellen niet mee.
 * @param {Array<{amount_cents?:number|null, spent_on?:string|null}>} [rows]
 * @param {string[]} [months] "YYYY-MM"-lijst uit trendMonths
 * @returns {Array<{label:string, value:number}>}
 */
export function monthlyTrendPoints(rows = [], months = []) {
  const totals = new Map(months.map((m) => [m, 0]));
  for (const row of rows) {
    if (typeof row?.spent_on !== 'string') continue;
    const key = row.spent_on.slice(0, 7);
    if (!totals.has(key)) continue;
    totals.set(key, totals.get(key) + (row.amount_cents ?? 0));
  }
  return months.map((m) => ({ label: MONTH_LABELS[Number(m.slice(5, 7)) - 1], value: totals.get(m) }));
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
      const out = renderExpensesSummary(rows, month);
      // AI-16 ronde 3: maandtrend als lijn-grafiek — aparte lichte query zodat
      // de maand-samenvatting (en dus de `data` naar het model) byte-identiek
      // blijft. Pas tonen bij ≥2 maanden mét uitgaven (anders is er geen trend).
      const months = trendMonths(month);
      const trendRows = throwOnError(
        await ctx.db
          .from('expenses')
          .select('amount_cents, spent_on')
          .eq('household_id', ctx.householdId)
          .gte('spent_on', `${months[0]}-01`)
          .lt('spent_on', nextMonth(month))
          .limit(2000)
      );
      const points = monthlyTrendPoints(trendRows, months);
      if (points.filter((p) => p.value > 0).length >= 2) {
        out.render.push(chartNode({ title: 'Trend per maand', unit: 'euro', variant: 'line', points }));
      }
      return out;
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
