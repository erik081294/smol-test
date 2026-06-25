// Pure, testbare kostenlogica voor het voertuig-kostenoverzicht (V3, "TCO"). Géén
// React/Supabase. We bouwen de kosten BOTTOM-UP op uit de eigen data — dat is wat
// betrouwbaar is (zie ontwerpkeuze): vaste lasten (terugkerende uitgaven gekoppeld aan
// het voertuig) + gerealiseerd onderhoud (vehicle_log) + een afschrijving-SCHATTING uit
// de RDW-catalogusprijs en leeftijd. De afschrijving is bewust apart: het is een
// projectie (geen écht betaalde uitgave), dus het loopt niet mee in WieBetaaltWat.
import { RECUR } from './constants';

// Maandelijks equivalent (centen) van een terugkerend bedrag. Onbekende freq → 0.
// Week/dag worden via een jaargemiddelde naar een maand herschaald (52/12 resp. 365/12).
export function monthlyEquivalentCents(amountCents, freq, interval = 1) {
  const a = Number(amountCents) || 0;
  const n = Math.max(1, interval || 1);
  if (freq === RECUR.MONTHLY) return a / n;
  if (freq === RECUR.WEEKLY) return (a / n) * (52 / 12);
  if (freq === RECUR.DAILY) return (a / n) * (365 / 12);
  return 0;
}

// Geschatte afschrijving via een dalende-balansmodel: waarde(leeftijd) = catalogusprijs ×
// r^leeftijd (r = 0.82, ~18%/jaar), met een restwaarde-ondergrens (10% van catalogus).
// Geeft de huidige geschatte waarde + de afschrijving van het áfgelopen jaar (maand+jaar).
// Zonder catalogusprijs óf eerste-toelating → null (we schatten niet uit de lucht).
export function depreciationEstimate({ catalogPriceCents, firstRegistration, now = new Date() } = {}) {
  if (!catalogPriceCents || catalogPriceCents <= 0 || !firstRegistration) return null;
  const start = new Date(firstRegistration);
  if (Number.isNaN(start.getTime())) return null;
  const ageYears = Math.max(0, (now - start) / (365.25 * 24 * 3600 * 1000));
  const r = 0.82;
  const floor = catalogPriceCents * 0.10;
  const valAt = (age) => Math.max(floor, catalogPriceCents * Math.pow(r, age));
  const currentValue = valAt(ageYears);
  const lastYearLoss = Math.max(0, valAt(Math.max(0, ageYears - 1)) - currentValue);
  return {
    currentValueCents: Math.round(currentValue),
    annualCents: Math.round(lastYearLoss),
    monthlyCents: Math.round(lastYearLoss / 12),
  };
}

// Gerealiseerde onderhoudskosten over de laatste `months` maanden → maand-gemiddelde (centen).
// Telt alleen logs met kosten binnen het venster [now - months, now].
export function maintenanceMonthlyAvgCents(logs = [], { now = new Date(), months = 12 } = {}) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  let sum = 0;
  for (const r of logs) {
    if (r?.cost_cents == null) continue;
    const d = r.performed_on ? new Date(r.performed_on) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    if (d >= cutoff && d <= now) sum += r.cost_cents;
  }
  return Math.round(sum / Math.max(1, months));
}

// Volledig kostenoverzicht (maand + jaar), opgesplitst in vaste lasten / onderhoud /
// afschrijving.
//   recurring: [{ amount_cents, recur_freq, recur_interval }]  (al gefilterd op dit voertuig)
//   logs:      [{ performed_on, cost_cents }]
//   vehicle:   { catalog_price_cents, first_registration }
export function vehicleCostSummary({ recurring = [], logs = [], vehicle = {}, now = new Date() } = {}) {
  const fixedMonthly = recurring.reduce(
    (s, t) => s + monthlyEquivalentCents(t.amount_cents, t.recur_freq, t.recur_interval), 0);
  const maintMonthly = maintenanceMonthlyAvgCents(logs, { now });
  const dep = depreciationEstimate({
    catalogPriceCents: vehicle.catalog_price_cents, firstRegistration: vehicle.first_registration, now,
  });
  const depMonthly = dep?.monthlyCents ?? 0;
  const monthly = Math.round(fixedMonthly + maintMonthly + depMonthly);
  return {
    fixedMonthlyCents: Math.round(fixedMonthly),
    maintenanceMonthlyCents: maintMonthly,
    depreciationMonthlyCents: depMonthly,
    monthlyCents: monthly,
    annualCents: monthly * 12,
    depreciation: dep,
  };
}
