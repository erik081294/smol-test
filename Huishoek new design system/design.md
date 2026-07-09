# Huishoek — Design System

Het huishouden draait op de app, niet andersom. Een gezin is geen team van
power-users: er is een tiener die 'm tussen twee lessen door openklapt, een
ouder die snel even boodschappen toevoegt, en een oma die het scherm op
grootste-tekst heeft staan. **Als het voor hen alle drie fijn werkt, werkt het
voor iedereen.** Dat is de lat.

Dit document beschrijft de principes én de visuele taal. De uitvoering staat in
een paar bestanden, en nergens anders:

- **`lib/theme.js`** — alle tokens (kleur, ruimte, vorm, type, schaduw, beweging).
- **`lib/ui.js`** — alle componenten.
- **`lib/illustrations.js`** — de beeldtaal voor lege staten (één vaste stage,
  platte geometrie, palet-tokens). Eén `<Illustration name="…">`, net als `Icon`.
- **`lib/motion.js`** — beweging op één plek: `animateNextLayout()` (zachte
  `LayoutAnimation` bij lijst-mutaties) en `prefersReducedMotion()`. Altijd
  no-op bij "verminder beweging".
- **`Huishoek Design System.dc.html`** — de visuele style guide: het levende
  overzicht van kleur, type, ruimte, componenten, module-kleuren en lege staten,
  mét werkende licht/donker-toggle. Dit is de bron voor "hoe hoort het eruit te
  zien".

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
  emoji en label, een status altijd óók tekst.

### 3. Warm, niet klinisch
Dit is een thuis, geen spreadsheet. Diepgroen (`forest`) als rustige basis, warm
oker (`ocher`) voor wat telt, op zandwit (`bg`). Ronde hoeken, zachte (warme)
schaduwen, vriendelijke taal. Emoji als herkenbare, talvrije iconen — een kind
leest een 🛒 sneller dan het woord "boodschappen".

### 4. Rustig, niet druk
Eén primaire actie per scherm (één gevulde `Button`, de rest `ghost`). Witruimte
mag er zijn. Geen badge-regen, geen vijf accentkleuren naast elkaar. Het 4pt-grid
(`space`) en één schermrand (`screenPadding`) houden alles ademend en
voorspelbaar.

### 5. Voorspelbaar
Dezelfde dingen zien er overal hetzelfde uit en doen hetzelfde. Elke module —
Taken, Boodschappen, Planten, Kosten, Koken, Was, Klusjes, Agenda — spreekt
dezelfde visuele taal, zodat je nooit opnieuw hoeft te leren hoe iets werkt.
Daarom: tokens en componenten, geen losse stijlen.

