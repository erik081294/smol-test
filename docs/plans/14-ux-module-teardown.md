# Plan 14 — Module-voor-module UX-ontleding (Fase 1.6 "van half naar af")

> **Status (2026-06-23):** de **quick wins UX-15 t/m UX-20 zijn af** (PR #37, op de Motorola
> E2E geverifieerd; incl. herbruikbaar `SwipeRow`-veegprimitief en de `snoozeDate`/`monthCount`-
> logica). De **verkennende teardown-sessies UXR-1 t/m UXR-8** staan nog open — dáár gaat dit plan
> nu vooral over. Bevinding uit UX-18: een bestaande plant is niet bewerkbaar → nieuwe rij **UX-21**.

**Backlog:** UXR-1 t/m UXR-8 (verkennend) + UX-15 t/m UX-20 (voor de hand liggend, ✅ af).
**Soort:** UX-diepgang — geen nieuwe datalaag, geen migratie. Leunt volledig op het
bestaande design-systeem (`lib/theme.js`, `lib/ui.js`, `DESIGN.md`).
**Verhouding tot Fase 1.5 (plan 07):** plan 07 maakte de app *visueel cohesief* (tokens,
componenten, optimistic/haptics/toast). Deze ronde gaat een laag dieper: per module
nagaan of de **flow af is** — niet "ziet het er goed uit", maar "kun je hier het hele
klusje klaren zonder dood te lopen". Veel modules hebben een dragende datalaag maar een
**halve interactie-laag** (data tonen ≠ kunnen handelen).

## Waarom deze ronde

De modules voelen "half af": de happy path bestaat, maar de randen niet. Terugkerende
patronen uit de UX-review:

- **States ontbreken** — geen laad-skeleton, een doodlopende lege staat, of geen zichtbare
  foutstaat. De gebruiker ziet een leeg scherm en weet niet of het laadt, leeg is, of stuk.
- **Data zonder handeling** — een detail-/kaartscherm toont iets (volgende waterbeurt,
  verzorgingskaart, ingrediënten, eerstvolgende dierzorg) maar je kunt er niet *op
  handelen* (afvinken, bewerken, plannen) zonder een omweg.
