// Pure, testbare kern van WieBetaaltWat: splitsen, saldo's en vereffenen.
// Géén React/Supabase. Alle bedragen in HELE CENTEN (integers) — nooit floats —
// zodat er geen cent zoekraakt bij afronden.
//
// Splitsing garandeert: som(aandelen) === amountCents, exact. Restcenten gaan
// deterministisch naar de deelnemers met de grootste afrondingsrest (bij gelijke
// rest: stabiel op profileId), zodat de uitkomst reproduceerbaar is.

export const SPLIT = { EQUAL: 'equal', SHARES: 'shares', EXACT: 'exact' };

// Verdeel amountCents over de deelnemers.
//   participants: [{ profileId, weight?, amountCents? }]
//     - equal  : iedereen gelijk (weight genegeerd)
//     - shares : naar verhouding van weight (default 1)
//     - exact  : neemt p.amountCents letterlijk over
// -> { [profileId]: cents }
export function computeShares({ amountCents, splitType = SPLIT.EQUAL, participants = [] }) {
  if (participants.length === 0) return {};

  if (splitType === SPLIT.EXACT) {
    const out = {};
    for (const p of participants) out[p.profileId] = Math.round(p.amountCents ?? 0);
    return out;
  }

  const weights = participants.map((p) =>
    splitType === SPLIT.SHARES ? Math.max(0, p.weight ?? 0) : 1
  );
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW <= 0) return Object.fromEntries(participants.map((p) => [p.profileId, 0]));

  // Exacte (breuk-)aandelen, dan naar beneden afronden en de restcenten verdelen.
  const exact = participants.map((p, i) => (amountCents * weights[i]) / totalW);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = amountCents - floors.reduce((a, b) => a + b, 0);

  // Volgorde voor de restcenten: grootste fractie eerst, dan stabiel op profileId.
  const order = participants
    .map((p, i) => ({ id: p.profileId, i, frac: exact[i] - floors[i] }))
    .sort((a, b) => (b.frac - a.frac) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const out = {};
  participants.forEach((p, i) => { out[p.profileId] = floors[i]; });
  for (let k = 0; k < order.length && remainder > 0; k++) {
    out[order[k].id] += 1;
    remainder -= 1;
  }
  return out;
}

// Som van een exact-splitsing klopt met het totaal? (UI-validatie vóór opslaan.)
export function exactSharesValid(amountCents, participants) {
  const sum = participants.reduce((a, p) => a + Math.round(p.amountCents ?? 0), 0);
  return sum === amountCents;
}

// Saldo per persoon over een set uitgaven.
//   expenses: [{ paidBy, shares: { [profileId]: cents } }]
// Positief = krijgt nog geld terug; negatief = is nog geld schuldig. Som = 0.
export function computeBalances(expenses = []) {
  const bal = {};
  const bump = (id, delta) => { bal[id] = (bal[id] ?? 0) + delta; };
  for (const e of expenses) {
    const total = Object.values(e.shares ?? {}).reduce((a, b) => a + b, 0);
    bump(e.paidBy, total);                  // betaler legde het hele bedrag voor
    for (const [id, cents] of Object.entries(e.shares ?? {})) bump(id, -cents); // ieders aandeel
  }
  // Ruim exacte nullen op zodat het overzicht schoon is.
  for (const id of Object.keys(bal)) if (bal[id] === 0) delete bal[id];
  return bal;
}

// Saldo per persoon uit server-side aggregaat-totalen (PERF-1). Gebruikt als de
// uitgavenlijst het laad-venster raakt (>2000 rijen): dan rekenen we niet uit de
// afgekapte rijen maar uit exacte all-time-totalen van household_expense_totals.
//   totals: [{ profile_id, paid_cents, share_cents }]
// Net = voorgeschoten - eigen aandeel. Som = 0 (zoals computeBalances). Exacte
// nullen worden opgeruimd zodat het saldo-overzicht schoon blijft.
export function balancesFromTotals(totals = []) {
  const bal = {};
  for (const ttl of totals) {
    const net = (ttl.paid_cents ?? 0) - (ttl.share_cents ?? 0);
    if (net !== 0) bal[ttl.profile_id] = net;
  }
  return bal;
}

// Vereffenen met zo min mogelijk betalingen (greedy: grootste crediteur ↔ grootste
// debiteur). Goed genoeg voor een huishouden; deterministisch op profileId bij gelijke bedragen.
//   balances: { [profileId]: cents }
// -> [{ from, to, amountCents }]  (from betaalt aan to)
export function settle(balances = {}) {
  const creditors = []; // krijgen geld (positief)
  const debtors = [];   // moeten betalen (negatief -> als positief bedrag)
  for (const [id, cents] of Object.entries(balances)) {
    if (cents > 0) creditors.push({ id, amount: cents });
    else if (cents < 0) debtors.push({ id, amount: -cents });
  }
  const byAmountThenId = (a, b) => (b.amount - a.amount) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  creditors.sort(byAmountThenId);
  debtors.sort(byAmountThenId);

  const payments = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const amount = Math.min(c.amount, d.amount);
    if (amount > 0) payments.push({ from: d.id, to: c.id, amountCents: amount });
    c.amount -= amount;
    d.amount -= amount;
    if (c.amount === 0) ci++;
    if (d.amount === 0) di++;
  }
  return payments;
}

// Hulp voor de UI: centen -> "€12,50".
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}€${(abs / 100).toFixed(2).replace('.', ',')}`;
}

// Hulp voor de UI: vrije invoer ("12,50" / "12.5" / "12") -> centen (of null).
export function parseAmountToCents(text) {
  if (text == null) return null;
  const cleaned = String(text).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}
