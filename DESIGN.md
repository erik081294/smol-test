# Huishoek — Design System

Het huishouden draait op de app, niet andersom. Een gezin is geen team van
power-users: er is een tiener die 'm tussen twee lessen door openklapt, een
ouder die snel even boodschappen toevoegt, en een oma die het scherm op
grootste-tekst heeft staan. **Als het voor hen alle drie fijn werkt, werkt het
voor iedereen.** Dat is de lat.

Dit document beschrijft de principes én de visuele taal. De uitvoering staat in
een paar bestanden, en nergens anders:

- **`lib/palette.js`** — alle kleurwaarden (licht + donker). Pure data, RN-vrij,
  zodat `tests/contrast.test.js` de échte hex kan lezen.
- **`lib/theme.js`** — de tokens eromheen (kleur, ruimte, vorm, type, schaduw, beweging).
- **`lib/fonts.js`** — de twee merk-letters + de asset-map voor `useFonts()`.
- **`lib/modules.js`** — de canonieke bron van de module-tint (`colorToken`).
- **`lib/ui.js`** — alle componenten.
- **`lib/illustrations.js`** — de beeldtaal voor lege staten (één vaste stage,
  platte geometrie, palet-tokens). Eén `<Illustration name="…">`, net als `Icon`.
- **`lib/motion.js`** — beweging op één plek: `animateNextLayout()` (zachte
  `LayoutAnimation` bij lijst-mutaties) en `prefersReducedMotion()`. Altijd
  no-op bij "verminder beweging".
- **`Huishoek new design system/Huishoek Design System.dc.html`** — de visuele
  style guide met werkende licht/donker-toggle: hoe het eruit hoort te zien.
  Waar de guide en dit document verschillen, wint dit document — het is tegen de
  a11y-gate gehouden (zie "Afwijkingen van de style guide").

Een scherm verzint geen eigen knop, kleur of marge. Het stelt samen uit
bestaande bouwstenen. Heb je iets nodig dat er niet is? Voeg het tóe aan de
bibliotheek — dan heeft de hele app het.

---

## De zeven principes

### 1. Eén blik, dan handelen
Wie de app opent, ziet binnen twee seconden wat er te doen is. De belangrijkste
informatie staat bovenaan en groot; details vouwen open op verzoek. Het scherm
*Vandaag* is de maatstaf: geen menu doorploegen om te weten wat er moet gebeuren.

### 2. Groot genoeg voor iedereen
Toegankelijkheid is geen optie achteraf, het zit in de bouwstenen.
- Alles wat je kunt aanraken is **minimaal 48dp** (`touchTarget`). Klein vinkje?
  Dan vergroot `hitSlopFor()` het tikgebied.
- Tekst **schaalt mee** met de systeeminstelling — we zetten `allowFontScaling`
  nooit uit. Daarom heeft elke type-token een `lineHeight`.
- **Contrast haalt minimaal AA.** `ink` en `inkSoft` voor leesbare tekst;
  `inkFaint` alléén voor decoratief of grote, vette tekst — nooit voor body.
- Betekenis hangt **nooit aan kleur alleen**: een categorie toont altijd óók een
  icoon en label, een status altijd óók tekst.
- `tests/contrast.test.js` (PLT-5) legt dit vast. Een palet-wijziging die het
  contrast breekt, faalt daar — vóór de merge.

### 3. Warm, niet klinisch
Dit is een thuis, geen spreadsheet. Diepgroen (`forest`) als rustige basis, warm
oker (`ocher`) voor wat telt, op zandwit (`bg`). Ronde hoeken, zachte (warme)
schaduwen — de schaduwkleur is `ink`, geen zwart. Vriendelijke taal. Emoji als
herkenbare, talvrije iconen — een kind leest een 🛒 sneller dan het woord
"boodschappen".

### 4. Rustig, niet druk
Eén primaire actie per scherm (één gevulde `Button`, de rest `ghost`). Witruimte
mag er zijn. Geen badge-regen. Het 4pt-grid (`space`) en één schermrand
(`screenPadding`) houden alles ademend en voorspelbaar. De module-tint is één
rustig herkenningspunt per scherm — geen kleurenregen.

### 5. Voorspelbaar
Dezelfde dingen zien er overal hetzelfde uit en doen hetzelfde. Elke module
spreekt dezelfde visuele taal, zodat je nooit opnieuw hoeft te leren hoe iets
werkt. Daarom: tokens en componenten, geen losse stijlen.

