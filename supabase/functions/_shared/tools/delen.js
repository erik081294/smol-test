// @ts-check
// Tool-pack van de Samen/Delen-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: de komende reserveringen op gedeelde spullen (auto,
// gereedschap…), als rooster per dag. De write (reserveren, mét conflictcheck —
// de DB dwingt overlap niet af!) volgt in fase B; rit-kosten boeken blijft bewust
// búíten de assistent (plan 27). Contract: zie taken.js.
// Bewust géén import van lib/reservations.js (date-fns hoort niet in de edge-bundel).

import { dayLabel, throwOnError } from './helpers.js';
import { scheduleNode } from './render.js';

const MAX_DAYS_SHOWN = 7;

/** "2026-07-06T18:30:00+00:00" → "18:30" (UTC-onafhankelijk: pak de tijd zoals opgeslagen). @param {string} ts */
const timeOf = (ts) => (typeof ts === 'string' && ts.length >= 16 ? ts.slice(11, 16) : '');

/**
 * Komende reserveringen → data + rooster (dag-rijen, max 7 dagen met boekingen).
 * Verwacht rows gesorteerd op starts_at (oplopend), al gefilterd op "loopt nog"
 * (ends_at > nu). resourceNames: resource-id → naam; names: profiel-id → naam.
 * @param {Array<{resource_id?:string|null, profile_id?:string|null, starts_at?:string|null, ends_at?:string|null, note?:string|null}>} [rows]
 * @param {Record<string,string>} [resourceNames]
 * @param {Record<string,string>} [names]
 * @param {string} [today] YYYY-MM-DD voor de vandaag-markering
 */
export function renderUpcomingReservations(rows = [], resourceNames = {}, names = {}, today = '') {
  const entries = rows
    .filter((r) => typeof r?.starts_at === 'string' && typeof r?.ends_at === 'string')
    .map((r) => ({
      resource: (r.resource_id && resourceNames[r.resource_id]) || 'Gedeeld',
      who: (r.profile_id && names[r.profile_id]) || null,
      date: /** @type {string} */ (r.starts_at).slice(0, 10),
      from: timeOf(/** @type {string} */ (r.starts_at)),
      to: timeOf(/** @type {string} */ (r.ends_at)),
    }));
  const data = { count: entries.length, reservations: entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Reserveringen', lines: ['Er staat niets gereserveerd.'] }] };
  }
  // Dag-rijen: alleen dagen mét boekingen (dit is een boekingenlijst, geen weekvenster).
  const byDate = /** @type {Record<string, typeof entries>} */ ({});
  for (const e of entries) (byDate[e.date] ??= []).push(e);
  const days = Object.keys(byDate).sort().slice(0, MAX_DAYS_SHOWN).map((date) => ({
    label: dayLabel(date),
    today: date === today,
    entries: byDate[date].map((e) => ({
      text: `${e.resource} ${e.from}–${e.to}${e.who ? ` (${e.who})` : ''}`,
    })),
  }));
  return { data, render: [scheduleNode({ title: 'Reserveringen', days })] };
}

// Module-brief (guidelines §1).
export const DELEN_BRIEF = {
  moduleKey: 'delen',
  label: 'Samen',
  brief: 'gedeelde spullen (auto, gereedschap) en hun reserveringen; kan tonen wat wanneer bezet of vrij is',
};

export const DELEN_TOOLS = [
  {
    name: 'delen_reserveringen',
    moduleKey: 'delen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Reserveringen nakijken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt of de (deel)auto of iets anders gedeelds vrij of bezet is, of wie iets wanneer heeft gereserveerd. Toont de komende reserveringen per dag.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const nowIso = `${ctx.today}T00:00:00Z`;
      const [resources, reservations] = await Promise.all([
        ctx.db.from('shared_resources').select('id, name').eq('household_id', ctx.householdId).limit(50),
        ctx.db.from('reservations').select('resource_id, profile_id, starts_at, ends_at, note')
          .eq('household_id', ctx.householdId).gt('ends_at', nowIso)
          .order('starts_at', { ascending: true }).limit(60),
      ]);
      const resourceNames = Object.fromEntries(throwOnError(resources).map((r) => [r.id, r.name]));
      return renderUpcomingReservations(throwOnError(reservations), resourceNames, ctx.memberNames ?? {}, ctx.today);
    },
  },
];

// Manifest: de enige declaratie per module (guidelines §1).
export const DELEN_MANIFEST = {
  moduleKey: DELEN_BRIEF.moduleKey,
  label: DELEN_BRIEF.label,
  brief: DELEN_BRIEF.brief,
  tools: DELEN_TOOLS,
};
