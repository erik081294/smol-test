// Units voor de pure prijstracker-logica (lib/priceTrack.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { series, latestPerStore, stats, trendPct } from '../lib/priceTrack.js';

const items = [
  { purchased_on: '2026-01-10', store: 'AH', unit_price_cents: 119 },
  { purchased_on: '2026-03-01', store: 'Jumbo', unit_price_cents: 109 },
  { purchased_on: '2026-02-01', store: 'AH', unit_price_cents: 125 },
  { purchased_on: '2026-04-01', store: 'AH', unit_price_cents: null }, // genegeerd: geen prijs
];

test('series: gesorteerd oud->nieuw, regels zonder prijs/datum eruit', () => {
  const s = series(items);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((p) => p.cents), [119, 125, 109]);
});

test('latestPerStore: nieuwste prijs per winkel', () => {
  const m = latestPerStore(items);
  assert.equal(m['AH'].cents, 125);   // 2026-02-01 is nieuwer dan 2026-01-10
  assert.equal(m['Jumbo'].cents, 109);
});

test('stats: min/max/latest/count; lege input veilig', () => {
  assert.deepEqual(stats(items), { min: 109, max: 125, latest: 109, count: 3 });
  assert.deepEqual(stats([]), { min: null, max: null, latest: null, count: 0 });
});

test('trendPct: % laatste vs eerste; null bij <2 punten; days-filter', () => {
  // eerste 119 -> laatste 109 over alles => (109-119)/119*100 ≈ -8.40
  const all = trendPct(items, null);
  assert.ok(Math.abs(all - (-8.403)) < 0.01);
  assert.equal(trendPct([{ purchased_on: '2026-01-01', store: 'AH', unit_price_cents: 100 }], null), null);
  // days-filter: alleen punten binnen 30 dagen voor `now` -> <2 punten -> null
  assert.equal(trendPct(items, 30, new Date('2026-05-01')), null);
});
