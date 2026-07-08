// @ts-check
// Tool-pack van de Samen/Delen-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: de komende reserveringen op gedeelde spullen (auto,
// gereedschap…), als rooster per dag. De write (reserveren, mét conflictcheck —
// de DB dwingt overlap niet af!) volgt in fase B; rit-kosten boeken blijft bewust
// búíten de assistent (plan 27). Contract: zie taken.js.
// Bewust géén import van lib/reservations.js (date-fns hoort niet in de edge-bundel).

import { dayLabel, isIsoDate, isHhmm, localDate, localHhmm, throwOnError, toUtcIso } from './helpers.js';
import { scheduleNode } from './render.js';

const MAX_DAYS_SHOWN = 7;

/**
 * Komende reserveringen → data + rooster (dag-rijen, max 7 dagen met boekingen).
 * Verwacht rows gesorteerd op starts_at (oplopend), al gefilterd op "loopt nog"
 * (ends_at > nu). resourceNames: resource-id → naam; names: profiel-id → naam.
 * De DB slaat UTC-instants op (de app schrijft Date.toISOString()); weergave
 * loopt via de client-tijdzone-offset (ctx.tzOffsetMinutes).
 * @param {Array<{resource_id?:string|null, profile_id?:string|null, starts_at?:string|null, ends_at?:string|null, note?:string|null}>} [rows]
 * @param {Record<string,string>} [resourceNames]
 * @param {Record<string,string>} [names]
 * @param {string} [today] YYYY-MM-DD voor de vandaag-markering
 * @param {number} [tzOffsetMinutes] minuten oost van UTC (client-device)
 */
