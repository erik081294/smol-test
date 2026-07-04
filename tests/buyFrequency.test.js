// Units voor de pure aankoopfrequentie-heuristiek (lib/buyFrequency.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseIntervals, frequencyEstimate, frequencyLabel } from '../lib/buyFrequency.js';

test('purchaseIntervals: dagen tussen opeenvolgende (gesorteerde) aankopen', () => {
  // 1 jun, 8 jun, 22 jun → 7 en 14 dagen.
  assert.deepEqual(purchaseIntervals(['2026-06-22', '2026-06-01', '2026-06-08']), [7, 14]);
});

test('purchaseIntervals: < 2 datums → leeg', () => {
  assert.deepEqual(purchaseIntervals(['2026-06-01']), []);
  assert.deepEqual(purchaseIntervals([]), []);
});

test('frequencyEstimate: null bij minder dan 2 aankopen', () => {
  assert.equal(frequencyEstimate(['2026-06-01']), null);
  assert.equal(frequencyEstimate([]), null);
});

test('frequencyEstimate: mediaan-interval + dueScore', () => {
  // Aankopen om de ~7 dagen; nu = 14 dagen na de laatste → dueScore ~2.
  const est = frequencyEstimate(['2026-06-01', '2026-06-08', '2026-06-15'], new Date(2026, 5, 29));
  assert.equal(est.count, 3);
  assert.equal(est.medianDays, 7);
  assert.equal(est.lastPurchasedOn, '2026-06-15');
  assert.equal(est.daysSince, 14);
  assert.equal(est.dueScore, 2);
});

test('frequencyEstimate: mediaan is robuust tegen een uitschieter', () => {
  // Intervallen 7, 7, 60 → mediaan 7 (gemiddelde zou ~25 zijn).
  const est = frequencyEstimate(['2026-01-01', '2026-01-08', '2026-01-15', '2026-03-16'], new Date(2026, 2, 23));
  assert.equal(est.medianDays, 7);
});

test('frequencyEstimate: dueScore < 1 als het nog geen tijd is', () => {
  const est = frequencyEstimate(['2026-06-01', '2026-06-15'], new Date(2026, 5, 20));
  assert.equal(est.medianDays, 14);
  assert.equal(est.daysSince, 5);
  assert.ok(est.dueScore < 1);
});

test('frequencyLabel: uitlegbare string of null', () => {
  const est = frequencyEstimate(['2026-06-01', '2026-06-15'], new Date(2026, 5, 20));
  assert.match(frequencyLabel(est), /14/);
  assert.equal(frequencyLabel(null), null);
});

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('lege/null/ongeldige datums vallen weg bij intervallen', () => {
  assert.deepEqual(purchaseIntervals(['2026-06-08', null, '', 'onzin', '2026-06-01']), [7]);
});

test('frequencyEstimate: mediaan sorteert de intervallen (volgorde-onafhankelijk)', () => {
  // dag-gaps 3, 14, 7 → mediaan 7 (niet 14 of de invoervolgorde).
  const est = frequencyEstimate(['2026-06-01', '2026-06-04', '2026-06-18', '2026-06-25'], new Date(2026, 6, 2));
  assert.equal(est.medianDays, 7);
});

test('frequencyEstimate: even aantal intervallen → gemiddelde van de twee middelste', () => {
  // gaps 7 en 14 → mediaan (7+14)/2 = 10,5 → 11.
  const est = frequencyEstimate(['2026-06-01', '2026-06-08', '2026-06-22'], new Date(2026, 6, 1));
  assert.equal(est.medianDays, 11);
});

test('frequencyEstimate: zelfde dag twee keer → één unieke dag → null (dedup)', () => {
  // Na dedup op kalenderdag blijft er maar één aankoopdag over (< 2) → geen schatting.
  assert.equal(frequencyEstimate(['2026-06-01', '2026-06-01'], new Date(2026, 5, 10)), null);
});

test('sortedDays dedupliceert kalenderdagen: zelfde-dag-aankopen halveren de mediaan niet', () => {
  // Aankopen 1 jun (2×) en 15 jun. Distinct dagen: 1, 15 → één interval van 14 dagen.
  // Zonder dedup zou de dubbele 1 juni een interval 0 toevoegen → intervallen [0, 14] →
  // mediaan (0+14)/2 = 7: exact de "gehalveerde mediaan" uit de review.
  assert.deepEqual(purchaseIntervals(['2026-06-01', '2026-06-01', '2026-06-15']), [14]);
  const est = frequencyEstimate(['2026-06-01', '2026-06-01', '2026-06-15'], new Date(2026, 5, 20));
  assert.equal(est.count, 2);       // 2 unieke dagen, niet 4
  assert.equal(est.medianDays, 14); // niet 7 (gehalveerd door een 0-interval)
});

test('datum-only strings zijn tijdzone-veilig (geen UTC-dagverschuiving)', () => {
  // '2026-06-15' is een kalenderdag, geen UTC-instant. Onder een negatieve-offset-tijdzone
  // mag new Date('2026-06-15') 'm niet naar 14 juni verschuiven. (De suite draait gepind
  // op zo'n zone — zie tests/register.mjs — zodat deze klasse fouten altijd zichtbaar is.)
  const est = frequencyEstimate(['2026-06-01', '2026-06-15'], new Date(2026, 5, 20));
  assert.equal(est.lastPurchasedOn, '2026-06-15'); // niet '2026-06-14'
  assert.equal(est.daysSince, 5);                  // niet 6
});
