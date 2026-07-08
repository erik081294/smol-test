// Unit-tests voor het Tijdlijn-tool-pack (tools/tijdlijn.js, AI-19 fase A):
// orderTimeline-spiegel (gepind eerst), snippet-knip en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIJDLIJN_TOOLS, TIJDLIJN_BRIEF, TIJDLIJN_MANIFEST, renderTimelineRecent, proposePost, MAX_POST_LENGTH } from '../supabase/functions/_shared/tools/tijdlijn.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = TIJDLIJN_TOOLS.find((t) => t.name === 'tijdlijn_recent');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(TIJDLIJN_BRIEF, {
    moduleKey: 'tijdlijn',
    label: 'Tijdlijn',
    brief: 'het prikbord van het huishouden; kan de recente berichten tonen en een bericht plaatsen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(TIJDLIJN_MANIFEST, { moduleKey: 'tijdlijn', label: 'Tijdlijn', brief: TIJDLIJN_BRIEF.brief, tools: TIJDLIJN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'tijdlijn_recent',
    moduleKey: 'tijdlijn',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Prikbord erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er op het prikbord of de tijdlijn staat, of wat huisgenoten recent hebben gedeeld. Toont de recente berichten (gepind bovenaan); je ziet alleen berichten die de vrager zelf mag zien.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('renderTimelineRecent: gepind eerst (nieuwst gepind bovenaan), dan nieuwste; ook met omgekeerde invoer', () => {
  const rows = [
    { id: 'a', body: 'Oud bericht', author_id: 'u2', pinned_at: null, created_at: '2026-07-01T10:00:00Z' },
    { id: 'b', body: 'Nieuw bericht', author_id: 'u1', pinned_at: null, created_at: '2026-07-05T10:00:00Z' },
    { id: 'c', body: 'Oud gepind', author_id: 'u1', pinned_at: '2026-06-01T10:00:00Z', created_at: '2026-05-01T10:00:00Z' },
    { id: 'd', body: 'Vers gepind', author_id: 'u2', pinned_at: '2026-07-02T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
  ];
  const volgorde = (input) => renderTimelineRecent(input, {}).data.posts.map((p) => p.snippet);
  assert.deepEqual(volgorde(rows), ['Vers gepind', 'Oud gepind', 'Nieuw bericht', 'Oud bericht']);
  assert.deepEqual(volgorde([...rows].reverse()), ['Vers gepind', 'Oud gepind', 'Nieuw bericht', 'Oud bericht']);
});

test('renderTimelineRecent: snippet op één regel geknipt, auteur/datum in de regel, foto-post leesbaar', () => {
  const lang = 'regel één\nregel twee ' + 'x'.repeat(200);
  const { data, render } = renderTimelineRecent(
    [
      { id: 'a', body: lang, author_id: 'u1', pinned_at: '2026-07-02T10:00:00Z', created_at: '2026-07-02T10:00:00Z' },
      { id: 'b', body: null, author_id: 'u9', pinned_at: null, created_at: '2026-07-01T10:00:00Z' },
    ],
    { u1: 'Erik' }
  );
  assert.equal(data.posts[0].snippet.length, 120);
  assert.equal(data.posts[0].snippet.endsWith('…'), true);
  assert.equal(data.posts[0].snippet.includes('\n'), false);
  assert.equal(render[0].items[0].emoji, '📌');
  // Onbekende auteur → geen naam; lege body → "(foto)".
  assert.equal(render[0].items[1].text, '(foto) — wo 1 jul');
});

test('renderTimelineRecent: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderTimelineRecent().render, [{ type: 'card', title: 'Prikbord', lines: ['Er staat nog niets op het prikbord.'] }]);
});

test('tijdlijn_recent: juiste tabel/kolommen (RLS filtert zichtbaarheid — geen eigen autorisatie)', async () => {
  const calls = [];
  await tool.run(toolCtx({ timeline_posts: [] }, calls));
  const call = calls.find((c) => c.table === 'timeline_posts');
  assert.equal(call.selected, 'id, body, author_id, pinned_at, created_at');
  assert.deepEqual(call.filters, [['eq', 'household_id', 'h1']]);
});

