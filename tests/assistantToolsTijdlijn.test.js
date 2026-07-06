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
