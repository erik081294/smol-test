// Units voor de pure kern van de scan-receipt Edge Function.
// Zie supabase/functions/scan-receipt/core.js — géén Deno/netwerk nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveMime, isAllowedMime, extractText, parseModelJson, normalize,
} from '../supabase/functions/scan-receipt/core.js';

test('effectiveMime: leest de MIME uit een data:-URL', () => {
  assert.equal(effectiveMime('data:image/png;base64,AAAA', null), 'image/png');
  assert.equal(effectiveMime('data:image/webp,xxx', 'image/jpeg'), 'image/webp'); // data:-URL wint
});

test('effectiveMime: valt terug op het mimeType-veld; null als onbekend', () => {
  assert.equal(effectiveMime('AAAAbase64', 'image/JPEG'), 'image/jpeg'); // lowercased
  assert.equal(effectiveMime('AAAAbase64', null), null);
  assert.equal(effectiveMime('AAAAbase64', '   '), null);
});

test('isAllowedMime: alleen jpeg/png/webp', () => {
  assert.equal(isAllowedMime('image/jpeg'), true);
  assert.equal(isAllowedMime('image/png'), true);
  assert.equal(isAllowedMime('image/webp'), true);
  assert.equal(isAllowedMime('image/gif'), false);
  assert.equal(isAllowedMime('application/pdf'), false);
  assert.equal(isAllowedMime(null), false);
});

test('parseModelJson: strip een ```json-codeblok en plain JSON', () => {
  assert.deepEqual(parseModelJson('```json\n{"store":"AH"}\n```'), { store: 'AH' });
  assert.deepEqual(parseModelJson('{"store":"Lidl"}'), { store: 'Lidl' });
});

test('normalize: saneert regels en winkel/datum naar het clientcontract', () => {
  const out = normalize({
    store: '  Albert Heijn ',
    purchased_on: '2026-06-21',
    items: [
      { name: ' Melk ', quantity: 2, unit: 'l', unit_price_cents: '129', line_total_cents: 258 },
      { name: '', quantity: 1 },                       // naamloos → weg
      { name: 'Brood', quantity: -3, unit: 'onzin' },   // qty<=0 → 1, unit → 'stuk'
    ],
  });
  assert.equal(out.store, 'Albert Heijn');
  assert.equal(out.purchased_on, '2026-06-21');
  assert.equal(out.items.length, 2);
  assert.deepEqual(out.items[0], { name: 'Melk', quantity: 2, unit: 'l', unit_price_cents: 129, line_total_cents: 258 });
  assert.deepEqual(out.items[1], { name: 'Brood', quantity: 1, unit: 'stuk', unit_price_cents: null, line_total_cents: null });
});

test('normalize: ongeldige datum en lege winkel worden null', () => {
  const out = normalize({ store: '   ', purchased_on: '21-06-2026', items: [] });
  assert.equal(out.store, null);
  assert.equal(out.purchased_on, null);
  assert.deepEqual(out.items, []);
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// de tot nu toe ongeteste extractText, plus grens-/null-/regex-ankergevallen in
// effectiveMime, normalize en parseModelJson.

test('extractText: leest content uit choices[].message als string', () => {
  assert.equal(extractText({ choices: [{ message: { content: 'Hallo' } }] }), 'Hallo');
});

test('extractText: pakt het eerste tekst-part uit een content-array', () => {
  assert.equal(extractText({ choices: [{ message: { content: [{ type: 'image' }, { text: 'Deel' }] } }] }), 'Deel');
});

test('extractText: valt terug op message.content, dan content, dan choice.text', () => {
  assert.equal(extractText({ message: { content: 'M' } }), 'M');
  assert.equal(extractText({ content: 'C' }), 'C');
  assert.equal(extractText({ choices: [{ message: { text: 'T' } }] }), 'T');
});

test('extractText: null als er geen bruikbare tekst is', () => {
  assert.equal(extractText({}), null);
  assert.equal(extractText(null), null);
  assert.equal(extractText(undefined), null);
  assert.equal(extractText({ choices: [null] }), null);          // choices[0] null → niet crashen
  assert.equal(extractText({ choices: [{ message: {} }] }), null);
  assert.equal(extractText({ choices: [{ message: { content: [{ niet: 'tekst' }] } }] }), null);
});

test('extractText: slaat null-elementen in de content-array veilig over', () => {
  assert.equal(extractText({ content: [null, { text: 'X' }] }), 'X');
});

test('effectiveMime: niet-string imageBase64 valt veilig terug op mimeType', () => {
  assert.equal(effectiveMime(null, 'image/png'), 'image/png');
  assert.equal(effectiveMime(undefined, 'image/webp'), 'image/webp');
});

test('effectiveMime: malformed data:-URL (zonder ; of ,) valt terug op mimeType', () => {
  assert.equal(effectiveMime('data:image/png', 'image/jpeg'), 'image/jpeg');
});

test('effectiveMime: trimt en lowercased de MIME uit de data:-URL', () => {
  assert.equal(effectiveMime('data: IMAGE/PNG ;base64,AAAA', null), 'image/png');
});

test('effectiveMime: trimt en lowercased ook het losse mimeType-veld', () => {
  assert.equal(effectiveMime('AAAAbase64', '  IMAGE/PNG  '), 'image/png');
});

test('parseModelJson: codeblok zónder json-label werkt ook', () => {
  assert.deepEqual(parseModelJson('```\n{"store":"AH"}\n```'), { store: 'AH' });
});

test('normalize: tolerant voor ontbrekende/lege/rommelige input', () => {
  assert.deepEqual(normalize(undefined), { store: null, purchased_on: null, items: [] });
  assert.deepEqual(normalize({}), { store: null, purchased_on: null, items: [] });
  assert.deepEqual(normalize({ items: [null, { name: '   ' }] }), { store: null, purchased_on: null, items: [] });
});

test('normalize: hoeveelheid 0 wordt 1 (grens > 0, niet >= 0)', () => {
  const out = normalize({ items: [{ name: 'Appel', quantity: 0, unit: 'kg' }] });
  assert.equal(out.items[0].quantity, 1);
});

test('normalize: datum moet exact yyyy-mm-dd zijn (ankers ^ en $)', () => {
  assert.equal(normalize({ purchased_on: '2026-06-21extra', items: [] }).purchased_on, null);
  assert.equal(normalize({ purchased_on: 'x 2026-06-21', items: [] }).purchased_on, null);
});