// --- Fase B: tijdlijn_plaatsen (HITL; zichtbaarheid altijd household).

test('proposePost: één bericht per voorstel, tekst verplicht, preview geknipt op 80', () => {
  const lang = 'x'.repeat(200);
  const out = proposePost({ items: [{ body: `  ${lang}  ` }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, 'Bericht op het prikbord plaatsen');
  assert.equal(out.items[0].length, 80);
  assert.equal(out.items[0].endsWith('…'), true);
  assert.deepEqual(out.args.items, [{ body: lang }]);
  assert.equal(proposePost({ items: [{ body: '' }] }).ok, false);
  assert.equal(proposePost({ items: [{ body: 'a' }, { body: 'b' }] }).ok, false);
  assert.equal(proposePost({ items: [{ body: 'x'.repeat(MAX_POST_LENGTH + 1) }] }).ok, false);
  assert.equal(proposePost().ok, false);
});

test('tijdlijn_plaatsen: execute schrijft de post op eigen naam (author = vrager, geen visibility-args)', async () => {
  const tool2 = TIJDLIJN_TOOLS.find((t) => t.name === 'tijdlijn_plaatsen');
  const calls = [];
  const out = await tool2.execute(toolCtx({}, calls), { items: [{ body: 'De cv-monteur komt dinsdag' }] });
  const ins = calls.find((c) => c.table === 'timeline_posts');
  assert.deepEqual(ins.inserted, [{ household_id: 'h1', author_id: 'u1', body: 'De cv-monteur komt dinsdag' }]);
  assert.deepEqual(out.inserted, [{ table: 'timeline_posts', id: 'timeline_posts-1' }]);
});

// Descriptor-contract van de write-tool exact vastpinnen (zelfde reden als bij
// de read-tool: een gewijzigde description verandert de tool-selectie en hoort
// een test te breken — en gaat daarna door de eval-gate).
test('descriptor-contract (write): statische vorm ligt exact vast', () => {
  const w = TIJDLIJN_TOOLS.find((t) => t.name === 'tijdlijn_plaatsen');
  assert.deepEqual(shape(w), {
      "name": "tijdlijn_plaatsen",
      "moduleKey": "tijdlijn",
      "kind": "write",
      "risk": "write",
      "destructive": false,
      "idempotent": false,
      "statusLabel": "Bericht klaarzetten…",
      "description": "Roep dit aan wanneer de gebruiker een bericht op het prikbord/de tijdlijn wil zetten voor de huisgenoten (bv. \"zet op het prikbord dat de cv-monteur dinsdag komt\"). Het bericht wordt zichtbaar voor het hele huishouden; de gebruiker beslist op de bevestigingskaart.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "description": "Het te plaatsen bericht (precies één).",
            "items": {
              "type": "object",
              "properties": {
                "body": {
                  "type": "string",
                  "description": "De tekst van het bericht"
                }
              },
              "required": [
                "body"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "items"
        ],
        "additionalProperties": false
      }
    });
});

test('proposePost: foutteksten liggen vast; precies 80 tekens knipt niet', () => {
  assert.equal(proposePost({ items: [] }).error, 'Geen bericht om te plaatsen.');
  assert.equal(proposePost({ items: [{ body: 'a' }, { body: 'b' }] }).error, 'Eén prikbord-bericht per voorstel.');
  assert.equal(proposePost({ items: [{ body: '  ' }] }).error, 'Het bericht heeft tekst nodig.');
  const exact = 'x'.repeat(80);
  assert.equal(proposePost({ items: [{ body: exact }] }).items[0], exact);
  assert.equal(proposePost({ items: [{ body: 'x'.repeat(MAX_POST_LENGTH) }] }).ok, true);
});

// --- Prikbord-foto (AI-16 ronde 3): image-node bij de bovenste post mét foto.

test('renderTimelineRecent: bovenste post mét foto krijgt een image-node (gepind wint van nieuwer)', () => {
  const rows = [
    { id: 'a', body: 'Nieuwste zonder foto', pinned_at: null, created_at: '2026-07-05T10:00:00Z' },
    { id: 'b', body: 'Gepind met foto', pinned_at: '2026-07-01T10:00:00Z', created_at: '2026-06-01T10:00:00Z' },
    { id: 'c', body: 'Ouder met foto', pinned_at: null, created_at: '2026-05-01T10:00:00Z' },
  ];
  const photos = [
    { post_id: 'c', photo_path: 'h1/c/1.jpg', position: 0 },
    { post_id: 'b', photo_path: 'h1/b/1.jpg', position: 0 },  // eerste foto (position) van de gepinde post
    { post_id: 'b', photo_path: 'h1/b/2.jpg', position: 1 },
  ];
  const { render } = renderTimelineRecent(rows, { }, photos);
  assert.equal(render.length, 2);
  assert.equal(render[1].type, 'image');
  assert.equal(render[1].bucket, 'timeline');
  assert.equal(render[1].path, 'h1/b/1.jpg');                 // gepind staat bovenaan → zijn foto wint
  assert.equal(render[1].caption.startsWith('Gepind met foto'), true);
  assert.equal(typeof render[1].text, 'string');              // fallback voor oude clients
  // Geen foto's (of default) → alleen de lijst, geen lege image-node.
  assert.equal(renderTimelineRecent(rows, {}).render.length, 1);
  assert.equal(renderTimelineRecent(rows, {}, [{ post_id: 'x', photo_path: '' }]).render.length, 1);
});

test('tijdlijn_recent: haalt de foto-rijen van de getoonde posts op (position oplopend)', async () => {
  const calls = [];
  await tool.run(toolCtx({ timeline_posts: [{ id: 'a', body: 'x', created_at: '2026-07-01' }], timeline_photos: [] }, calls));
  const photoCall = calls.find((c) => c.table === 'timeline_photos');
  assert.equal(photoCall.selected, 'post_id, photo_path, position');
  assert.deepEqual(photoCall.filters, [['in', 'post_id', ['a']]]);
  assert.deepEqual(photoCall.order, ['position', { ascending: true }]);
  // Zonder posts géén foto-query (geen lege .in()-roundtrip).
  const leeg = [];
  await tool.run(toolCtx({ timeline_posts: [] }, leeg));
  assert.equal(leeg.some((c) => c.table === 'timeline_photos'), false);
});

test('renderTimelineRecent: foto-keuze volgt de getoonde volgorde en verdraagt rommel-fotorijen', () => {
  const rows = [
    { id: 'a', body: 'Bovenste zonder foto', author_id: 'u1', pinned_at: null, created_at: '2026-07-05T10:00:00Z' },
    { id: 'c', body: 'Ouder met foto', author_id: 'u1', pinned_at: null, created_at: '2026-07-01T10:00:00Z' },
  ];
  // Rommel in de fotorijen (null, zonder pad, leeg pad) mag nooit crashen én
  // telt niet als foto — de bovenste post zónder echte foto wordt overgeslagen.
  const photos = [null, { post_id: 'a' }, { post_id: 'a', photo_path: '' }, { post_id: 'c', photo_path: 'h1/c/1.jpg' }];
  const { render } = renderTimelineRecent(rows, { u1: 'Erik' }, photos);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Prikbord');
  assert.equal(render[1].path, 'h1/c/1.jpg');
  // Caption = exact de lijstregel: snippet — auteur, datum (mét komma-scheiding).
  assert.equal(render[1].caption, 'Ouder met foto — Erik, wo 1 jul');
});

// ── Ratchet-verdieping (AI-19 fase C): de randen die de mutatietest aanwees. ──

test('renderTimelineRecent: tie-breaks — beide gepind (nieuwst gepind eerst), gelijke pinned_at → created_at beslist', () => {
  const { data } = renderTimelineRecent([
    { id: 'a', body: 'a', pinned_at: '2026-07-01T10:00:00Z', created_at: '2026-06-01T10:00:00Z' },
    { id: 'b', body: 'b', pinned_at: '2026-07-02T10:00:00Z', created_at: '2026-05-01T10:00:00Z' },
    { id: 'c', body: 'c', pinned_at: '2026-07-01T10:00:00Z', created_at: '2026-06-15T10:00:00Z' },
  ]);
  // b (nieuwst gepind) → dan a/c (zelfde pin-moment) op created_at nieuwste eerst.
  assert.deepEqual(data.posts.map((p) => p.snippet), ['b', 'c', 'a']);
});

test('renderTimelineRecent: snippet-grens exact op 120; whitespace op één regel; kale post zonder meta', () => {
  const precies = 'x'.repeat(120);
  const over = 'y'.repeat(121);
  const { data, render } = renderTimelineRecent([
    { id: 'a', body: precies, created_at: '2026-07-06T10:00:00Z' },
    { id: 'b', body: over, created_at: '2026-07-05T10:00:00Z' },
    { id: 'c', body: '  regel\n\n twee  ', created_at: null },       // geen datum/auteur → geen meta-deel
  ]);
  assert.equal(data.posts[0].snippet, precies);                       // 120 knipt niet
  assert.equal(data.posts[1].snippet, `${'y'.repeat(119)}…`);         // 121 → 119 + …
  assert.equal(data.posts[2].snippet, 'regel twee');
  assert.equal(data.posts[2].date, null);
  assert.equal(render[0].items[2].text, 'regel twee');                // zonder meta géén " — "
  assert.equal(render[0].items[2].emoji, null);                       // niet gepind → geen speld
});

test('proposePost: exacte fouttekst per pad; grens 2000/2001; kapot item', () => {
  assert.deepEqual(proposePost(), { ok: false, error: 'Geen bericht om te plaatsen.' });
  assert.equal(proposePost({ items: [{ body: 'a' }, { body: 'b' }] }).error, 'Eén prikbord-bericht per voorstel.');
  assert.deepEqual(proposePost({ items: [null] }), { ok: false, error: 'Het bericht heeft tekst nodig.' });
  assert.equal(proposePost({ items: [{ body: '   ' }] }).error, 'Het bericht heeft tekst nodig.');
  assert.equal(proposePost({ items: [{ body: 'x'.repeat(2000) }] }).ok, true);
  assert.equal(proposePost({ items: [{ body: 'x'.repeat(2001) }] }).error, 'Een bericht mag maximaal 2000 tekens zijn.');
  // Preview-grens: 81 tekens → 79 + ellipsis.
  assert.equal(proposePost({ items: [{ body: 'z'.repeat(81) }] }).items[0], `${'z'.repeat(79)}…`);
});

test('tijdlijn_recent/tijdlijn_plaatsen: query-/insert-vorm ligt exact vast', async () => {
  const calls = [];
  await tool.run(toolCtx({
    timeline_posts: [{ id: 'p1', body: 'hoi', author_id: 'u1', pinned_at: null, created_at: '2026-07-06T10:00:00Z' }],
    timeline_photos: [],
  }, calls));
  const pq = calls.find((c) => c.table === 'timeline_posts');
  assert.equal(pq.selected, 'id, body, author_id, pinned_at, created_at');
  assert.deepEqual(pq.filters, [['eq', 'household_id', 'h1']]);
  assert.deepEqual(pq.order, ['created_at', { ascending: false }]);
  const fq = calls.find((c) => c.table === 'timeline_photos');
  assert.equal(fq.selected, 'post_id, photo_path, position');
  assert.deepEqual(fq.filters, [['in', 'post_id', ['p1']]]);
  assert.deepEqual(fq.order, ['position', { ascending: true }]);

  const w = TIJDLIJN_TOOLS.find((t) => t.name === 'tijdlijn_plaatsen');
  const calls2 = [];
  const out = await w.execute(toolCtx({}, calls2), { items: [{ body: 'De cv-monteur komt dinsdag' }] });
  const ins = calls2.find((c) => c.table === 'timeline_posts');
  assert.deepEqual(ins.inserted, [{ household_id: 'h1', author_id: 'u1', body: 'De cv-monteur komt dinsdag' }]);
  assert.equal(ins.selected, 'id');
  assert.equal(out.summary, 'Op het prikbord gezet.');
});
