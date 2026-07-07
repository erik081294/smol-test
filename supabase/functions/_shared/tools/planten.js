// @ts-check
// Tool-pack van de Planten-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: het plantenoverzicht mét de eerstvolgende verzorgingstaak
// per plant. De write (plant toevoegen + verzorgingstaken) volgt in fase B.
// Contract: zie taken.js. Bewust géén import van lib/plantCare.js — die trekt
// date-fns/extensieloze imports de edge-bundel in; de samenvatting hier is een
// dunne spiegel op de rijen zelf.

import { addDays, dayLabel, throwOnError } from './helpers.js';

/**
 * Planten + hun open verzorgingstaken → data + lijst. Per plant de locatie en
 * de eerstvolgende taak (op due_date; taken zonder datum tellen niet als "volgende").
 * @param {Array<{id:string, name:string, location?:string|null}>} [plants]
 * @param {Array<{plant_id?:string|null, title?:string|null, due_date?:string|null}>} [tasks] open taken (completed_at null)
 */
export function renderPlantsOverview(plants = [], tasks = []) {
  const nextByPlant = /** @type {Record<string, {title:string, due_date:string}>} */ ({});
  for (const t of tasks) {
    if (!t?.plant_id || typeof t.due_date !== 'string' || !t.due_date || typeof t.title !== 'string') continue;
    const cur = nextByPlant[t.plant_id];
    if (!cur || t.due_date < cur.due_date) nextByPlant[t.plant_id] = { title: t.title, due_date: t.due_date };
  }
  const entries = plants.map((p) => {
    const next = nextByPlant[p.id] ?? null;
    return {
      name: p.name,
      location: p.location ?? null,
      next_care: next ? { title: next.title, due_date: next.due_date } : null,
    };
  });
  const data = { count: plants.length, plants: entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Planten', lines: ['Er staan nog geen planten in de app.'] }] };
  }
  const items = entries.map((e) => {
    const where = e.location ? ` (${e.location})` : '';
    const care = e.next_care ? ` — ${e.next_care.title} ${dayLabel(e.next_care.due_date)}` : '';
    return { text: `${e.name}${where}${care}`, emoji: '🪴' };
  });
  return { data, render: [{ type: 'list', title: `Planten (${entries.length})`, items }] };
}

export const MAX_PROPOSED_PLANTS = 5;

/**
 * Puur voorstel-bouwwerk van planten_toevoegen (fase B, HITL). Naam verplicht;
 * water_days (optioneel, 1-60) stuurt de eerste water-taak die execute erbij
 * aanmaakt. items ↔ args.items lopen 1-op-1 (multi-edit-contract).
 * @param {{ items?: Array<{name?:string, location?:string, water_days?:number}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeAddPlants(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen plant om toe te voegen.' };
  if (raw.length > MAX_PROPOSED_PLANTS) return { ok: false, error: `Maximaal ${MAX_PROPOSED_PLANTS} planten per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    if (!name) return { ok: false, error: 'Elke plant heeft een naam nodig.' };
    if (name.length > 80) return { ok: false, error: 'Een plantnaam mag maximaal 80 tekens zijn.' };
    const location = typeof it?.location === 'string' && it.location.trim() ? it.location.trim().slice(0, 80) : null;
    const waterDays = Number.isInteger(it?.water_days) && /** @type {number} */ (it.water_days) >= 1 && /** @type {number} */ (it.water_days) <= 60
      ? /** @type {number} */ (it.water_days)
      : null;
    norm.push({ name, location, water_days: waterDays });
    items.push([name, location, waterDays ? `water elke ${waterDays} dgn` : null].filter(Boolean).join(' · '));
  }
  const summary = norm.length === 1 ? `Plant "${norm[0].name}" toevoegen` : `${norm.length} planten toevoegen`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (guidelines §1): één regel in de systemprompt-snapshot.
export const PLANTEN_BRIEF = {
  moduleKey: 'planten',
  label: 'Planten',
  brief: 'de kamerplanten en hun verzorging; kan het overzicht tonen en planten toevoegen',
};

export const PLANTEN_TOOLS = [
  {
    name: 'planten_overzicht',
    moduleKey: 'planten',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even langs de planten…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de planten, welke plant water of voeding nodig heeft, of wat er aan plantverzorging openstaat. Toont alle planten met locatie en de eerstvolgende verzorgingstaak.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const [plants, tasks] = await Promise.all([
        ctx.db.from('plants').select('id, name, location').eq('household_id', ctx.householdId).order('name').limit(100),
        ctx.db.from('tasks').select('plant_id, title, due_date')
          .eq('household_id', ctx.householdId).eq('category', 'plant').is('completed_at', null)
          .not('plant_id', 'is', null).limit(200),
      ]);
      return renderPlantsOverview(throwOnError(plants), throwOnError(tasks));
    },
  },
  {
    name: 'planten_toevoegen',
    moduleKey: 'planten',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: voegt alleen planten (en evt. een water-taak) toe
    idempotent: false,  // nogmaals uitvoeren = dubbele planten
    statusLabel: 'Plant klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een plant in de app wil zetten (bv. "we hebben een nieuwe monstera"). Stelt de plant voor, optioneel met locatie en een water-interval — bij een interval maakt de app na bevestiging meteen de eerste water-taak aan. De gebruiker beslist op de bevestigingskaart.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De toe te voegen planten (maximaal 5).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Naam van de plant, bv. "Monstera"' },
              location: { type: 'string', description: 'Optionele plek, bv. "woonkamer"' },
              water_days: { type: 'integer', description: 'Optioneel: om de hoeveel dagen water (1-60)' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeAddPlants,
    async execute(ctx, args) {
      const inserted = [];
      for (const it of args.items) {
        const rows = throwOnError(
          await ctx.db.from('plants').insert({
            household_id: ctx.householdId,
            created_by: ctx.userId,
            name: it.name,
            ...(it.location ? { location: it.location } : {}),
            ...(it.water_days ? { water_days: it.water_days } : {}),
          }).select('id')
        );
        inserted.push(...rows.map((r) => ({ table: 'plants', id: r.id })));
        // Eerste water-taak (category 'plant', gekoppeld via plant_id) zodat de
        // verzorging meteen loopt; de vollere care-templates blijven app-werk.
        if (it.water_days && rows[0]) {
          const task = throwOnError(
            await ctx.db.from('tasks').insert({
              household_id: ctx.householdId,
              created_by: ctx.userId,
              title: `${it.name} water geven`,
              category: 'plant',
              plant_id: rows[0].id,
              due_date: addDays(ctx.today, it.water_days),
              recur_freq: 'daily',
              recur_interval: it.water_days,
            }).select('id')
          );
          inserted.push(...task.map((r) => ({ table: 'tasks', id: r.id })));
        }
      }
      const plants = inserted.filter((r) => r.table === 'plants').length;
      return {
        summary: plants === 1 ? 'Plant toegevoegd.' : `${plants} planten toegevoegd.`,
        inserted,
      };
    },
  },
];

// Manifest: de enige declaratie per module (guidelines §1).
export const PLANTEN_MANIFEST = {
  moduleKey: PLANTEN_BRIEF.moduleKey,
  label: PLANTEN_BRIEF.label,
  brief: PLANTEN_BRIEF.brief,
  tools: PLANTEN_TOOLS,
};
