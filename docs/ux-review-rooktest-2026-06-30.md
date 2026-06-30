# UX/Product-review — rooktest 2026-06-30

> **Gedateerde snapshot.** Onafhankelijke UX/product-doorlichting op basis van de device-rooktest-
> screenshots van 2026-06-30 (moto g72, dev-client, branch `main`). Drie sporen: **SCH-4** (Schoonmaak —
> zelf rooster samenstellen), **PLA-10** (Planten — verzorgingstaken bewerkbaar vanaf detail),
> **BOO-14/15/16/17** (Boodschappen — kop-compactie + zoek/afvink/verwijder-feedback). Géén statustracker
> — actuele status leeft in [`huishoek-backlog.md`](../huishoek-backlog.md) §6. Beoordeeld op
> visueel/UX/interactie/copy, niet op code. De lat is `DESIGN.md` (de zeven principes) en de eerdere
> [design-review van 2026-06-26](design-review-2026-06-26.md).

> **Naschrift na code-verificatie (2026-06-30).** De drie "hoog"-punten zijn tegen de bron gelegd; ze
> bleken grotendeels artefacten van statische screenshots:
> - **#1 (taak-editor, twee bevestigplekken)** — een echte doc⇄code-spanning, maar het is het **bewuste
>   UX-39**-patroon (primaire actie óók onderaan, in *alle* editors en *beide* modi — niet nieuw-vs-bewerk
>   zoals hieronder gesteld). **Besluit (Erik): de onderknop blijft — fijne UX.** `DESIGN.md` is verzoend
>   met UX-39 (kop + voet = dezelfde `save`, één bevestig-actie). Opgelost-as-designed.
> - **#2 (bulk-prullenbak)** — heeft al een `accessibilityLabel` (`groceries.clearChecked`) én een
>   undo-toast (`onClearChecked`). Geen defect; de review-onzekerheid hierover klopte.
> - **#3 (catalogus "voeg toe")** — de dropdown-rij *is* tap-to-add (`pickCatalog`, op toestel bevestigd);
>   de stepper is secundair. Hooguit minieme polish.
>
> De **midden/lage** punten hieronder (schoonmaak-footer, "Rooster bekijken"-copy, herhaal-blok, "Voor
> wie"-modus-verschil, dubbele taaknamen, enz.) blijven staan als echte opvolging — zie backlog **UXR-10**.

## 1. Samenvatting

De drie sporen werken in de kern: het zelf-samenstellen van een schoonmaakrooster is een fijne, live
voorvertoonde flow; de plant-verzorgingstaken zijn nu echt bewerkbaar vanaf het detail (de "dode tik"
is weg); en de boodschappen-feedback (afvink-banner vs. donkere undo-toast) is duidelijk distinct. De
eerdere review is goed opgevolgd — explainer-ⓘ rechtsboven overal, undo-toasts overal, FAB-conventie.

De zwaarste punten: **(1)** de taak-editor toont in **nieuw-modus** zowel een kop-`Bewaar` als een grote
onderaan-knop "Afspraak toevoegen" — twee bevestigplekken op één scherm, regelrecht tegen de DESIGN.md-
regel "één bevestigplek" (en inconsistent met de bewerk-modus, die alleen de kop heeft). **(2)** De
"Alles afgevinkt!"-sectie heeft een **labelloze rode prullenbak** die alle afgevinkte items in één tik
wist — destructief, zonder zichtbare bevestiging, en in strijd met de a11y-regel "icoon-zonder-tekst =
accessibilityLabel". **(3)** De catalogus-dropdown toont een stepper op **0**: de primaire "voeg toe"-
handeling is niet ontdekbaar — het is onduidelijk of je op de rij tikt of op `+` (de stepper suggereert
"kies eerst een aantal").

## 2. Per spoor

### 2.1 Schoonmaak (SCH-4)

**Wat werkt goed.** De opstel-sheet is sterk: de Sjabloon/Zelf-samenstellen-toggle is helder, de inline
cadans-keuze per zone (`15-zone-cadans-s.png` → `16-cadans-maand-s.png`) met de **live preview** onderaan
("Toilet · Toilet schoonmaken — Elke maand") geeft directe feedback, en "Opzetten" is correct disabled tot
≥1 zone met heldere hint (`14-zelf-samenstellen-s.png`). Per-zone "+ Taak toevoegen" vs. de footer "Rooster
opstellen" is een net onderscheid losse-taak vs. heel-schema. De deeplink naar Taken met actieve
"Schoonmaak ×"-filterchip (`21-taken-filter-s.png`) hergebruikt de bestaande filter-infrastructuur netjes.

**Verbeterpunten.**

- **Twee concurrerende footerknoppen, kleur-omkering t.o.v. de sheet** (`12-schoonmaak-bottom-s.png`).
  "Rooster bekijken" (grijs/secundair) + "Rooster opstellen" (**ocher**/primair) staan naast elkaar. Maar
  in de opstel-sheet zelf is de primaire knop "Opzetten" **forest** (`13`/`15`/`16`). Eén flow, twee
  primaire kleuren — dat ondermijnt principe 5 (voorspelbaar). Kies één accent voor "de primaire actie in
  deze module" en houd 'm vast van footer tot sheet. Daarnaast: twee knoppen op één balk laat de gebruiker
  raden welke de hoofdactie is; overweeg "Rooster bekijken" als tekstlink/ghost-`Button` en alleen
  "Rooster opstellen" gevuld, of "bekijken" pas tonen zodra er een rooster ís.
- **"Rooster bekijken" is een verwarrende belofte** (`21-taken-filter-s.png`). De knop heet "bekijken"
  maar landt op de **Taken**-tab met een filterchip — een ander scherm, andere kop ("Taken · Alles wat er
  te doen is in huis"). Functioneel prima, maar de gebruiker verwacht na "Rooster bekijken" een
  rooster-/kalenderweergave, niet de generieke takenlijst. Copy als "In de takenlijst tonen" of een korte
  toelichting dekt de verwachting beter. (De Android "Openen met"-disambiguatie in `20-rooster-bekijken-
  s.png` is dev-only, buiten scope.)
- **Leaderboard: betekenis hangt aan kleur + placeholderdata** (`10-schoonmaak-s.png`). De "Wie deed
  hoeveel"-balken zijn allemaal hetzelfde groen; alleen de lengte + het getal rechts dragen de betekenis —
  dat is op zich principe-2-conform (niet kleur-only), maar de balk bij "Erik2 · 0" is een lege grijze
  spoorbalk die makkelijk als "laden" leest. Overweeg bij 0 een expliciet "nog niets" i.p.v. een lege
  balk. ("Erik2" is testdata, geen designpunt.)
- **Identieke taaknamen zonder onderscheid** (`10`/`11-schoonmaak-footer-s.png`). In Badkamer staan twee
  rijen "Badkamer schoonmaken", in Keuken twee "Keuken dweilen", in Toilet na opzetten twee "Toilet
  schoonmaken" (`19-toilet-zone-s.png`) — met verschillende data ("zat 22 aug." vs. niets, "Elke maand"
  vs. "Wekelijks: za"). Voor de gebruiker oogt dat als een dubbele/dubbel-aangemaakte taak. Het verschil
  zit alleen in de kleine meta-regel. Bij het opstellen van een rooster bovenop bestaande taken zou een
  ontdubbeling of een waarschuwing ("Toilet heeft al een wekelijkse taak — toch toevoegen?") de
  verwarring wegnemen.
- **Kop-subtitel belooft afvinkbaarheid die je hier niet ziet.** "Je taken per ruimte — afvinken werkt
  overal door." (`10`) is een fijne, geruststellende zin, maar op dit scherm zijn de checkboxes leeg en
  niet de focus; de claim "werkt overal door" is voor een nieuwe gebruiker abstract. Niet kritiek.

### 2.2 Planten (PLA-10)

**Wat werkt goed.** De kernwens is gehaald: een verzorgingstaak opent nu de taak-editor
(`31-plant-detail-s.png` → `32-taak-editor-s.png`), en "+ Taak toevoegen" op de plant maakt een nieuwe
taak die mét plant-koppeling onder Verzorgingstaken verschijnt ("ROOKTEST plant taak · Plant · Vandaag",
`36-na-bewaar-s.png`). De verwijder-undo-toast (`38-delete-confirm-s.png`) is consistent met de rest van
de app. De Verzorgingskaart is nu inklapbaar (chevron, `31`) — opvolging van de vorige review.

**Verbeterpunten.**

- **Twee bevestigplekken in de nieuw-modus — de zwaarste UX-fout van deze batch**
  (`34-taak-nieuw-s.png`). De "Nieuwe afspraak"-editor toont tegelijk een kop-`Bewaar` (rechtsboven) én
  een volle-breedte **groene "Afspraak toevoegen"-knop onderaan**. DESIGN.md is hier expliciet: "Bevestigen
  in een editor/sheet → ModalHeader met onConfirm … **Nooit óók een Bewaar-knop onderaan**." De bewerk-
  modus (`32-taak-editor-s.png`) doet het wél goed: alleen kop-`Bewaar`, geen onderknop. Dezelfde editor,
  twee verschillende contracten — dat is verwarrend én inconsistent. Haal de onderaan-knop in nieuw-modus
  weg (of, als de onderknop bewust de primaire is, haal 'm in béíde modi weg uit de kop — maar kies één).
- **Herhaling-blok is dicht en cognitief zwaar** (`32-taak-editor-s.png`). Onder "Herhalen" staan
  tegelijk: Dagelijks/Wekelijks/Maandelijks-chips, "Elke [− 4 +] weken", én een rij vaste weekdagen
  (Ma–Zo), met daaronder twee regels uitleg. Dat zijn drie elkaar deels uitsluitende manieren om hetzelfde
  in te stellen ("Elke 4 weken" vs. "vaste dagen — dan vervalt het wekeninterval"). Voor de oma-met-grote-
  tekst-persona uit DESIGN.md is dit veel ineens. Overweeg de vaste-dagen-rij pas te tonen bij "Wekelijks",
  en het interval-veld te verbergen zodra vaste dagen gekozen zijn (i.p.v. de uitleg-zin "dan vervalt …").
- **"Voor wie" verschilt per modus** — in nieuw-modus een ingeklapte rij met chevron ("Hele huishouden ›",
  `34`), in bewerk-modus een uitgeklapte sectie met chips ("Hele huishouden / Een groep", `32`). DESIGN.md
  schrijft de collapsible-`VisibilityPicker` voor (ingeklapt tenzij afwijkend van "Hele huishouden"). De
  bewerk-modus toont 'm uitgeklapt terwijl de waarde "Hele huishouden" is — dat wijkt af van de regel en
  van de nieuw-modus. Eén gedrag kiezen.
- **Plantfoto-kwaliteit/uitsnede** (`30-planten-s.png`, `31`). "Plant tweee" toont een pixelige/lage-res
  afbeelding en "Palmpje" een foto van een persoon op een dak — duidelijk testdata, maar het laat zien dat
  de kaart geen graceful fallback heeft voor een rare/lage-kwaliteit-foto. Geen actiepunt voor nu, wel iets
  om in het achterhoofd te houden voor de lege/placeholder-staat. ("Plant tweee" met dubbele e is testdata.)

### 2.3 Boodschappen (BOO-14/15/16/17)

**Wat werkt goed.** De feedback-distinctie (BOO-17) is goed gelukt: afvinken geeft een **groene
banner** "✓ Alles afgevinkt! 🎉" + verplaatsing naar sectie "Afgevinkt · 1" (`44-afvink-s.png`),
verwijderen een **donkere undo-toast** "'Koffie' gewist — Ongedaan maken" (`45-delete-feedback-s.png`) —
visueel en in toon duidelijk verschillend, precies principe 6 vs. 7. De zoek-herfocus (BOO-15) werkt: na
keuze blijft het toetsenbord staan en is het veld leeg (`42-na-pick-s.png`); de wis-knop (×, BOO-16) doet
hetzelfde (`41` → `43-na-wis-s.png`). De compacte "Catalogus | Bonnen"-rij (BOO-14 stap 1) is netjes. De
lege staat (`40-boodschappen-s.png`) is warm: winkelwagen-illustratie + "Lijst is leeg / Typ hierboven om
iets toe te voegen."

**Verbeterpunten.**

- **Labelloze rode prullenbak wist álle afgevinkte items zonder bevestiging** (`44-afvink-s.png`). Naast
  "Afgevinkt · 1" staat een rood prullenbak-icoon zonder label. Dat is (a) een icoon-zonder-tekst zonder
  zichtbaar `accessibilityLabel` — tegen DESIGN.md's component-regel; (b) een destructieve bulk-actie
  ("wis alle afgevinkte") die in één tik kan toeslaan. DESIGN.md: "Vernietigende acties (`danger`) vragen
  om bevestiging." Geef 'm minstens een undo-toast (zoals het enkel-verwijderen er al een heeft), liefst
  een korte bevestiging ("3 afgevinkte items wissen?"), en een label ("Afgevinkte items wissen").
- **Catalogus-dropdown: de "voeg toe"-actie is niet ontdekbaar** (`41-zoek-koffie-s.png`). De rij toont
  emoji + "Koffie" + een stepper op **0** (`[− 0 +]`). Het is onduidelijk wat de primaire handeling is:
  tik je op de rijnaam (voegt 1 toe? opent detail?), of moet je eerst `+` tikken? Een stepper op 0 leest
  als "kies eerst een aantal", terwijl de bedoeling "voeg dit item toe" is. De eerdere review prees juist
  de expliciete "+'kaas' toevoegen"-affordance — die helderheid mist hier. Overweeg de rij zelf de
  toevoeg-actie te maken (tik = +1, met de stepper pas zichtbaar ná toevoegen), of een expliciet
  "Toevoegen"-label i.p.v. de kale stepper-op-0.
- **Subtiele dropdown over de lege-staat-illustratie** (`41`). De dropdown "Uit de catalogus" zweeft
  half over de winkelwagen-illustratie, met de illustratie er onscherp doorheen. Op een lege lijst is dat
  visuele ruis; een vollere overlay-achtergrond of het dimmen van de illustratie tijdens het zoeken houdt
  het rustig (principe 4).
- **Sectie-emoji is decoratief klein en kleur-only-achtig** (`42`/`44`). De sectiekop "Dranken" heeft een
  klein groen vlekje/emoji ervoor dat op deze resolutie nauwelijks leesbaar is. Niet kritiek, maar het
  categorie-icoon mag iets groter/duidelijker — DESIGN.md leunt bewust op emoji als talvrij icoon.
- **"Bonnen"-knop zonder context.** In de compacte rij staat "Catalogus | Bonnen" (`40`). "Bonnen" is voor
  een nieuwe gebruiker dubbelzinnig (kortingsbonnen? kassabonnen?). Een woord meer of een tooltip in de
  ⓘ-drawer kan helpen — laag.

## 3. Cross-cutting

1. **Eén-bevestigplek wordt niet overal nageleefd.** De taak-editor schendt 'm in nieuw-modus
   (kop-`Bewaar` + onderknop, `34`), terwijl bewerk-modus (`32`) en de schoonmaak-sheet (`13`) het wél
   goed doen. Dit is hetzelfde patroon-risico dat DESIGN.md expliciet benoemt; het hoort één keer in het
   gedeelde `Editor`-skelet geborgd, niet per scherm.
2. **Primaire-accent-kleur is niet consistent binnen één flow.** Schoonmaak-footer "Rooster opstellen" =
   ocher (`12`), maar de sheet-primaire "Opzetten" = forest (`13`–`16`). Boodschappen-`+` = ocher (`40`),
   plant-FAB = ocher (`30`), maar de taak-editor-onderknop = forest (`34`). Eén regel — "primaire actie =
   X, accent/FAB = ocher" — strakker toepassen voorkomt het raden.
3. **Destructieve acties: niet overal bevestiging/label.** Enkel-verwijderen heeft overal nette undo-
   toasts (`22`, `38`, `45`) — sterk. Maar de bulk-prullenbak in Afgevinkt (`44`) en de labelloze status
   ervan vallen buiten dat patroon. Trek de undo-toast-conventie ook over bulk-/icoon-acties.
4. **Lege/0-staten.** Goed: Boodschappen-lege-staat (`40`) en Taken-lege-staat "Niets in beeld" (`22`).
   Aandacht: de leaderboard-balk op 0 (`10`) leest als laden; de catalogus-stepper op 0 (`41`) leest als
   "kies aantal" i.p.v. "voeg toe". 0 verdient overal een expliciete tekst i.p.v. een lege grafische vorm.
5. **Identieke labels naast elkaar.** Dubbele "Badkamer schoonmaken" / "Toilet schoonmaken" (`10`, `19`)
   waarbij alleen de meta-regel verschilt — een ontdubbeling of een onderscheidende subregel scheelt
   verwarring "heb ik dit dubbel aangemaakt?".
6. **Copy/microcopy.** Overwegend warm en Nederlands (principe 3) — "Lijst is leeg", "Niets in beeld /
   Geen taken deze week", "✓ Alles afgevinkt! 🎉". Verbeterpunten: "Rooster bekijken" belooft een
   weergave die het niet levert (het is een takenfilter); "Bonnen" is dubbelzinnig; de herhaal-uitleg "dan
   vervalt het wekeninterval" (`32`) is technisch jargon i.p.v. huisgenoot-taal.
7. **Touch-targets / a11y.** Overwegend ruim. Aandachtspunten: de ⓘ-knop rechtsboven (`10`, `30`, `40`)
   en de catalogus-stepper-`±`-knoppen ogen aan de krappe kant — meten tegen 48dp (sluit aan op het open
   A11Y-2-punt "44pt-targets nameten"). De ongelabelde rode prullenbak (`44`) is het duidelijkste a11y-gat.

## 4. Prioriteitenlijst

Gesorteerd op ernst (hoog → laag). Moeite: S = klein (copy/token/conditie), M = component-/sheet-werk,
L = herontwerp.

| # | Punt | Screenshot | Ernst | Moeite | Spoor |
|---|------|-----------|-------|--------|-------|
| 1 | Taak-editor nieuw-modus heeft twee bevestigplekken (kop-`Bewaar` + onderknop) — haal de onderknop weg, gelijk aan bewerk-modus | `34-taak-nieuw-s.png` | Hoog | S | Planten |
| 2 | Bulk-prullenbak "Afgevinkt" wist alles zonder bevestiging/undo, ongelabeld icoon | `44-afvink-s.png` | Hoog | M | Boodschappen |
| 3 | Catalogus-dropdown: "voeg toe"-actie niet ontdekbaar (stepper op 0) | `41-zoek-koffie-s.png` | Hoog | M | Boodschappen |
| 4 | Twee concurrerende footerknoppen + primaire-kleur-omkering t.o.v. de sheet (ocher vs. forest) | `12-schoonmaak-bottom-s.png`, `13` | Midden | M | Schoonmaak |
| 5 | "Rooster bekijken" belooft een weergave maar landt op een takenfilter — copy/verwachting | `21-taken-filter-s.png` | Midden | S | Schoonmaak |
| 6 | Herhaling-blok te dicht: interval + vaste dagen + uitleg tegelijk; conditioneel tonen | `32-taak-editor-s.png` | Midden | M | Planten |
| 7 | "Voor wie" verschilt nieuw- vs. bewerk-modus (ingeklapt vs. uitgeklapt bij "Hele huishouden") | `32`, `34` | Midden | S | Planten |
| 8 | Identieke taaknamen naast elkaar (alleen meta verschilt) — ontdubbel of waarschuw | `10`, `19-toilet-zone-s.png` | Midden | M | Schoonmaak |
| 9 | Dropdown zweeft onscherp over de lege-staat-illustratie | `41-zoek-koffie-s.png` | Laag | S | Boodschappen |
| 10 | Leaderboard-balk op 0 leest als laden i.p.v. "nog niets" | `10-schoonmaak-s.png` | Laag | S | Schoonmaak |
| 11 | Touch-targets ⓘ-knop + stepper-`±` tegen 48dp meten | `10`, `41` | Laag | M | Cross |
| 12 | "Bonnen"-label dubbelzinnig | `40-boodschappen-s.png` | Laag | S | Boodschappen |
| 13 | Sectie-emoji "Dranken" klein/onleesbaar op resolutie | `42-na-pick-s.png` | Laag | S | Boodschappen |
| 14 | Herhaal-uitleg jargon ("dan vervalt het wekeninterval") → huisgenoot-taal | `32-taak-editor-s.png` | Laag | S | Planten |
</content>
</invoke>
