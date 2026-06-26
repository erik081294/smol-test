// @ts-check
// Pure, testbare verschijning-helpers voor de fun-factor (V1): RDW-kleur → hex en
// RDW-carrosserie ('inrichting') → een grove silhouet-soort. Géén React. De CarGlyph
// (lib/CarGlyph.js) tekent hiermee "jouw autootje" in de juiste kleur en vorm.

// RDW levert de kleur als Nederlands woord (eerste_kleur), bv. 'BLAUW'. We mappen de
// gangbare waarden naar een prettige hex; onbekend → null (de UI valt terug op een
// neutrale themakleur). Sleutels lowercase; de lookup normaliseert de invoer.
const COLOR_HEX = {
  wit: '#EDEDED', zwart: '#2B2B2B', grijs: '#8A8F94', zilver: '#C2C7CC',
  blauw: '#3B6FB0', rood: '#C0392B', groen: '#3B8A57', geel: '#E8C541',
  oranje: '#E08A3C', bruin: '#7A5230', beige: '#D9C7A3', creme: '#EFE6CC',
  paars: '#7A4FA0', roze: '#D87CA8', goud: '#C9A646', diversen: null,
};

// Kleurnaam → hex, of null bij onbekend/leeg. Diakriet-/hoofdletter-/spatie-tolerant
// ('Crème' → 'creme'). Puur en deterministisch.
export function colorHex(name) {
  const key = String(name ?? '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // diakrieten weg: crème → creme
    .replace(/[^a-z]/g, '');
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(COLOR_HEX, key) ? COLOR_HEX[key] : null;
}

// Een kleur is "licht" (→ donkere rand/ruiten voor contrast) als de waargenomen
// helderheid hoog is. Verwacht een #rrggbb-hex; onbekend → false (behandel als donker).
export function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Rec. 601 luma; > 0.6 telt als licht.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// RDW-carrosserie ('inrichting') of voertuigsoort → grove silhouet-soort voor de glyph.
// Onbekend/leeg → 'hatchback' (de neutrale standaardauto).
export function bodyKind(bodyType) {
  const s = String(bodyType ?? '').toLowerCase();
  if (!s) return 'hatchback';
  if (/(stationwagen|station)/.test(s)) return 'station';
  if (/(mpv|kampeer|bus)/.test(s)) return 'van';
  if (/(bestel|gesloten opbouw|open laadvloer|laadbak)/.test(s)) return 'van';
  if (/(suv|terrein|cross)/.test(s)) return 'suv';
  if (/(sedan|coupe|coupé|cabrio)/.test(s)) return 'sedan';
  return 'hatchback';
}
