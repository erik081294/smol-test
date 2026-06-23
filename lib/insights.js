// Pure logica voor kosten-inzichten & budget. Géén React/Supabase. Werkt op de
// rauwe uitgave-rijen (amount_cents/spent_on/category) — het HUISHOUD-totaal per
// maand/categorie, niet per-persoon (dat is computeBalances in lib/expenses.js).
// Bedragen in hele centen.
import { format, subMonths, startOfMonth } from 'date-fns';
import { dateLocale } from './i18n';

// 'yyyy-MM' van een datum of een 'yyyy-MM-dd'-string (geen tijdzone-gedoe).
const monthKeyOf = (d) => (typeof d === 'string' ? d.slice(0, 7) : format(d, 'yyyy-MM'));
const cents = (e) => Number(e?.amount_cents) || 0;

// Totaal per maand over de laatste `months` maanden (incl. nul-maanden), oud → nieuw.
// -> [{ month: 'yyyy-MM', label: 'jun', totalCents }]
export function byMonth(expenses = [], { months = 6, now = new Date() } = {}) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    buckets.push({ month: format(d, 'yyyy-MM'), label: format(d, 'LLL', { locale: dateLocale() }), totalCents: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of expenses) {
    const i = idx.get(monthKeyOf(e.spent_on));
    if (i != null) buckets[i].totalCents += cents(e);
  }
  return buckets;
}

// Totaal van één maand ('yyyy-MM').
export function monthTotal(expenses = [], month) {
  return expenses.reduce((s, e) => (monthKeyOf(e.spent_on) === month ? s + cents(e) : s), 0);
}

// Aantal uitgaven in één maand ('yyyy-MM') — voor periode-transparantie in de
// inzichten ("8 uitgaven deze maand"), zodat het maandtotaal navolgbaar is.
export function monthCount(expenses = [], month) {
  return expenses.reduce((n, e) => (monthKeyOf(e.spent_on) === month ? n + 1 : n), 0);
}

// Totaal per categorie (optioneel binnen één maand), aflopend gesorteerd.
// -> [{ category, totalCents }]
export function byCategory(expenses = [], { month = null } = {}) {
  const totals = new Map();
  for (const e of expenses) {
    if (month && monthKeyOf(e.spent_on) !== month) continue;
    const c = e.category || 'overig';
    totals.set(c, (totals.get(c) ?? 0) + cents(e));
  }
  return [...totals.entries()]
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => (b.totalCents - a.totalCents) || a.category.localeCompare(b.category));
}

// Budgetstand voor een maandtotaal. null als er geen (positief) budget is.
// -> { budgetCents, totalCents, remainingCents, pct, over }
export function budgetStatus(totalCents, budgetCents) {
  if (budgetCents == null || budgetCents <= 0) return null;
  return {
    budgetCents,
    totalCents,
    remainingCents: budgetCents - totalCents,
    pct: Math.round((totalCents / budgetCents) * 100),
    over: totalCents > budgetCents,
  };
}
