// @ts-check
// Tool-pack van de Boodschappen-module (assistent-skill-file, guidelines §1).
// Lezen (boodschappen_lijst) en voorstellen (boodschappen_toevoegen — HITL:
// bevestiging in de app vóór er iets op de lijst komt). Contract: zie taken.js.

import { throwOnError } from './helpers.js';

/**
 * Boodschappenlijst (onafgevinkt) → data + kaart.
 * @param {Array<{name:string, quantity?:string|null}>} [rows]
 */
export function renderGroceryList(rows = []) {
  const items = rows.map((g) => ({ text: g.quantity ? `${g.name} (${g.quantity})` : g.name }));
  const data = { count: rows.length, items: rows.map((g) => ({ name: g.name, quantity: g.quantity ?? null })) };
  const render = items.length > 0
    ? [{ type: 'list', title: `Boodschappenlijst (${items.length})`, items }]
    : [{ type: 'card', title: 'Boodschappenlijst', lines: ['De lijst is leeg.'] }];
  return { data, render };
}

export const MAX_PROPOSED_GROCERIES = 20;

/**
 * Puur voorstel-bouwwerk van boodschappen_toevoegen. `items` (weergaveteksten)
 * loopt 1-op-1 met `args.items` voor per-item aan/uitvinken op de bevestigingskaart.
 * @param {{ items?: Array<{name?:string, quantity?:string}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeAddGroceries(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen boodschappen om toe te voegen.' };
  if (raw.length > MAX_PROPOSED_GROCERIES) return { ok: false, error: `Maximaal ${MAX_PROPOSED_GROCERIES} boodschappen per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    if (!name) return { ok: false, error: 'Elke boodschap heeft een naam nodig.' };
    if (name.length > 80) return { ok: false, error: 'Een boodschap mag maximaal 80 tekens zijn.' };
    const quantity = typeof it?.quantity === 'string' && it.quantity.trim().length > 0 ? it.quantity.trim() : null;
    norm.push({ name, quantity });
    items.push(quantity ? `${name} (${quantity})` : name);
  }
  const summary = norm.length === 1
    ? `"${norm[0].name}" op de boodschappenlijst zetten`
    : `${norm.length} boodschappen op de lijst zetten`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const BOODSCHAPPEN_BRIEF = {
  moduleKey: 'boodschappen',
  label: 'Boodschappen',
  brief: 'de gedeelde boodschappenlijst; kan de lijst tonen en items voorstellen',
};

export const BOODSCHAPPEN_TOOLS = [
  {
    name: 'boodschappen_lijst',
    moduleKey: 'boodschappen',
    kind: 'read',
    statusLabel: 'Boodschappenlijstje erbij pakken…',
    description: 'Haal de actuele (onafgevinkte) boodschappenlijst op. Gebruik dit bij vragen over wat er nog gehaald moet worden of wat er op de lijst staat.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const rows = throwOnError(
        await ctx.db
          .from('groceries')
          .select('name, quantity')
          .eq('household_id', ctx.householdId)
          .eq('checked', false)
          .order('created_at', { ascending: true })
          .limit(100)
      );
      return renderGroceryList(rows);
    },
  },
  {
    name: 'boodschappen_toevoegen',
    moduleKey: 'boodschappen',
    kind: 'write',
    destructive: false, // additief: zet alleen items op de lijst
    idempotent: false,  // nogmaals uitvoeren = dubbele items
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Stel voor om één of meer items op de boodschappenlijst te zetten. De gebruiker ziet een bevestigingskaart en kan per item aan- of uitvinken; er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De toe te voegen boodschappen (maximaal 20).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Wat er gehaald moet worden, bv. "Melk"' },
              quantity: { type: 'string', description: 'Optionele hoeveelheid, bv. "2 pakken"' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeAddGroceries,
    async execute(ctx, args) {
      const rows = args.items.map((it) => ({
        household_id: ctx.householdId,
        added_by: ctx.userId,
        name: it.name,
        quantity: it.quantity,
        checked: false,
      }));
      const inserted = throwOnError(await ctx.db.from('groceries').insert(rows).select('id'));
      return {
        summary: inserted.length === 1 ? 'Op de boodschappenlijst gezet.' : `${inserted.length} boodschappen op de lijst gezet.`,
        inserted: inserted.map((r) => ({ table: 'groceries', id: r.id })),
      };
    },
  },
];
