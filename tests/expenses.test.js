// Units voor de WieBetaaltWat-kern (lib/expenses.js). Het hart van de module:
// splitsen mag nooit een cent kwijtraken, saldo's tellen op tot 0, en vereffenen
// gebruikt het minimale aantal betalingen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPLIT, computeShares, exactSharesValid, computeBalances, balancesFromTotals, settle,
  formatCents, parseAmountToCents,
} from '../lib/expenses.js';

const P = (...ids) => ids.map((id) => ({ profileId: id }));
const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

test('computeShares equal: som klopt en restcenten gaan deterministisch', () => {
  const out = computeShares({ amountCents: 1000, splitType: SPLIT.EQUAL, participants: P('a', 'b', 'c') });
  assert.equal(sum(out), 1000);
  // 1000/3 = 333.33 -> 334,333,333; de extra cent gaat naar 'a' (kleinste id bij gelijke frac).
  assert.equal(out.a, 334);
  assert.equal(out.b, 333);
  assert.equal(out.c, 333);
});

test('computeShares equal: precies deelbaar', () => {
  const out = computeShares({ amountCents: 900, splitType: SPLIT.EQUAL, participants: P('a', 'b', 'c') });
  assert.deepEqual(out, { a: 300, b: 300, c: 300 });
});

test('computeShares shares: naar verhouding van gewichten', () => {
  const out = computeShares({
    amountCents: 1000, splitType: SPLIT.SHARES,
    participants: [{ profileId: 'a', weight: 1 }, { profileId: 'b', weight: 1 }, { profileId: 'c', weight: 2 }],
  });
  assert.equal(sum(out), 1000);
  assert.deepEqual(out, { a: 250, b: 250, c: 500 });
});

test('computeShares shares: restcent bij niet-deelbare verhouding', () => {
  const out = computeShares({
    amountCents: 1000, splitType: SPLIT.SHARES,
    participants: [{ profileId: 'a', weight: 1 }, { profileId: 'b', weight: 2 }],
  });
  assert.equal(sum(out), 1000); // 333.33 / 666.66 -> 333 + 667
  assert.equal(out.a + out.b, 1000);
});

test('computeShares exact: neemt bedragen letterlijk over', () => {
  const out = computeShares({
    amountCents: 1000, splitType: SPLIT.EXACT,
    participants: [{ profileId: 'a', amountCents: 700 }, { profileId: 'b', amountCents: 300 }],
  });
  assert.deepEqual(out, { a: 700, b: 300 });
});

test('exactSharesValid: alleen waar als de som klopt', () => {
  assert.equal(exactSharesValid(1000, [{ amountCents: 700 }, { amountCents: 300 }]), true);
  assert.equal(exactSharesValid(1000, [{ amountCents: 700 }, { amountCents: 200 }]), false);
});

test('computeShares: lege deelnemers -> leeg', () => {
  assert.deepEqual(computeShares({ amountCents: 1000, participants: [] }), {});
});

test('computeBalances: betaler krijgt voorschot terug, deelnemers betalen aandeel, som = 0', () => {
  // Erik betaalt €30, gelijk gedeeld over Erik, Mira, Tim (elk €10).
  const shares = computeShares({ amountCents: 3000, splitType: SPLIT.EQUAL, participants: P('erik', 'mira', 'tim') });
  const bal = computeBalances([{ paidBy: 'erik', shares }]);
  assert.equal(sum(bal), 0);
  assert.equal(bal.erik, 2000);   // legde 3000 voor, eigen aandeel 1000 -> +2000
  assert.equal(bal.mira, -1000);
  assert.equal(bal.tim, -1000);
});

test('computeBalances: meerdere uitgaven verrekenen tegen elkaar', () => {
  const e1 = { paidBy: 'a', shares: { a: 500, b: 500 } }; // a betaalt 1000
  const e2 = { paidBy: 'b', shares: { a: 500, b: 500 } }; // b betaalt 1000
  const bal = computeBalances([e1, e2]);
  // Beiden gelijk -> alles vereffend, geen saldo.
  assert.deepEqual(bal, {});
});

test('settle: keten lost op in het minimale aantal betalingen', () => {
  // a moet 1000, b moet 500, c krijgt 1500.
  const payments = settle({ a: -1000, b: -500, c: 1500 });
  assert.equal(payments.length, 2);
  assert.equal(payments.reduce((s, p) => s + p.amountCents, 0), 1500);
  for (const p of payments) assert.equal(p.to, 'c');
});

test('settle: bedragen kloppen en niemand betaalt meer dan zijn schuld', () => {
  const bal = { a: -700, b: -300, c: 1000 };
  const payments = settle(bal);
  const paidBy = {};
  for (const p of payments) paidBy[p.from] = (paidBy[p.from] ?? 0) + p.amountCents;
  assert.equal(paidBy.a, 700);
  assert.equal(paidBy.b, 300);
});

test('settle: leeg saldo -> geen betalingen', () => {
  assert.deepEqual(settle({}), []);
});

test('formatCents: nette euro-notatie', () => {
  assert.equal(formatCents(1250), '€12,50');
  assert.equal(formatCents(-400), '-€4,00');
  assert.equal(formatCents(0), '€0,00');
});

