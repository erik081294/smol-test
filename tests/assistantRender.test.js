// Unit- + contracttests voor het gedeelde gen-UI-vocabulaire
// (supabase/functions/_shared/tools/render.js, AI-16 ronde 2 / plan 26).
//
// De kern is de ROUNDTRIP: elke constructor-output moet ongeschonden door de
// client-poortwachter (lib/assistantUi.js) komen. Dat is de modulariteits-borg:
// een module-pack dat via deze constructors componeert, kan geen node bouwen
// die op de client stilletjes sneuvelt of velden verliest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chartNode, scheduleNode, choiceNode, imageNode, progressNode } from '../supabase/functions/_shared/tools/render.js';
import { normalizeNode } from '../lib/assistantUi.js';

test('chartNode: vorm + euro-fallback (centen → komma-notatie, ·-gescheiden)', () => {
  const node = chartNode({ title: 'Per week', unit: 'euro', points: [{ label: '1–7', value: 12500 }, { label: '8–14', value: 0 }] });
  assert.deepEqual(node, {
    type: 'chart',
    title: 'Per week',
    unit: 'euro',
    points: [{ label: '1–7', value: 12500 }, { label: '8–14', value: 0 }],
    text: 'Per week: 1–7: € 125,00 · 8–14: € 0,00',
  });
});

test('chartNode: zonder titel/unit → kale fallback met rauwe getallen', () => {
  const node = chartNode({ points: [{ label: 'ma', value: 3 }] });
  assert.equal(node.text, 'ma: 3');
  assert.equal('title' in node, false);
  assert.equal('unit' in node, false);
});

test('scheduleNode: fallback = regel per dag mét entries; lege dagen blijven in days staan', () => {
  const node = scheduleNode({
    title: 'Weekmenu',
    days: [
      { label: 'ma', today: true, entries: [{ text: 'Lasagne (4p)' }, { text: 'Soep · lunch' }] },
      { label: 'di', entries: [] },
      { label: 'wo', entries: [{ text: 'Wraps' }] },
    ],
  });
  assert.equal(node.text, 'ma — Lasagne (4p), Soep · lunch\nwo — Wraps');
  assert.equal(node.days.length, 3); // de lege di blijft — een gat is informatie
});

test('choiceNode: fallback = prompt + labels', () => {
  const node = choiceNode({
    prompt: 'Welk recept bedoel je?',
    options: [
      { label: 'Lasagne', description: 'voor 4 personen', reply: 'Gebruik het recept "Lasagne"' },
      { label: 'Wraps', description: null, reply: 'Gebruik het recept "Wraps"' },
    ],
  });
  assert.equal(node.text, 'Welk recept bedoel je? Lasagne / Wraps');
});

// --- Roundtrip-contract: constructor → poortwachter, verliesvrij. -----------

test('roundtrip: chartNode passeert de poortwachter met alle punten intact', () => {
  const node = chartNode({ title: 'Per week', unit: 'euro', points: [{ label: '1–7', value: 12500 }, { label: '8–14', value: 0 }] });
  const normalized = normalizeNode(node);
  assert.deepEqual(normalized, {
    type: 'chart',
    title: 'Per week',
    unit: 'euro',
    variant: 'bar',
    points: [{ label: '1–7', value: 12500 }, { label: '8–14', value: 0 }],
  });
});

test('roundtrip: chartNode lijn-variant houdt zijn variant (r3); onzin-variant reist niet mee', () => {
  const line = chartNode({ title: 'Trend', unit: 'euro', variant: 'line', points: [{ label: 'jun', value: 100 }, { label: 'jul', value: 200 }] });
  assert.equal(normalizeNode(line).variant, 'line');
  assert.equal(line.text, 'Trend: jun: € 1,00 · jul: € 2,00'); // fallback blijft de tabelvorm
  // De constructor laat een niet-bestaande variant weg → poortwachter default 'bar'.
  const raar = chartNode({ variant: 'pie', points: [{ label: 'a', value: 1 }] });
  assert.equal('variant' in raar, false);
  assert.equal(normalizeNode(raar).variant, 'bar');
});

