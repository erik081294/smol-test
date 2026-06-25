// Units voor de pure kern van de tijdlijn / prikbord (TML-1). Zie lib/timeline.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTimeline, summarizePost, isPostValid } from '../lib/timeline.js';

const ids = (list) => list.map((p) => p.id);

test('orderTimeline: nieuwste post eerst (ongepind, op created_at desc)', () => {
  const posts = [
    { id: 'a', created_at: '2026-06-20T10:00:00Z' },
    { id: 'b', created_at: '2026-06-22T10:00:00Z' },
    { id: 'c', created_at: '2026-06-21T10:00:00Z' },
  ];
  assert.deepEqual(ids(orderTimeline(posts)), ['b', 'c', 'a']);
});

test('orderTimeline: een gepinde OUDE post staat boven een ongepinde NIEUWE (grens)', () => {
  const posts = [
    { id: 'nieuw', created_at: '2026-06-25T10:00:00Z', pinned_at: null },
    { id: 'gepind-oud', created_at: '2026-06-01T10:00:00Z', pinned_at: '2026-06-02T00:00:00Z' },
  ];
  // Gepind wint, ook al is de andere recenter.
  assert.deepEqual(ids(orderTimeline(posts)), ['gepind-oud', 'nieuw']);
});

test('orderTimeline: twee gepinde sorteren onderling op pinned_at desc', () => {
  const posts = [
    { id: 'pin-vroeg', created_at: '2026-06-10T00:00:00Z', pinned_at: '2026-06-11T00:00:00Z' },
    { id: 'pin-laat', created_at: '2026-06-01T00:00:00Z', pinned_at: '2026-06-20T00:00:00Z' },
    { id: 'los', created_at: '2026-06-25T00:00:00Z' },
  ];
  // Beide pins boven de losse; onderling nieuwste pin eerst — assert de héle lijst.
  assert.deepEqual(ids(orderTimeline(posts)), ['pin-laat', 'pin-vroeg', 'los']);
});

test('orderTimeline: stabiel ook met omgekeerde invoer-volgorde (tie-break-richting)', () => {
  const base = [
    { id: 'b', created_at: '2026-06-22T10:00:00Z' },
    { id: 'a', created_at: '2026-06-20T10:00:00Z' },
  ];
  assert.deepEqual(ids(orderTimeline(base)), ['b', 'a']);
  assert.deepEqual(ids(orderTimeline([...base].reverse())), ['b', 'a']);
});

test('orderTimeline: muteert de invoer niet en werkt zonder argument', () => {
  const posts = [
    { id: 'a', created_at: '2026-06-20T10:00:00Z' },
    { id: 'b', created_at: '2026-06-22T10:00:00Z' },
  ];
  const snapshot = ids(posts);
  orderTimeline(posts);
  assert.deepEqual(ids(posts), snapshot, 'invoer ongewijzigd');
  assert.deepEqual(orderTimeline(), []); // default-param: leeg → leeg
});

test('orderTimeline: ontbrekende created_at zakt naar onder', () => {
  const posts = [
    { id: 'leeg' },
    { id: 'echt', created_at: '2026-06-22T10:00:00Z' },
  ];
  assert.deepEqual(ids(orderTimeline(posts)), ['echt', 'leeg']);
});

test('summarizePost: tekst + foto’s samengevat, body getrimd', () => {
  const s = summarizePost(
    { id: 'p1', body: '  hallo huis  ', author_id: 'u1', photos: [{ id: 'f1' }, { id: 'f2' }], created_at: '2026-06-25T11:59:30Z' },
    { now: Date.parse('2026-06-25T12:00:00Z') },
  );
  assert.equal(s.id, 'p1');
  assert.equal(s.body, 'hallo huis');
  assert.equal(s.hasBody, true);
  assert.equal(s.photoCount, 2);
  assert.equal(s.hasPhotos, true);
  assert.equal(s.pinned, false);
  assert.equal(s.authorId, 'u1');
  assert.equal(s.when, 'zojuist');
});

test('summarizePost: foto-only bericht (geen body) + gepind', () => {
  const s = summarizePost({ id: 'p2', body: null, photos: [{ id: 'f' }], pinned_at: '2026-06-25T00:00:00Z' });
  assert.equal(s.hasBody, false);
  assert.equal(s.body, '');
  assert.equal(s.hasPhotos, true);
  assert.equal(s.pinned, true);
});

test('summarizePost: bericht zonder foto’s', () => {
  const s = summarizePost({ id: 'p3', body: 'tekst', created_at: '2026-06-25T10:00:00Z' });
  assert.equal(s.photoCount, 0);
  assert.equal(s.hasPhotos, false);
});

test('orderTimeline: defensief bij een null-element (crasht niet, echte post eerst)', () => {
  const out = orderTimeline([null, { id: 'echt', created_at: '2026-06-20T10:00:00Z' }]);
  assert.equal(out[0]?.id, 'echt');
  assert.equal(out[1], null);
});

test('orderTimeline: een ongeldige datum-string zakt naar onder (niet naar boven)', () => {
  const posts = [
    { id: 'kapot', created_at: 'niet-een-datum' },
    { id: 'goed', created_at: '2026-06-20T10:00:00Z' },
  ];
  assert.deepEqual(ids(orderTimeline(posts)), ['goed', 'kapot']);
});

test('summarizePost: undefined invoer → veilige standaardwaarden (geen crash)', () => {
  const s = summarizePost(undefined);
  assert.equal(s.id, undefined);
  assert.equal(s.body, '');
  assert.equal(s.hasBody, false);
  assert.equal(s.photoCount, 0);
  assert.equal(s.hasPhotos, false);
  assert.equal(s.pinned, false);
  assert.equal(s.authorId, undefined);
  assert.equal(typeof s.when, 'string');
});

test('isPostValid: tekst óf foto vereist; leeg/whitespace ongeldig', () => {
  assert.equal(isPostValid({ body: 'iets' }), true);            // alleen tekst
  assert.equal(isPostValid({ body: '', photoCount: 1 }), true); // alleen foto
  assert.equal(isPostValid({ body: '   ', photoCount: 0 }), false); // whitespace telt niet
  assert.equal(isPostValid({ body: '' }), false);
  assert.equal(isPostValid(), false);                            // default-param: niets → ongeldig
});
