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

// ---------------------------------------------------------------------------
// Kleur
// ---------------------------------------------------------------------------
// Tekstregel (zie DESIGN.md "Contrast"):
//   • ink / inkSoft  → leesbare tekst op licht oppervlak (AA).
//   • inkFaint       → alléén voor decoratief of ≥18pt-bold; nooit voor body.
//   • op donkergroen (forest) altijd #fff of ocherSoft voor tekst.
// Licht palet — de basisidentiteit: zandwit met diepgroen + oker.
const lightColors = {
  // Basis-oppervlakken
  bg:         '#F5F2EC',  // warm zandwit — app-achtergrond
  surface:    '#FFFFFF',  // kaarten, rijen, velden
  surfaceAlt: '#EDE8DE',  // zachte vulling, ingedrukte staat
  overlay:    'rgba(26,36,32,0.45)', // dimlaag onder modals/sheets

  // Merk
  forest:     '#0E3A2F',  // diepgroen — koppen, primaire knop, navigatie
  forestSoft: '#1C5446',  // lichter groen — pressed/hover van forest
  forestTint: '#E4ECE6',  // groene vlek-achtergrond (badges, selectie)
  brandText:  '#0E3A2F',  // groene tékst op forestTint (= forest; donker op lichte vlek)
  ocher:      '#E0A53D',  // accent — acties, highlights, FAB
  ocherSoft:  '#F6E4BE',  // accent-achtergrond (avatar, badge)

  // Tekst (op lichte oppervlakken)
  ink:        '#1A2420',  // primaire tekst
  inkSoft:    '#5A655F',  // secundaire tekst (AA op bg/surface)
  inkFaint:   '#8A938D',  // tertiair: meta, placeholders — niet voor body
  onDark:     '#FFFFFF',  // tekst op forest/donkere vlakken

  // Toast/snackbar — een zwevend, contrastrijk vlak dat los van het thema móét
  // werken: een eigen donker oppervlak met witte tekst (niet `ink`, want die kantelt
  // in donkere modus naar licht en maakt witte tekst onleesbaar). Zie lib/toast.js.
  toastBg:    '#1A2420',  // diep, warm donker
  toastText:  '#FFFFFF',

  // Lijnen & scheiding
  line:       '#E2DDD2',  // randen van kaarten/velden
  lineStrong: '#CFC8B9',  // duidelijker scheiding waar nodig

  // Status (kleur + zachte achtergrond als paar)
  success:     '#2E7D5B',
  successSoft: '#DBEDE3',
  warning:     '#B97A12',
  warningSoft: '#FBEACB',
  danger:      '#B8462C',
  dangerSoft:  '#F6DBD2',
  info:        '#3D6E97',
  infoSoft:    '#DCE8F1',

  // Afgerond/voltooid (eigen, vriendelijker groen dan success)
  done:        '#7BA893',

  // Toegankelijkheid
  focus:       '#1C5446',  // zichtbare focus-/selectie-ring

  // Categorie-accenten (bewust van elkaar onderscheidbaar, ook bij kleurenblindheid
  // wordt categorie áltijd ook met een emoji/label getoond — nooit kleur alleen).
  catKlus:       '#E0A53D',
  catHuishouden: '#6B8FB5',
  catPlant:      '#7BA893',
  catHuisdier:   '#C77B52',
  catAfspraak:   '#B5739E',
  catOverig:     '#9AA39D',
};

// Donker palet — dezelfde warme, huiselijke identiteit op donkere oppervlakken.
// Diepgroen wordt iets lichter (zichtbaar als knop/accent op donker), oker blijft het
// accent, zachte status-tinten worden donkere vlekken. Tekst is warm wit i.p.v. inkt.
const darkColors = {
  bg:         '#100F0B',  // warm bijna-zwart (iets dieper → kaarten poppen meer)
  surface:    '#262219',  // kaarten/rijen — duidelijk lichter dan bg zodat ze oplichten
  surfaceAlt: '#332E23',  // zachte vulling, ingedrukte staat (boven surface)
  overlay:    'rgba(0,0,0,0.6)',

  forest:     '#2F7058',  // diepgroen, lichter zodat knop/accent oplicht op donker
  forestSoft: '#3E8E6F',
  forestTint: '#223A2D',  // groene vlek (badges, icoon-cirkels) — zichtbaar op surface
  brandText:  '#7FBFA0',  // groene tékst op forestTint — lichter dan forest voor AA op donker
  ocher:      '#E6AE4A',  // accent blijft warm oker
  ocherSoft:  '#3A2F1A',  // donkere oker-vlek

  ink:        '#F1EDE3',  // warm wit — primaire tekst
  inkSoft:    '#B6AFA2',  // secundair
  inkFaint:   '#857F72',  // tertiair: meta, placeholders
  onDark:     '#FFFFFF',

  // Toast/snackbar — blijft een donker, opgetild vlak (iets lichter dan de kaarten
  // zodat 'ie op de bijna-zwarte achtergrond duidelijk zweeft), met witte tekst.
  toastBg:    '#3A352B',
  toastText:  '#FFFFFF',

  line:       '#3A3429',  // randen op donker — iets zichtbaarder tegen surface
  lineStrong: '#4E4636',

  success:     '#4FA77E',
  successSoft: '#16271F',
  warning:     '#D69A3A',
  warningSoft: '#2C2412',
  danger:      '#DB6E52',
  dangerSoft:  '#2E1812',
  info:        '#5B92C0',
  infoSoft:    '#15222E',

  done:        '#5E8C77',

  focus:       '#3E8E6F',

  // Categorie-accenten — iets opgehelderd voor leesbaarheid op donker.
  catKlus:       '#E6AE4A',
  catHuishouden: '#7FA0C2',
  catPlant:      '#8FBBA5',
  catHuisdier:   '#D48A60',
  catAfspraak:   '#C488AE',
  catOverig:     '#A7AFA9',
};

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
};

// Standaard schermrand. Eén waarde door de hele app = rustig en voorspelbaar.
export const screenPadding = 18;

// ---------------------------------------------------------------------------
// Vorm
// ---------------------------------------------------------------------------
export const radius = { sm: 8, md: 14, lg: 22, xl: 28, pill: 999 };

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
export const font = {
  // Systeemfonts. In productie kun je een display-face laden (bv. Fraunces voor
  // display/h1) zonder de rest van het systeem te raken.
  display: undefined,
  body: undefined,
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
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  h1:      { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  h2:      { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  title:   { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  bodyLg:  { fontSize: 17, lineHeight: 26, fontWeight: '400' }, // primair leescomfort
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label:   { fontSize: 13, lineHeight: 16, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  button:  { fontSize: 16, lineHeight: 20, fontWeight: '700' }, // kleur per gebruik
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