### 6. Vier de voortgang
Afvinken hoort goed te voelen. Voltooid werk krijgt een eigen, vriendelijk groen
(`done`). Microcopy is menselijk en bemoedigend ("Lekker bezig!", niet "0 items
remaining"). De app viert mee in plaats van alleen te registreren.

> In de praktijk: de **Vandaag-hero** (`lib/HomeHero.js`) is hét ankerpunt — een
> diepgroene merkkaart met groet en een **voortgangsring** (`lib/widgets/ProgressRing.js`,
> gevoed door `dayProgress`) die **vult** naar de stand van de dag en bij een volledige
> dag een feestelijke check laat zien. `Celebrate` viert "alles af". Alle voortgang in
> `done`/accent-groen.

### 7. Vergevingsgezind
Mensen maken fouten; de app straft ze niet. Acties zijn makkelijk ongedaan te
maken (undo-toast). Foutteksten leggen uit wat er aan de hand is en wat je kunt
doen, in gewone taal. Vernietigende acties (`danger`) vragen om bevestiging.

---

## Typografie

Twee families, elk met één taak. Mengen is een systeem-overtreding.

- **Bricolage Grotesque** — koppen en displaytekst. Fris en karaktervol, warm
  zonder kinderachtig te worden. Weight **500** op de grote maten, **600** voor
  `h2`. Nooit zwaarder — de ronding geeft al warmte, extra gewicht maakt het
  bombastisch.
- **Hanken Grotesk** — alle body, UI, navigatie, knoppen, captions. Rustig en
  zeer leesbaar, ook op grootste-tekst.

We zetten de **`fontFamily` per gewicht** en dus **géén losse `fontWeight`**: bij een
custom face kiest Android het bestand op familienaam en zou een `fontWeight` er
synthetische bold overheen leggen. Wil je nadruk? Pak `font.semi` (of `font.display`
voor een kop), niet `fontWeight`.

| Token | Familie (`font.*`) | Grootte / regelhoogte | Tracking | Gebruik |
|---|---|---|---|---|
| `type.display` | `display` (Bricolage 500) | 34 / 40 | −1 | grootste kop |
| `type.h1` | `display` (Bricolage 500) | 30 / 36 | −0.8 | `ScreenHeader`-titel |
| `type.h2` | `displaySemi` (Bricolage 600) | 22 / 28 | −0.4 | sectiekoppen, hero-groet |
| `type.title` | `semi` (Hanken 600) | 17 / 22 | — | kaart-/rijtitels |
| `type.bodyLg` | `body` (Hanken 400) | 17 / 26 | — | primair leescomfort |
| `type.body` | `body` (Hanken 400) | 16 / 24 | — | standaard leestekst |
| `type.label` | `semi` (Hanken 600) | 13 / 16 | — | veldlabels |
| `type.caption` | `medium` (Hanken 500) | 13 / 17 | — | meta, fijne info |
| `type.button` | `semi` (Hanken 600) | 15 / 20 | — | knoplabels (kleur per gebruik) |

Elke token draagt een `lineHeight` zodat tekst met de systeeminstelling meeschaalt.
De fonts laden in `app/_layout.js` (`useFonts`), gegate op `SplashWait` — bij een
laadfout valt de app terug op het systeemfont i.p.v. op de splash te blijven hangen.

---

## Kleur — één live palet

`colors` is één **live palet** dat bij een thema-wissel in plaats wordt gemuteerd
(`applyTheme` in `lib/theme.js`); alle `colors.*`-inline-styles lezen daardoor
automatisch het actieve palet. `type`/`categoryMeta` worden bij élke wissel met een
**verse object-identiteit** herbouwd (niet via een getter), omdat Fabric de geflatte
stijl per identiteit cachet. `lib/useTheme.js` kiest de modus (systeem/licht/donker,
voorkeur in `lib/themePrefs.js`) en de **root-remount via `key`** in `app/_layout.js`
past 'm toe.

**Gevolg voor wie bouwt:** blijf `colors.*`/`type.*` gebruiken (nooit een rauwe hex) —
dan erft je scherm de donkere modus gratis.

### Basis — merk & oppervlak

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `bg` | `#FBF6EC` | `#141F1A` | schermachtergrond (zandwit) |
| `surface` | `#FFFDF8` | `#1E2C25` | kaarten, rijen, velden |
| `surfaceAlt` | `#F3EBDA` | `#26352C` | zachte vulling, ingedrukte staat |
| `forest` | `#0E3A2F` | `#2F7058` | primaire knop, merkkaart, navigatie |
| `forestSoft` | `#DCE8E1` | `#22322B` | zacht groen **oppervlak** |
| `forestPressed` | `#1C5446` | `#3E8E6F` | pressed/hover van `forest` |
| `forestTint` | `#E4ECE6` | `#223A2D` | groene vlek (badge, selectie, illustratie-stage) |
| `forestText` | `#0E3A2F` | `#86DCA8` | groene tékst/link |
| `brandText` | `#0E3A2F` | `#86DCA8` | groene tekst op `forestTint` |
| `ocher` | `#D98A29` | `#E5A23F` | accent, FAB, highlights |
| `ocherSoft` | `#F6E6CB` | `#3A2E18` | zachte accentvlakken |
| `onAccent` | `#2A1B08` | `#2A1B08` | voorgrond ÓP een accent-/FAB-vlak |
| `onDark` | `#FBF7EF` | `#FBF7EF` | voorgrond op een donker vlak |
| `line` / `lineStrong` | `#E8E0CE` / `#D8CFBC` | `#33433B` / `#445248` | randen, scheiding |

> **`forestSoft` is sinds het nieuwe systeem een oppervlak, geen inkt.** De pressed-staat
> van de primaire knop heet nu `forestPressed`. Gebruik je `forestSoft` als tekst- of
> knopkleur, dan is dat een bug.

### Tekst

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `ink` | `#1C2420` | `#ECF1ED` | koppen, primaire tekst |
| `inkSoft` | `#4C574F` | `#AEB8B1` | secundaire tekst |
| `inkFaint` | `#808A82` | `#808A82` | meta/placeholder — ≥3:1, **nooit** body |
| `body` | `#3A3A3A` | `#C7D0CA` | lange leestekst |

### Status — altijd kleur **én** tekst

`done` `#3F9E64` (voltooid werk, voortgang) · `success` · `warning` · `danger` ·
`info`, elk met een `…Soft`-vlek. De status-tinten zijn bewust wat gedempter dan de
style guide: de fellere waarden zakken op hun eigen soft-vlak onder de 3:1-vloer.

### Tertiair — module-kleuren

Elke module draagt een eigen warme tint — herkenbaar in één oogopslag, binnen dezelfde
familie. **`lib/modules.js` is de canonieke bron**: een module noemt alleen zijn
`colorToken`/`colorSoftToken`; de hex leeft in `lib/palette.js` en kantelt met het thema.
Eén bron voedt zowel de widget-tegel (`lib/widgets/colorSchemes.js`) als de scherm-kop
(`ScreenHeader module="…"`).

| Module | Token | Sterk (licht / donker) | Soft (licht / donker) |
|---|---|---|---|
| 🛒 Boodschappen | `modBoodschappen` | `#D98A29` / `#E5A23F` | `#F6E6CB` / `#3A2E18` |
| ✅ Taken | `modTaken` | `#2F8F6B` / `#57BE96` | `#D6E9DF` / `#1E3329` |
| 🪴 Planten | `modPlanten` | `#4FA35C` / `#6FC079` | `#DCEEE2` / `#1E3327` |
| 💶 Kosten | `modKosten` | `#2B7CB0` / `#4EA0D6` | `#D6E7F2` / `#16303F` |
| 🍳 Keuken | `modMaaltijden` | `#D9603A` / `#EE7D56` | `#F6DDD2` / `#3A2018` |
| 🧹 Schoonmaak | `modSchoonmaak` | `#7E6BC4` / `#A48FE0` | `#E6E1F5` / `#26214A` |
| 🥫 Voorraad | `modVoorraad` | `#9A8230` / `#C0A64A` | `#EFE8CC` / `#2E2A14` |
| 📌 Tijdlijn | `modTijdlijn` | `#B4327A` / `#DA5EA0` | `#F5D6E6` / `#3A1A2B` |
| 🐾 Huisdieren | `modHuisdieren` | `#C77B52` / `#D48A60` | `#F4E1D5` / `#33221A` |
| 🚗 Voertuigen | `modVoertuigen` | `#5B7A8C` / `#7EA0B3` | `#DDE6EB` / `#1B2830` |

**Regels voor module-kleur.**
- **Sterk** = icoonvlak, checkbox-rand, voortgangsbalk. De voorgrond erop kies je op
  runtime met `pickReadable()` — vaste witte tekst zakt op de oker-tint naar ~2.65:1.
- **Soft** = kaart-/tegel-/sectievlak. Daarop staat gewone tekst in `ink`/`inkSoft`.
- **De sterke tint is nooit zélf de tekstkleur.** Oker haalt op zijn eigen soft-vlak maar
  ~2.25:1. `widgetScheme()` regelt dit met `statOn()`: haalt de tint ≥3:1, dan kleurt de
  stat mee; zo niet, dan valt 'ie terug op `ink`.
- Betekenis hangt nooit aan de kleur alleen — icoon en naam gaan altijd mee.
- Nieuwe module? Voeg een `mod*`/`mod*Soft`-paar toe aan `palette.js` (licht + donker),
  wijs het toe in `modules.js`, en `tests/contrast.test.js` bewaakt het vanzelf.

**Mapping t.o.v. de style guide.** "Koken" is deze `maaltijden`-module, "Was" is
`schoonmaak`, en de **Agenda is opgegaan in Taken** (UX-27) en deelt dus diens tint.
"Klusjes" is géén module maar een taak-*categorie* — zie hieronder.

### Categorie-accenten (een andere as)

`categoryMeta` (`catKlus`, `catPlant`, …) kleurt een **individuele taak** binnen Taken,
niet een module. De twee assen bestaan naast elkaar: module = scherm-identiteit,
categorie = fijnmazig label. Categorie wordt áltijd óók met icoon + label getoond.

---

## Ruimte, vorm, diepte

- **Ruimte** — 4pt-grid: `space.xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 ·
  `xxl` 32 · `xxxl` 48 · `section` 96. `screenPadding` (18) voor de schermrand.
- **Vorm** — `radius.sm` 8 · `md` 12 (knop/input) · `lg` 16 (kaart) · `xl` 24
  (feature/module-kaart) · `pill` 999.
- **Diepte** — warme schaduw (schaduwkleur `#1A2420`, geen zwart): `elevation.e0`
  plat · `e1` kaart · `e2` sheet · `e3` FAB. Diepte komt vooral uit kleurcontrast.
- **Tik** — `touchTarget` 48, `hitSlopFor(size)` voor kleine elementen.
- **Beweging** — `motion.fast` 150 · `base` 220 · `slow` 360 ms. Kort en zacht;
  altijd no-op bij "verminder beweging".

---

## Componenten (`lib/ui.js`)

**Lay-out** — `Stack`, `Row`, `Divider`
**Tekst** — `T` (past een type-token toe)
**Acties** — `Button` (`primary`/`accent`/`soft`/`ghost`/`danger` · `md`(48)/`lg`(56),
met `loading`/`icon`/`fullWidth`), `IconButton`, `FAB` (met `label` → extended)
**Invoer** — `Field` (label + helper/fout), `Checkbox` (popt zacht op bij afvinken),
`Chip` (kiest runtime een leesbare voorgrond), `Stepper`, `DateStepper`, `EmojiPicker`
**Oppervlak** — `Card` (optioneel aantikbaar)
**Status & info** — `Badge` (`neutral`/`success`/`warning`/`danger`/`info`/`brand`/`plate`),
`Banner`, `Empty` (met optionele actie/illustratie), `ListSkeleton`, `Celebrate`, `SplashWait`
**Mensen** — `Avatar`, `AvatarSelect` (lid-keuze, optioneel "Iedereen"), `ReactionBar`
**Structuur** — `SectionHeader`, `ItemRow` (`chevron` voor navigerende rijen), `SwipeRow`,
`SegmentedControl`, `ScreenHeader` (optioneel `module` → gekleurd icoonvlak),
`Collapsible`, `RevealLink`
**Modaal & kop** — `ModalHeader`, `Editor`, `BottomSheet` + `SheetScrollView`,
`ModuleHelpButton`
**Mini-viz** — `Sparkline`, `BarChart` (bewust decoratief; de cijfers staan los in de UI)
**Hooks** — `useDiscardGuard`, `useErrorScroll`

Náást `lib/ui.js` wonen: `Illustration` (`lib/illustrations.js`), `Icon` (`lib/icons.js`),
`VisibilityPicker` (`lib/VisibilityPicker.js`), `HomeHero` (`lib/HomeHero.js`) en
`ProgressRing` (`lib/widgets/ProgressRing.js`).

Alle interactieve componenten dragen een `accessibilityRole`, weerspiegelen hun
toestand via `accessibilityState` (disabled/selected/checked/busy) en hebben een
zichtbare ingedrukte staat. Iconen-zonder-tekst (`IconButton`) eisen een
`accessibilityLabel`.

---

## Regels voor wie eraan bouwt

- **Pak een token, verzin geen waarde.** Geen `'#0E3A2F'` of `padding: 16` los in
  een scherm — gebruik `colors.forest`, `space.lg`.
- **Pak een component, niet een rauwe `Pressable`.** Mist 'm? Voeg 'm hier toe.
- **Elke tikzone ≥ 48dp.** Klein element? `hitSlopFor()`.
- **Tekst altijd via `type` of `T`**, zodat lineHeight en schaalbaarheid kloppen.
- **Nadruk via `font.semi`, nooit via `fontWeight`** (zie Typografie).
- **Betekenis nooit via kleur alleen** — voeg label, icoon of tekst toe.
- **Kleur altijd via een token** (`colors.*`), nooit rauwe hex — zo erft je scherm
  de donkere modus gratis.
- **Schrijf microcopy zoals je tegen je huisgenoot praat**: kort, warm, in het Nederlands.

---

## Acties & knoppen — één plek, één betekenis

- **Aanmaken op een lijst → `FAB`** (rechtsonder). *Uitzondering:* Boodschappen gebruikt
  een inline invoerbalk voor razendsnel achter-elkaar toevoegen — dat is bewust.
- **Bevestigen in een editor/sheet → `ModalHeader` met `onConfirm`** (Annuleer · titel ·
  Bewaar, altijd in de kop en dus bereikbaar zonder te scrollen). Een **editor** (lang,
  scrollend formulier) **mag de primaire actie óók onderaan herhalen** als één gelabelde
  `Button` ná het laatste veld (**UX-39**, dezelfde `save`). Het blijft **één
  bevestig-*actie***: nooit een tweede, *andere* bevestiging. Een korte **sheet** zonder
  scroll houdt het bij alleen de kop.
- **Verwijderen → onderaan**, als `Button variant="ghost"`/`danger`, los van de
  bevestiging. Destructief hoort niet naast Bewaar.
- **Veeg-acties op lijstrijen → `SwipeRow`**: **links vegen = verwijderen** (rood),
  **rechts vegen = uitstellen / secundair** (groen). Altijd met **undo-toast**.
  **App-breed bindend (UX-43).** Een scherm zónder verwijderen laat `left` **leeg**
  (bv. Vandaag). Op web rendert `SwipeRow` de kale rij; de zichtbare knop blijft de
  toegankelijke ingang. Voor screenreaders zijn de veegacties ook als
  `accessibilityActions` beschikbaar (A11Y-1).
- **Kop-rechts = uitleg + gelabelde acties, nooit verstopte navigatie (UX-42).** De
  `ScreenHeader`-`right`-slot draagt precies één ding: de `ModuleHelpButton` (de rustige ⓘ).
  Module-specifieke vervolgnavigatie hangt als **gelabelde `actions`** onderin diezelfde
  help-drawer, niet als cryptische icoonknop.
- **Een flow-actie die geen "aanmaken" is** → volle-breedte `Button` aan het eind van de inhoud.
- **Detailschermen krijgen een `ModalHeader`** (titel + sluiten), geen losse back-knop.
  De `ModalHeader` padt zichzelf (`paddingHorizontal: space.lg`): wrap 'm níét nog eens
  in een padded `View`.

### Editor-flow — één skelet, één volgorde

Elke aanmaak-/bewerk-editor gebruikt het `Editor`-omhulsel uit `lib/ui.js` (veilige rand +
toetsenbord-ontwijking + **vaste** `ModalHeader` + scrollend inhoudsvlak). Bouw geen eigen
`SafeAreaView`/`ScrollView`/`ModalHeader`-combinatie per scherm. Velden staan in een vaste,
voorspelbare volgorde — de denkstap van de gebruiker:

1. **Wat** — titel/omschrijving (+ categorie, bedrag).
2. **Wie** — toewijzen / betaald door / deelnemers.
3. **Wanneer** — datum (+ herhaling).
4. **Details** — notities e.d.
5. **Delen met** — geavanceerd; via `VisibilityPicker collapsible` ingeklapt onderaan
   (opent vanzelf als de keuze afwijkt van "Hele huishouden"). Model:
   [docs/zichtbaarheid.md](docs/zichtbaarheid.md).
6. **Verwijderen** — helemaal onderaan, alleen in bewerk-modus (undo-toast, geen
   blokkerende `Alert`).

Eén scherm doet zowel aanmaken als bewerken: prefill de state uit het bestaande record en
laat Bewaar vertakken (`isNew ? add… : update…`).

**Niet-bewaarde wijzigingen.** Geef de `Editor` een `dirty`-prop; bij sluiten/terug vraagt
'ie dan om bevestiging (`confirmDiscard`, via het eigen `dialog`-systeem — één codepad voor
alle platforms, Android hardware-back onderschept). Een schoon formulier sluit direct. Bij
ongeldige invoer geef je `confirmDisabled` mee: de bevestig-knop dimt én wordt niet-tikbaar.

