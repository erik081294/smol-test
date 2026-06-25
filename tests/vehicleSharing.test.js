// Units voor de pure delen-met-kosten-logica (lib/vehicleSharing.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripCostCents, parseRatePerKm, formatRatePerKm } from '../lib/vehicleSharing.js';

test('tripCostCents: km × tarief, afgerond; geen km/tarief → 0 (gratis)', () => {
  assert.equal(tripCostCents(100, 25), 2500);     // 100 km × €0,25 = €25,00
  assert.equal(tripCostCents(12.5, 20), 250);     // kommagetal km
  assert.equal(tripCostCents(33, 19), 627);       // 33 × 19 = 627 (afronding)
  assert.equal(tripCostCents(0, 25), 0);          // geen km
  assert.equal(tripCostCents(100, 0), 0);         // gratis (geen tarief)
  assert.equal(tripCostCents(100, null), 0);
  assert.equal(tripCostCents(null, 25), 0);
  assert.equal(tripCostCents(-5, 25), 0);         // negatief telt niet
});

test('parseRatePerKm: euro/km → centen/km, leeg/onzin/negatief → null', () => {
  assert.equal(parseRatePerKm('0,25'), 25);
  assert.equal(parseRatePerKm('0.19'), 19);
  assert.equal(parseRatePerKm('1'), 100);
  assert.equal(parseRatePerKm(''), null);
  assert.equal(parseRatePerKm(null), null);
  assert.equal(parseRatePerKm('-2'), null);
  assert.equal(parseRatePerKm('gratis'), null);
});

test('formatRatePerKm: centen/km → toonbaar, null → leeg', () => {
  assert.equal(formatRatePerKm(25), '0,25');
  assert.equal(formatRatePerKm(100), '1,00');
  assert.equal(formatRatePerKm(0), '0,00');
  assert.equal(formatRatePerKm(null), '');
  assert.equal(formatRatePerKm(undefined), '');
});
