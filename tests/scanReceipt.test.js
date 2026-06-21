// Units voor de pure kern van de scan-receipt Edge Function.
// Zie supabase/functions/scan-receipt/core.js — géén Deno/netwerk nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveMime, isAllowedMime, parseModelJson, normalize,
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
