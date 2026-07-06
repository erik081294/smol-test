// @ts-check
// Tool-pack van de Tijdlijn-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: de recente prikbord-berichten. De RLS-gebonden ctx.db
// filtert zichtbaarheid (subgroep/custom) automatisch op de vrager — de tool bouwt
// géén eigen autorisatie. De write (bericht plaatsen) volgt in fase B.
// Contract: zie taken.js. Bewust géén import van lib/timeline.js (extensieloze
// imports horen niet in de edge-bundel); de sortering hieronder spiegelt orderTimeline.

import { dayLabel, throwOnError } from './helpers.js';

const MAX_BODY_SNIPPET = 120;

/**
 * Recente prikbord-posts → data + lijst. Gepinde berichten eerst (nieuwst gepind
 * bovenaan), daarna de nieuwste posts — spiegel van lib/timeline.js orderTimeline.
 * Auteur via memberNames; body wordt op één regel geknipt.
 * @param {Array<{id:string, body?:string|null, author_id?:string|null, pinned_at?:string|null, created_at?:string|null}>} [rows]
 * @param {Record<string,string>} [names] profiel-id → weergavenaam
 */
export function renderTimelineRecent(rows = [], names = {}) {
  const sorted = [...rows].sort((a, b) => {
    const ap = a?.pinned_at ?? '';
    const bp = b?.pinned_at ?? '';
    if (Boolean(ap) !== Boolean(bp)) return ap ? -1 : 1;   // gepind eerst
    if (ap && bp && ap !== bp) return ap < bp ? 1 : -1;    // nieuwst gepind bovenaan
    const ac = a?.created_at ?? '';
    const bc = b?.created_at ?? '';
    return ac < bc ? 1 : ac > bc ? -1 : 0;                  // anders nieuwste eerst
  });
  const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const entries = sorted.map((p) => {
    const body = oneLine(p.body);
    return {
      author: (p.author_id && names[p.author_id]) || null,
      date: typeof p.created_at === 'string' ? p.created_at.slice(0, 10) : null,
      pinned: Boolean(p.pinned_at),
      snippet: body.length > MAX_BODY_SNIPPET ? `${body.slice(0, MAX_BODY_SNIPPET - 1)}…` : body,
    };
  });
  const data = { count: rows.length, posts: entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Prikbord', lines: ['Er staat nog niets op het prikbord.'] }] };
  }
  const items = entries.map((e) => {
    const meta = [e.author, e.date ? dayLabel(e.date) : null].filter(Boolean).join(', ');
    const text = e.snippet || '(foto)';
    return { text: meta ? `${text} — ${meta}` : text, emoji: e.pinned ? '📌' : null };
  });
  return { data, render: [{ type: 'list', title: 'Prikbord', items }] };
}

// Module-brief (guidelines §1).
export const TIJDLIJN_BRIEF = {
  moduleKey: 'tijdlijn',
  label: 'Tijdlijn',
  brief: 'het prikbord van het huishouden; kan de recente berichten tonen',
};

export const TIJDLIJN_TOOLS = [
  {
    name: 'tijdlijn_recent',
    moduleKey: 'tijdlijn',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Prikbord erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er op het prikbord of de tijdlijn staat, of wat huisgenoten recent hebben gedeeld. Toont de recente berichten (gepind bovenaan); je ziet alleen berichten die de vrager zelf mag zien.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const rows = throwOnError(
        await ctx.db.from('timeline_posts')
          .select('id, body, author_id, pinned_at, created_at')
          .eq('household_id', ctx.householdId)
          .order('created_at', { ascending: false })
          .limit(15)
      );
      return renderTimelineRecent(rows, ctx.memberNames ?? {});
    },
  },
];

// Manifest: de enige declaratie per module (guidelines §1).
export const TIJDLIJN_MANIFEST = {
  moduleKey: TIJDLIJN_BRIEF.moduleKey,
  label: TIJDLIJN_BRIEF.label,
  brief: TIJDLIJN_BRIEF.brief,
  tools: TIJDLIJN_TOOLS,
};
