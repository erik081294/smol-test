// Design tokens voor Huishoek.
//
// Identiteit: "thuis" — diepgroen als basis, warm oker als accent, op zandwit.
// Rustig, huiselijk, maar strak genoeg om dagelijks te gebruiken. Toegankelijk
// genoeg dat zowel een kind als een oma 'm fijn vindt.
//
// Dit bestand is de ENIGE bron van waarheid voor kleur, ruimte, vorm, type,
// schaduw en beweging. Schermen en componenten verzinnen geen eigen waarden;
// ze pakken hier een token. Zie DESIGN.md voor de principes erachter.

import { Platform } from 'react-native';
import { lightColors, darkColors } from './palette';

// ---------------------------------------------------------------------------
// Kleur — de paletten staan in lib/palette.js (pure data, RN-vrij) zodat de
// a11y-contrast-test ze kan inlezen. Hier bouwen we het live `colors`-object +
// de afgeleide tokens (type/categoryMeta) eromheen. Tekstregel: zie DESIGN.md
// "Contrast" en de kop van lib/palette.js.
// ---------------------------------------------------------------------------

// Live palet. Eén gedeeld object dat in plaats gemuteerd wordt bij een thema-wissel,
// zodat alle `colors.x`-referenties (inline styles, op render-tijd gelezen) automatisch
// de nieuwe waarde zien zodra de boom hertekent. Zie applyTheme().
export const colors = { ...lightColors };

// ---------------------------------------------------------------------------
// Ruimte — 4pt-grid. spacing(n) voor losse berekeningen, `space` voor leesbare
// namen in stijlen. Gebruik bij voorkeur de namen.
// ---------------------------------------------------------------------------
export const spacing = (n) => n * 4;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 96, // ruimte tussen grote editoriale banden (guide)
};

// Standaard schermrand. Eén waarde door de hele app = rustig en voorspelbaar.
export const screenPadding = 18;

// ---------------------------------------------------------------------------
// Vorm — genereuze radii, afgestemd op het ronde display-karakter (guide).
// ---------------------------------------------------------------------------
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

// ---------------------------------------------------------------------------
// Toegankelijkheid
// ---------------------------------------------------------------------------
// Minimale tikbare maat. Alles wat je kunt aanraken is ten minste dit groot —
// fysiek óf via hitSlop. (Apple HIG 44pt / Material 48dp → we kiezen 48.)
export const touchTarget = 48;

// Vergroot het tikbare gebied rond een klein icoon/checkbox zonder de lay-out
// te verstoren. Geef het zichtbare formaat mee; je krijgt de hitSlop terug die
// het naar `touchTarget` optrekt.
export const hitSlopFor = (size) => {
  const pad = Math.max(0, Math.ceil((touchTarget - size) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
};

// ---------------------------------------------------------------------------
// Schaduw / elevatie — warme schaduw (ink i.p.v. zwart) voor een huiselijk
// gevoel. Spreid één object in een stijl: style={[..., elevation.e1]}.
// ---------------------------------------------------------------------------
// Op web wil React-Native-Web `boxShadow` (de losse shadow*-props zijn daar
// deprecated); op iOS/Android juist de shadow*-props + Android-elevation.
const shadow = (opacity, radiusPx, y, android) =>
  Platform.OS === 'web'
    ? { boxShadow: opacity > 0 ? `0px ${y}px ${radiusPx}px rgba(26,36,32,${opacity})` : undefined }
    : {
        shadowColor: '#1A2420',
        shadowOpacity: opacity,
        shadowRadius: radiusPx,
        shadowOffset: { width: 0, height: y },
        elevation: android,
      };

export const elevation = {
  e0: shadow(0, 0, 0, 0),     // plat
  e1: shadow(0.06, 8, 2, 2),  // kaart in rust
  e2: shadow(0.12, 16, 6, 6), // verhoogd / sheet
  e3: shadow(0.18, 20, 8, 10),// zwevend / FAB
};

// ---------------------------------------------------------------------------
// Beweging — kort en zacht. Respecteer "verminder beweging" in schermen die
// animeren (zie DESIGN.md).
// ---------------------------------------------------------------------------
export const motion = {
  fast: 150,
  base: 220,
  slow: 360,
};

// ---------------------------------------------------------------------------
// Typografie — elke stijl heeft een lineHeight: cruciaal voor leesbaarheid en
// voor tekst die meeschaalt met de systeeminstelling. Gebruik nooit fontSize
// zonder bijbehorende regelhoogte; pak hier een stijl.
// ---------------------------------------------------------------------------
// Twee families, elk met één taak (DESIGN.md "Typografie"):
//   • Bricolage Grotesque — koppen/display. Fris en karaktervol, warm zonder
//     kinderachtig te worden. Nooit zwaarder dan 500/600.
//   • Hanken Grotesk — alle body, UI, navigatie, knoppen, captions.
// Mengen is een systeem-overtreding. De assets laden via lib/fonts.js.
//
// We zetten de fontFamily per gewicht (en dus GEEN fontWeight ernaast): met een
// custom face kiest Android het bestand op familienaam en zou een losse
// fontWeight er synthetische bold overheen leggen — precies wat het systeem verbiedt.
export const font = {
  display:     'BricolageGrotesque_500Medium',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body:        'HankenGrotesk_400Regular',
  medium:      'HankenGrotesk_500Medium',
  semi:        'HankenGrotesk_600SemiBold',
};

// Tekstschalen — de KLEUR wordt per thema ingevuld (zie rebuildTokens), niet als
// live getter. Reden: op de New Architecture cachet Fabric de geflatte stijl per
// object-identiteit bij de eerste render; een `get color()` op een gedeeld,
// herbruikt style-object wordt dan maar één keer uitgelezen en blijft na een
// thema-wissel hangen op de kleur van die eerste render (bv. een h1-titel die in
// licht-modus voor het eerst rendert blijft donker op een donkere achtergrond).
// Daarom krijgen `type`/`categoryMeta` bij élke applyTheme() een VERSE identiteit
// met een platte kleurwaarde uit het actuele palet → Fabric herrekent gegarandeerd.
const TYPE_BASE = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: font.display,     letterSpacing: -1 },
  h1:      { fontSize: 30, lineHeight: 36, fontFamily: font.display,     letterSpacing: -0.8 },
  h2:      { fontSize: 22, lineHeight: 28, fontFamily: font.displaySemi, letterSpacing: -0.4 },
  title:   { fontSize: 17, lineHeight: 22, fontFamily: font.semi },
  bodyLg:  { fontSize: 17, lineHeight: 26, fontFamily: font.body }, // primair leescomfort
  body:    { fontSize: 16, lineHeight: 24, fontFamily: font.body },
  label:   { fontSize: 13, lineHeight: 16, fontFamily: font.semi },
  caption: { fontSize: 13, lineHeight: 17, fontFamily: font.medium },
  button:  { fontSize: 15, lineHeight: 20, fontFamily: font.semi }, // kleur per gebruik
};
// Welk paletspoor elke schaal als tekstkleur krijgt (button: geen — per gebruik gezet).
const TYPE_INK = {
  display: 'ink', h1: 'ink', h2: 'ink', title: 'ink', bodyLg: 'ink',
  body: 'ink', label: 'inkSoft', caption: 'inkFaint',
};
export const type = {};

