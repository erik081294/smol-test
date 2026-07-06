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

/**
 * Puur voorstel-bouwwerk van boodschappen_afvinken. `items` (namen) loopt 1-op-1
 * met `args.items` voor per-item aan/uitvinken op de bevestigingskaart.
 * @param {{ items?: Array<{name?:string}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeCheckGroceries(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen boodschappen om af te vinken.' };
  if (raw.length > MAX_PROPOSED_GROCERIES) return { ok: false, error: `Maximaal ${MAX_PROPOSED_GROCERIES} boodschappen per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    if (!name) return { ok: false, error: 'Elke boodschap heeft een naam nodig.' };
    if (name.length > 80) return { ok: false, error: 'Een boodschap mag maximaal 80 tekens zijn.' };
    norm.push({ name });
    items.push(name);
  }
  const summary = norm.length === 1
    ? `"${norm[0].name}" afvinken van de boodschappenlijst`
    : `${norm.length} boodschappen afvinken`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const BOODSCHAPPEN_BRIEF = {
  moduleKey: 'boodschappen',
  label: 'Boodschappen',
  brief: 'de gedeelde boodschappenlijst; kan de lijst tonen, items voorstellen en afvinken',
};

export const BOODSCHAPPEN_TOOLS = [
  {
    name: 'boodschappen_lijst',
    moduleKey: 'boodschappen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Boodschappenlijstje erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er nog gehaald moet worden of wat er op de boodschappenlijst staat. Haalt de actuele (onafgevinkte) lijst op. Voor "wat is er in huis / bijna op" is dit niet de juiste tool — gebruik voorraad_bijna_op.',
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
    risk: 'write',
    destructive: false, // additief: zet alleen items op de lijst
    idempotent: false,  // nogmaals uitvoeren = dubbele items
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker iets op de boodschappenlijst wil zetten of wil laten halen. Stelt één of meer items voor: de gebruiker ziet een bevestigingskaart en kan per item aan- of uitvinken, er wordt nooit direct iets opgeslagen.',
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
  {
    name: 'boodschappen_afvinken',
    moduleKey: 'boodschappen',
    kind: 'write',
    risk: 'write',
    destructive: false, // haalt items van de actieve lijst; omkeerbaar in de lijst-UI
    idempotent: true,   // al afgevinkt = geen effect
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een of meer boodschappen als gehaald/gekocht wil afvinken of van de lijst wil halen (bv. "ik heb melk en brood gehaald"). Gebruik de namen zoals ze op de lijst staan (haal ze zo nodig eerst op met boodschappen_lijst). De gebruiker ziet een bevestigingskaart en kan per item aan- of uitvinken. Dit is niet voor het TOEVOEGEN van items — gebruik daarvoor boodschappen_toevoegen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De af te vinken boodschappen (maximaal 20).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'De naam zoals op de lijst, bv. "Melk"' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeCheckGroceries,
    async execute(ctx, args) {
      // De AI kent alleen de namen, niet de rij-ids: haal de onafgevinkte lijst op
      // en match case-insensitief, zet de treffers op checked=true.
      const wanted = args.items.map((it) => it.name.trim().toLowerCase());
      const open = throwOnError(
        await ctx.db.from('groceries').select('id, name')
          .eq('household_id', ctx.householdId).eq('checked', false).limit(200)
      );
      const ids = open.filter((g) => wanted.includes((g.name ?? '').trim().toLowerCase())).map((g) => g.id);
      if (ids.length === 0) {
        return { summary: 'Die boodschappen stonden niet (meer) open op de lijst.', inserted: [] };
      }
      throwOnError(await ctx.db.from('groceries').update({ checked: true }).in('id', ids).select('id'));
      // Geen undo-spoor: afvinken is geen insert (undo verwijdert inserts) en is
      // triviaal terug te zetten in de boodschappenlijst zelf.
      return {
        summary: ids.length === 1 ? 'Afgevinkt van de boodschappenlijst.' : `${ids.length} boodschappen afgevinkt.`,
        inserted: [],
      };
    },
  },
];

// Manifest (fundament AI-actie-laag): de enige declaratie per module — brief + tools
// in één object. index.js leidt hieruit ASSISTANT_TOOLS/MODULE_BRIEFS af (guidelines §1).
export const BOODSCHAPPEN_MANIFEST = {
  moduleKey: BOODSCHAPPEN_BRIEF.moduleKey,
  label: BOODSCHAPPEN_BRIEF.label,
  brief: BOODSCHAPPEN_BRIEF.brief,
  tools: BOODSCHAPPEN_TOOLS,
};
