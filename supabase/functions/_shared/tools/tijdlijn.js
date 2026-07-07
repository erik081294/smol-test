// @ts-check
// Tool-pack van de Tijdlijn-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: de recente prikbord-berichten. De RLS-gebonden ctx.db
// filtert zichtbaarheid (subgroep/custom) automatisch op de vrager — de tool bouwt
// géén eigen autorisatie. De write (bericht plaatsen) volgt in fase B.
// Contract: zie taken.js. Bewust géén import van lib/timeline.js (extensieloze
// imports horen niet in de edge-bundel); de sortering hieronder spiegelt orderTimeline.

import { dayLabel, throwOnError } from './helpers.js';
import { imageNode } from './render.js';

const MAX_BODY_SNIPPET = 120;

/**
 * Recente prikbord-posts → data + lijst. Gepinde berichten eerst (nieuwst gepind
 * bovenaan), daarna de nieuwste posts — spiegel van lib/timeline.js orderTimeline.
 * Auteur via memberNames; body wordt op één regel geknipt. Met `photos` erbij
 * (AI-16 ronde 3) krijgt de bóvenste post mét foto zijn foto als image-node —
 * het pad komt uit de RLS-gefilterde query, de client signt zelf (storage-RLS).
 * @param {Array<{id:string, body?:string|null, author_id?:string|null, pinned_at?:string|null, created_at?:string|null}>} [rows]
 * @param {Record<string,string>} [names] profiel-id → weergavenaam
 * @param {Array<{post_id?:string|null, photo_path?:string|null}>} [photos] op position gesorteerd
 */
export function renderTimelineRecent(rows = [], names = {}, photos = []) {
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
  const render = /** @type {object[]} */ ([{ type: 'list', title: 'Prikbord', items }]);
  // De bovenste post mét foto (in de getoonde volgorde) krijgt zijn eerste
  // foto erbij; de caption is dezelfde regel als in de lijst.
  const photoIdx = sorted.findIndex((p) =>
    photos.some((ph) => ph?.post_id === p.id && typeof ph?.photo_path === 'string' && ph.photo_path.length > 0));
  if (photoIdx !== -1) {
    // De findIndex-treffer hierboven garandeert de find-hit (type-only cast).
    const photo = /** @type {{photo_path: string}} */ (photos.find((ph) => ph?.post_id === sorted[photoIdx].id && ph?.photo_path));
    render.push(imageNode({ bucket: 'timeline', path: photo.photo_path, caption: items[photoIdx].text }));
  }
  return { data, render };
}

export const MAX_POST_LENGTH = 2000;

/**
 * Puur voorstel-bouwwerk van tijdlijn_plaatsen (fase B, HITL). Post-tekst
 * verplicht (1-2000); zichtbaarheid is ALTIJD 'household' — de assistent
 * verzint nooit subgroup/custom (dat vergt geldige subgroep-ids en is een
 * bewuste mens-keuze in de app). Eén post per voorstel (items[0]).
 * @param {{ items?: Array<{body?:string}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposePost(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen bericht om te plaatsen.' };
  if (raw.length > 1) return { ok: false, error: 'Eén prikbord-bericht per voorstel.' };
  const body = typeof raw[0]?.body === 'string' ? raw[0].body.trim() : '';
  if (!body) return { ok: false, error: 'Het bericht heeft tekst nodig.' };
  if (body.length > MAX_POST_LENGTH) return { ok: false, error: `Een bericht mag maximaal ${MAX_POST_LENGTH} tekens zijn.` };
  const preview = body.length > 80 ? `${body.slice(0, 79)}…` : body;
  return { ok: true, summary: 'Bericht op het prikbord plaatsen', items: [preview], args: { items: [{ body }] } };
}

// Module-brief (guidelines §1).
export const TIJDLIJN_BRIEF = {
  moduleKey: 'tijdlijn',
  label: 'Tijdlijn',
  brief: 'het prikbord van het huishouden; kan de recente berichten tonen en een bericht plaatsen',
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
      // Foto's van deze posts (AI-16 ronde 3) — RLS erft de post-zichtbaarheid;
      // position oplopend zodat "eerste foto van de post" deterministisch is.
      const photos = rows.length > 0
        ? throwOnError(
            await ctx.db.from('timeline_photos')
              .select('post_id, photo_path, position')
              .in('post_id', rows.map((r) => r.id))
              .order('position', { ascending: true })
              .limit(30)
          )
        : [];
      return renderTimelineRecent(rows, ctx.memberNames ?? {}, photos);
    },
  },
  {
    name: 'tijdlijn_plaatsen',
    moduleKey: 'tijdlijn',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: alleen een nieuw bericht
    idempotent: false,  // nogmaals uitvoeren = dubbel bericht
    statusLabel: 'Bericht klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een bericht op het prikbord/de tijdlijn wil zetten voor de huisgenoten (bv. "zet op het prikbord dat de cv-monteur dinsdag komt"). Het bericht wordt zichtbaar voor het hele huishouden; de gebruiker beslist op de bevestigingskaart.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Het te plaatsen bericht (precies één).',
          items: {
            type: 'object',
            properties: {
              body: { type: 'string', description: 'De tekst van het bericht' },
            },
            required: ['body'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposePost,
    async execute(ctx, args) {
      const rows = throwOnError(
        await ctx.db.from('timeline_posts').insert({
          household_id: ctx.householdId,
          author_id: ctx.userId,
          body: args.items[0].body,
        }).select('id')
      );
      return {
        summary: 'Op het prikbord gezet.',
        inserted: rows.map((r) => ({ table: 'timeline_posts', id: r.id })),
      };
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