### Drawers & sheets — toetsenbord-ontwijking en sluiten

Elke onderaan-ingeschoven drawer/sheet gebruikt het gedeelde `BottomSheet`-omhulsel.
Twee **harde eisen**:

- **Nooit onder het toetsenbord.** Bevat de sheet een invoerveld, gebruik
  `BottomSheet avoidKeyboard` — de inhoud schuift omhoog. Een veld dat onder het
  toetsenbord verdwijnt is een bug, geen detail.
- **Drie sluit-routes, altijd alledrie.** (1) veeg omlaag, (2) tik op de gedimde
  achtergrond, (3) het kruisje/Annuleren in de `ModalHeader`.

---

## Illustraties & lege staten

Eén vaste stage (een `forestTint`-cirkel met zachte contactschaduw), platte geometrie,
palet-tokens — geen 3D-render. Max ~4 tinten per beeld: één hoofdobject (~55-65% van de
stage) plus één speels accent. De warmte zit in ronde vormen, emoji en bemoedigende
microcopy. `<Illustration name="…">` net als `Icon`; `Empty` neemt 'm optioneel op met een
actie ("Item toevoegen"). Houd alles binnen de palet-tokens zodat het in donkere modus
meebeweegt. Zie de skill `svg-illustraties`.

---

## Afwijkingen van de style guide (bewust, en waarom)