- **Inconsistente bediening** — verwijderen is in de ene module een undo-toast, in de
  andere een long-press, in de derde een modal. Bulk-acties ("clear done", "verwijder
  verlopen") bestaan in de ene module wel en de andere niet.
- **Onduidelijke beslismomenten** — microcopy die een keuze niet uitlegt (rotatie-volgorde,
  split-type, welke periode de eerlijkheid/inzichten telt, "settle"-suggesties).

Dit zijn geen bugs; het zijn ontbrekende stappen die samen het "half"-gevoel geven.

---

## De ontleed-lens — drie passes per module

Elke teardown-sessie loopt één module-familie langs in drie passes. Leg per pass de
bevindingen vast als **concrete §6-rijen** (een nieuwe `UX-NN`, of een module-prefix-rij);
de UXR-rij zelf is de *sessie*, niet de oplossing.

### 1. Scherm voor scherm
Voor élk scherm in de module (lijst, detail, editor, sheet):

- **5-seconden-test** — open het scherm koud: weet je binnen 2s wat dit scherm is en wat
  de eerstvolgende actie is? (`DESIGN.md` principe 1.)
- **De vier states** — bestaat er een nette **loading** (skeleton, niet blanco), **leeg**
  (met next-step, geen dood einde), **fout** en **offline/geen-netwerk**? Of valt het
  scherm terug op niets?
- **Informatiehiërarchie** — staat het belangrijkste boven en groot? Concurreert er niets
  onnodig om aandacht (badge-regen, te veel accenten — principe 4)?
- **Eén primaire actie** — is er precies één gevulde knop/`FAB`, rest secundair? Staat
  aanmaken/bevestigen/verwijderen op de voorspelbare plek (`DESIGN.md` "Acties & knoppen")?
- **Affordances** — leest tikbaar als tikbaar (chevron op navigerende rijen, checkbox op
  afvink-rijen)? Is er geen verborgen long-press als enige toegang tot een actie?

### 2. Beslissing voor beslissing
Voor elk keuzemoment dat de module de gebruiker oplegt:

- **Default-check** — is de standaardkeuze de juiste voor het gezin-scenario (tiener/ouder/
  oma)? Kan de gebruiker meteen door zonder te kiezen?
- **Kan de keuze weg?** — elke keuze is frictie. Is de optie het waard, of kan een slimme
  default 'm vervangen?
- **Begrijpt de gebruiker de keuze?** — microcopy die uitlegt wat er gebeurt (rotatie =
  volgorde, niet selectie; split-type; welke periode telt; waarom deze settle-betaling).
- **Vergevingsgezind** — is de keuze terug te draaien (`DESIGN.md` principe 7)?

### 3. Flow voor flow
Voor elke end-to-end gebruikerstaak in de module (niet per scherm, maar de hele reis):

- **Loop 'm echt** — bijv. "plant toevoegen → soort/verzorging → afvinken waterbeurt →
  tijdlijn-foto" of "maaltijd plannen → ingrediënten → boodschappen → na koken → voorraad".
- **Waar haakt het?** — een stap die een onnodig scherm verder ligt, een actie die je
  alleen via een omweg bereikt, een dood einde zonder vervolgstap.
- **Deeplinks & terugkeer** — kun je van het ene domein naar het verwante springen
  (kaart → detail → gekoppelde taak → terug) zonder de draad kwijt te raken?
- **Cross-module-consistentie** — doet dezelfde handeling hetzelfde als in de buurmodule?

> **Output van een sessie.** Een korte notitie + een setje §6-rijen (`Insp.` S/M, `Status`
> ⏳). Houd elke rij klein en zelfstandig bouwbaar (geen migratie, units waar pure logica
> ontstaat). Zo wordt "ontleden" meteen "afmaken".

---

## De teardown-sessies (UXR-1 … UXR-8)

Gegroepeerd per **gebruikersreis/module-familie** (niet strikt per tab), zodat verwante
schermen in één sessie samenhangend bekeken worden. Aanbevolen volgorde = meest gebruikt /
hoogste "half"-dichtheid eerst.

| UXR | Module-familie | Schermen in scope |
|-----|----------------|-------------------|
| UXR-1 | **Vandaag / overzicht** | `vandaag.js` (hero + widgetgrid, bewerk-modus, widget-stijlen) |
| UXR-2 | **Taken & de tasks-weergaven** | `taken.js`, `agenda.js`, `schoonmaak.js`, `task/[id].js` — klopt de rolverdeling (STR-1) écht in gebruik? |
| UXR-3 | **Boodschappen** | `boodschappen.js`, favorieten-/vaste-boodschappen-sheet, catalogus |
| UXR-4 | **Kosten & delen** | `kosten.js`, `expense/[id].js`, `kosten-inzichten.js`, `delen.js`, `resource/[id].js` |
| UXR-5 | **Keuken-loop** | `maaltijden.js`, `recipe/[id].js`, `voorraad.js` — de menu→lijst→voorraad-reis |
| UXR-6 | **Zorg-modules** | `planten.js`/`plant/*`, `huisdieren.js`/`pet/*` — gedeelde verzorgings-/tijdlijn-infra |
| UXR-7 | **Setup & beheer** | `huishouden.js` (leden/subgroepen/module-toggles), `onboarding.js`, `instellingen.js` |
| UXR-8 | **Activiteit & navigatie-weefsel** | `activiteit.js` + cross-module deeplinks/terugkeer (sluit aan op UX-10/UX-12) |

Per sessie: loop de drie passes hierboven, leg bevindingen vast als §6-rijen, en pak de
goedkoopste meteen mee. UXR-1..8 zijn **parallelliseerbaar** (raken losse schermen).

---

## Voor de hand liggende quick wins (UX-15 … UX-20)

Deze hoeven niet op een sessie te wachten — ze kwamen scherp en herhaald uit de review en
zijn los bouwbaar op het bestaande systeem. Detail per item in backlog §6.

- **UX-15 — Laad-skeletons overal.** `ListSkeleton` bestaat (STR-4) maar wordt op de
  na-Fase-1.5 gebouwde modules niet gebruikt → blanco scherm tijdens laden. Rol uit op
  Maaltijden, Voorraad, Huisdieren, Delen, Kosten-inzichten, planten/agenda/schoonmaak waar
  nog niet.
- **UX-16 — Lege staten met next-step compleet maken.** STR-10 dekte de hoofdtabs; de
  nieuwere modules (Maaltijden, Voorraad, Huisdieren, Delen, Agenda) missen nog een
  uitnodigende lege staat met één duidelijke vervolgactie + illustratie.
- **UX-17 — Eén verwijder-/veeg-interactie overal.** Harmoniseer verwijderen: zichtbare
  swipe-to-delete + undo-toast (STR-5/STR-9-patroon) consistent op Boodschappen, Voorraad,
  en de modules die nu nog long-press of een kale modal gebruiken.
- **UX-18 — Inline "bewerken"-affordance op verzorging/ingrediënten.** Verzorgingskaart
  (plant/huisdier) en recept-ingrediënten zien er statisch uit; maak bewerkbaarheid
  zichtbaar (potlood-/chevron-affordance) i.p.v. impliciet.
- **UX-19 — "Voltooide wissen" + vier-de-voortgang consistent.** Taken-done-sectie en
  Voorraad-verlopen krijgen dezelfde bulk-opruimactie als Boodschappen; en een kleine
  "alles af vandaag"-viering (sluit aan op STR-11 / principe 6).
- **UX-20 — Periode-transparantie.** In Schoonmaak-eerlijkheid en Kosten-inzichten zichtbaar
  maken *welke* items in WEEK/MAAND/ALLES meetellen (subkop/telling), zodat de cijfers
  navolgbaar zijn.

---

## Aanpak in VSC

Geen migratie, geen nieuwe infra. Per quick win: pas het scherm aan met bestaande
componenten/tokens, draai `npm test` (blijft groen — raakt geen pure logica, tenzij je een
heuristiek toevoegt; dan een unit erbij), korte rooktest op web. Per UXR-sessie: leg de
bevindingen vast als nieuwe §6-rijen en commit de meegnomen quick wins per logische stap.

## UXR-1 — Vandaag (Thuis) · sessie-notitie 2026-06-23

Doorlopen op de Moto g72 (screenshots) + broncode (`app/(tabs)/vandaag.js`,
`lib/HomeHero.js`, `lib/widgets/WidgetGrid.js`, `lib/widgets/WidgetHost.js`). Drie passes
gelopen; hieronder alleen de bevindingen die **Erik akkoord** heeft bevonden — de overige
suggesties (accent-regen, dubbele dag-stand, stijl-toggle schrappen, dubbele /meer-ingang,
FAB-keuze) zijn **bewust verworpen** en niet als rij opgenomen.

| ID | Bevinding (Vandaag) | Bron | Insp. | Status |
|----|---------------------|------|-------|--------|
| UX-22 | **Hero-ring leest als knop maar is dood.** In de lege staat (`nothingToday`) toont de `ProgressRing` een zon-achtig `today`-icoon in een cirkel met accentrand → schreeuwt "tik mij", doet niets. Geef 'm betekenis (tik → Taken) óf maak 'm visueel platter/minder knop-achtig in de lege staat. | `lib/HomeHero.js:70-74` | S | ✅ |
| UX-23 | **Geen loading-/fout-/offline-staat op Vandaag.** Alleen `RefreshControl`; tijdens laden is `tasks` leeg → hero toont vrolijk "Een rustige dag" terwijl er nog niets binnen is (misleidend). Geen skeleton (sluit aan op UX-15), geen foutstaat als `reload` faalt, geen offline-indicatie. | `app/(tabs)/vandaag.js:141-144` | M | ✅ |
| UX-24 | **Widget-preview puilt uit de tegel.** Tegel-inhoud zit in een harde `height: tileH` (132px) zonder `overflow:hidden`; zodra de preview (taaktitels, afgevinkte activiteit) hoger wordt, tekent die over de tegel/elementen eronder. Brede tegels hebben juist veel ongebruikte ruimte. Fix-richting: laat brede tegels hun ruimte benutten om de items netjes te tónen (i.p.v. overflow) — bv. tegel groeit mee of preview vult de breedte. | `lib/widgets/WidgetGrid.js:143` + `lib/widgets/WidgetHost.js:28,51` | M | ✅ |
| UX-25 | **Widgets slepen met long-press óók buiten aanpas-modus.** Drag staat nu op `.enabled(editing)`; gewenst: long-press (≈220ms) tilt een tegel op en herschikt, terwijl een korte tik blijft navigeren. Let op: buiten bewerkmodus is er geen controlebalk — dit is puur herschikken; per-ongeluk optillen tijdens scrollen vermijden. | `lib/widgets/WidgetGrid.js:177` | M | ✅ |
| UX-26 | **"Aanpassen"-regel onder de widget-grid.** De grid-kop (`Overzicht` + Aanpassen-toggle) staat nu bóven de tegels; verplaats naar onder de grid. Gevolg: de stijl-keuze + drag-hint die bij bewerkmodus horen verschijnen dan ook onder de grid — meenemen in de verplaatsing. | `app/(tabs)/vandaag.js:186-210` | S | ✅ |

> Verworpen in deze sessie (vastgelegd zodat ze niet terugkomen): accent-regen in de grid,
> dubbele dag-stand hero↔Taken-tegel, `playful`/`neutral`-stijltoggle schrappen, dubbele
> ingang naar /meer, en de hard-gecodeerde "+ Taak"-FAB. Erik vindt deze niet passend.

---

## UXR-2 — Taken & tasks-weergaven · sessie-notitie 2026-06-23

Doorlopen op de Moto g72 + broncode (`taken.js`, `agenda.js`, `schoonmaak.js`,
`task/[id].js`). **Kernbeslissing (STR-1 herijkt):** Taken wordt het centrale
**afspraken/agenda**-oppervlak. Het wordt *handmatig* gevuld met afspraken én
*automatisch* door de modules (plant/huisdier/schoonmaak/…). De Taken-editor focust op
handmatige afspraken; module-items hóren bij hun module en linken daarheen terug — zo
voorkomen we "parallelle werelden" (een plant-taak zónder plant). Feit dat dit haalbaar
maakt: module-taken dragen al hun bron-koppeling (`category:'plant' + plant_id`,
`zone_id`, etc.).

### Reframe & navigatie

| ID | Bevinding | Bron | Insp. | Status |
|----|-----------|------|-------|--------|
| UX-27 | **Agenda samenvoegen met Taken; Agenda-tab vervalt.** Maand-scope in Taken neemt de rol over (de subgroep-filter uit Agenda erbij). Agenda is nu een feature-arme kopie van Taken/Maand (zelfde `MonthView`, alleen subgroep-chips, geen filter/loading/leeg/swipe). | `agenda.js` ↔ `taken.js:246` | M | ✅ |
| UX-28 | **Module-taken linken terug naar hun bron-element.** Tik op een afspraak die via een module is ontstaan (bv. `category:'plant'` met `plant_id`) → navigeer naar de logische detailview in díe module (plant/huisdier/…), niet naar de generieke editor. De handmatige afspraken openen wél de editor. Voorkomt parallelle werelden. | `lib/TaskRow.js` + `usePlants.js:70` | M | ✅ |

### Overzicht-interactie (Taken)

| ID | Bevinding | Bron | Insp. | Status |
|----|-----------|------|-------|--------|
| UX-29 | **Horizontaal swipen tussen periodes.** Veeg links/rechts = vorige/volgende reeks (dag/week/maand). Let op: verticaal scrollen mag niet wiebelig worden — gesture-conflict (horizontaal pannen vs verticaal scrollen) netjes afvangen. | `taken.js:251` (SectionList) | M | ✅ |
| UX-30 | **Kalender pas op klik.** Standaard alleen het periode-/datumlabel tonen; tik erop opent de kalenderkiezer, met het schaalniveau van de actieve tab (dag/week/maand). Maandview toont dus niet meer standaard de kalender. | `taken.js:230-241` + `MonthView` | M | ✅ |
| UX-31 | **Default = week-view** bij openen van Taken (nu `'dag'`). | `taken.js:39` | S | ✅ |
| UX-32 | **Jaar-scope gelijktrekken** met de andere tabs (zelfde lijst-/periodebediening), maar zónder kalenderkiezer (niet nodig op jaar). | `taken.js:244` | S | ✅ |
| UX-33 | **YearActivity-statistieken naar een aparte, vriendelijke plek.** Niet schrappen — ze zijn waardevol. Locatie nog TBD (kandidaat: een "inzichten"-/profielplek). | `lib/YearActivity.js` | M | ✅ |

### Editor vereenvoudigen (`task/[id].js` → afspraken-editor)

| ID | Bevinding | Bron | Insp. | Status |
|----|-----------|------|-------|--------|
| UX-34 | **Zone-keuze eruit.** Bij alleen-afspraken is de zone-koppeling overbodig; zones horen bij de Schoonmaak-flow. | `task/[id].js:204-215` | S | ✅ |
| UX-35 | **"Voor wie?" → multi-select + groepen.** Meerdere leden selecteerbaar (nu single-select `assignedTo`); subgroepen verschijnen hier indien aanwezig. | `task/[id].js:217-220` | M | ✅ |
| UX-36 | **Datumselectie herontwerpen.** Default = **vandaag** (nu "geen datum"). Andere datum via een datum-icoon; terugkerend via een vinkje dat pas dán de herhaalinstellingen onthult. Weg met "expander-op-expander"; nette, gefaseerde stappen. | `task/[id].js:222-327` | L | ✅ |
| UX-37 | **"Delen met" + "Voor wie" samenvoegen** tot één begrijpelijk blok, ook in de copy: "Voor wie is deze afspraak?" / "Wie ziet deze afspraak in de agenda?". | `task/[id].js:217-220, 336-347` | M | ✅ |
| UX-38 | **Beschrijving via progressive disclosure.** "Notitie (optioneel)" wordt een nette toggle onder de titel ("Beschrijving toevoegen?") die het veld pas op klik onthult. | `task/[id].js:329-334` | S | ✅ |
| UX-39 | **Primaire actieknop óók onderaan.** Naast de bevestiging rechtsboven een duidelijke, goed-gelabelde knop onderaan ("Afspraak opslaan"/"Toevoegen") — niet alleen de rechtsboven-knop (zwakke UX). | `lib/ui.js` (`Editor`) | M | ✅ |
| UX-40 | **Rotatie/rouleren eruit.** Beurtrotatie hoort bij de modules waar dat telt; afspraken zijn agenda-items. | `task/[id].js:289-325` | S | ✅ |

### Flexibiliteit

| ID | Bevinding | Bron | Insp. | Status |
|----|-----------|------|-------|--------|
| UX-41 | **Door gebruiker gemaakte, gekleurde tags** koppelbaar aan afspraken; voeding voor de filters. Behoudt ultieme flexibiliteit voor afspraaktypes die de modules niet dekken. **Let op:** raakt de datalaag (tag-entiteit + kleur + koppeling) — valt buiten de "geen-migratie"-belofte van dit plan; apart inplannen. | nieuw (filters: `lib/agenda.js`) | L | ✅ |

> **Niet behandeld / nog open (geparkeerd, geen besluit deze sessie):** Taken mist een
> **foutstaat** (alleen pull-to-refresh); de editor toont een **blanco scherm** tijdens het
> laden van een bestaande taak i.p.v. een skeleton (`task/[id].js:179`); **Schoonmaak**
> gebruikt voor de inricht-preview een rauwe `Modal` i.p.v. de gedeelde `BottomSheet`
> (`schoonmaak.js:181`) en heeft **geen swipe-verwijderen** op zijn TaskRows. Schoonmaak
> zelf krijgt een eigen teardown (UXR-2 richtte zich op Taken/Agenda/editor).

---

## Build-notitie — UXR-1 + UXR-2 uitgevoerd (2026-06-24)

Alle rijen **UX-22 t/m UX-41 zijn gebouwd** (branch `feat/ux-batch-22-41-vandaag-taken`,
4 commits per fase). `npm test` 497 groen, `expo lint` 0 errors, mutatie-ratchet groen
(agenda **91.4 %**, i18n 73.2 %, modules 88.7 % — geen daling).

**Belangrijke implementatiebeslissingen (door Erik geaccordeerd of als verantwoorde default):**
- **category vs. tags.** `category` (klus/plant/huisdier/…) blijft de *module-herkomst*-marker
  die UX-28 nodig heeft om terug te linken; de mensgerichte indeling van handmatige afspraken
  is nu de **eigen gekleurde tags** (UX-41). De categorie-picker is uit de editor; een nieuwe
  handmatige afspraak krijgt `category:'afspraak'`. Filters filteren op beide assen.
- **UX-33 → nieuw `/inzichten`-scherm** (jaar-activiteit/heatmap), bereikbaar via "Meer".
  De `agenda`-module-slot is herbestemd naar `inzichten` (kind `overview`).
- **UX-41 datalaag.** Migratie `0039_tags.sql` (tags-tabel + `is_member`-RLS + realtime +
  `tasks.tag_ids uuid[]`) is **toegepast op de live DB** via MCP; security-advisors schoon.
- **assigned_to-behoud.** "Voor wie?" (custom, 1 persoon) zet `assigned_to`; bij Hele-huishouden/
  subgroep blijft de bestaande `assigned_to` staan, zodat bewerkte schoonmaaktaken hun beurt
  niet verliezen. `zone_id` en `rotation` blijven eveneens passthrough (UI eruit, data intact).
- **Bonus.** `useCollection` wist de lijst niet meer leeg bij een transiënte laadfout en legt
  een `error` bloot (foutbanner op Vandaag én Taken). Jaar-scope dropt z'n filters niet meer.

**On-device rooktest — uitgevoerd & geslaagd (moto g72, 2026-06-24).** Geverifieerd:
Vandaag (hero-ring → Taken, widget-preview netjes binnen de tegel, bewerk-modus-controlebalk),
Taken (week-default, periode-kop, "Achterstallig" bovenaan, dag-groepering), **UX-30** kalender-
op-klik ("Kies een dag" met dag-stippen), **UX-32** Jaar als maand-gegroepeerde lijst, **UX-28**
plant-taak → plant-detail, **UX-41** end-to-end (tag "Sport" live aangemaakt + getoond op de rij),
de **afspraken-editor** (datum=vandaag, "Voor wie?"-blok, Herhalen-vinkje, beschrijving-toggle,
actieknop onderaan, géén categorie/zone/rotatie) en het opslaan van een afspraak. **UX-29**
horizontaal periode-vegen werkt (22–28 jun → 29–5 jul); rij-swipe wint op een rij, periode-veeg
op kop/tussenruimte (let op: via adb vereist een Pan een tráge drag ≥1000ms — geen ontwerpfout).

**Geparkeerd, bewust nog niet gedaan:** editor toont nog een **blanco** scherm tijdens het laden
  van een bestaande taak (geen skeleton); **Schoonmaak** rauwe `Modal` + geen swipe (eigen
  teardown). Deze stonden al als "open" genoteerd onder UXR-2.

## Build-notitie — UXR-2 batch 2 (gebruikersfeedback 2026-06-24)

Tweede ronde verfijningen op dezelfde branch/PR (#41). `npm test` **512 groen**, `expo lint`
0 errors, mutatie-ratchet **groen** (agenda 91.3 %, recurrence 92.8 %, widgets 79.8 %, i18n/
modules/constants ongemoeid — geen daling; `advanceRecurrence` + `forMe`/audience + details-
toggle gedekt).

Gebouwd (11 punten):
1. **Vandaag — hele groene hero-kaart klikbaar** i.p.v. alleen de ring (één knop, samengestelde a11y).
2. **Vandaag — focus-taken weg-swipen:** rechts = afvinken (groen, omkeerbaar, geen undo-toast),
   links = uitstellen (oker, +1 dag, met undo). Verwijderen hoort hier bewust níet.
3. **Vandaag — "Klaar" prominent in bewerkmodus:** gevulde groene pil in de kop + primaire knop
   onderaan de bewerkgroep (was een fluisterstil tekstlinkje).
4. **Widgets instelbaar:** breedte (1/2 kolommen) + **details-toggle** per tegel; een brede tegel
   toont nu **side-by-side** (stat-blok links, preview rechts). Pure `toggleWidgetDetails`/
   `widgetShowsDetails` in `grid.js`; placement-veld `details` (default aan = backward compat).
5. **Afspraken — subtiel delen:** `VisibilityPicker` in collapsible-modus ("Voor wie? — Hele
   huishouden", vouwt pas op tik open). **Taken — "Voor mij"-filter:** pure `forMe` (toegewezen/
   gemaakt/gedeeld) + `audience`-as in `applyTaskFilters`; losse huishoud-taken vallen weg, met
   jou gedeelde afspraken blijven zichtbaar.
6. **Drawers — grijp-handvat + omlaag-swipen om te sluiten** op de gedeelde `BottomSheet` (raakt
   álle sheets); `GestureHandlerRootView` in de `Modal`, Pan op een ruime (~44dp) handvat-zone
   zodat scrollende inhoud los blijft scrollen. Overlay-tik + kruisje blijven als sluit-routes.
7. **Taken — content schuift mee** tussen periodes (translateX volgt de vinger, nieuwe periode
   schuift van de overkant in; respecteert "verminder beweging"). **Volledige datumbox klikbaar**
   (alle scopes, óók Jaar) + **jaar-kiezer** toegevoegd aan `PeriodPicker`.
8. **Herhaal-einde** (subtiel, zoals "Beschrijving toevoegen"): stopdatum óf na X keer. Pure
   `advanceRecurrence` beslist doorrollen vs. stoppen; `completeTask` telt `recur_count` af.
   Migratie **`0040_recur_end.sql`** (`tasks.recur_until` + `recur_count`, beide nullable) is
   **op de live DB toegepast** via MCP (na expliciete toestemming Erik).
9. **Kalender van maand naar maand swipen** (`PeriodPicker`): horizontaal vegen bladert dag/
   week-grid maand-naar-maand, maand-grid jaar-naar-jaar, jaar-grid per pagina; content schuift
   mee. De ‹ › knoppen blijven als betrouwbare bediening.
10. **Hele drawer naar beneden swipen om te sluiten** (niet enkel het handvat), mét **scroll-
    voorrang.** De dismiss-Pan loopt **simultaan** met de scroll (scroll wordt nooit geblokkeerd)
    en sluit alleen wanneer de lijst bovenaan staat (`scrollY ≤ 0`). Nieuwe `SheetScrollView`
    deelt de scrollpositie; de verticaal-scrollende sheets (Taken-filter, maaltijden, plant-/
    huisdier-detail) zijn erop omgezet.
11. **Breedte-knop met richtinggevoelig icoon**: een smalle tegel toont "verbreden", een brede
    "versmallen" — duidelijker dan één ⟳-icoon.

**Verificatie 2026-06-24.** Op het tóestel (moto g72) geverifieerd: hele hero-kaart als één knop
(gecombineerde a11y), "Voor mij"-chip, volledige klikbare datumbox. Op de **emulator** (toestel
was in gebruik): app boot + Vandaag/Taken renderen, **brede Agenda-widget toont side-by-side**,
afspraken-editor met **subtiele "Voor wie?"-rij**, **herhaal-einde** ("Op datum"-pill + "Na aantal
keer"-stepper, ook in de niet-bewaard-guard), Filter-sheet mét **grijp-handvat**.
Daarna óók geverifieerd op de emulator: **widget-bewerkmodus** — gevulde "Klaar"-pil in de kop +
prominente "Klaar"-knop onderaan (#2), en de control-balk met de **details-toggle alléén op brede
tegels** + het richtinggevoelige breedte-icoon (#3/#11); de **side-by-side**-preview op de
Activiteit-widget; de **koud-laad-skeleton + "Even laden…"** op Vandaag.

**Niet via adb verifieerbaar:** álle RNGH-Pan-gebaren (periode-content-slide #7, drawer-swipe-omlaag
#10, kalender-maand-swipe #9) — `adb input swipe` dríjft op deze emulator géén RNGH-Pan aan (ook de
in batch 1 op het toestel bewezen periode-swipe reageert niet via adb-emulator; dat isoleert het als
emulator/adb-beperking, geen code-bug). Alles degradeert veilig: drawers blijven sluitbaar via
overlay-tik/kruisje, de kalender via de ‹ › knoppen, en de scroll-Pan loopt simultaan met scrollen
(scroll kan niet geblokkeerd worden). **Op een echt toestel te bevestigen:** drawer-swipe-omlaag
(incl. scroll-voorrang), kalender-maand-swipe en de periode-content-slide.

## Acceptatie

- Elke aangepakte module heeft een nette **loading-, lege- en foutstaat**.
- Verwijderen voelt overal hetzelfde en is **terug te draaien**.
- Geen detail-/kaartscherm dat data toont zonder de bijbehorende **handeling** binnen bereik.
- Elke UXR-sessie levert een korte notitie + concrete §6-rijen op (ontleden → afmaken).
- `npm test` blijft groen.
