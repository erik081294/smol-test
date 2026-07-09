// @ts-check
// Pure export-/deel-formatters (PLT-4, plan 29 F9). Zetten app-data om naar platte
// tekst die via de systeem-sharesheet (react-native Share) te delen is — een
// boodschappenlijst als leesbaar lijstje, saldo's als CSV. Géén React/IO hier;
// de schermen roepen deze functies aan en geven het resultaat aan Share.share.

/**
 * Boodschappenlijst → deelbare tekst. Bedoeld om "wat moet er nog" te sturen:
 * standaard alleen de nog-openstaande items (afgevinkte laten we weg). Een item
 * toont zijn naam + (optioneel) de vrije-tekst hoeveelheid. Lege lijst → een
 * rustige regel i.p.v. een kale titel.
 * @param {Array<{ name?: string, quantity?: string|null, checked?: boolean }>} [items]
 * @param {{ title?: string, includeChecked?: boolean, emptyLabel?: string }} [opts]
 * @returns {string}
 */
export function groceriesAsText(items = [], { title = 'Boodschappen', includeChecked = false, emptyLabel = 'De lijst is leeg.' } = {}) {
  const lines = [];
  for (const it of items) {
    if (!it || typeof it.name !== 'string' || !it.name.trim()) continue;
    if (it.checked && !includeChecked) continue;
    const qty = typeof it.quantity === 'string' && it.quantity.trim() ? ` (${it.quantity.trim()})` : '';
    lines.push(`- ${it.name.trim()}${qty}`);
  }
  if (lines.length === 0) return `${title}\n${emptyLabel}`;
  return `${title}\n${lines.join('\n')}`;
}

// Centen → NL-decimaal ("1250" → "12,50"; negatief blijft negatief). Los gehouden
// van lib/expenses.formatCents (die zet er "€ " voor — voor CSV willen we kaal).
/** @param {number} cents */
function centsToNl(cents) {
  const n = Number.isFinite(cents) ? cents : 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Saldo-overzicht → CSV. NL-Excel-conventie: puntkomma-gescheiden + komma-decimaal,
 * zodat het bestand in een NL-spreadsheet direct in kolommen opent. Positief = staat
 * groen (krijgt geld terug), negatief = staat rood. Naam met een puntkomma/quote
 * wordt netjes ge-quote (CSV-escaping). Rijen worden op naam gesorteerd voor een
 * stabiele, reproduceerbare uitvoer.
 * @param {Array<{ name?: string, cents?: number }>} [rows]
 * @param {{ header?: [string, string] }} [opts]
 * @returns {string}
 */
export function balancesAsCsv(rows = [], { header = ['Naam', 'Saldo'] } = {}) {
  const esc = (s) => {
    const str = String(s ?? '');
    return /[";\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const body = [...rows]
    .filter((r) => r && typeof r.name === 'string' && r.name.trim())
    // De filter garandeert een niet-lege naam; `?? ''` is puur voor de typechecker
    // (de flow-narrowing draagt niet door naar een nieuwe array).
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'nl'))
    .map((r) => `${esc((r.name ?? '').trim())};${centsToNl(r.cents ?? 0)}`);
  return [`${esc(header[0])};${esc(header[1])}`, ...body].join('\n');
}