De `.dc.html`-guide is een web-mockup en is niet tegen de a11y-gate gehouden. Waar dit
document afwijkt, is dat met opzet:

1. **`inkFaint` is donkerder** dan de guide (`#808A82` i.p.v. `#8B948D`): die zakt op de
   nieuwe `bg` naar ~2.9:1, onder de 3:1-vloer.
2. **Status-kleuren blijven gedempt.** De felle `warning #E0A81E` haalt op zijn eigen
   soft-vlak ~1.8:1.
3. **`forest` licht op in donkere modus** (`#2F7058`) i.p.v. vlak `#0E3A2F` te blijven:
   een vlakke diepgroene kaart is op `bg #141F1A` bijna onzichtbaar. Groene *tekst* gaat
   in donker via `forestText`/`brandText`.
4. **De module-tint is nooit tekstkleur** (zie "Regels voor module-kleur").
5. **Tokennamen volgen de code**, niet de guide (`surface` i.p.v. `card`, `line` i.p.v.
   `hairline`): één taal in doc én code, zonder een sweep van honderden verwijzingen.

---

## Do's & don'ts

**Do** — anker op zandwit (`bg`); geef elke module zijn tint via de registry; Bricolage
500/600 op koppen; toon voortgang in `done`; laat de ring vúllen; houd elke kleur in een token.

**Don't** — geen rauwe hex; geen `fontWeight` naast een custom `fontFamily`; geen Bricolage
zwaarder dan 600; betekenis nooit via kleur alleen; de moduletint nooit als tekstkleur;
geen tweede, afwijkende bevestig-actie; geen verstopte navigatie rechtsboven.