test('parseAmountToCents: accepteert komma en punt, weigert onzin', () => {
  assert.equal(parseAmountToCents('12,50'), 1250);
  assert.equal(parseAmountToCents('12.5'), 1250);
  assert.equal(parseAmountToCents('7'), 700);
  assert.equal(parseAmountToCents('abc'), null);
  assert.equal(parseAmountToCents('1,234'), null); // te veel decimalen
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// deling-door-nul, de exacte restcent-volgorde (fractie dan id), deterministisch
// vereffenen bij gelijke bedragen, en een getal-invoer.

test('computeShares shares: alle gewichten 0 → iedereen 0 (geen deling door nul)', () => {
  const out = computeShares({
    amountCents: 1000, splitType: SPLIT.SHARES,
    participants: [{ profileId: 'a', weight: 0 }, { profileId: 'b', weight: 0 }],
  });
  assert.deepEqual(out, { a: 0, b: 0 });
});

test('computeShares: restcenten gaan naar grootste fractie, dan op id', () => {
  // gewichten 1:2:3 op 100 ct → 16,67 / 33,33 / 50,0 → floor 16/33/50, 1 restcent
  // naar de grootste fractie (z = ,67), niet naar het kleinste id.
  const out = computeShares({
    amountCents: 100, splitType: SPLIT.SHARES,
    participants: [{ profileId: 'z', weight: 1 }, { profileId: 'a', weight: 2 }, { profileId: 'm', weight: 3 }],
  });
  assert.deepEqual(out, { z: 17, a: 33, m: 50 });
  // gelijke fracties (4 × 250,5 op 1002) → 2 restcenten naar de twee kleinste id's.
  const out2 = computeShares({ amountCents: 1002, splitType: SPLIT.EQUAL, participants: P('d', 'a', 'c', 'b') });
  assert.deepEqual(out2, { a: 251, b: 251, c: 250, d: 250 });
  assert.equal(sum(out2), 1002);
});

test('computeShares: som-invariant blijft kloppen, óók bij een negatief totaal', () => {
  // De invoerpaden weigeren negatief, maar de functie hoort de som-invariant te
  // bewaren als een toekomstige refund-feature dit tóch raakt (regressievangnet).
  const neg = computeShares({ amountCents: -1000, splitType: SPLIT.EQUAL, participants: P('a', 'b', 'c') });
  assert.equal(sum(neg), -1000);
  const negShares = computeShares({
    amountCents: -100, splitType: SPLIT.SHARES,
    participants: [{ profileId: 'z', weight: 1 }, { profileId: 'a', weight: 2 }, { profileId: 'm', weight: 3 }],
  });
  assert.equal(sum(negShares), -100);
});

test('settle: deterministische koppeling bij gelijke bedragen (op id)', () => {
  const payments = settle({ x: -500, a: -500, c: 500, z: 500 });
  assert.deepEqual(payments, [
    { from: 'a', to: 'c', amountCents: 500 },
    { from: 'x', to: 'z', amountCents: 500 },
  ]);
});

test('parseAmountToCents: accepteert ook een getal als invoer', () => {
  assert.equal(parseAmountToCents(7.5), 750);
  assert.equal(parseAmountToCents(12), 1200);
});

// --- balancesFromTotals (PERF-1): saldo uit server-side aggregaat-totalen, gebruikt
// als de uitgavenlijst het laad-venster raakt. Net = voorgeschoten − eigen aandeel;
// som = 0 net als computeBalances; exacte nullen worden opgeruimd.

test('balancesFromTotals: net = voorgeschoten − aandeel, som = 0', () => {
  const bal = balancesFromTotals([
    { profile_id: 'erik', paid_cents: 3000, share_cents: 1000 }, // legde voor → +2000
    { profile_id: 'mira', paid_cents: 0, share_cents: 1000 },    // alleen aandeel → −1000
    { profile_id: 'tim', paid_cents: 0, share_cents: 1000 },     // alleen aandeel → −1000
  ]);
  assert.equal(bal.erik, 2000);   // 3000 − 1000 (niet 3000 + 1000)
  assert.equal(bal.mira, -1000);
  assert.equal(bal.tim, -1000);
  assert.equal(sum(bal), 0);
});

test('balancesFromTotals: exacte nul-saldi worden opgeruimd', () => {
  const bal = balancesFromTotals([
    { profile_id: 'a', paid_cents: 500, share_cents: 500 },  // net 0 → weg
    { profile_id: 'b', paid_cents: 800, share_cents: 300 },  // net +500 → blijft
  ]);
  assert.deepEqual(bal, { b: 500 });
  assert.ok(!('a' in bal), 'nul-saldo hoort niet in het overzicht');
});

test('balancesFromTotals: ontbrekende paid/share tellen als 0, leeg → leeg', () => {
  const bal = balancesFromTotals([
    { profile_id: 'a', share_cents: 400 },  // geen paid_cents → 0 − 400 = −400
    { profile_id: 'b', paid_cents: 400 },   // geen share_cents → 400 − 0 = +400
  ]);
  assert.equal(bal.a, -400);
  assert.equal(bal.b, 400);
  assert.deepEqual(balancesFromTotals([]), {});
  assert.deepEqual(balancesFromTotals(), {}); // zonder argument → leeg saldo
});
