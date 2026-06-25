# Huishoek — Design System

Het huishouden draait op de app, niet andersom. Een gezin is geen team van
power-users: er is een tiener die 'm tussen twee lessen door openklapt, een
ouder die snel even boodschappen toevoegt, en een oma die het scherm op
grootste-tekst heeft staan. **Als het voor hen alle drie fijn werkt, werkt het
voor iedereen.** Dat is de lat.

Dit document beschrijft de principes. De uitvoering staat in twee bestanden, en
nergens anders:

- **`lib/theme.js`** — alle tokens (kleur, ruimte, vorm, type, schaduw, beweging).
- **`lib/ui.js`** — alle componenten.
- **`lib/illustrations.js`** — de beeldtaal voor lege staten (één vaste stage,
  platte geometrie, palet-tokens). Eén `<Illustration name="…">`, net als `Icon`.
- **`lib/motion.js`** — beweging op één plek: `animateNextLayout()` (zachte
  `LayoutAnimation` bij lijst-mutaties) en `prefersReducedMotion()`. Altijd
  no-op bij "verminder beweging".

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
Taken, Boodschappen, Planten, Kosten — spreekt dezelfde visuele taal, zodat je
nooit opnieuw hoeft te leren hoe iets werkt. Daarom: tokens en componenten, geen
losse stijlen.

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

## Tokens in het kort

| Groep | Token | Gebruik |
|------|-------|---------|
| Kleur | `forest` / `forestSoft` | primaire knop, koppen, navigatie (+ pressed) |
| | `ocher` / `ocherSoft` | accent, FAB, highlights |
| | `ink` / `inkSoft` / `inkFaint` | tekst (faint alleen decoratief) |
| | `success/warning/danger/info` (+ `…Soft`) | status, altijd kleur + tekst |
| Ruimte | `space.xs…xxxl` (4pt-grid) | marges, gaps; `screenPadding` voor de rand |
| Vorm | `radius.sm…pill` | hoeken |
| Type | `type.display…caption` + `button` | nooit losse fontSize; altijd met lineHeight |
| Diepte | `elevation.e0…e3` | warme schaduw; e1 kaart, e3 FAB |
| Tik | `touchTarget` (48), `hitSlopFor(size)` | minimale tikmaat |
| Beweging | `motion.fast/base/slow` | kort en zacht |

**Thema (licht/donker).** `colors` is één **live palet** dat bij een thema-wissel
in plaats wordt gemuteerd (`applyTheme` in `lib/theme.js`); alle `colors.*`-inline-
styles lezen daardoor automatisch het actieve palet. `type`/`categoryMeta` lezen hun
kleur via een **getter** (niet vooraf-berekend), zodat een wissel doorwerkt zónder de
in dev bevroren style-objecten te muteren. `lib/useTheme.js` kiest de modus (systeem/
licht/donker, voorkeur in `lib/themePrefs.js`) en de **root-remount via `key`** in
`app/_layout.js` past 'm toe. **Gevolg voor wie bouwt:** blijf `colors.*`/`type.*`
gebruiken (nooit een rauwe hex) — dan erft je scherm de donkere modus gratis.

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
**Structuur** — `SectionHeader`, `ItemRow` (`chevron` voor navigerende rijen)

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
- **Schrijf microcopy zoals je tegen je huisgenoot praat**: kort, warm, in het
  Nederlands.

---

## Acties & knoppen — één plek, één betekenis

Zodat elke actie op een voorspelbare plek staat:

- **Aanmaken op een lijst → `FAB`** (rechtsonder). De dagelijkse "voeg toe"-actie.
  *Uitzondering:* Boodschappen gebruikt een inline invoerbalk voor razendsnel
  achter-elkaar toevoegen — dat is bewust.
- **Bevestigen in een editor/sheet → `ModalHeader` met `onConfirm`** (Annuleer ·
  titel · Bewaar, altijd in de kop en dus bereikbaar zonder te scrollen).
  **Nooit óók een Bewaar-knop onderaan** — één bevestigplek per scherm.
- **Verwijderen → onderaan**, als `Button variant="ghost"`/`danger`, los van de
  bevestiging. Destructief hoort niet naast Bewaar.
