// @ts-check
// Tool-pack van de Planten-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: het plantenoverzicht mét de eerstvolgende verzorgingstaak
// per plant. De write (plant toevoegen + verzorgingstaken) volgt in fase B.
// Contract: zie taken.js. Bewust géén import van lib/plantCare.js — die trekt
// date-fns/extensieloze imports de edge-bundel in; de samenvatting hier is een
// dunne spiegel op de rijen zelf.

import { dayLabel, throwOnError } from './helpers.js';

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

// Module-brief (guidelines §1): één regel in de systemprompt-snapshot.
export const PLANTEN_BRIEF = {
  moduleKey: 'planten',
  label: 'Planten',
  brief: 'de kamerplanten en hun verzorging; kan tonen welke plant wanneer water of voeding nodig heeft',
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
];

// Manifest: de enige declaratie per module (guidelines §1).
export const PLANTEN_MANIFEST = {
  moduleKey: PLANTEN_BRIEF.moduleKey,
  label: PLANTEN_BRIEF.label,
  brief: PLANTEN_BRIEF.brief,
  tools: PLANTEN_TOOLS,
};
