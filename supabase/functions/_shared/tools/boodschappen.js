// @ts-check
// Tool-pack van de Boodschappen-module (assistent-skill-file, guidelines §1).
// Lezen (boodschappen_lijst) en voorstellen (boodschappen_toevoegen — HITL:
// bevestiging in de app vóór er iets op de lijst komt). Contract: zie taken.js.
// AI-11 spoor 1: toevoegen matcht deterministisch tegen de gebundelde catalogus
// (lib/groceryCatalog.js) en koppelt aan een huishoud-product — zelfde verrijking
// als handmatig toevoegen, geen losse dubbele regels.

import { throwOnError } from './helpers.js';
// App↔edge-brug (patroon lib/modules.js in assistant/index.ts): de gebundelde
// catalogus is puur en edge-safe, dus de assistent matcht tegen exact dezelfde
// bron als het handmatige toevoegen in de app — niet tegen een tweede lijst.
import { itemByName, searchCatalog, categoryMeta } from '../../../../lib/groceryCatalog.js';
import { normalize } from '../../../../lib/productMatch.js';

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
 * Deterministische catalogus-match voor een vrije boodschap-naam (AI-11 spoor 1):
 * exact op genormaliseerde naam (case-/ruis-ongevoelig via dezelfde `normalize`
 * als de app), anders een uniek prefix ("hagel" → Hagelslag). Een ambigu prefix
 * ("kip" → Kipfilet én Kipfilet (vleeswaren)) of geen treffer → null; het item
 * blijft dan ongematcht (kandidaat voor async categorisering, spoor 2).
 * @param {string} [name]
 * @returns {{key:string, name:string, category:string, unit:string, emoji?:string}|null}
 */
export function matchCatalogGrocery(name) {
  const exact = itemByName(name);
  if (exact) return exact;
  const q = normalize(name);
  // Equivalente mutant: zonder deze kortsluiting matcht '' alsnog niets
  // (alle 190+ items zijn dan "prefix-treffer" → ambigu → null), alleen trager.
  // Stryker disable next-line all
  if (!q) return null;
  // searchCatalog rangschikt prefix-treffers voorop maar geeft óók
  // midden-in-de-naam-treffers terug ("kaas" → Jonge kaas); alleen een écht
  // prefix telt hier, en alleen als het ondubbelzinnig is.
  const prefix = searchCatalog(q).filter((it) => normalize(it.name).startsWith(q));
  return prefix.length === 1 ? prefix[0] : null;
}

/**
 * SEAM voor AI-11 spoor 2 (async categoriseren): welke net toegevoegde items
 * hebben géén catalogus-match en moeten later alsnog een schap krijgen?
 * `items` en `matches` lopen 1-op-1 (matches[i] = matchCatalogGrocery van
 * items[i], null = geen match); dedupliceert op genormaliseerde naam.
 * TODO(AI-11 spoor 2, huishoek-backlog.md §6): hier de async categorisering
 * aanhaken — een goedkoop model kiest een schap uit de catalog_categories-
 * taxonomie voor deze werklijst. Bewust nog géén model-call gebouwd: dat vergt
 * Orq-config + eval-gate (docs/assistent-architectuur.md).
 * @param {Array<{name?:string, productId?:string|null}>} [items]
 * @param {Array<object|null>} [matches]
 * @returns {Array<{name:string, productId:string|null}>}
 */
export function uncategorizedAfterExecute(items = [], matches = []) {
  const out = [];
  const seen = new Set();
  items.forEach((it, i) => {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    const key = normalize(name);
    if (!key || matches[i] || seen.has(key)) return;
    seen.add(key);
    out.push({ name, productId: it.productId ?? null });
  });
  return out;
}

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
    // Catalogus-match op de kaartregel (AI-11): de gebruiker ziet dát er
    // gekoppeld wordt — "Melk (2 pakken) 🥛 · Zuivel & eieren". De match zelf
    // reist niet mee in args: execute her-matcht deterministisch (zo blijft de
    // edit-flow op {name, quantity} werken en valt er niets te vervalsen).
    const base = quantity ? `${name} (${quantity})` : name;
    const match = matchCatalogGrocery(name);
    if (match) {
      const cat = categoryMeta(match.category);
      items.push(`${base} ${match.emoji ?? cat.emoji} · ${cat.label}`);
    } else {
      items.push(base);
    }
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
      // Verrijking (AI-11 spoor 1): koppel elk item — net als handmatig toevoegen
      // (useProducts.ensureProduct) — via find-or-create op de genormaliseerde
      // naam aan een huishoud-product, met schap/default-eenheid uit de
      // catalogus-match. Zo krijgt een assistent-boodschap dezelfde schap-
      // indeling/emoji én voedt hij de times_added-recency ("Eerder gekozen"),
      // i.p.v. een losse dubbele regel naast de catalogus achter te laten.
      const existing = throwOnError(
        await ctx.db.from('products').select('id, name, search')
          .eq('household_id', ctx.householdId).limit(1000)
      );
      const productByNorm = new Map();
      for (const p of existing) {
        // Zelfde terugval als ensureProduct: een rij zonder `search` matcht op naam.
        const key = p.search || normalize(p.name);
        if (key && !productByNorm.has(key)) productByNorm.set(key, p.id);
      }
      const toCreate = [];
      for (const it of args.items) {
        const key = normalize(it.name);
        if (!key || productByNorm.has(key) || toCreate.some((p) => p.search === key)) continue;
        // Gematcht → schap + default-eenheid (zelfde velden als de handmatige
        // catalogus-tik); ongematcht → kaal product (categorie null → 'overig').
        const match = matchCatalogGrocery(it.name);
        toCreate.push({
          household_id: ctx.householdId,
          created_by: ctx.userId,
          name: it.name,
          search: key,
          ...(match?.category ? { category: match.category } : {}),
          ...(match?.unit ? { default_unit: match.unit } : {}),
        });
      }
      if (toCreate.length > 0) {
        // insert(...).select geeft de rijen in insert-volgorde terug → 1-op-1 met toCreate.
        const created = throwOnError(await ctx.db.from('products').insert(toCreate).select('id'));
        toCreate.forEach((p, i) => { if (created[i]?.id) productByNorm.set(p.search, created[i].id); });
      }
      // TODO(AI-11 spoor 2, huishoek-backlog.md §6): items zónder catalogus-match
      // hier async laten categoriseren — uncategorizedAfterExecute levert de werklijst.
      const rows = args.items.map((it) => {
        const productId = productByNorm.get(normalize(it.name)) ?? null;
        return {
          household_id: ctx.householdId,
          added_by: ctx.userId,
          name: it.name,
          quantity: it.quantity,
          checked: false,
          ...(productId ? { product_id: productId } : {}),
        };
      });
      const inserted = throwOnError(await ctx.db.from('groceries').insert(rows).select('id'));
      // Alleen de lijstregels in het undo-spoor: net als bij handmatig toevoegen
      // blijft het huishoud-product bestaan als de regel weer verdwijnt (en
      // 'products' staat bewust niet in de UNDO_TABLE_WHITELIST).
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
