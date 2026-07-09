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
  bg:         '#FBF6EC',  // warm zandwit — app-achtergrond (warmer, lichter)
  surface:    '#FFFDF8',  // kaarten, rijen, velden (cream-wit i.p.v. koud wit)
  surfaceAlt: '#F3EBDA',  // zachte vulling, ingedrukte staat, footer/CTA-band
  overlay:    'rgba(26,36,32,0.45)', // dimlaag onder modals/sheets

  // Merk
  forest:      '#0E3A2F', // diepgroen — koppen, primaire knop, navigatie
  forestSoft:  '#DCE8E1', // zacht groen OPPERVLAK (kaart/sectie-vlek) — NIET meer de pressed-ink
  forestPressed: '#1C5446', // lichter groen — pressed/hover van forest (was forestSoft)
  forestTint:  '#E4ECE6', // groene vlek-achtergrond (badges, selectie, illustratie-stage)
  forestText:  '#0E3A2F', // groene tékst/link op licht vlak (in donker lichter, zie darkColors)
  brandText:   '#0E3A2F', // groene tékst op forestTint (= forest; donker op lichte vlek)
  ocher:       '#D98A29', // accent — acties, highlights, FAB (dieper, warmer oker)
  ocherSoft:   '#F6E6CB', // accent-achtergrond (avatar, badge)
  onAccent:    '#2A1B08', // tekst/icoon ÓP het accent (ocher) — donkerbruin, ruim AA-groot/UI

  // Tekst (op lichte oppervlakken)
  ink:        '#1C2420',  // primaire tekst
  inkSoft:    '#4C574F',  // secundaire tekst (AA op bg/surface)
  inkFaint:   '#808A82',  // tertiair: meta, placeholders — ≥3:1 op bg (donkerder dan design
                          // #8B948D, dat op de nieuwe bg op ~2.9:1 zou zakken — PLT-5-gate)
  body:       '#3A3A3A',  // lange leestekst (iets zachter dan ink)
  onDark:     '#FBF7EF',  // tekst op forest/donkere vlakken (warm cream-wit)

  // Toast/snackbar — een zwevend, contrastrijk vlak dat los van het thema móét
  // werken: een eigen donker oppervlak met witte tekst (niet `ink`, want die kantelt
  // in donkere modus naar licht en maakt witte tekst onleesbaar). Zie lib/toast.js.
  toastBg:    '#1A2420',  // diep, warm donker
  toastText:  '#FFFFFF',

  // Lijnen & scheiding
  line:       '#E8E0CE',  // randen van kaarten/velden (hairline)
  lineStrong: '#D8CFBC',  // duidelijker scheiding waar nodig

  // Status (kleur + zachte achtergrond als paar) — waarden bewust op de AA-halende
  // tinten gehouden: de fellere mockup-waarden (bv. warning #E0A81E) zakken op hun
  // eigen soft-vlak onder de 3:1-vloer (PLT-5). Status blijft kleur + tekst.
  success:     '#2E7D5B',
  successSoft: '#DBEDE3',
  warning:     '#B97A12',
  warningSoft: '#FBEACB',
  danger:      '#B8462C',
  dangerSoft:  '#F6DBD2',
  info:        '#3D6E97',
  infoSoft:    '#DCE8F1',

  // Afgerond/voltooid (eigen, vriendelijker groen dan success) — verzadigder, "eiland"
  // dat in beide thema's zijn vulling houdt.
  done:        '#3F9E64',

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

  // Module-tinten (tertiair) — elke module een eigen warme tint binnen dezelfde
  // familie; samen "de horizon". `mod*` = sterk (icoonvlak, checkbox-rand, accent),
  // `mod*Soft` = zacht kaart-/sectievlak. Tekst op een soft-vlak blijft ink/inkSoft:
  // de sterke tint is nooit de tekstkleur (oker haalt als tekst geen 3:1). Zie
  // lib/modules.js voor de koppeling module → token en DESIGN.md "Module-kleuren".
  modTaken:            '#2F8F6B',
  modTakenSoft:        '#D6E9DF',
  modBoodschappen:     '#D98A29',
  modBoodschappenSoft: '#F6E6CB',
  modPlanten:          '#4FA35C',
  modPlantenSoft:      '#DCEEE2',
  modKosten:           '#2B7CB0',
  modKostenSoft:       '#D6E7F2',
  modMaaltijden:       '#D9603A',
  modMaaltijdenSoft:   '#F6DDD2',
  modSchoonmaak:       '#7E6BC4',
  modSchoonmaakSoft:   '#E6E1F5',
  modVoorraad:         '#9A8230',
  modVoorraadSoft:     '#EFE8CC',
  modTijdlijn:         '#B4327A',
  modTijdlijnSoft:     '#F5D6E6',
  modHuisdieren:       '#C77B52',
  modHuisdierenSoft:   '#F4E1D5',
  modVoertuigen:       '#5B7A8C',
  modVoertuigenSoft:   '#DDE6EB',
};

