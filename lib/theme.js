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
export const colors = {
  // Basis-oppervlakken
  bg:         '#F5F2EC',  // warm zandwit — app-achtergrond
  surface:    '#FFFFFF',  // kaarten, rijen, velden
  surfaceAlt: '#EDE8DE',  // zachte vulling, ingedrukte staat
  overlay:    'rgba(26,36,32,0.45)', // dimlaag onder modals/sheets

  // Merk
  forest:     '#0E3A2F',  // diepgroen — koppen, primaire knop, navigatie
  forestSoft: '#1C5446',  // lichter groen — pressed/hover van forest
  forestTint: '#E4ECE6',  // groene vlek-achtergrond (badges, selectie)
  ocher:      '#E0A53D',  // accent — acties, highlights, FAB
  ocherSoft:  '#F6E4BE',  // accent-achtergrond (avatar, badge)

  // Tekst (op lichte oppervlakken)
  ink:        '#1A2420',  // primaire tekst
  inkSoft:    '#5A655F',  // secundaire tekst (AA op bg/surface)
  inkFaint:   '#8A938D',  // tertiair: meta, placeholders — niet voor body
  onDark:     '#FFFFFF',  // tekst op forest/donkere vlakken

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
  catAfspraak:   '#B5739E',
  catOverig:     '#9AA39D',
};

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

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h1:      { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h2:      { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  title:   { fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.ink },
  bodyLg:  { fontSize: 17, lineHeight: 26, fontWeight: '400', color: colors.ink }, // primair leescomfort
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '400', color: colors.ink },
  label:   { fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.inkSoft },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.inkFaint },
  button:  { fontSize: 16, lineHeight: 20, fontWeight: '700' },
};

// ---------------------------------------------------------------------------
// Categorie-metadata — categorie wordt áltijd met icoon + label getoond, niet
// met kleur alleen (toegankelijk bij kleurenblindheid). `icon` verwijst naar een
// semantische naam in lib/icons.js.
// ---------------------------------------------------------------------------
export const categoryMeta = {
  klus:       { label: 'Klusje',     icon: 'klus',       color: colors.catKlus },
  huishouden: { label: 'Huishouden', icon: 'huishouden', color: colors.catHuishouden },
  plant:      { label: 'Plant',      icon: 'plant',      color: colors.catPlant },
  afspraak:   { label: 'Afspraak',   icon: 'afspraak',   color: colors.catAfspraak },
  overig:     { label: 'Overig',     icon: 'overig',     color: colors.catOverig },
};
