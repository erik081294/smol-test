// Units voor de pure plantfoto-helpers (lib/plantPhoto.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storagePath, diaryPhotoPath, extFromUri, normalizeExt, contentTypeForExt, parseDataUrl, PLANT_BUCKET } from '../lib/plantPhoto.js';

test('PLANT_BUCKET is de verwachte naam', () => {
  assert.equal(PLANT_BUCKET, 'plants');
});

test('storagePath: <household>/<plant>.<ext>, household als eerste segment', () => {
  assert.equal(storagePath('hh-1', 'p-1', 'png'), 'hh-1/p-1.png');
  assert.equal(storagePath('hh-1', 'p-1'), 'hh-1/p-1.jpg'); // default jpg
  // Eerste segment moet het household zijn (storage-RLS scopet daarop).
  assert.equal(storagePath('hh-1', 'p-1', 'jpg').split('/')[0], 'hh-1');
});

test('diaryPhotoPath: <household>/<plant>/<key>.<ext>, household als eerste segment', () => {
  assert.equal(diaryPhotoPath('hh-1', 'p-1', '1700000000', 'png'), 'hh-1/p-1/1700000000.png');
  assert.equal(diaryPhotoPath('hh-1', 'p-1', 'k'), 'hh-1/p-1/k.jpg'); // default jpg
  assert.equal(diaryPhotoPath('hh-1', 'p-1', 'k', 'JPEG').endsWith('.jpg'), true);
  assert.equal(diaryPhotoPath('hh-1', 'p-1', 'k').split('/')[0], 'hh-1');
});

test('extFromUri: pakt de extensie, normaliseert jpeg->jpg, valt terug op jpg', () => {
  assert.equal(extFromUri('file:///x/y/foto.PNG'), 'png');
  assert.equal(extFromUri('https://h/abc.jpeg?token=1'), 'jpg');
  assert.equal(extFromUri('zonder-extensie'), 'jpg');
  assert.equal(extFromUri(null), 'jpg');
});

test('normalizeExt: lowercase + jpeg->jpg', () => {
  assert.equal(normalizeExt('JPEG'), 'jpg');
  assert.equal(normalizeExt('PNG'), 'png');
  assert.equal(normalizeExt(undefined), 'jpg');
});

test('parseDataUrl: haalt ext + base64 uit een web data-URL', () => {
  const out = parseDataUrl('data:image/png;base64,AAAABBBB');
  assert.deepEqual(out, { ext: 'png', base64: 'AAAABBBB' });
  // jpeg normaliseert naar jpg
  assert.equal(parseDataUrl('data:image/jpeg;base64,XX').ext, 'jpg');
  // geen data-URL -> null (native file:// uri)
  assert.equal(parseDataUrl('file:///x/foto.jpg'), null);
  assert.equal(parseDataUrl(null), null);
});

test('contentTypeForExt: juiste MIME, default image/jpeg', () => {
  assert.equal(contentTypeForExt('jpg'), 'image/jpeg');
  assert.equal(contentTypeForExt('jpeg'), 'image/jpeg');
  assert.equal(contentTypeForExt('png'), 'image/png');
  assert.equal(contentTypeForExt('webp'), 'image/webp');
  assert.equal(contentTypeForExt('gif'), 'image/jpeg'); // onbekend -> default
});
