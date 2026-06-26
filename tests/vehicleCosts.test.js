// Units voor de pure voertuig-kostenlogica (lib/vehicleCosts.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyEquivalentCents, depreciationEstimate, maintenanceMonthlyAvgCents, vehicleCostSummary,
} from '../lib/vehicleCosts.js';
import { RECUR } from '../lib/constants.js';

test('monthlyEquivalentCents: maand/week/dag herschaald, onbekend → 0', () => {
  assert.equal(monthlyEquivalentCents(5000, RECUR.MONTHLY), 5000);
  assert.equal(monthlyEquivalentCents(30000, RECUR.MONTHLY, 3), 10000);   // per kwartaal → /3
  assert.equal(Math.round(monthlyEquivalentCents(1200, RECUR.WEEKLY)), 5200); // 1200 × 52/12
  assert.equal(Math.round(monthlyEquivalentCents(100, RECUR.DAILY)), 3042);   // 100 × 365/12
  assert.equal(monthlyEquivalentCents(5000, 'yearly'), 0);                // onbekende freq
  assert.equal(monthlyEquivalentCents(null, RECUR.MONTHLY), 0);
});

test('depreciationEstimate: dalende balans, null zonder prijs/datum', () => {
  const now = new Date('2026-06-25');
  const est = depreciationEstimate({ catalogPriceCents: 3000000, firstRegistration: '2018-06-25', now });
  assert.ok(est.currentValueCents < 3000000 && est.currentValueCents > 0, 'waarde gedaald maar positief');
  assert.ok(est.annualCents > 0 && est.monthlyCents === Math.round(est.annualCents / 12));
  // Restwaarde-ondergrens: een heel oude auto zakt niet onder 10% catalogus.
  const oud = depreciationEstimate({ catalogPriceCents: 3000000, firstRegistration: '1990-01-01', now });
  assert.equal(oud.currentValueCents, 300000); // exact de 10%-vloer
  assert.equal(oud.annualCents, 0);            // op de vloer → geen verdere afschrijving
  // Ontbrekende invoer → null (niet uit de lucht schatten).
  assert.equal(depreciationEstimate({ catalogPriceCents: 0, firstRegistration: '2018-01-01', now }), null);
  assert.equal(depreciationEstimate({ catalogPriceCents: 3000000, firstRegistration: null, now }), null);
  assert.equal(depreciationEstimate(), null);
});

test('maintenanceMonthlyAvgCents: alleen kosten binnen het venster → maandgemiddelde', () => {
  const now = new Date('2026-06-25');
  const logs = [
    { performed_on: '2026-01-10', cost_cents: 24000 }, // binnen 12 mnd
    { performed_on: '2026-05-01', cost_cents: 12000 }, // binnen
    { performed_on: '2024-01-01', cost_cents: 99999 }, // te oud → buiten venster
    { performed_on: '2026-03-03', cost_cents: null },  // geen kosten → telt niet
  ];
  assert.equal(maintenanceMonthlyAvgCents(logs, { now }), Math.round(36000 / 12)); // 3000
  assert.equal(maintenanceMonthlyAvgCents([], { now }), 0);
});

test('maintenanceMonthlyAvgCents: eind-van-maand-cutoff overflowt niet (28 feb, niet 3 mrt)', () => {
  // now = 31 mrt, venster = 1 maand. De cutoff hoort ~28 feb te zijn. Met het kale
  // Date.setMonth zou de cutoff naar 3 mrt overflowen → een log van 1 mrt zou dan
  // (fout) buiten het venster vallen. We assert dat 'ie juist binnen valt.
  const now = new Date('2026-03-31T12:00:00Z');
  const beginMaart = [{ performed_on: '2026-03-01', cost_cents: 6000 }];
  assert.equal(maintenanceMonthlyAvgCents(beginMaart, { now, months: 1 }), 6000); // /max(1,1)
  // Een log van eind januari ligt vóór 28 feb → buiten het 1-maands-venster.
  const eindJan = [{ performed_on: '2026-01-28', cost_cents: 6000 }];
  assert.equal(maintenanceMonthlyAvgCents(eindJan, { now, months: 1 }), 0);
});

test('maintenanceMonthlyAvgCents: venster is inclusief op beide grenzen', () => {
  // Lokale Date-constructie (geen string-parsing) houdt de grensgelijkheid tijdzone-robuust:
  // now, cutoff (= now − 12 mnd) en de logs liggen allemaal in dezelfde lokale tijd.
  const now = new Date(2026, 5, 25, 12, 0, 0);                 // 25 jun 2026 12:00 lokaal
  const opOndergrens = new Date(2025, 5, 25, 12, 0, 0).toISOString(); // exact now − 12 mnd
  const opBovengrens = new Date(2026, 5, 25, 12, 0, 0).toISOString(); // exact now
  // Een log precies óp de ondergrens telt mee (>= cutoff, niet > cutoff).
  assert.equal(maintenanceMonthlyAvgCents([{ performed_on: opOndergrens, cost_cents: 1200 }], { now }), 100);
  // Een log precies óp de bovengrens telt mee (<= now, niet < now).
  assert.equal(maintenanceMonthlyAvgCents([{ performed_on: opBovengrens, cost_cents: 1200 }], { now }), 100);
});

test('vehicleCostSummary: telt vaste lasten + onderhoud + afschrijving op', () => {
  const now = new Date('2026-06-25');
  const s = vehicleCostSummary({
    recurring: [
      { amount_cents: 4500, recur_freq: RECUR.MONTHLY, recur_interval: 1 }, // verzekering 45/mnd
      { amount_cents: 30000, recur_freq: RECUR.MONTHLY, recur_interval: 3 }, // wegenbelasting 100/mnd
    ],
    logs: [{ performed_on: '2026-02-01', cost_cents: 24000 }], // 2000/mnd
    vehicle: { catalog_price_cents: 3000000, first_registration: '2018-06-25' },
    now,
  });
  assert.equal(s.fixedMonthlyCents, 14500);            // 4500 + 10000
  assert.equal(s.maintenanceMonthlyCents, 2000);       // 24000/12
  assert.ok(s.depreciationMonthlyCents > 0);
  assert.equal(s.monthlyCents, s.fixedMonthlyCents + s.maintenanceMonthlyCents + s.depreciationMonthlyCents);
  assert.equal(s.annualCents, s.monthlyCents * 12);
  assert.ok(s.depreciation.currentValueCents > 0);
});

test('vehicleCostSummary: lege invoer → alles 0, geen afschrijving', () => {
  const s = vehicleCostSummary();
  assert.equal(s.monthlyCents, 0);
  assert.equal(s.annualCents, 0);
  assert.equal(s.depreciation, null);
});
