// Units voor de beeld-resolver (lib/productImage.js). Puur; asset-map wordt geïnjecteerd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductImage } from '../lib/productImage.js';

const ASSETS = { melk: 42, broccoli: 7 }; // assetSources zijn opaque (in de app: require()-ids)

test('asset wint: item.key in de assets-map → kind asset', () => {
  const r = resolveProductImage({ key: 'melk', emoji: '🥛', category: 'zuivel' }, { assets: ASSETS });
  assert.deepEqual(r, { kind: 'asset', source: 42, key: 'melk' });
});

test('image_key heeft voorrang op key bij de asset-lookup', () => {
  const r = resolveProductImage({ key: 'iets', image_key: 'broccoli', category: 'groente-fruit' }, { assets: ASSETS });
  assert.equal(r.kind, 'asset');
  assert.equal(r.key, 'broccoli');
});

test('geen asset, wél emoji op item → die emoji', () => {
  const r = resolveProductImage({ key: 'thee', emoji: '🍵', category: 'dranken' }, { assets: ASSETS });
  assert.deepEqual(r, { kind: 'emoji', char: '🍵' });
});

test('geen asset, geen emoji → categorie-emoji', () => {
  const r = resolveProductImage({ key: 'iets', category: 'dranken' }); // geen assets meegegeven
  assert.deepEqual(r, { kind: 'emoji', char: '🧃' });
});

test('onbekende categorie zonder emoji → generieke kar', () => {
  const r = resolveProductImage({ key: 'x', category: 'verzonnen' });
  assert.deepEqual(r, { kind: 'emoji', char: '🛒' });
});

test('null item → generieke kar (null-safe)', () => {
  assert.deepEqual(resolveProductImage(null), { kind: 'emoji', char: '🛒' });
});
