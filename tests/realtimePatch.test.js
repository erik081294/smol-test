// Units voor de pure realtime-patch-helpers (lib/realtimePatch.js). Geen
// React/Supabase nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparatorFromOrder, applyRealtimePatch } from '../lib/realtimePatch.js';

// === comparatorFromOrder ==================================================

test('comparatorFromOrder: ascending sorteert klein→groot', () => {
  const cmp = comparatorFromOrder([{ column: 'n', ascending: true }]);
  const out = [{ n: 3 }, { n: 1 }, { n: 2 }].sort(cmp).map((x) => x.n);
  assert.deepEqual(out, [1, 2, 3]);
});

test('comparatorFromOrder: descending sorteert groot→klein', () => {
  const cmp = comparatorFromOrder([{ column: 'n', ascending: false }]);
  const out = [{ n: 1 }, { n: 3 }, { n: 2 }].sort(cmp).map((x) => x.n);
  assert.deepEqual(out, [3, 2, 1]);
});

test('comparatorFromOrder: default ASC → nulls last', () => {
  const cmp = comparatorFromOrder([{ column: 'd', ascending: true }]);
  const out = [{ d: null }, { d: '2026-01-02' }, { d: '2026-01-01' }].sort(cmp).map((x) => x.d);
  assert.deepEqual(out, ['2026-01-01', '2026-01-02', null]);
});

test('comparatorFromOrder: default DESC → nulls first', () => {
  const cmp = comparatorFromOrder([{ column: 'd', ascending: false }]);
  const out = [{ d: '2026-01-01' }, { d: null }, { d: '2026-01-02' }].sort(cmp).map((x) => x.d);
  assert.deepEqual(out, [null, '2026-01-02', '2026-01-01']);
});

test('comparatorFromOrder: expliciete nullsFir=false bij ascending', () => {
  const cmp = comparatorFromOrder([{ column: 'd', ascending: true, nullsFirst: false }]);
  const out = [{ d: null }, { d: '2026-01-01' }].sort(cmp).map((x) => x.d);
  assert.deepEqual(out, ['2026-01-01', null]);
});

test('comparatorFromOrder: meerdere kolommen (tweede breekt de gelijkstand)', () => {
  const cmp = comparatorFromOrder([
    { column: 'checked', ascending: true },
    { column: 'created_at', ascending: false },
  ]);
  const rows = [
    { checked: true, created_at: 5 },
    { checked: false, created_at: 1 },
    { checked: false, created_at: 9 },
  ];
  const out = rows.sort(cmp).map((x) => [x.checked, x.created_at]);
  // false (onafgevinkt) eerst, daarbinnen nieuwste eerst.
  assert.deepEqual(out, [[false, 9], [false, 1], [true, 5]]);
});

// === applyRealtimePatch ===================================================

const byNAsc = comparatorFromOrder([{ column: 'n', ascending: true }]);

test('INSERT: voegt toe en houdt de sortering', () => {
  const items = [{ id: 'a', n: 1 }, { id: 'c', n: 3 }];
  const out = applyRealtimePatch(items, { eventType: 'INSERT', new: { id: 'b', n: 2 } }, byNAsc);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'c']);
});

test('INSERT: idempotent op id (realtime-echo verdubbelt niet)', () => {
  const items = [{ id: 'a', n: 1 }];
  const out = applyRealtimePatch(items, { eventType: 'INSERT', new: { id: 'a', n: 1 } }, byNAsc);
  assert.equal(out, items); // ongewijzigde referentie
});

test('INSERT: zonder id → null (fallback naar reload)', () => {
  const out = applyRealtimePatch([], { eventType: 'INSERT', new: { n: 1 } }, byNAsc);
  assert.equal(out, null);
});

test('UPDATE: vervangt de rij en hersorteert', () => {
  const items = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
  const out = applyRealtimePatch(items, { eventType: 'UPDATE', new: { id: 'a', n: 5 } }, byNAsc);
  assert.deepEqual(out.map((x) => [x.id, x.n]), [['b', 2], ['a', 5]]);
});

test('UPDATE: onbekende id → voegt in (kwam in beeld)', () => {
  const items = [{ id: 'a', n: 1 }];
  const out = applyRealtimePatch(items, { eventType: 'UPDATE', new: { id: 'z', n: 0 } }, byNAsc);
  assert.deepEqual(out.map((x) => x.id), ['z', 'a']);
});

test('DELETE: verwijdert op old.id', () => {
  const items = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
  const out = applyRealtimePatch(items, { eventType: 'DELETE', old: { id: 'a' } }, byNAsc);
  assert.deepEqual(out.map((x) => x.id), ['b']);
});

test('DELETE: zonder id in old/new → null (fallback naar reload)', () => {
  const items = [{ id: 'a', n: 1 }];
  const out = applyRealtimePatch(items, { eventType: 'DELETE', old: {} }, byNAsc);
  assert.equal(out, null);
});

test('onbekend event → null', () => {
  assert.equal(applyRealtimePatch([], { eventType: 'TRUNCATE' }, byNAsc), null);
});

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('comparatorFromOrder: zonder ascending → standaard oplopend', () => {
  const cmp = comparatorFromOrder([{ column: 'n' }]);
  assert.deepEqual([{ n: 3 }, { n: 1 }, { n: 2 }].sort(cmp).map((x) => x.n), [1, 2, 3]);
});

test('comparatorFromOrder: ontbrekende kolom telt als null; gelijke waarde valt door naar de 2e kolom', () => {
  const cmp = comparatorFromOrder([{ column: 'k', ascending: true }, { column: 't', ascending: true }]);
  assert.deepEqual([{ k: 'b' }, {}, { k: 'a' }].sort(cmp).map((x) => x.k ?? 'X'), ['a', 'b', 'X']); // undefined = null = laatst
  assert.deepEqual([{ k: 'a', t: 2 }, { k: 'a', t: 1 }].sort(cmp).map((x) => x.t), [1, 2]); // gelijke k → t beslist
});

test('comparatorFromOrder: beide null in de 1e kolom → 2e kolom beslist; robuust tegen null-elementen', () => {
  const cmp = comparatorFromOrder([{ column: 'k', ascending: true }, { column: 't', ascending: true }]);
  assert.deepEqual([{ k: null, t: 2 }, { k: null, t: 1 }].sort(cmp).map((x) => x.t), [1, 2]);
  assert.equal(typeof cmp(null, { k: 1 }), 'number'); // crasht niet op een null-element
});

test('applyRealtimePatch: null/zonder-row payloads → null (fallback naar reload)', () => {
  assert.equal(applyRealtimePatch([], null, byNAsc), null);
  assert.equal(applyRealtimePatch([], { eventType: 'INSERT' }, byNAsc), null); // geen new
  assert.equal(applyRealtimePatch([], { eventType: 'UPDATE' }, byNAsc), null); // geen new
});

test('INSERT: idempotent ook in een lijst met meerdere items', () => {
  const items = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
  const out = applyRealtimePatch(items, { eventType: 'INSERT', new: { id: 'a', n: 1 } }, byNAsc);
  assert.equal(out, items); // geen duplicaat, ongewijzigde referentie
});

test('DELETE: valt terug op new.id als old.id ontbreekt; onbekend event patcht niet stiekem', () => {
  assert.deepEqual(
    applyRealtimePatch([{ id: 'a', n: 1 }], { eventType: 'DELETE', new: { id: 'a' } }, byNAsc).map((x) => x.id),
    [],
  );
  assert.equal(applyRealtimePatch([{ id: 'a', n: 1 }], { eventType: 'TRUNCATE', old: { id: 'a' } }, byNAsc), null);
});
