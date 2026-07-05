// @ts-check
// Tool-pack van de Taken-module (assistent-skill-file, guidelines §1).
// Levert wat de assistent met taken kan: lezen (taken_open) en voorstellen
// (taken_toevoegen — HITL: de harness onderschept elke write-call en maakt er
// een bevestigingsvoorstel van; `execute` draait pas ná gebruikersbevestiging).
//
// Contract (bewaakt door tests/assistantToolPacks.test.js):
//  - naam = `<moduleKey>_<onderwerp>`; parameters met additionalProperties:false;
//  - read-tool → `run(ctx, args)`; write-tool → puur `propose(args, env)` +
//    `execute(ctx, args)` en de annotaties `destructive`/`idempotent` (MCP-vocabulaire);
//  - render is server-side en deterministisch; het model krijgt alleen `data`.

import { dayLabel, isIsoDate, resolveMemberId, throwOnError } from './helpers.js';

/**
 * Open taken → data + kaart. Sorteert op due_date (zonder datum achteraan).
 * @param {Array<{title:string, due_date?:string|null, assigned_to?:string|null}>} [rows]
 * @param {Record<string,string>} [names] profiel-id → weergavenaam
 */
export function renderOpenTasks(rows = [], names = {}) {
  const sorted = [...rows].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  });
  const items = sorted.map((t) => {
    const who = t.assigned_to ? names[t.assigned_to] : null;
    const parts = [t.title, t.due_date ?? null, who ?? null].filter(Boolean);
    return { text: parts.join(' · ') };
  });
  const data = { count: rows.length, tasks: sorted.map((t) => ({ title: t.title, due_date: t.due_date ?? null, assignee: (t.assigned_to && names[t.assigned_to]) || null })) };
  const render = items.length > 0
    ? [{ type: 'list', title: `Open taken (${items.length})`, items }]
    : [{ type: 'card', title: 'Open taken', lines: ['Niets open — lekker bezig!'] }];
  return { data, render };
}

export const MAX_PROPOSED_TASKS = 10;

/**
 * Puur voorstel-bouwwerk van taken_toevoegen: valideer/normaliseer de model-args
 * naar een bevestigbaar voorstel. `items` (weergaveteksten) loopt 1-op-1 met
 * `args.items` — de harness gebruikt die uitlijning voor per-item aan/uitvinken.
 * @param {{ items?: Array<{title?:string, due_date?:string, assignee_name?:string}> }} [args]
 * @param {{ memberNames?: Record<string,string> }} [env]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposeAddTasks(args = {}, env = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen taken om toe te voegen.' };
  if (raw.length > MAX_PROPOSED_TASKS) return { ok: false, error: `Maximaal ${MAX_PROPOSED_TASKS} taken per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) return { ok: false, error: 'Elke taak heeft een titel nodig.' };
    if (title.length > 120) return { ok: false, error: 'Een taaktitel mag maximaal 120 tekens zijn.' };
    const due = typeof it?.due_date === 'string' && it.due_date.length > 0 ? it.due_date : null;
    if (due !== null && !isIsoDate(due)) return { ok: false, error: `Ongeldige datum: ${due} (gebruik YYYY-MM-DD).` };
    const assigneeId = resolveMemberId(it?.assignee_name, env.memberNames ?? {});
    const who = assigneeId ? (env.memberNames ?? {})[assigneeId] : null;
    norm.push({ title, due_date: due, assigned_to: assigneeId });
    items.push([title, due ? dayLabel(due) : null, who].filter(Boolean).join(' · '));
  }
  const summary = norm.length === 1 ? `Taak "${norm[0].title}" toevoegen` : `${norm.length} taken toevoegen`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const TAKEN_BRIEF = {
  moduleKey: 'taken',
  label: 'Taken',
  brief: 'open taken en klusjes van het huishouden; kan taken bekijken en nieuwe taken voorstellen',
};

export const TAKEN_TOOLS = [
  {
    name: 'taken_open',
    moduleKey: 'taken',
    kind: 'read',
    statusLabel: 'Even in de taken kijken…',
    description: 'Roep dit aan zodra de gebruiker vraagt wat er nog moet gebeuren, naar deadlines, of wie welke taak doet — antwoord niet uit het geheugen. Haalt de open (niet-afgeronde) taken van het huishouden op, optioneel alleen die van de vrager (only_mine).',
    parameters: {
      type: 'object',
      properties: { only_mine: { type: 'boolean', description: 'Alleen taken die aan de vrager zijn toegewezen' } },
      required: [],
      additionalProperties: false,
    },
    async run(ctx, args = {}) {
      let q = ctx.db
        .from('tasks')
        .select('title, due_date, assigned_to')
        .eq('household_id', ctx.householdId)
        .is('completed_at', null);
      if (args.only_mine === true) q = q.eq('assigned_to', ctx.userId);
      const rows = throwOnError(await q.order('due_date', { ascending: true, nullsFirst: false }).limit(50));
      return renderOpenTasks(rows, ctx.memberNames ?? {});
    },
  },
  {
    name: 'taken_toevoegen',
    moduleKey: 'taken',
    kind: 'write',
    destructive: false, // additief: voegt alleen nieuwe taken toe
    idempotent: false,  // nogmaals uitvoeren = dubbele taken
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een taak of klusje wil vastleggen (niet voor een maaltijd — gebruik daarvoor maaltijden_plannen). Stelt één of meer taken voor: de gebruiker ziet een bevestigingskaart en beslist zelf, er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De toe te voegen taken (maximaal 10).',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Korte taaktitel, bv. "Stofzuigen"' },
              due_date: { type: 'string', description: 'Optionele deadline als YYYY-MM-DD' },
              assignee_name: { type: 'string', description: 'Optionele naam van het huisgenoot-lid dat de taak krijgt' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeAddTasks,
    async execute(ctx, args) {
      const rows = args.items.map((it) => ({
        household_id: ctx.householdId,
        created_by: ctx.userId,
        title: it.title,
        due_date: it.due_date,
        assigned_to: it.assigned_to,
      }));
      const inserted = throwOnError(await ctx.db.from('tasks').insert(rows).select('id'));
      return {
        summary: inserted.length === 1 ? 'Taak toegevoegd.' : `${inserted.length} taken toegevoegd.`,
        inserted: inserted.map((r) => ({ table: 'tasks', id: r.id })),
      };
    },
  },
];