// Donker palet — dezelfde warme, huiselijke identiteit op donkere oppervlakken.
// Diepgroen wordt iets lichter (zichtbaar als knop/accent op donker), oker blijft het
// accent, zachte status-tinten worden donkere vlekken. Tekst is warm wit i.p.v. inkt.
export const darkColors = {
  bg:         '#141F1A',  // warm donkergroen-zwart (past bij de forest-identiteit)
  surface:    '#1E2C25',  // kaarten/rijen — duidelijk lichter dan bg zodat ze oplichten
  surfaceAlt: '#26352C',  // zachte vulling, ingedrukte staat, footer/CTA-band (boven surface)
  overlay:    'rgba(0,0,0,0.6)',

  // Merk. Bewuste deviatie van de style guide (die forest vlak #0E3A2F houdt): een
  // vlakke #0E3A2F-kaart zou op bg #141F1A bijna onzichtbaar zijn. Daarom licht de
  // forest-VULLING op in donker (zodat de HomeHero/Kosten-kaart popt); groene TEKST
  // gaat via forestText/brandText (lichter, voor AA op donker).
  forest:       '#2F7058', // diepgroen, lichter zodat knop/kaart/accent oplicht op donker
  forestSoft:   '#22322B', // zacht groen oppervlak (kaart/sectie-vlek)
  forestPressed: '#3E8E6F', // pressed/hover van forest (was forestSoft)
  forestTint:   '#223A2D', // groene vlek (badges, icoon-cirkels, illustratie-stage)
  forestText:   '#86DCA8', // groene tékst/link op donker vlak
  brandText:    '#86DCA8', // groene tékst op forestTint — licht genoeg voor AA op donker
  ocher:        '#E5A23F', // accent blijft warm oker
  ocherSoft:    '#3A2E18', // donkere oker-vlek
  onAccent:     '#2A1B08', // tekst/icoon ÓP het accent — donkerbruin, ≥3:1 op de lichte oker

  ink:        '#ECF1ED',  // warm wit — primaire tekst
  inkSoft:    '#AEB8B1',  // secundair
  inkFaint:   '#808A82',  // tertiair: meta, placeholders
  body:       '#C7D0CA',  // lange leestekst
  onDark:     '#FBF7EF',  // tekst op forest/donkere vlakken (warm cream-wit)

  // Toast/snackbar — blijft een donker, opgetild vlak (iets lichter dan de kaarten
  // zodat 'ie op de bijna-zwarte achtergrond duidelijk zweeft), met witte tekst.
  toastBg:    '#3A352B',
  toastText:  '#FFFFFF',

  line:       '#33433B',  // randen op donker — iets zichtbaarder tegen surface
  lineStrong: '#445248',

  success:     '#4FA77E',
  successSoft: '#16271F',
  warning:     '#D69A3A',
  warningSoft: '#2C2412',
  danger:      '#DB6E52',
  dangerSoft:  '#2E1812',
  info:        '#5B92C0',
  infoSoft:    '#15222E',

  done:        '#3F9E64',

  focus:       '#3E8E6F',

  // Categorie-accenten — iets opgehelderd voor leesbaarheid op donker.
  catKlus:       '#E6AE4A',
  catHuishouden: '#7FA0C2',
  catPlant:      '#8FBBA5',
  catHuisdier:   '#D48A60',
  catAfspraak:   '#C488AE',
  catOverig:     '#A7AFA9',
  catVoertuig:   '#6E90A3',

  // Module-tinten — sterke tint licht op zodat 'ie leest op donker; de soft-vlekken
  // donkeren mee (zie de kop van lightColors voor de regels).
  modTaken:            '#57BE96',
  modTakenSoft:        '#1E3329',
  modBoodschappen:     '#E5A23F',
  modBoodschappenSoft: '#3A2E18',
  modPlanten:          '#6FC079',
  modPlantenSoft:      '#1E3327',
  modKosten:           '#4EA0D6',
  modKostenSoft:       '#16303F',
  modMaaltijden:       '#EE7D56',
  modMaaltijdenSoft:   '#3A2018',
  modSchoonmaak:       '#A48FE0',
  modSchoonmaakSoft:   '#26214A',
  modVoorraad:         '#C0A64A',
  modVoorraadSoft:     '#2E2A14',
  modTijdlijn:         '#DA5EA0',
  modTijdlijnSoft:     '#3A1A2B',
  modHuisdieren:       '#D48A60',
  modHuisdierenSoft:   '#33221A',
  modVoertuigen:       '#7EA0B3',
  modVoertuigenSoft:   '#1B2830',
};