- **Veeg-acties op lijstrijen → `SwipeRow`** (`lib/ui.js`, op `ReanimatedSwipeable`):
  **links vegen = verwijderen** (rood), **rechts vegen = uitstellen / secundair**
  (groen). De acties zijn declaratieve descriptors (`{ icon, label, color, onTrigger }`),
  uitbreidbaar naar nieuwe acties zonder het component te wijzigen. De **zichtbare
  knop in de rij blijft** als toegankelijke + web-fallback (op web rendert `SwipeRow`
  de kale rij); de veeg is alleen een snellere ingang. Altijd met **undo-toast** — de
  actie zelf leeft in `onTrigger`, niet in een tweede delete-pad. **Deze richting is
  app-breed bindend (UX-43):** dezelfde veeg betekent overal hetzelfde. Een scherm
  zónder verwijderen laat `left` **leeg** (bv. Vandaag — een focus-overzicht, geen
  wis-plek) i.p.v. er een niet-destructieve actie op te hangen; zo wist links-vegen
  nergens het ene scherm en doet het op het andere iets anders. Voor screenreaders zijn
  de veegacties ook als `accessibilityActions` beschikbaar (A11Y-1).
- **Secundair/navigatie → header-rechts `IconButton`(s)** (zoeken, bibliotheek,
  terugkerend). Houd het bij maximaal een handvol.
- **Een flow-actie die geen "aanmaken" is** (bijv. "Boodschappen aanvullen") →
  volle-breedte `Button` aan het eind van de inhoud.
- **Detailschermen krijgen een `ModalHeader`** (titel + sluiten), geen losse back-knop.
  De `ModalHeader` **padt zichzelf** (`paddingHorizontal: space.lg`): plaats 'm direct
  onder de `SafeAreaView`/sheet en wrap 'm níét nog eens in een padded `View` — anders
  springt de titel dubbel in of plakt 'ie tegen de hoek.

### Editor-flow — één skelet, één volgorde

Elke aanmaak-/bewerk-editor gebruikt het `Editor`-omhulsel uit `lib/ui.js`
(veilige rand + toetsenbord-ontwijking + **vaste** `ModalHeader` + scrollend
inhoudsvlak). Daarmee blijft de Bewaar-knop altijd in beeld en is "één
bevestigplek" structureel geborgd — bouw geen eigen `SafeAreaView`/`ScrollView`/
`ModalHeader`-combinatie meer per scherm.

Velden staan in een vaste, voorspelbare volgorde — de denkstap van de gebruiker:

1. **Wat** — titel/omschrijving (+ categorie, bedrag).
2. **Wie** — toewijzen / betaald door / deelnemers.
3. **Wanneer** — datum (+ herhaling).
4. **Details** — notities e.d.
5. **Delen met** — geavanceerd; via `VisibilityPicker collapsible` ingeklapt
   onderaan (opent vanzelf als de keuze afwijkt van "Hele huishouden"), zodat het
   de hoofd-flow niet onderbreekt.
6. **Verwijderen** — helemaal onderaan, alleen in bewerk-modus (undo-toast, geen
   blokkerende `Alert`).

Eén scherm doet zowel aanmaken als bewerken: prefill de formulier-state uit het
bestaande record en laat Bewaar vertakken (`isNew ? add… : update…`). Geavanceerde,
zelden-gewijzigde blokken horen in een `Collapsible`.

**Niet-bewaarde wijzigingen.** Geef de `Editor` een `dirty`-prop mee wanneer het
formulier gewijzigd is; bij sluiten/terug-drukken vraagt 'ie dan eerst om bevestiging
(`confirmDiscard`, cross-platform: `Alert` native / `window.confirm` web, Android-back
onderschept) i.p.v. een ingevuld formulier stil weg te gooien. Een schoon formulier
sluit direct — geen frictie. (De native `Alert` wordt later het eigen dialoog-systeem.)

### Drawers & sheets — toetsenbord-ontwijking en sluiten

Elke onderaan-ingeschoven drawer/sheet gebruikt het gedeelde `BottomSheet`-omhulsel
uit `lib/ui.js` — bouw geen losse `Modal`-variant per scherm. Twee dingen zijn een
**harde eis**, geen optie:

- **Nooit onder het toetsenbord.** Bevat de sheet een invoerveld, dan schuift de
  inhoud omhoog zodra het toetsenbord opent — je ziet altijd wat je typt. Gebruik
  `BottomSheet avoidKeyboard`; voor sheets met invoer is dat de standaard, niet de
  uitzondering. Een veld dat onder het toetsenbord verdwijnt is een bug, geen detail —
  een stabiele UI waarin de gebruiker z'n invoer ziet gaat vóór alles.
- **Drie sluit-routes, altijd alledrie.** Een sheet sluit via (1) een veeg omlaag,
  (2) een tik op de gedimde achtergrond, én (3) het kruisje/Annuleren in de
  `ModalHeader`. Niet één ervan in plaats van de andere — alledrie moeten werken.