test('imageNode: vorm + caption-fallback ("(foto)" zonder caption)', () => {
  assert.deepEqual(imageNode({ bucket: 'timeline', path: 'h1/p1/f.jpg', caption: 'De nieuwe kast' }), {
    type: 'image', bucket: 'timeline', path: 'h1/p1/f.jpg', caption: 'De nieuwe kast', text: 'De nieuwe kast',
  });
  const kaal = imageNode({ bucket: 'pets', path: 'h1/d1/f.jpg' });
  assert.equal('caption' in kaal, false);
  assert.equal(kaal.text, '(foto)');
});

test('progressNode: vorm + teller-fallback', () => {
  assert.deepEqual(progressNode({ label: 'Deze week afgerond', value: 5, max: 12 }), {
    type: 'progress', label: 'Deze week afgerond', value: 5, max: 12, text: 'Deze week afgerond: 5 van 12',
  });
});

test('roundtrip: imageNode en progressNode passeren de poortwachter verliesvrij', () => {
  assert.deepEqual(normalizeNode(imageNode({ bucket: 'timeline', path: 'h1/p1/f.jpg', caption: 'Kast' })), {
    type: 'image', bucket: 'timeline', path: 'h1/p1/f.jpg', caption: 'Kast',
  });
  assert.deepEqual(normalizeNode(progressNode({ label: 'Deze week afgerond', value: 5, max: 12 })), {
    type: 'progress', label: 'Deze week afgerond', value: 5, max: 12,
  });
});

test('roundtrip: scheduleNode passeert de poortwachter met dagen/today/entries intact', () => {
  const node = scheduleNode({
    title: 'Weekmenu',
    days: [
      { label: 'ma', today: true, entries: [{ text: 'Lasagne' }] },
      { label: 'di', entries: [] },
    ],
  });
  assert.deepEqual(normalizeNode(node), {
    type: 'schedule',
    title: 'Weekmenu',
    days: [
      { label: 'ma', today: true, entries: [{ text: 'Lasagne', emoji: null }] },
      { label: 'di', today: false, entries: [] },
    ],
  });
});

test('roundtrip: choiceNode passeert de poortwachter met opties/replies intact', () => {
  const node = choiceNode({
    prompt: 'Welke?',
    options: [{ label: 'A', description: 'a', reply: 'kies a' }, { label: 'B', description: null, reply: 'kies b' }],
  });
  assert.deepEqual(normalizeNode(node), {
    type: 'choice',
    prompt: 'Welke?',
    options: [{ label: 'A', description: 'a', reply: 'kies a' }, { label: 'B', description: null, reply: 'kies b' }],
  });
});

test('roundtrip: op een OUDE client (zonder deze types) degradeert elke constructor naar zijn fallback-tekst', () => {
  // Simuleer een oude poortwachter: onbekend type → default-tak pakt node.text.
  // Dat contract borgen we hier per constructor: text is aanwezig én niet leeg.
  for (const node of [
    chartNode({ title: 'T', unit: 'euro', points: [{ label: 'a', value: 1 }] }),
    chartNode({ title: 'T', variant: 'line', points: [{ label: 'a', value: 1 }] }),
    scheduleNode({ title: 'T', days: [{ label: 'ma', entries: [{ text: 'x' }] }] }),
    choiceNode({ prompt: 'P?', options: [{ label: 'A', reply: 'a' }] }),
    imageNode({ bucket: 'timeline', path: 'h1/f.jpg' }),
    progressNode({ label: 'L', value: 1, max: 2 }),
  ]) {
    assert.equal(typeof node.text, 'string');
    assert.ok(node.text.length > 0);
  }
});
