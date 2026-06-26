# Design-review & verbeterplan — 2026-06-26

> **Gedateerde snapshot.** Eenmalige design-doorlichting op basis van de rooktest-screenshots
> van 2026-06-26 (sessies 19:11–20:58). Géén statustracker — actuele status leeft in
> [`huishoek-backlog.md`](../huishoek-backlog.md) §6. Dit document beoordeelt **visueel/UX**;
> data-hygiëne (test-/placeholderdata) en build-stabiliteit zijn buiten scope gehouden.

## Context

Doel: de app door de bril van een designer die zich richt op *buitengewoon fijn werkende* apps.
Per scherm: wat zie ik, wat kan beter, en hoe. De bevindingen worden onderaan tot één getierd
plan gebundeld — binnen het bestaande design-systeem (`lib/theme.js`, `lib/palette.js`,
`lib/ui.js`, `DESIGN.md`), met expliciete herbruik van bestaande tokens/componenten.

**Beoordeeld (18 distincte schermen):** Login · Splash · Thuis · Catalogus (+zoek) · Kosten ·
Planten-lijst · Plantdetail · Plant-tijdlijn · Tijdlijnfoto-sheet · Foto-verwijderbevestiging ·
Huisdieren (leeg) · Keuken/Weekmenu · Keuken/Recepten · Meer · Tijdlijn (leeg) · Voertuigen-lijst ·
Voertuig-editor.

De lat (uit `DESIGN.md`): (1) één blik dan handelen, (2) groot genoeg voor iedereen,
(3) warm niet klinisch, (4) rustig niet druk — **één primaire actie per scherm**, (5) voorspelbaar,
(6) vier de voortgang, (7) vergevingsgezind.

---

## 1. Per-scherm review

