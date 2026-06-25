// Pure aantal-logica voor de boodschappenlijst + catalogus. De `quantity`-kolom op
// een boodschap is vrije tekst ("2 pak", "3"); deze module zet die om naar een telbaar
// getal + eenheid en weer terug, zodat een +/−-stepper op een lijstrij er rechtstreeks
// op kan werken. Géén React/IO — los testbaar.

// Splits een quantity-string in een telbaar aantal + (optionele) eenheid.
//   '2 pak' -> { count: 2, unit: 'pak' }
//   '3'     -> { count: 3, unit: '' }
//   'pak'   -> { count: 1, unit: 'pak' }   (geen getal = enkelvoud van die eenheid)
//   '' / null -> { count: 1, unit: '' }
// Het aantal is minimaal 1 (een boodschap zonder telbaar getal telt als één).
export function parseQuantity(quantity) {
  const s = String(quantity ?? '').trim();
  const m = s.match(/^(\d+)\s*(.*)$/);
  if (m) return { count: Math.max(1, parseInt(m[1], 10)), unit: m[2].trim() };
  return { count: 1, unit: s };
}

// Tel twee quantity-strings bij elkaar op (voor het samenvoegen van een dubbele
// boodschap). De eenheid van de bestaande regel wint, anders die van de nieuwe.
//   ('2 pak', '1 pak') -> '3 pak' · (null, null) -> '2' · ('3', null) -> '4'
export function mergeQuantity(existingQty, addQty) {
  const a = parseQuantity(existingQty);
  const b = parseQuantity(addQty);
  return formatQuantity(a.count + b.count, a.unit || b.unit);
}

// Bouw de quantity-string terug uit aantal + eenheid. Eén stuks toont géén aantal
// (de naam alleen volstaat → null), zodat de lijst rustig blijft; vanaf twee tonen we
// "<n> <eenheid>" (of enkel "<n>" zonder eenheid). De grens ligt dus exact op 2.
export function formatQuantity(count, unit = '') {
  const n = Math.trunc(Number(count) || 0);
  if (n < 2) return null;
  const u = String(unit ?? '').trim();
  return u ? `${n} ${u}` : String(n);
}
