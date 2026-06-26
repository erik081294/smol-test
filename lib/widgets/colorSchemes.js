// @ts-check
// Pure per-module kleurschema's voor de widget-grid (VDG-6). Bewust géén
// react-native-/theme-import zodat de afleiding in node te unit-testen is; het live
// palet (licht/donker, uit lib/theme.js) geeft de aanroeper mee als `palette`.
//
// Twee stijlen per widget (VDG-5):
//   • playful — een zachte wash van de module-accent + een accent-gekleurd icoon;
//   • neutral — het rustige oppervlak met een zacht icoon (accent enkel op de stat).

// Onderscheidbare, warme accenten per module (AA als icoon/stat-kleur op zowel het
// lichte als het donkere oppervlak).
export const WIDGET_ACCENTS = {
  taken: '#2E6B4F',
  boodschappen: '#B6772A',
  // Warme bes/wijn i.p.v. koel tech-violet (#6E5FB0): past beter bij het warme
  // forest/ocher-palet (DESIGN.md "warm, niet klinisch"), blijft onderscheidbaar van
  // de andere accenten en houdt vergelijkbaar contrast (~4.6 op bg).
  kosten: '#9A5A6E',
  planten: '#4E9A6B',
  agenda: '#C2663A',
  schoonmaak: '#3F8C8C',
  maaltijden: '#C0564A',
  voorraad: '#9A8230',
  activiteit: '#4E7FA6',
};
const DEFAULT_ACCENT = '#2E6B4F';

export function accentFor(moduleKey) {
  return WIDGET_ACCENTS[moduleKey] ?? DEFAULT_ACCENT;
}

// -> { bg, border, icon, accent }. `palette`: { surface, line, inkSoft } uit het thema.
export function widgetScheme(moduleKey, style = 'playful', palette = {}) {
  const accent = accentFor(moduleKey);
  if (style === 'neutral') {
    return {
      bg: palette.surface ?? '#FFFFFF',
      border: palette.line ?? '#E2DDD2',
      icon: palette.inkSoft ?? '#5A655F',
      accent,
    };
  }
  // playful: ~12% accent-wash (8-bits alpha-suffix), accent-gekleurd icoon.
  return { bg: `${accent}1F`, border: 'transparent', icon: accent, accent };
}