### 1.1 Login (`app/(auth)/welcome.js`)
**Feedback.** De secundaire link **"Nieuw hier? Maak een account"** staat als `forest`-tekst
(#0E3A2F) direct op de `forest`-achtergrond → nagenoeg onzichtbaar, een duidelijke contrast-/
vindbaarheidsfout (registratie is de op één na belangrijkste actie). Verder: het witte
inlogkaartje, de huis-mark en de kop zijn sterk; het wachtwoordveld mist een "toon
wachtwoord"-oog en er is geen "wachtwoord vergeten".
**Verbetersuggestie.** Link → `ocherSoft`/`onDark` met onderstreping (≥AA op `forest`); voeg een
oog-toggle toe (hergebruik `IconButton` als trailing in `Field`) en een "Wachtwoord vergeten?".
Dit is meteen het ankervoorbeeld voor de contrast-sweep in Tier 1.

### 1.2 Splash (`lib/ui.js` → `SplashWait`)
**Feedback.** Rustig, gecentreerde dampende-mok-illustratie op `bg`. Niets mis; merk-mark
(huis) op login vs mok op splash zijn twee verschillende beelden.
**Verbetersuggestie.** Geen blocker. Overweeg één consistente merk-mark over splash/login/empty
states zodat de identiteit één gezicht heeft.

### 1.3 Thuis / Vandaag (`app/(tabs)/vandaag.js`)
**Feedback.** Sterk ankerscherm: hero met groet + voortgangsring (0/2), focuslijst met
categorie-getagde taken, en een kleurrijke widget-grid + `+Taak` FAB. Punt van aandacht: de
**Kosten-tegel is paars** — paars zit niet in de merk-/categoriepalet-logica (`catAfspraak` is
paars), wat "rustig, max. één-twee accenten" (principe 4) onder druk zet zodra meerdere
gekleurde tegels naast elkaar staan.
**Verbetersuggestie.** Tegel-tinten verankeren aan de module-categorie-tokens en het aantal
gelijktijdige felle vlakken temperen (bv. Kosten → `forestTint`/`info` i.p.v. paars). Bewaren
voor de widget-stijl-herijking (Tier 3).

### 1.4 Catalogus + zoek (`app/catalog.js`)
**Feedback.** Functioneel rijk: zoekveld, filterchips (Alles / Eerder gekozen / Groente & fruit),
rijen met emoji + naam + eenheid + stepper `[− 0 +]` en een **×** per rij. Drie frictiepunten:
(a) bij waarde **0** blijven `−` én `×` staan → veel ruis en no-op-tikken; (b) de `×` op élke rij
maakt de lijst visueel druk en concurreert met de stepper; (c) de pressed-state van de
terug-knop ("‹ Boodschappen") rendert als een kale grijze rechthoek. De "+'kaas' toevoegen"-
affordance in het zoekresultaat is daarentegen uitstekend.
**Verbetersuggestie.** Verberg/deactiveer `−` op 0; verplaats "verwijderen uit catalogus" naar een
swipe (`SwipeRow`, app-conventie links=verwijderen) i.p.v. een vaste `×`; geef de terug-knop een
nette `surfaceAlt`-pill pressed-state (radius `pill`). Grotere herinrichting in Tier 3.

### 1.5 Kosten (`app/(tabs)/kosten.js`)
**Feedback.** Heldere hero: segmented "Iedereen / 🏠 Huisie", grote `forest`-saldokaart
("Jij krijgt nog €0,67" + ocher "Bekijk vereffening (1)"), uitgavenrijen, ocher `+Uitgave` FAB.
Typografie-nit in de subtitel: ontbrekende spatie vóór de middot ("deelnemers· 20 jun.").
**Richting (bijgesteld 2026-06-26).** De labelloze **icoonknoppen rechtsboven** willen we wég.
In hun plaats komt één **explainer**-affordance die een **drawer** opent met uitleg van de module
waar je nu bent en hoe het werkt — een *cross-module patroon* (elke module krijgt dezelfde
explainer). Geen per-icoon-labeling dus, maar één rustige "hoe werkt dit?"-ingang. De saldo-hero
zelf blijft; alleen de kop-rechts-zone verandert. Herstel de middot-spatiëring (Tier 1).

### 1.6 Planten-lijst (`app/(tabs)/planten.js`)
**Feedback.** Mooie 2-koloms kaarten (foto, naam, soort, "💧 maa 20 jul."), ocher `+Plant` FAB.
De geschiedenis-icoonknop rechtsboven is labelloos (zelfde patroon als Kosten).
**Verbetersuggestie.** `accessibilityLabel` op de geschiedenis-knop (valt onder de header-knop-
sweep, Tier 2).

### 1.7 Plantdetail (`app/plant/[id].js`)
**Feedback.** Rijk en goed gestructureerd: avatarcirkel + "Foto wijzigen", naam + soort,
"📍 Tuin", ocher "Aanpassen", een **Verzorgingskaart** (Licht/Water/Voeding/Tip) en
**Verzorgingstaken**. Keerzijde: het scherm is lang; de altijd-uitgeklapte verzorgingskaart duwt
de taken en tijdlijn ver naar onderen.
**Verbetersuggestie.** Verpak de Verzorgingskaart in `Collapsible` (regel 917 in `lib/ui.js`),
standaard open maar inklapbaar, zodat de gebruiker sneller bij taken/tijdlijn komt. Vorm-/
sectie-werk in Tier 3.

### 1.8 Plant-tijdlijn (`app/plant/timeline.js`)
**Feedback.** Nette verticale tijdlijn (datumstip + thumbnail + datum + notitie) met onderaan
een full-width "Plant verwijderen". Detail: bij een entry zónder notitie staat er nu het label
**"Geen notitie"** — overbodige ruis.
**Richting (bijgesteld 2026-06-26).**
- Toon **geen tekst** als er geen notitie is — alleen foto + datum. Voeg **"door wie"** toe
  (wie de entry plaatste) als prettige context.
- Een **Reddit-achtige weergave-toggle** tussen een **beknopte** view en een **grote-foto** view.
- Bij een entry mét alleen een notitie (geen foto) staat het icoon op een groene vlek → maak dat
  **icoon wit** voor contrast.
Geldt voor de gedeelde tijdlijn-rij (plant/huisdier/voertuig delen het patroon).

### 1.9 Tijdlijnfoto-sheet (`lib/ui.js` → `BottomSheet`)
**Feedback.** Goede bottom-sheet: grabber, "Tijdlijnfoto" + ×, grote foto, datum,
notitie-veld, en een twee-knops-voet ("🗑 Verwijderen" ghost · "Notitie bewaren" forest). Risico:
de foto is zó groot dat op kleinere/`fontScale`-toestellen het notitieveld en de acties onder de
vouw kunnen vallen.
**Verbetersuggestie.** Beperk de fotohoogte (bv. `maxHeight`/aspect-cap) zodat veld + acties altijd
zichtbaar blijven; sheet zit al in `SheetScrollView`, dus borg dat de voet sticky/in-beeld blijft.

### 1.10 Foto-verwijderbevestiging (`lib/dialog.js`)
**Feedback.** Voorbeeldig vergevingsgezind (principe 7): "Foto verwijderen? / Dit kan niet
ongedaan worden gemaakt." met "Annuleren" (ghost) + "Verwijder" (`danger`, rood gevuld).
**Verbetersuggestie.** Geen. Dit is het referentiepatroon — gebruik het overal waar nu een kale
`×` direct verwijdert (zie Catalogus).

### 1.11 Huisdieren — leeg (`app/(tabs)/huisdieren.js`)
**Feedback.** Sterke lege staat (poot-illustratie, warme copy: "wij stellen meteen een
verzorgingsschema voor"). **Maar:** het scherm toont tegelijk de centrale `Empty`-actieknop
("Huisdier toevoegen") én een ocher `+Huisdier` **FAB** naar exact dezelfde route — twee primaire
acties op één leeg scherm, in strijd met principe 4.
**Verbetersuggestie.** Op een lege lijst: toon de `Empty`-CTA, verberg de FAB; de FAB verschijnt
zodra er items zijn. Component-fix (Tier 2), geldt voor álle modules met dit patroon.

### 1.12 Keuken / Weekmenu (`app/(tabs)/maaltijden.js`)
**Feedback.** Segmented Weekmenu/Recepten, week-navigatie, dagkaarten met "+". De ingeplande
maaltijd (badge "Diner", "1 pers.", avatars, "+3 gasten", 🗑) leest goed. Knelpunt: elke **lege
dag** is een grote kaart met alleen datum + "+", waardoor de 7 dagen niet samen in beeld passen en
het scherm leeg-en-lang oogt. De vandaag-markering (forest-rand) is subtiel naast een dag mét
maaltijd.
**Verbetersuggestie.** Compactere lege-dag-rijen (lagere hoogte) zodat de hele week in één blik
past (principe 1); versterk de vandaag-indicator (bv. forest-rand + datum in `forest`/vet).

### 1.13 Keuken / Recepten (`app/(tabs)/maaltijden.js`)
**Feedback.** Zoekveld + twee rijen filterchips, daarna een full-width **grijze** "+ Nieuw recept"-
knop en receptrijen (thumbnail + naam + aantal personen + chevron). De "nieuw"-affordance wijkt af
van de rest van de app: overal elders is toevoegen een **ocher FAB**, hier een inline `surfaceAlt`-
knop → inconsistent (principe 5). De twee chiprijen eten verticale ruimte vóór de inhoud.
**Verbetersuggestie.** Breng de toevoeg-affordance in lijn met de andere modules (FAB óf één
gedeelde "AddRow"-component, consequent toegepast). Filterchips compacter/horizontaal scrollend.

### 1.14 Meer (`app/(tabs)/meer.js`)
**Feedback.** Prettig gegroepeerd (Eten / Huis / Geld & delen), scanbare witte rijen met icoon +
chevron. Detail: het **Tijdlijn**-item draagt een blad-icoon, terwijl Tijdlijn het sociale
prikbord is — icoon-mismatch met de illustratie/betekenis elders.
**Verbetersuggestie.** Tijdlijn-icoon afstemmen op de prikbord-/mensen-beeldtaal die het lege
Tijdlijn-scherm al gebruikt. Kleine consistentie-fix (Tier 1).

### 1.15 Tijdlijn — leeg (`app/(tabs)/tijdlijn.js`)
**Feedback.** Mooie lege staat (twee-personen-met-hart, copy: "een foto, een mededeling, een
momentje"). **Zelfde dubbele-CTA als Huisdieren:** `Empty`-knop "Bericht" + ocher `+Bericht` FAB
naar dezelfde route.
**Verbetersuggestie.** Idem 1.11 — één primaire actie op de lege staat (Tier 2).

### 1.16 Voertuigen-lijst (`app/(tabs)/voertuigen.js`)
**Feedback.** Heldere kaart (auto-icoon, "Renault Clio · 2019", kenteken-badge, "Volgende:
don 25 jun."), ocher `+Voertuig` FAB. De **kenteken-badge** is een neutrale grijze pill — een gemiste
delight: een NL-kenteken is herkenbaar geel.
**Verbetersuggestie.** Style de kenteken-badge als een mini geel plaatje (ocher/`ocherSoft`
achtergrond, donkere tekst, `radius.sm`) — talvrije herkenning, past bij "warm, niet klinisch"
(principe 3). Kleine delight (Tier 1/2).

### 1.17 Voertuig-editor (`app/vehicle/[id].js`)
**Feedback.** Rijk formulier met fijne RDW-hint ("Merk en model opgehaald bij de RDW"), een
sympathieke auto-illustratie ("Rood · Hatchback · APK t/m …"), deel-instellingen en een sticky
kostenvoorspelling "€110,11 / maand". Knelpunten: de velden lopen zonder duidelijke
**sectiekoppen** in elkaar over (dicht), en de sticky kostbalk onderin lijkt tegen/over de
navigatiebalk te vallen.
**Verbetersuggestie.** Groepeer met `SectionHeader` (Basis · Delen · Kosten · Notities); geef de
sticky kostbalk veilige `insets.bottom`-padding zodat hij vrij van de navigatie blijft. Onderdeel
van de detail-/editor-herstructurering (Tier 3).

---

## 2. Doorlopende patronen (cross-cutting)

1. **Dubbele primaire actie op lege staten** — `Empty` mét `actionTitle/onAction` **én** een `FAB`
   naar dezelfde route (bevestigd in `huisdieren.js:98-105`, `tijdlijn.js:88-97`). Schendt
   principe 4. Eén gedeelde fix dekt alle modules.
2. **Labelloze kop-icoonknoppen** — Kosten (Inzichten/Terugkerend), Planten (geschiedenis).
   Vindbaarheids- én a11y-gat. **Opgelost via één cross-module explainer-drawer** (zie Tier 2):
   de kop-rechts-zone wordt overal dezelfde "hoe werkt dit?"-ingang die een uitleg-drawer opent.
3. **Lage-contrast tekst** — Login-registratielink (forest-op-forest), "Geen notitie" (groen waar
   gedempt hoort). Vraagt om een gerichte contrast-sweep + uitbreiding van `tests/contrast.test.js`.
4. **Inconsistente toevoeg-affordance** — meeste modules: ocher FAB; Recepten/Catalogus: inline
   knoppen. Schendt principe 5 (voorspelbaar).
5. **Kale pressed-states** — terug-knop in Catalogus rendert als grijze rechthoek i.p.v. een nette
   pill.
6. **Microcopy-/typografie-nits** — ontbrekende spaties rond middots, icoon-mismatch (Meer →
   Tijdlijn).

---

## 3. Verbeterplan (getierd)

Alle wijzigingen blijven binnen het design-systeem: nieuwe waarde? → token in `lib/theme.js`/
`lib/palette.js`; nieuw gedrag? → component in `lib/ui.js`. Schermen stellen samen, verzinnen niets.

### Tier 1 — Quick wins (tokens + microcopy, 1 PR)
- **Login-registratielink contrast** → `ocherSoft`/`onDark` + onderstreping (`app/(auth)/welcome.js`).
- **"Geen notitie"** → `inkFaint` (`app/plant/timeline.js`).
- **Middot-spatiëring** in de uitgaven-subtitel herstellen (`app/(tabs)/kosten.js` / i18n-string).
- **Meer → Tijdlijn-icoon** afstemmen op de prikbord-beeldtaal (`app/(tabs)/meer.js` + `lib/icons.js`).
- **Compactere lege-dag-rijen** in Weekmenu + sterkere vandaag-indicator (`app/(tabs)/maaltijden.js`).

### Tier 2 — Component-niveau (gedeelde `lib/ui.js`, hergebruik overal)
- **Lege-staat dedupe.** Eén bron van waarheid: óf `Empty` bezit de primaire actie en het scherm
  verbergt de `FAB` bij een lege lijst, óf andersom. Implementeer als gedeelde regel (bv. een
  `hasItems`-prop op de schermen, of een `Screen`/list-wrapper) en pas toe op Huisdieren, Tijdlijn
  én elke andere module met dit patroon.
- **Standaard toevoeg-affordance.** Recepten en Catalogus naar hetzelfde patroon als de rest
  (ocher FAB óf één gedeelde inline "AddRow"); leg de keuze één keer vast in `lib/ui.js`.
- **Explainer-drawer (cross-module).** Eén gedeeld patroon: een rustige "hoe werkt dit?"-ingang in
  de kop-rechts-zone die een `BottomSheet`-drawer opent met uitleg van de huidige module (waarvoor
  is dit, hoe werkt het). Vervangt de labelloze kop-icoonknoppen (Kosten, Planten, …). Tekst per
  module centraal (bv. `lib/moduleHelp.js` / i18n).
- **Tijdlijn-weergave.** Gedeelde tijdlijn-rij: geen "Geen notitie"-tekst meer (alleen foto +
  datum + "door wie"), een beknopt/grote-foto weergave-toggle, en een wit icoon op de groene vlek
  bij notitie-only entries (plant/huisdier/voertuig).
- **Nette pressed-states.** `surfaceAlt`-pill pressed-state voor terug-knoppen/links (Catalogus);
  borg via `ItemRow`/header-componenten zodat het overal klopt.
- **Kenteken-badge.** Mini geel-plaatje-variant van `Badge` (`ocherSoft` + donkere tekst); toepassen
  op Voertuigen-lijst en -editor.
- **Contrast-test uitbreiden.** Voeg de nieuwe tekst-op-vlak-paren toe aan `tests/contrast.test.js`
  zodat de login-link e.d. niet opnieuw kunnen wegzakken.

### Tier 3 — Herontwerpen (per module, eigen PR)
- **Kosten-overzicht.** Twee labelloze kopknoppen → expliciete ingangen "Inzichten" en
  "Terugkerend"; saldo-hero + "Bekijk vereffening" als één heldere primaire flow; uitgaven-rij-
  hiërarchie (bedrag vs. meta) aanscherpen.
- **Catalogus-interactie.** Stepper + verwijderen ontwarren: `−` verbergen op 0, verwijderen naar
  `SwipeRow` (links = verwijderen, app-conventie), secties in kaartgroepen, en een duidelijker
  onderscheid "in mandje" vs. "in catalogus".
- **Detail/editor-structuur (Plant + Voertuig).** Lange schermen secties geven met `SectionHeader`;
  Verzorgingskaart in `Collapsible`; sticky kostenbalk vrij van de navigatie (`insets.bottom`).
- **Weekmenu compacte week.** Layout die 7 dagen in één blik toont (principe 1), met de ingeplande
  maaltijd als compacte regel en een duidelijke vandaag-markering.
- **Widget-tint-herijking (Thuis).** Tegel-tinten verankeren aan de categorie-tokens en het aantal
  gelijktijdige felle vlakken temperen (principe 4) — Kosten weg van paars.

---

## 3b. Uitvoeringsstatus (2026-06-26)

Wat in deze ronde is gebouwd (groen op typecheck + 780 unit-tests + volledige ESLint):

- **Explainer-drawer (cross-module).** Nieuwe `ModuleHelpButton` (`lib/ui.js`) + content in
  `lib/moduleHelp.js`; ingehangen in alle 12 module-headers. De labelloze kop-icoonknoppen zijn
  weg; Kosten (Inzichten/Terugkerend), Planten/Huisdieren (tijdlijn) en Taken (klusbibliotheek)
  landen nu als gelabelde acties ín de drawer.
- **Plant-tijdlijn (1.8).** Geen "Geen notitie"-tekst meer; "door wie" toegevoegd; Reddit-achtige
  **Lijst/Groot**-weergavetoggle; wit notitie-icoon op de groene vlek (`app/plant/[id].js`).
- **Tier 1.** Login-link → wit + onderstreept (AA in beide thema's); middot-spatiëring Kosten;
  Tijdlijn-icoon eigen `pinboard` (📌, los van de voeding-leaf); compacte lege weekmenu-dagen +
  sterkere vandaag-indicator.
- **Tier 2.** Lege-staat dedupe (FAB verborgen bij lege lijst) op Huisdieren, Tijdlijn, Kosten,
  Voertuigen; geel **kenteken-plaatje** (`Badge` tone `plate`) + contrast-test; plant-Verzorgings-
  kaart in `Collapsible`; Kosten-widgettint van koel violet naar warme bes (`colorSchemes.js`).
- **Geverifieerde non-issues** (geen wijziging nodig): de voertuig-"€/maand" is gewone scroll-
  content, geen overlappende sticky balk; de Catalogus-`Stepper` dimt/deactiveert `−` al op 0; de
  terug-knop gebruikt al een nette opacity-pressed-state (de grijze rechthoek was Android's
  transiente touch-highlight in de screenshot).

Tweede ronde (de herontwerpen + extra wens), eveneens groen + **live op toestel bevestigd**:

- **Tijdlijn "Groot" — notitie-only als tekstkaart.** Een notitie zónder foto toont in de grote
  weergave géén beeld-placeholder meer maar een leesbare `forestTint`-tekstkaart (label + notitie
  groot, datum + "door wie" eronder) — `TimelinePhotoCard` in `app/plant/[id].js`.
- **Uniforme toevoeg-affordance.** Recepten gebruikt nu dezelfde ocher **FAB** als elke andere
  module i.p.v. de grijze inline-knop (`app/(tabs)/maaltijden.js`); Weekmenu houdt zijn per-dag
  "+" en "Boodschappen aanvullen".
- **Catalogus-interactie.** De vaste `×` op "Eerder gekozen"-rijen → **swipe naar links**
  (`SwipeRow`, app-conventie), wat de rij ontruimt (stepper = enige knop). De veegactie blijft
  toegankelijk via SwipeRow's accessibility-actie; de on-lijst-rij blijft `forest`-vet.
- **Weekmenu.** De compacte lege dagen laten de héle week in één blik passen (op toestel
  bevestigd). Een zwaardere herstructurering van de maaltijd-kaart is bewust niet gedaan: dat zou
  de rijke details (badge/avatars/porties) kosten.

## 4. Verificatie (per PR)

1. **Visueel.** Dev-client herbouwen + `npm run device`, en élk aangeraakt scherm opnieuw
   screenshotten (licht én donker — `lib/palette.js` heeft beide paletten); leg voor/na naast elkaar.
   Toestel-recept: zie memory's *Lokale Android dev-build* / *Standalone vs dev-client bundle*.
2. **Toegankelijkheid.** `tests/contrast.test.js` groen (incl. de nieuw toegevoegde paren);
   `fontScale` op groot zetten en de aangepaste schermen aflopen (geen afgekapte/overlappende tekst).
3. **Suite.** `npm test` groen; `npm run typecheck` groen. Raakte een PR een gemuteerde `lib/*.js`-
   module, dan `node scripts/mutation-check.mjs --since=origin/main` tot groen (DoD in `CLAUDE.md`).
4. **Doc-reflex.** Verschuift een PR een feit dat een doc beweert, werk dan backlog §6 / voortgang
   in dezelfde PR bij (DoD §5).
