// Pure barcode-helpers (BOO-9): normaliseren + GTIN-checksumvalidatie. Géén React/
// netwerk — los testbaar. Een scanner levert soms ruis (spaties, letters) of een
// onvolledige code; hiermee accepteren we alleen echte EAN-8/UPC-A/EAN-13/GTIN-14.

// Alleen de cijfers overhouden.
export function normalizeBarcode(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

// GTIN mod-10-checksum: weeg de datacijfers van rechts naar links met 3,1,3,1,…
// en vergelijk met het controlecijfer (laatste cijfer). Geldt voor lengte 8/12/13/14.
export function isValidBarcode(raw) {
  const code = normalizeBarcode(raw);
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  return (10 - (sum % 10)) % 10 === check;
}

// UPC-A (12) is een EAN-13 met een leidende 0. Normaliseer naar 13 zodat we op één
// vorm in de catalogus (`code`) kunnen matchen.
export function toEan13(raw) {
  const code = normalizeBarcode(raw);
  if (code.length === 12) return `0${code}`;
  return code;
}
