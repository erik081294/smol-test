// @ts-check
// Pure per-module kleurschema's voor de widget-grid (VDG-6). Bewust géén
// react-native-/theme-import zodat de afleiding in node te unit-testen is; het live
// palet (licht/donker, uit lib/theme.js) geeft de aanroeper mee als `palette`.
//
// Eén bron van waarheid: de module-tint staat als tokennaam in lib/modules.js
// (`colorToken` / `colorSoftToken`) en de hex in lib/palette.js. Hier resolven we die
// tegen het meegegeven palet, zodat de tegel vanzelf met het thema meekantelt.
//
// Twee stijlen per widget (VDG-5):
//   • playful — het zachte module-vlak (`*Soft`) met een sterk gekleurd icoonvlak;
//   • neutral — het rustige oppervlak met een zacht icoon (accent enkel op de stat).
import { getModule } from '../modules.js';
import { pickReadable, contrastRatio, AA_LARGE } from '../contrast.js';

// Terugval als een module geen eigen tint heeft (of het palet nog leeg is, in tests).
const DEFAULT_ACCENT = '#2E6B4F';

/** De sterke module-tint: icoonvlak, checkbox-rand, voortgangsbalk. */
export function accentFor(moduleKey, palette = {}) {
  const tok = getModule(moduleKey)?.colorToken;
  return (tok && palette[tok]) || palette.forest || DEFAULT_ACCENT;
}

/** Het zachte module-vlak: kaart-/tegel-achtergrond. `undefined` als de module geen tint heeft. */
export function softFor(moduleKey, palette = {}) {
  const tok = getModule(moduleKey)?.colorSoftToken;
  return (tok && palette[tok]) || undefined;
}

// -> { bg, border, icon, onAccent, accent, stat }. `palette`: het live `colors`-object.
export function widgetScheme(moduleKey, style = 'playful', palette = {}) {
  const accent = accentFor(moduleKey, palette);
  const ink = palette.ink ?? '#1C2420';
  // De glyph ÓP het sterke vlak: kies op runtime de leesbare voorgrond. Vaste witte
  // tekst zakt op de oker-tint naar ~2.65:1 — precies wat Chip ook al zo oplost.
  const onAccent = pickReadable(accent, palette.onAccent ?? '#2A1B08', palette.onDark ?? '#FBF7EF');

  if (style === 'neutral') {
    const bg = palette.surface ?? '#FFFFFF';
    return {
      bg,
      border: palette.line ?? '#E2DDD2',
      icon: palette.inkSoft ?? '#5A655F',
      onAccent,
      accent,
      stat: statOn(accent, bg, ink),
    };
  }
  // playful: het echte soft-token (kantelt mee in donkere modus). Heeft de module géén
  // tint, dan de oude ~12% accent-wash als terugval.
  const bg = softFor(moduleKey, palette) ?? `${accent}1F`;
  return { bg, border: 'transparent', icon: accent, onAccent, accent, stat: statOn(accent, bg, ink) };
}

// De stat is korte, grote tekst (AA-groot/UI ⇒ 3:1). Haalt de moduletint dat op dit
// vlak, dan kleurt de stat mee; zo niet (bv. oker op zijn eigen soft-vlek: ~2.25:1)
// valt 'ie terug op `ink`. DESIGN.md: "tekst nooit in de moduletint als het niet leest".
function statOn(accent, bg, ink) {
  return contrastRatio(accent, bg) >= AA_LARGE ? accent : ink;
}
