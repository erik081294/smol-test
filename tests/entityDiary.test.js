// Units voor de pure kern van de entiteit-dagboeken (lib/entityDiary.js): de
// omslag-terugval bij het verwijderen van een tijdlijn-post.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCoverPath, coverNeedsRefresh, deleteDiaryEntryWithCover } from '../lib/entityDiary.js';

test('pickCoverPath: eerste resterende foto (nieuwste eerst), of null', () => {
  assert.equal(pickCoverPath([{ photo_path: 'a.jpg' }, { photo_path: 'b.jpg' }]), 'a.jpg');
  // Volgorde telt: aanroeper levert nieuwste-eerst, dus [0] wint.
  assert.equal(pickCoverPath([{ photo_path: 'b.jpg' }, { photo_path: 'a.jpg' }]), 'b.jpg');
  assert.equal(pickCoverPath([]), null);
  assert.equal(pickCoverPath(null), null);
  assert.equal(pickCoverPath(undefined), null);
  // Ontbrekend/leeg pad op de eerste rij → null (geen omslag).
  assert.equal(pickCoverPath([{ }]), null);
  assert.equal(pickCoverPath([{ photo_path: null }]), null);
});

test('coverNeedsRefresh: alleen als de verwijderde foto de huidige omslag wás', () => {
  assert.equal(coverNeedsRefresh('cover.jpg', 'cover.jpg'), true);
  assert.equal(coverNeedsRefresh('other.jpg', 'cover.jpg'), false); // andere foto
  assert.equal(coverNeedsRefresh(null, 'cover.jpg'), false);        // notitie-only post
  assert.equal(coverNeedsRefresh(undefined, 'cover.jpg'), false);
  assert.equal(coverNeedsRefresh('cover.jpg', null), false);        // parent had geen omslag
  // Lege string is geen echte foto → geen refresh (ook al zijn ze "gelijk").
  assert.equal(coverNeedsRefresh('', ''), false);
});

test('deleteDiaryEntryWithCover: foto die de omslag was → omslag valt terug op nieuwste rest', async () => {
  const calls = [];
  const next = await deleteDiaryEntryWithCover({
    entry: { id: 7, photo_path: 'cover.jpg' },
    parentCover: 'cover.jpg',
    removeObject: (p) => { calls.push(['removeObject', p]); return Promise.resolve(); },
    deleteRow: (id) => { calls.push(['deleteRow', id]); return Promise.resolve(); },
    fetchRemaining: () => { calls.push(['fetchRemaining']); return Promise.resolve([{ photo_path: 'new.jpg' }, { photo_path: 'old.jpg' }]); },
    setCover: (c) => { calls.push(['setCover', c]); return Promise.resolve(); },
  });
  assert.equal(next, 'new.jpg');
  // Volgorde: eerst storage-object weg, dán de rij, dán herstellen.
  assert.deepEqual(calls, [
    ['removeObject', 'cover.jpg'],
    ['deleteRow', 7],
    ['fetchRemaining'],
    ['setCover', 'new.jpg'],
  ]);
});

test('deleteDiaryEntryWithCover: foto maar niet de omslag → geen herstel, omslag blijft', async () => {
  const calls = [];
  const next = await deleteDiaryEntryWithCover({
    entry: { id: 3, photo_path: 'other.jpg' },
    parentCover: 'cover.jpg',
    removeObject: (p) => { calls.push(['removeObject', p]); return Promise.resolve(); },
    deleteRow: (id) => { calls.push(['deleteRow', id]); return Promise.resolve(); },
    fetchRemaining: () => { calls.push(['fetchRemaining']); return Promise.resolve([]); },
    setCover: (c) => { calls.push(['setCover', c]); return Promise.resolve(); },
  });
  assert.equal(next, 'cover.jpg');
  assert.deepEqual(calls, [['removeObject', 'other.jpg'], ['deleteRow', 3]]);
});

test('deleteDiaryEntryWithCover: notitie-only post → geen storage-verwijdering, omslag ongemoeid', async () => {
  const calls = [];
  const next = await deleteDiaryEntryWithCover({
    entry: { id: 9, photo_path: null },
    parentCover: 'cover.jpg',
    removeObject: (p) => { calls.push(['removeObject', p]); return Promise.resolve(); },
    deleteRow: (id) => { calls.push(['deleteRow', id]); return Promise.resolve(); },
    fetchRemaining: () => { calls.push(['fetchRemaining']); return Promise.resolve([]); },
    setCover: (c) => { calls.push(['setCover', c]); return Promise.resolve(); },
  });
  assert.equal(next, 'cover.jpg');
  assert.deepEqual(calls, [['deleteRow', 9]]); // geen removeObject
});

test('deleteDiaryEntryWithCover: omslag verwijderd en niets rest → omslag wordt null', async () => {
  const calls = [];
  const next = await deleteDiaryEntryWithCover({
    entry: { id: 1, photo_path: 'cover.jpg' },
    parentCover: 'cover.jpg',
    removeObject: () => Promise.resolve(),
    deleteRow: () => Promise.resolve(),
    fetchRemaining: () => Promise.resolve([]),
    setCover: (c) => { calls.push(c); return Promise.resolve(); },
  });
  assert.equal(next, null);
  assert.deepEqual(calls, [null]); // omslag expliciet op null gezet
});

test('deleteDiaryEntryWithCover: parent zonder omslag → returnt null (niet undefined)', async () => {
  const next = await deleteDiaryEntryWithCover({
    entry: { id: 1, photo_path: 'p.jpg' },
    parentCover: null,
    removeObject: () => Promise.resolve(),
    deleteRow: () => Promise.resolve(),
    fetchRemaining: () => Promise.resolve([]),
    setCover: () => Promise.resolve(),
  });
  assert.equal(next, null);
});
