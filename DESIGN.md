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

---

## Componenten (`lib/ui.js`)

**Lay-out** — `Stack`, `Row`, `Divider`
**Tekst** — `T` (past een type-token toe)
**Acties** — `Button` (primary/accent/ghost/danger · md/lg), `IconButton`, `FAB`
**Invoer** — `Field` (label + helper/fout), `Checkbox`, `Chip`
**Oppervlak** — `Card` (optioneel aantikbaar)
**Status & info** — `Badge`, `Banner`, `Empty` (met optionele actie)
**Mensen** — `Avatar`
**Structuur** — `SectionHeader`

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
