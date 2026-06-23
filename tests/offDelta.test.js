// Units voor de pure delta-refresh-logica (lib/offDelta.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeltaIndex, deltaTimestamps, selectNewDeltas } from '../lib/offDelta.js';

// OFF-deltabestandsnamen bevatten echte UNIX-timestamps (10 cijfers). We werken met een
// basis-epoch + leesbare offsets, en een helper voor de bestandsnaam.
const T = 1700000000;
const ts = (n) => T + n;
const f = (from, to) => `products_${ts(from)}_${ts(to)}.json.gz`;

test('parseDeltaIndex: trimt en gooit lege regels weg', () => {
  assert.deepEqual(parseDeltaIndex('a.gz\n  b.gz \n\n c.gz\n'), ['a.gz', 'b.gz', 'c.gz']);
  assert.deepEqual(parseDeltaIndex(''), []);
});

test('deltaTimestamps: leest from/to uit de naam; null als er geen twee timestamps zijn', () => {
  assert.deepEqual(deltaTimestamps(f(0, 86400)), { from: T, to: T + 86400 });
  assert.equal(deltaTimestamps('geen-timestamps.json.gz'), null);
  assert.equal(deltaTimestamps(`alleen_${T}.gz`), null);
});

test('selectNewDeltas: kiest alleen delta\'s met to > watermark, oplopend op to', () => {
  const files = [f(300, 400), f(100, 200), f(200, 300)];
  const { pending, gap } = selectNewDeltas(files, ts(200));
  assert.deepEqual(pending.map((d) => d.to), [ts(300), ts(400)]); // ts(200) niet (>watermark), gesorteerd
  assert.equal(gap, false);
});

test('selectNewDeltas: watermark 0 (nog nooit gesynct) → alles toepassen, geen gap', () => {
  const { pending, gap } = selectNewDeltas([f(100, 200), f(200, 300)], 0);
  assert.equal(pending.length, 2);
  assert.equal(gap, false);
});

test('selectNewDeltas: gat gedetecteerd als oudste delta ná het watermerk begint', () => {
  // We synctten t/m ts(50), maar de oudste beschikbare delta begint pas op ts(100) → gat.
  const { gap } = selectNewDeltas([f(100, 200), f(200, 300)], ts(50));
  assert.equal(gap, true);
});

test('selectNewDeltas: overlappend venster met kleinste from ≠ kleinste to → geen vals gat', () => {
  // [100,200] en [50,500]; watermark 75 valt binnen [50,500] → géén gat (regressietest:
  // de delta met de kleinste `to` is niet die met de kleinste `from`).
  const { gap } = selectNewDeltas([f(100, 200), f(50, 500)], ts(75));
  assert.equal(gap, false);
});

test('selectNewDeltas: aansluitend (overlappend) → geen gat', () => {
  const { gap, pending } = selectNewDeltas([f(100, 200), f(150, 300)], ts(180)); // ts(180) valt in [ts(100),ts(200)]
  assert.equal(gap, false);
  assert.deepEqual(pending.map((d) => d.to), [ts(200), ts(300)]);
});

test('selectNewDeltas: negeert namen zonder geldige timestamps', () => {
  const { total } = selectNewDeltas(['rommel.gz', f(100, 200)], 0);
  assert.equal(total, 1);
});

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('selectNewDeltas: gelijke `to` → stabiele tie-break op bestandsnaam', () => {
  const { pending } = selectNewDeltas([f(200, 300), f(100, 300)], 0); // zelfde to, andere from/naam
  assert.deepEqual(pending.map((d) => d.from), [ts(100), ts(200)]); // bestandsnaam met T+100 vóór T+200
});

test('selectNewDeltas: watermerk exact op de oudste `from` → geen gat (grens)', () => {
  const { gap } = selectNewDeltas([f(100, 200), f(200, 300)], ts(100)); // oldestFrom == watermark
  assert.equal(gap, false);
});
