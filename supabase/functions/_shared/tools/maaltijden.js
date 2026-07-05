// @ts-check
// Tool-pack van de Keuken-module (assistent-skill-file, guidelines §1).
// Lezen (maaltijden_weekmenu) en voorstellen (maaltijden_plannen — HITL).
// v1 plant met vrije-tekst-titels; koppelen aan opgeslagen recepten (recipe_id)
// volgt zodra er een recepten-zoek-tool is — consolidatie boven tool-wildgroei.
// Contract: zie taken.js.

import { addDays, dayLabel, isIsoDate, throwOnError } from './helpers.js';

export const MEAL_TYPES = ['ontbijt', 'lunch', 'diner', 'snack'];

/**
 * Weekmenu-regels → data + kaart. Verwacht rows gesorteerd op plan_date; de
 * titel komt uit vrije tekst (title) of het gekoppelde recept (recipes.title).
 * @param {Array<{plan_date:string, meal_type?:string|null, title?:string|null, servings?:number|null, recipes?:{title?:string|null}|null}>} [rows]
 * @param {number} [days] hoeveel dagen vooruit er is gekeken (voor de kaarttitel)
 */
export function renderWeekMenu(rows = [], days = 7) {
  const entries = rows.map((r) => ({
    date: r.plan_date,
    meal_type: r.meal_type ?? 'diner',
    title: r.title ?? r.recipes?.title ?? 'Maaltijd',
    servings: r.servings ?? null,
  }));
  const items = entries.map((e) => {
    const meal = e.meal_type === 'diner' ? '' : ` · ${e.meal_type}`;
    const servings = e.servings ? ` (${e.servings}p)` : '';
    return { text: `${dayLabel(e.date)}${meal} — ${e.title}${servings}` };
  });
  const data = { count: entries.length, entries };
  const render = items.length > 0
    ? [{ type: 'list', title: `Weekmenu (komende ${days} dagen)`, items }]
    : [{ type: 'card', title: 'Weekmenu', lines: ['Er staat nog niets op het menu.'] }];
  return { data, render };
}

export const MAX_PROPOSED_MEALS = 14;

/**
 * Puur voorstel-bouwwerk van maaltijden_plannen. `items` (weergaveteksten)
 * loopt 1-op-1 met `args.items` voor per-item aan/uitvinken op de bevestigingskaart.
 * @param {{ items?: Array<{date?:string, meal_type?:string, title?:string, servings?:number}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposePlanMeals(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen maaltijden om in te plannen.' };
  if (raw.length > MAX_PROPOSED_MEALS) return { ok: false, error: `Maximaal ${MAX_PROPOSED_MEALS} maaltijden per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) return { ok: false, error: 'Elke maaltijd heeft een titel nodig.' };
    if (title.length > 120) return { ok: false, error: 'Een maaltijdtitel mag maximaal 120 tekens zijn.' };
    if (!isIsoDate(it?.date ?? '')) return { ok: false, error: `Ongeldige datum: ${it?.date} (gebruik YYYY-MM-DD).` };
    const date = /** @type {string} */ (it.date);
    const mealType = MEAL_TYPES.includes(it?.meal_type ?? '') ? /** @type {string} */ (it.meal_type) : 'diner';
    const servings = Number.isInteger(it?.servings) && /** @type {number} */ (it.servings) >= 1 && /** @type {number} */ (it.servings) <= 12
      ? /** @type {number} */ (it.servings)
      : null;
    norm.push({ date, meal_type: mealType, title, servings });
    const meal = mealType === 'diner' ? '' : ` · ${mealType}`;
    items.push(`${dayLabel(date)}${meal} — ${title}${servings ? ` (${servings}p)` : ''}`);
  }
  const summary = norm.length === 1
    ? `"${norm[0].title}" op het menu zetten (${dayLabel(norm[0].date)})`
    : `${norm.length} maaltijden inplannen`;
  return { ok: true, summary, items, args: { items: norm } };
}

export const MAALTIJDEN_TOOLS = [
  {
    name: 'maaltijden_weekmenu',
    moduleKey: 'maaltijden',
    kind: 'read',
    statusLabel: 'Weekmenu erbij pakken…',
    description: 'Haal het geplande weekmenu op (vandaag + de komende dagen), inclusief gekoppelde recepten. Gebruik dit bij vragen over wat er gegeten wordt of wat er op het menu staat.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Hoeveel dagen vooruit (1-14, default 7)' } },
      required: [],
      additionalProperties: false,
    },
    async run(ctx, args = {}) {
      const days = Number.isInteger(args.days) && args.days >= 1 && args.days <= 14 ? args.days : 7;
      const rows = throwOnError(
        await ctx.db
          .from('meal_plan_entries')
          .select('plan_date, meal_type, title, servings, recipes(title)')
          .eq('household_id', ctx.householdId)
          .gte('plan_date', ctx.today)
          .lt('plan_date', addDays(ctx.today, days))
          .order('plan_date', { ascending: true })
          .limit(60)
      );
      return renderWeekMenu(rows, days);
    },
  },
  {
    name: 'maaltijden_plannen',
    moduleKey: 'maaltijden',
    kind: 'write',
    destructive: false, // additief: zet alleen nieuwe maaltijden op het menu
    idempotent: false,  // nogmaals uitvoeren = dubbele menu-regels
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Stel voor om één of meer maaltijden op het weekmenu te zetten (bv. "vrijdag lasagne"). De gebruiker ziet een bevestigingskaart en kan per maaltijd aan- of uitvinken; er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De in te plannen maaltijden (maximaal 14).',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'De dag als YYYY-MM-DD' },
              title: { type: 'string', description: 'Wat er gegeten wordt, bv. "Lasagne"' },
              meal_type: { type: 'string', enum: MEAL_TYPES, description: 'Welk eetmoment (default: diner)' },
              servings: { type: 'integer', description: 'Optioneel aantal eters (1-12)' },
            },
            required: ['date', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposePlanMeals,
    async execute(ctx, args) {
      const rows = args.items.map((it) => ({
        household_id: ctx.householdId,
        created_by: ctx.userId,
        plan_date: it.date,
        meal_type: it.meal_type,
        title: it.title,
        ...(it.servings ? { servings: it.servings } : {}),
      }));
      const inserted = throwOnError(await ctx.db.from('meal_plan_entries').insert(rows).select('id'));
      return {
        summary: inserted.length === 1 ? 'Op het weekmenu gezet.' : `${inserted.length} maaltijden op het weekmenu gezet.`,
        inserted: inserted.map((r) => ({ table: 'meal_plan_entries', id: r.id })),
      };
    },
  },
];