### 6. Vier de voortgang
Afvinken hoort goed te voelen. Voltooid werk krijgt een eigen, vriendelijk groen
(`done`). Microcopy is menselijk en bemoedigend ("Lekker bezig!", niet "0 items
remaining"). De app viert mee in plaats van alleen te registreren.

> In de praktijk: de **Vandaag-hero** (`lib/HomeHero.js`) is hét ankerpunt — een
> diepgroene merkkaart met groet en een **voortgangsring** (`lib/widgets/ProgressRing.js`,
> gevoed door `dayProgress`) die de stand van de dag in één blik toont en bij een
> volledige dag een feestelijke check laat zien. Widget-tegels fade-in'en gestaggerd
> (eenmalig, respecteert "verminder beweging") en de Taken-widget toont een mini
> voortgangsbalk (`x/y vandaag af`). Alle voortgang in `done`/accent-groen.

### 7. Vergevingsgezind
Mensen maken fouten; de app straft ze niet. Acties zijn makkelijk ongedaan te
maken. Foutteksten leggen uit wat er aan de hand is en wat je kunt doen, in
gewone taal. Vernietigende acties (`danger`) vragen om bevestiging.

---

## Typografie

Twee families, elk met één taak. Mengen is een systeem-overtreding.

- **Bricolage Grotesque** — koppen en displaytekst. Fris en karaktervol, warm
  zonder kinderachtig te worden. Weight **500** op grote displaymaten met
  negatieve letter-spacing (-1 tot -2px); **600** voor kleinere titels. Nooit
  zwaarder — de ronding geeft al warmte, extra gewicht maakt het bombastisch.
- **Hanken Grotesk** — alle body, UI, navigatie, knoppen, captions. Rustig en
  zeer leesbaar, ook op grootste-tekst.

Fallback-stack voor beide: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI",
Roboto, sans-serif`. (Inter is fallback, nooit de eerste keus.)

| Token | Familie | Grootte / gewicht | Gebruik |
|---|---|---|---|
| `type.display` | Bricolage | 40–72 / 500 | Hero-h1, sectiekoppen |
| `type.title` | Bricolage | 24 / 600 | Kaarttitels, modulenamen |
| `type.heading` | Hanken | 18 / 600 | Vraag/label-koppen |
| `type.body` | Hanken | 16 / 400 | Standaard leestekst |
| `type.button` | Hanken | 15 / 600 | Knoplabels |
| `type.caption` | Hanken | 13 / 500 | Captions, fijne info |

Elke token draagt een `lineHeight` zodat tekst met de systeeminstelling
meeschaalt.

---

## Kleur — één live palet

`colors` is één **live palet** dat bij een thema-wissel in plaats wordt gemuteerd
(`applyTheme` in `lib/theme.js`); alle `colors.*`-inline-styles lezen daardoor
automatisch het actieve palet. `type`/`categoryMeta` lezen hun kleur via een
**getter** (niet vooraf-berekend), zodat een wissel doorwerkt zónder de in dev
bevroren style-objecten te muteren. `lib/useTheme.js` kiest de modus (systeem/
licht/donker, voorkeur in `lib/themePrefs.js`) en de **root-remount via `key`** in
`app/_layout.js` past 'm toe.

**Gevolg voor wie bouwt:** blijf `colors.*`/`type.*` gebruiken (nooit een rauwe
hex) — dan erft je scherm de donkere modus gratis. In de style guide is dit één
`data-theme="dark"`-attribuut dat de CSS-variabelen omzet; in de app is het
hetzelfde principe.

### Basis — merk & oppervlak

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `forest` | `#0E3A2F` | `#0E3A2F` (vlak) / `#86DCA8` (koptekst) | primaire knop, koppen, nav |
| `forestSoft` | `#DCE8E1` | `#22322B` | zachte groene vlakken |
| `ocher` | `#D98A29` | `#E5A23F` | accent, FAB, highlights |
| `ocherSoft` | `#F6E6CB` | `#3A2E18` | zachte accentvlakken |
| `onAccent` | `#2A1B08` | `#2A1B08` | voorgrond op een accent-/FAB-vlak |
| `onDark` | `#FBF7EF` | `#FBF7EF` | voorgrond op een donker vlak |
| `bg` (zandwit) | `#FBF6EC` | `#141F1A` | schermachtergrond |
| `card` | `#FFFDF8` | `#1E2C25` | kaartoppervlak |
| `surfaceStrong` | `#F3EBDA` | `#26352C` | footer/CTA-band |
| `hairline` | `#E8E0CE` | `#33433B` | 1px-randen |
| `divider` | `#F0E9DA` | `#2A3A32` | scheidingslijnen |

### Tekst

| Token | Licht | Donker | Gebruik |
|---|---|---|---|
| `ink` | `#1C2420` | `#ECF1ED` | koppen, primaire tekst |
| `inkSoft` | `#4C574F` | `#AEB8B1` | secundaire tekst |
| `inkFaint` | `#8B948D` | `#808A82` | captions, **alléén** decoratief |
| `body` | `#3A3A3A` | `#C7D0CA` | lange leestekst |

### Status — altijd kleur **én** tekst

| Token | Hex | Gebruik |
|---|---|---|
| `done` | `#3F9E64` | voltooid werk, voortgang |
| `success` | `#2E8B57` | succesmelding |
| `warning` | `#E0A81E` | waarschuwing |
| `danger` | `#D2452F` | fout, vernietigende actie |
| `info` | `#2B7CB0` | informatie |

Status- en merkkleuren behouden hun vulling in beide modi (het zijn "eilanden");
de soft-varianten donkeren wél mee.

### Tertiair — module-kleuren

Naast forest en oker draagt **elke module een eigen warme tint** — herkenbaar in
één oogopslag, maar altijd binnen dezelfde familie. Samen vormen ze de horizon
onderaan elke pagina. Elke module heeft een **sterke** tint (accent, icoonvlak)
en een **soft** tint (kaartachtergrond).

| Module | Token | Sterk (licht / donker) | Soft (licht / donker) |
|---|---|---|---|
| 🛒 Boodschappen | `mod.boodschappen` | `#D98A29` / `#E5A23F` | `#F6E6CB` / `#3A2E18` |
| 🧹 Taken | `mod.taken` | `#2F8F6B` / `#57BE96` | `#D6E9DF` / `#1E3329` |
| 🪴 Planten | `mod.planten` | `#4FA35C` / `#6FC079` | `#DCEEE2` / `#1E3327` |
| 💶 Kosten | `mod.kosten` | `#2B7CB0` / `#4EA0D6` | `#D6E7F2` / `#16303F` |
| 🍳 Koken | `mod.koken` | `#D9603A` / `#EE7D56` | `#F6DDD2` / `#3A2018` |
| 🧺 Was | `mod.was` | `#7E6BC4` / `#A48FE0` | `#E6E1F5` / `#26214A` |
| 🔧 Klusjes | `mod.klus` | `#B4327A` / `#DA5EA0` | `#F5D6E6` / `#3A1A2B` |
| 📅 Agenda | `mod.agenda` | `#E0A81E` / `#F0BE3E` | `#F7ECCB` / `#332C15` |

**Regels voor module-kleur.** Een module gebruikt zijn sterke tint voor het
icoonvlak, de checkbox-rand en accenten; de soft tint als kaart-/sectievlak.
Tekst blijft altijd `ink`/`inkSoft` (die erven de modus), nooit de moduletint
zelf voor lange tekst. Betekenis hangt nooit aan de kleur alleen — de emoji en
naam gaan altijd mee. Nieuwe module? Voeg een `mod.*`-paar toe aan `theme.js`,
kies een tint die naast de bestaande horizon past, en geef 'm een licht- én
donker-waarde.

---

## Ruimte, vorm, diepte

- **Ruimte** — 4pt-grid: `space.xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 ·
  `xxl` 32 · `xxxl` 48. `screenPadding` voor de schermrand; `section` 96 tussen
  grote banden.
- **Vorm** — `radius.sm` 8 · `md` 12 (knop/input) · `lg` 16 (kaart) · `xl` 24
  (feature/module-kaart) · `pill` 999.
- **Diepte** — warme schaduw: `elevation.e0` plat · `e1` kaart · `e2` sheet ·
  `e3` FAB. Geen harde schaduwen; diepte komt uit kleurcontrast.
- **Tik** — `touchTarget` 48, `hitSlopFor(size)` voor kleine elementen.
- **Beweging** — `motion.fast/base/slow`, kort en zacht; altijd no-op bij
  "verminder beweging".

---

## Componenten (`lib/ui.js`)

**Lay-out** — `Stack`, `Row`, `Divider`
**Tekst** — `T` (past een type-token toe)
**Acties** — `Button` (primary/accent/ghost/danger · md/lg), `IconButton`, `FAB`
**Invoer** — `Field` (label + helper/fout), `Checkbox` (popt zacht op bij
afvinken), `Chip`, `EmojiPicker` (icoon-keuze)
**Oppervlak** — `Card` (optioneel aantikbaar)
**Status & info** — `Badge`, `Banner`, `Empty` (met optionele actie/illustratie),
`ListSkeleton` (zachte laad-placeholder)
**Mensen** — `Avatar`, `AvatarSelect` (lid-keuze, één selectie, optioneel "Iedereen")
**Structuur** — `SectionHeader`, `ItemRow` (`chevron` voor navigerende rijen),
`SwipeRow`

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
- **Betekenis nooit via kleur alleen** — voeg label, emoji of tekst toe.
- **Kleur altijd via een token** (`colors.*`, `mod.*`), nooit rauwe hex — zo erft
  je scherm de donkere modus gratis.
- **Schrijf microcopy zoals je tegen je huisgenoot praat**: kort, warm, in het
  Nederlands.

---

## Acties & knoppen — één plek, één betekenis

Zodat elke actie op een voorspelbare plek staat:

- **Aanmaken op een lijst → `FAB`** (rechtsonder). De dagelijkse "voeg toe"-actie.
  *Uitzondering:* Boodschappen gebruikt een inline invoerbalk voor razendsnel
  achter-elkaar toevoegen — dat is bewust.
- **Bevestigen in een editor/sheet → `ModalHeader` met `onConfirm`** (Annuleer ·
  titel · Bewaar, altijd in de kop en dus bereikbaar zonder te scrollen). Een
  **editor** (lang, scrollend formulier) **mag de primaire actie óók onderaan
  herhalen** als één gelabelde `Button` ("Toevoegen"/"Opslaan") ná het laatste veld
  — dezelfde `save`, een sterkere afsluit-affordance (**UX-39**). Het blijft **één
  bevestig-*actie*** (kop en voet roepen hetzelfde aan): nooit een tweede, *andere*
  bevestiging. Een korte **sheet** zonder scroll houdt het bij alleen de kop.
- **Verwijderen → onderaan**, als `Button variant="ghost"`/`danger`, los van de
  bevestiging. Destructief hoort niet naast Bewaar.
- **Veeg-acties op lijstrijen → `SwipeRow`**: **links vegen = verwijderen** (rood),
  **rechts vegen = uitstellen / secundair** (groen). Altijd met **undo-toast**.
  **App-breed bindend (UX-43):** dezelfde veeg betekent overal hetzelfde. Een
  scherm zónder verwijderen laat `left` **leeg** (bv. Vandaag). Voor screenreaders
  zijn de veegacties ook als `accessibilityActions` beschikbaar (A11Y-1).
- **Kop-rechts = uitleg + gelabelde acties, nooit verstopte navigatie (UX-42).**
  De `ScreenHeader`-`right`-slot draagt precies één ding: de `ModuleHelpButton`
  (de rustige ⓘ). Module-specifieke vervolgnavigatie hangt als **gelabelde
  `actions`** onderin diezelfde help-drawer, niet als cryptische icoonknop.
- **Een flow-actie die geen "aanmaken" is** → volle-breedte `Button` aan het eind
  van de inhoud.
- **Detailschermen krijgen een `ModalHeader`** (titel + sluiten), geen losse
  back-knop. De `ModalHeader` padt zichzelf (`paddingHorizontal: space.lg`).

### Editor-flow — één skelet, één volgorde

Elke aanmaak-/bewerk-editor gebruikt het `Editor`-omhulsel uit `lib/ui.js`
(veilige rand + toetsenbord-ontwijking + **vaste** `ModalHeader` + scrollend
inhoudsvlak). Velden staan in een vaste, voorspelbare volgorde:

1. **Wat** — titel/omschrijving (+ categorie, bedrag).
2. **Wie** — toewijzen / betaald door / deelnemers.
3. **Wanneer** — datum (+ herhaling).
4. **Details** — notities e.d.
5. **Delen met** — geavanceerd; via `VisibilityPicker collapsible` ingeklapt onderaan.
6. **Verwijderen** — helemaal onderaan, alleen in bewerk-modus (undo-toast).

Eén scherm doet zowel aanmaken als bewerken: prefill de state uit het bestaande
record en laat Bewaar vertakken (`isNew ? add… : update…`).

**Niet-bewaarde wijzigingen.** Geef de `Editor` een `dirty`-prop; bij sluiten
vraagt 'ie dan om bevestiging (`confirmDiscard`). Een schoon formulier sluit
direct. Bij ongeldige invoer geef je `confirmDisabled` mee: de bevestig-knop dimt
én wordt niet-tikbaar.

### Drawers & sheets — toetsenbord-ontwijking en sluiten

Elke onderaan-ingeschoven drawer/sheet gebruikt het gedeelde `BottomSheet`-omhulsel.
Twee harde eisen:

- **Nooit onder het toetsenbord.** Bevat de sheet een invoerveld, gebruik
  `BottomSheet avoidKeyboard` — de inhoud schuift omhoog. Een veld dat onder het
  toetsenbord verdwijnt is een bug.
- **Drie sluit-routes, altijd alledrie.** (1) veeg omlaag, (2) tik op de gedimde
  achtergrond, (3) het kruisje/Annuleren in de `ModalHeader`.

---

## Illustraties & lege staten

Eén vaste stage, platte geometrie, palet-tokens — geen 3D-render. De warmte zit
in ronde vormen, emoji en bemoedigende microcopy. `<Illustration name="…">` net
als `Icon`; `Empty` neemt 'm optioneel op met een actie ("Item toevoegen"). De
achtergrondvormen (de drie strepen, de losse vlakken) zijn deel van de identiteit
— houd ze binnen de palet-tokens zodat ze in donkere modus meebewegen.

---

## Do's & don'ts

**Do** — anker op zandwit (`bg`); cycle module-tinten voor herkenning; Bricolage
500 met negatieve letter-spacing op koppen; toon voortgang in `done`; sluit
pagina's warm (cream footer / `surfaceStrong`), nooit hard donker in lichte modus.

**Don't** — geen rauwe hex; geen Bricolage zwaarder dan 500/600; betekenis nooit
via kleur alleen; geen tweede, afwijkende bevestig-actie; geen verstopte
navigatie rechtsboven.
