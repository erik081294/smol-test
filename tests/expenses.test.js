// Units voor de WieBetaaltWat-kern (lib/expenses.js). Het hart van de module:
// splitsen mag nooit een cent kwijtraken, saldo's tellen op tot 0, en vereffenen
// gebruikt het minimale aantal betalingen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPLIT, computeShares, exactSharesValid, computeBalances, settle,
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
