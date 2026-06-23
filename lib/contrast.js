// Pure WCAG-contrasthelpers (géén React). Voor de a11y-contrast-borging (PLT-5):
// tests/contrast.test.js legt hiermee de AA-drempels van de kerntoken-paren vast,
// in licht én donker, zodat een palette-wijziging die het contrast breekt rood wordt.

// sRGB-kanaal → lineair (WCAG 2.x).
function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

// Relatieve luminantie van een '#rrggbb'-hex (0..1).
export function relativeLuminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Contrastverhouding tussen twee hex-kleuren (1..21). Symmetrisch.
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// WCAG-drempels: AA normale tekst 4.5, AA grote/bold tekst & UI-componenten 3.0.
export const AA_TEXT = 4.5;
export const AA_LARGE = 3.0;