export function renderUpcomingReservations(rows = [], resourceNames = {}, names = {}, today = '', tzOffsetMinutes = 0) {
  const entries = rows
    .filter((r) => typeof r?.starts_at === 'string' && typeof r?.ends_at === 'string')
    .map((r) => ({
      resource: (r.resource_id && resourceNames[r.resource_id]) || 'Gedeeld',
      who: (r.profile_id && names[r.profile_id]) || null,
      date: localDate(r.starts_at, tzOffsetMinutes),
      from: localHhmm(r.starts_at, tzOffsetMinutes),
      to: localHhmm(r.ends_at, tzOffsetMinutes),
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

export const MAX_PROPOSED_RESERVATIONS = 3;

/**
 * Puur voorstel-bouwwerk van delen_reserveren (fase B, HITL). Valideert datum en
 * HH:MM-tijden, componeert UTC-instants via de client-tijdzone-offset (env) en
 * lijnt items ↔ args.items 1-op-1 uit. De naam→resource-koppeling én de
 * conflictcheck gebeuren pas bij execute (propose is puur, geen db) — de DB
 * dwingt overlap niet af, dus execute is de verplichte poort.
 * @param {{ items?: Array<{resource_name?:string, date?:string, from?:string, to?:string, note?:string}> }} [args]
 * @param {{ today?: string, tzOffsetMinutes?: number }} [env]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeReserve(args = {}, env = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen reservering om te plaatsen.' };
  if (raw.length > MAX_PROPOSED_RESERVATIONS) return { ok: false, error: `Maximaal ${MAX_PROPOSED_RESERVATIONS} reserveringen per voorstel.` };
  const off = Number.isInteger(env.tzOffsetMinutes) ? /** @type {number} */ (env.tzOffsetMinutes) : 0;
  const items = [];
  const norm = [];
  for (const it of raw) {
    const name = typeof it?.resource_name === 'string' ? it.resource_name.trim() : '';
    if (!name) return { ok: false, error: 'Zeg erbij wát je wilt reserveren (bv. de deelauto).' };
    if (!isIsoDate(it?.date ?? '')) return { ok: false, error: `Ongeldige datum: ${it?.date} (gebruik YYYY-MM-DD).` };
    if (!isHhmm(it?.from ?? '') || !isHhmm(it?.to ?? '')) {
      return { ok: false, error: 'Geef een begin- en eindtijd als HH:MM (bv. 14:00).' };
    }
    if (/** @type {string} */ (it.to) <= /** @type {string} */ (it.from)) {
      return { ok: false, error: 'De eindtijd moet ná de begintijd liggen.' };
    }
    const startsAt = toUtcIso(/** @type {string} */ (it.date), /** @type {string} */ (it.from), off);
    const endsAt = toUtcIso(/** @type {string} */ (it.date), /** @type {string} */ (it.to), off);
    // Stryker disable next-line all -- defensief: isIsoDate/isHhmm zijn hierboven al gevalideerd, dus toUtcIso kan hier niet op null uitkomen (equivalente mutanten).
    if (!startsAt || !endsAt) return { ok: false, error: 'De datum/tijd kon niet worden verwerkt.' };
    const note = typeof it?.note === 'string' && it.note.trim() ? it.note.trim().slice(0, 200) : null;
    norm.push({ resource_name: name, starts_at: startsAt, ends_at: endsAt, note });
    items.push(`${name} — ${dayLabel(/** @type {string} */ (it.date))} ${it.from}–${it.to}`);
  }
  const summary = norm.length === 1
    ? `${norm[0].resource_name} reserveren (${items[0].split(' — ')[1]})`
    : `${norm.length} reserveringen plaatsen`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (guidelines §1).
export const DELEN_BRIEF = {
  moduleKey: 'delen',
  label: 'Samen',
  brief: 'gedeelde spullen (auto, gereedschap) en hun reserveringen; kan tonen wat bezet is en kan reserveren',
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
      return renderUpcomingReservations(throwOnError(reservations), resourceNames, ctx.memberNames ?? {}, ctx.today, ctx.tzOffsetMinutes ?? 0);
    },
  },
  {
    name: 'delen_reserveren',
    moduleKey: 'delen',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: zet alleen een nieuwe reservering
    idempotent: false,  // nogmaals uitvoeren = dubbele boeking (execute weigert overlap)
    statusLabel: 'Reservering klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker de deelauto of iets anders gedeelds wil reserveren of vastleggen voor een tijdvak (bv. "reserveer de auto zaterdag van 14 tot 16"). Kijk zo nodig eerst met delen_reserveringen wat er al bezet is. Stelt de reservering voor: de gebruiker beslist op de bevestigingskaart; een tijdvak dat toch al bezet blijkt wordt bij uitvoeren geweigerd. Rit-kosten boeken hoort hier niet bij.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De te plaatsen reserveringen (meestal één, maximaal 3).',
          items: {
            type: 'object',
            properties: {
              resource_name: { type: 'string', description: 'Wat er gereserveerd wordt, zoals het in de app heet (bv. "Deelauto")' },
              date: { type: 'string', description: 'De dag als YYYY-MM-DD' },
              from: { type: 'string', description: 'Begintijd als HH:MM (24-uurs, lokale tijd)' },
              to: { type: 'string', description: 'Eindtijd als HH:MM (24-uurs, lokale tijd)' },
              note: { type: 'string', description: 'Optionele notitie, bv. het doel van de rit' },
            },
            required: ['resource_name', 'date', 'from', 'to'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeReserve,
    async execute(ctx, args) {
      // Naam → resource (case-insensitief, exact) + verplichte conflictcheck:
      // de DB dwingt overlap níét af (alleen ends_at > starts_at), dus dit is
      // de poort tegen dubbelboeken. Half-open interval: rakend telt niet.
      const resources = throwOnError(
        await ctx.db.from('shared_resources').select('id, name').eq('household_id', ctx.householdId).limit(50)
      );
      const inserted = [];
      for (const it of args.items) {
        const wanted = it.resource_name.trim().toLowerCase();
        const hits = resources.filter((r) => (r.name ?? '').trim().toLowerCase() === wanted);
        if (hits.length !== 1) {
          throw new Error(`"${it.resource_name}" is niet (eenduidig) gevonden bij de gedeelde spullen.`);
        }
        const existing = throwOnError(
          await ctx.db.from('reservations').select('id, starts_at, ends_at')
            .eq('resource_id', hits[0].id).gt('ends_at', it.starts_at).limit(200)
        );
        const conflict = existing.some((r) => r.starts_at < it.ends_at && it.starts_at < r.ends_at);
        if (conflict) {
          throw new Error(`${hits[0].name} is in dat tijdvak al gereserveerd — kies een ander moment.`);
        }
        const rows = throwOnError(
          await ctx.db.from('reservations').insert({
            household_id: ctx.householdId,
            resource_id: hits[0].id,
            profile_id: ctx.userId,
            starts_at: it.starts_at,
            ends_at: it.ends_at,
            note: it.note,
          }).select('id')
        );
        inserted.push(...rows.map((r) => ({ table: 'reservations', id: r.id })));
      }
      return {
        summary: inserted.length === 1 ? 'Gereserveerd.' : `${inserted.length} reserveringen geplaatst.`,
        inserted,
      };
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
