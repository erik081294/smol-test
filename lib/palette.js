// Pure kleurpaletten (géén React Native) — losgetrokken uit lib/theme.js zodat de
// a11y-contrast-test (tests/contrast.test.js, PLT-5) de échte waarden kan lezen en
// regressies vangt. theme.js importeert deze en bouwt het live `colors`-object +
// de afgeleide tokens (type/categoryMeta) eromheen.
//
// Tekstregel (zie DESIGN.md "Contrast"):
//   • ink / inkSoft  → leesbare tekst op licht oppervlak (AA).
//   • inkFaint       → tertiair (meta, placeholders); ≥ 3:1 (UI/large), niet voor body.
//   • op donkergroen (forest) → `onDark` (#fff) voor tekst; `ocherSoft` is bewust een
//     vlek-/achtergrondkleur, niet leesbaar als tekst op forest (donker: ~2.24:1).
//   • op het accent (ocher, bv. FAB/accent-knop) → `onAccent` (diepgroen); dat haalt
//     ≥3:1 in beide thema's waar `forest` in donker op 2.94:1 zou zakken.

// Licht palet — de basisidentiteit: zandwit met diepgroen + oker.
export const lightColors = {
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
  onAccent:   '#0E3A2F',  // tekst/icoon ÓP het accent (ocher) — diepgroen, AA-groot/UI (≥3:1)

  // Tekst (op lichte oppervlakken)
  ink:        '#1A2420',  // primaire tekst
  inkSoft:    '#5A655F',  // secundaire tekst (AA op bg/surface)
  inkFaint:   '#6F766E',  // tertiair: meta, placeholders — AA op surface, ≥3:1 op bg
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
  catVoertuig:   '#5B7A8C',
};

// Donker palet — dezelfde warme, huiselijke identiteit op donkere oppervlakken.
// Diepgroen wordt iets lichter (zichtbaar als knop/accent op donker), oker blijft het
// accent, zachte status-tinten worden donkere vlekken. Tekst is warm wit i.p.v. inkt.
export const darkColors = {
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
  onAccent:   '#0E3A2F',  // tekst/icoon ÓP het accent — donkerder groen dan forest zodat
                          // het op de lichte oker ≥3:1 haalt (forest zou hier 2.94:1 zijn)

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
  catVoertuig:   '#6E90A3',
};