// ---------------------------------------------------------------------------
// Categorie-metadata — categorie wordt áltijd met icoon + label getoond, niet
// met kleur alleen (toegankelijk bij kleurenblindheid). `icon` verwijst naar een
// semantische naam in lib/icons.js. Kleur per thema ingevuld (zie hierboven).
// ---------------------------------------------------------------------------
const CATEGORY_BASE = {
  klus:       { label: 'Klusje',     icon: 'klus',       token: 'catKlus' },
  huishouden: { label: 'Huishouden', icon: 'huishouden', token: 'catHuishouden' },
  plant:      { label: 'Plant',      icon: 'plant',      token: 'catPlant' },
  huisdier:   { label: 'Huisdier',   icon: 'huisdier',   token: 'catHuisdier' },
  afspraak:   { label: 'Afspraak',   icon: 'afspraak',   token: 'catAfspraak' },
  overig:     { label: 'Overig',     icon: 'overig',     token: 'catOverig' },
  voertuig:   { label: 'Voertuig',   icon: 'voertuig',   token: 'catVoertuig' },
};
export const categoryMeta = {};

// (Her)bouw de afgeleide tokens met platte kleurwaarden uit het actuele `colors`.
// Verse object-identiteiten per aanroep zodat de Fabric-stijlcache de nieuwe
// tekstkleuren oppikt na een thema-wissel.
function rebuildTokens() {
  for (const k in TYPE_BASE) {
    type[k] = TYPE_INK[k] ? { ...TYPE_BASE[k], color: colors[TYPE_INK[k]] } : { ...TYPE_BASE[k] };
  }
  for (const k in CATEGORY_BASE) {
    const b = CATEGORY_BASE[k];
    categoryMeta[k] = { label: b.label, icon: b.icon, color: colors[b.token] };
  }
}
rebuildTokens(); // vul direct bij module-load (palet staat dan op licht)

// ---------------------------------------------------------------------------
// Thema toepassen. Muteert alléén het live `colors`-palet; type/categoryMeta lezen
// hun kleur via getters, dus die hoeven (en mogen) niet gemuteerd worden. Roep dit
// aan vóór een root-remount (key-bump) zodat de hele boom met de nieuwe kleuren
// hertekent. mode: 'licht' | 'donker'. Zie lib/useTheme.js.
// ---------------------------------------------------------------------------
export function applyTheme(mode) {
  Object.assign(colors, mode === 'donker' ? darkColors : lightColors);
  rebuildTokens(); // verse type/categoryMeta-identiteiten → Fabric herrekent de tekstkleuren
}
