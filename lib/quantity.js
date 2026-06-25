// Pure aantal-logica voor de boodschappenlijst + catalogus. De `quantity`-kolom op
// een boodschap is vrije tekst ("2 pak", "3"); deze module zet die om naar een telbaar
// getal + eenheid en weer terug, zodat een +/−-stepper op een lijstrij er rechtstreeks
// op kan werken. Géén React/IO — los testbaar.

// Rondt af op 3 decimalen — houdt float-ruis (0.1 + 0.2 = 0.30000000000000004) uit
// de som/opmaak, zodat een quantity-string netjes blijft ronddraaien.
function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// Splits een quantity-string in een telbaar aantal + (optionele) eenheid.
//   '2 pak'   -> { count: 2, unit: 'pak' }
//   '2.5 kg'  -> { count: 2.5, unit: 'kg' }   (decimaal blijft behouden, BOO-12)
//   '1,5 kg'  -> { count: 1.5, unit: 'kg' }   (komma telt óók als decimaalteken)
//   '3'       -> { count: 3, unit: '' }
//   'pak'     -> { count: 1, unit: 'pak' }     (geen getal = enkelvoud van die eenheid)
//   '' / null -> { count: 1, unit: '' }
// Een ontbrekend of nul-aantal telt als één (een boodschap staat er minstens één keer
// op); een positieve breuk (0.5 kg) blijft staan zoals getypt.
export function parseQuantity(quantity) {
  const s = String(quantity ?? '').trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m) {
    const v = round3(parseFloat(m[1].replace(',', '.')));
    return { count: v > 0 ? v : 1, unit: m[2].trim() };
  }
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

// Bouw de quantity-string terug uit aantal + eenheid. Eén héél stuks toont géén aantal
// (de naam alleen volstaat → null), zodat de lijst rustig blijft; vanaf twee — én bij
// élke breuk (1.5 kg, 0.5 l) — tonen we "<n> <eenheid>" (of enkel "<n>" zonder eenheid).
// De grens voor hele getallen ligt dus exact op 2; breuken tonen we altijd.
export function formatQuantity(count, unit = '') {
  const n = round3(Number(count) || 0);
  if (n <= 0) return null;
  if (Number.isInteger(n) && n < 2) return null;
  const u = String(unit ?? '').trim();
  return u ? `${n} ${u}` : String(n);
}
