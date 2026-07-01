# Visual-design review — Voertuigen, Bonnen, Catalogus + producteditor (2026-06-30)

Onafhankelijke, puur-visuele review van een batch device-screenshots (moto g72, dev-client,
branch `main`). Scope: visuele hiërarchie, kleur-rolzuiverheid (forest = primair, ocher =
accent), typografie, spacing/uitlijning, kaarten/randen, iconografie/emoji en de rust van het
beeld. Géén interactie/flow-oordeel. Beoordeeld is **wat te zien is**; vermoedens zijn als
[twijfel] getagd. Referentie: `DESIGN.md` (zeven principes, tokens).

---

## 1. Samenvatting

De drie modules zien er over het algemeen **rustig, consistent en op-merk** uit: zandwitte
achtergrond, ronde witte kaarten met zachte schaduw, forest voor koppen en bevestigen, één
duidelijke primaire actie per scherm. De editor-koppen en de FAB-stijl sluiten netjes aan op de
rest van de app. Het beeld ademt en is niet druk.

De belangrijkste visuele aandachtspunten:

1. **Kleur-rolzuiverheid op gevulde knoppen is niet consistent.** Op het bon-detail (`b02`) is
   "Splitsen met het huishouden" een **gevulde ocher** knop — dat trekt het accent-oker naar een
   knop-rol die elders forest of ghost is. Tegelijk is de gevulde primaire knop in de
   onderhoud-log (`v05`, "Loggen") en de FAB op `v01` forest resp. ocher. Er lopen dus drie
   verschillende invullingen van "de gevulde knop" door de drie modules heen.
2. **Inconsistente kop-bevestigingslabels:** "Opslaan" (Voertuigen `v02`/`v03`), "Bewaar"
   (Bonnen-editor `b03`, Producteditor `c01`) en "Bewerken" (bon-detail `b02`, dat is een
   modus-schakelaar, geen bevestiging). Twee woorden voor dezelfde actie.
3. **Twee detail/editor-patronen door elkaar:** Voertuigen opent een voertuig direct als editor
   ("Annuleer · titel · Opslaan"), Bonnen opent eerst een lees-detail ("Annuleer · titel ·
   Bewerken"). Visueel ogen de koppen identiek maar ze betekenen iets anders — dat is een
   subtiele inconsistentie die het beeld iets minder voorspelbaar maakt.
4. De **Kosten-kaart** (`v03`) is sterk maar de uitsplitsingsregels staan visueel wat los van de
   grote kop; de hiërarchie kan strakker.

Niets is alarmerend; dit zijn aanscherpingen binnen een al volwassen, kalm design.

---

## 2. Per module

### Voertuigen (`v01`–`v05`)

**Sterk**
- **Lijst (`v01`):** voorbeeldig kalm. Eén witte kaart met de auto-emoji-illustratie links, naam
  vet (forest-ink), grijze metaregel, oker kenteken-pill als enige accent, chevron rechts, en
  "Volgende: vri 25 dec." in forest. Eén accentkleur, veel witruimte, FAB rechtsonder. Dit is het
  design-systeem zoals bedoeld. [zeker]
- De **oker kenteken-pill** (`JZP70N`) is een mooie, rolzuivere inzet van ocher als highlight —
  precies de accent-rol. [zeker]
- De **auto-illustratie** in de editor (`v02`) is goed van schaal en gecentreerd, met een nette
  meta-regel "Rood · Hatchback · APK t/m 13-03-2028" eronder. Past bij de platte-geometrie
  beeldtaal. [zeker]

**Verbeterpunten**
- **Auto-illustratie wit op zand (`v02`):** de illustratie staat los op de zandwitte achtergrond
  zonder kaart/kader, terwijl de velden eromheen wél in witte kaders zitten. Daardoor "zweeft"
  het beeld een beetje tussen Km-stand en "Delen met". Een lichte kaart of meer verticale
  ademruimte zou het beter verankeren. [twijfel — kan bewuste keuze zijn]
- **Kosten-kaart (`v03`) hiërarchie:** "€109,86 / maand" is groot en sterk, "€1318,32 / jaar"
  eronder is klein en grijs (goed: secundair). Maar de drie uitsplitsingsregels (vaste lasten /
  onderhoud / afschrijving) staan in dezelfde grijstint en grootte als de jaar-regel, direct
  eronder, waardoor het oog geen duidelijke trap ziet: groot bedrag → mini-subtotaal →
  detailregels lopen visueel in elkaar over. Een fractie meer ruimte of een divider tussen het
  kop-bedrag en de detailregels zou de trap verduidelijken. De getallen rechts zijn netjes
  rechts-uitgelijnd — dat is sterk. [zeker]
- **Veel licht-grijze "blok"-knoppen onder elkaar (`v03`):** "+ Vaste last toevoegen",
  "Onderhoud loggen" (omrand), "Onderhoudsboekje openen", "Voertuig verwijderen". Drie tot vier
  brede, zachtgrijze knoppen op een rij geven een wat monotone, grijze strook. Visueel rust het,
  maar het ritme is wat vlak; er is geen enkele primaire affordance zichtbaar in deze sectie —
  alles is even zwaar (ghost). [twijfel — bewuste "rustige sectie", maar oogt grijzig]
- **Log-formulier (`v05`):** netjes ingekaderd wit blok met de velden, en hier is "Loggen" wél een
  **gevulde forest** primaire knop — sterk en duidelijk. De checkbox "Ook als gedeelde uitgave"
  en "Foto toevoegen" (grijze knop met camera-emoji) zijn goed uitgelijnd. Dit scherm heeft de
  beste knop-hiërarchie van de Voertuigen-set. [zeker]

### Bonnen / kassabonnen (`b00`–`b03`)

**Sterk**
- **Bonnenlijst (`b00`):** zeer kalm, consistent met `v01`-patroon. Witte kaart met bon-samenvatting,
  chevron, en de "+ Bon invoeren" als brede grijze (ghost) knop eronder. Veel witruimte. [zeker]
- **Bon-editor (`b03`):** dichtbevolkt maar goed georganiseerd. "Scan bon" bovenaan als brede knop
  met uitlegtekst, dan Winkel/Datum, dan een ingekaderde "Regel 1"-kaart met het **gekoppelde
  product als forest-pill** ("≈ Halfvolle melk 10 kgs · gekoppeld"), stepper, en de eenheid-chips
  (stuk/pak/kg/g/l/ml). De geselecteerde chip "stuk" is forest-gevuld, de rest omrand — nette,
  rolzuivere selectie-stijl. [zeker]

**Verbeterpunten**
- **`b02` — "Splitsen met het huishouden" is een gevulde OCHER knop.** Dit is het scherpste
  kleur-rolpunt van de batch. Volgens `DESIGN.md` is ocher = accent/FAB/highlights en forest =
  primaire knop. Hier draagt ocher een **volle-breedte primaire-ogende actie**, terwijl
  "Naar voorraad" eronder een grijze ghost-knop is. Effect: het oker schreeuwt harder dan past
  bij "één rustig accent", en het concurreert visueel niet met een forest-primair (die is er niet
  op dit scherm). De vraag uit de opdracht — hoort dit ocher of forest? — visueel: als dit de
  primaire actie van het scherm is, hoort het **forest** (consistent met "Loggen" `v05` en de
  bevestig-koppen); ocher is hier overdadig voor een gewone bevestig-actie. Als het bewust een
  "accent-actie" is, dan zou de FAB-logica (ocher = de speciale toevoeg-actie) het kunnen
  rechtvaardigen — maar dan wijkt het af van hoe forest elders de gevulde knop is. **Aanbeveling
  voor de code-check:** leg dit token naast de FAB en naast "Loggen"; mijn visuele lezing is dat
  forest hier consistenter zou zijn. [zeker — observatie; rol-oordeel deels twijfel]
- **`b02` regeltekst dubbel:** "Halfvolle melk 10 kgs" staat als titel én herhaald in de grijze
  metaregel ("1 stuk · Halfvolle melk 10 kgs"). Visueel oogt dat als een herhaling/ruis in een
  verder schone regel. [zeker]
- **`b02` lege ruimte vs. twee knoppen direct onder de eerste regel:** de twee actieknoppen staan
  hoog, direct onder de enige bon-regel, met daaronder een groot leeg vlak. De compositie voelt
  topzwaar; de knoppen zouden lager of de inhoud meer gevuld kunnen ogen. [twijfel — afhankelijk
  van content-hoeveelheid]
- **`b03` "Bontotaal (optioneel)" + "Ongeteld":** onderaan staat "Ongeteld: €122,00" half
  afgekapt; de regel net boven de systeembalk oogt krap. Vermoedelijk scroll-afkap in de
  screenshot, maar de afstand tot de onderrand is minimaal. [twijfel — kan screenshot-crop zijn]

### Catalogus + producteditor (`c00`, `c01`)

**Sterk**
- **Catalogus (`c00`):** heel sterk en kalm. Zoekbalk, filter-chips (de actieve "Alles" is
  forest-gevuld, rest omrand met emoji — rolzuiver en consistent met de eenheid-chips in `b03`),
  en een productlijst met emoji + naam + schap-label + 0-based stepper rechts. De steppers zijn
  uniform witte afgeronde controls; de lijst heeft een rustig, voorspelbaar ritme met dunne
  dividers. [zeker]
- **Consistente chip-taal** tussen Catalogus-filters (`c00`) en bon-editor-eenheden (`b03`):
  zelfde pill-vorm, zelfde forest-gevuld-vs-omrand-selectie. Dat is precies "voorspelbaar". [zeker]

**Verbeterpunten**
- **Producteditor schap-grid (`c01`):** functioneel mooi (emoji + label per categorie, "Dranken"
  forest-geselecteerd), maar het is een **groot, dicht raster van ~17 omrande chips** dat het
  scherm domineert — visueel het drukste vlak van de hele batch. Het botst licht met principe 4
  ("rustig, niet druk"): veel emoji-kleuren (groente-groen, kaas-geel, vlees-rood, snoep-roze
  enz.) naast elkaar geven een bonte indruk. Het is verdedigbaar (één keuze, emoji = talvrij
  icoon), maar het oog krijgt hier weinig rust. Overweeg meer verticale ademruimte tussen de
  rijen of een subtielere chip-achtergrond. [twijfel — bonte indruk is inherent aan emoji-grid]
- **Chip-uitlijning (`c01`):** de chips zijn twee-koloms maar variëren in breedte (tekstlengte),
  waardoor de rechterrand rafelig is en sommige rijen één brede + één smalle chip hebben. Een
  raster met gelijke kolombreedte of links-uitgelijnde flow zou rustiger ogen. [twijfel — flow-layout, lastig hard te beoordelen uit één beeld]
- **"Foto toevoegen"-tegel (`c01`):** de camera-emoji-tegel linksboven is klein-vierkant en grijs;
  consistent met `v05`'s "Foto toevoegen" qua emoji, maar daar is het een brede knop en hier een
  vierkante tegel. Twee vormen voor dezelfde "foto toevoegen"-affordance. [zeker]

---

## 3. Cross-module visuele consistentie

**Sterk / consistent**
- **Schermkoppen:** "Voertuigen", "Bonnen", "Catalogus" delen dezelfde grote vette display-kop in
  ink, met een rustige sub-navigatie ("‹ Boodschappen" in forest op Bonnen/Catalogus) en de ⓘ
  help-knop rechts (`v01`). Consistent en op-merk. [zeker]
- **Kaarten:** witte afgeronde kaarten met zachte schaduw, chevron-rijen, en de zandwitte `bg`
  zijn overal identiek. [zeker]
- **Chips:** filters (`c00`) en eenheden (`b03`) delen exact dezelfde pill-stijl en
  forest-selectie. Sterke visuele rijm. [zeker]
- **FAB vs. inline:** Voertuigen gebruikt de ocher FAB (`v01`); Bonnen/Catalogus gebruiken brede
  "+ ..."-knoppen / het Boodschappen-patroon. Dat is conform `DESIGN.md` (FAB voor lijst-toevoeg,
  uitzondering Boodschappen). Consistent met de regels. [zeker]

**Inconsistent**
- **Bevestigingslabel in de kop:** "Opslaan" (Voertuigen `v02`/`v03`) vs. "Bewaar" (Bonnen `b03`,
  Producteditor `c01`). Zelfde positie (rechtsboven, forest-tekst), twee woorden. Dit valt direct
  op als je tussen modules wisselt. **Aanbeveling:** kies één term app-breed. [zeker]
- **Detail-vs-editor-patroon:** Voertuig opent direct in edit-modus ("Annuleer · titel ·
  Opslaan", `v02`); Bon opent in lees-modus met "Bewerken" rechtsboven (`b02`) en pas dáárna de
  editor ("Bon bewerken · Bewaar", `b03`). De koppen ogen identiek (3-slots) maar de
  rechtsboven-knop betekent twee verschillende dingen (bevestigen vs. modus-wissel). Visueel
  ondermijnt dit "voorspelbaar". [zeker — observatie; of het *moet* uniformeren is UX, buiten scope]
- **Gevulde-knop-rol verschilt per scherm:** forest-gevuld ("Loggen" `v05`, geselecteerde chips),
  ocher-gevuld ("Splitsen met het huishouden" `b02`, FAB), grijs/ghost (de meeste "+ ..."-knoppen).
  Binnen één app zou de gevulde primaire knop bij voorkeur één kleur-rol dragen (forest), met
  ocher gereserveerd voor de FAB/echte accenten. Nu lekt ocher naar een gewone bevestig-knop.
  [zeker — observatie]
- **"Foto toevoegen":** brede grijze knop met camera-emoji (`v05`) vs. vierkante grijze tegel
  (`c01`). Twee vormen voor dezelfde affordance. [zeker]

---

## 4. Geprioriteerde tabel

| # | Punt | Ernst | Element | Screenshot | Tag |
|---|------|-------|---------|------------|-----|
| 1 | "Splitsen met het huishouden" is gevulde **ocher** waar een primaire bevestig-actie eerder **forest** hoort — ocher concurreert als accent | Hoog | Volle-breedte knop | `b02` | [zeker] (rol-oordeel deels [twijfel]) |
| 2 | Bevestigingslabel inconsistent: "Opslaan" vs. "Bewaar" | Midden | Kop rechtsboven | `v02`/`v03` vs `b03`/`c01` | [zeker] |
| 3 | Gevulde-knop-rol lekt (forest/ocher/grijs door elkaar) — geen vaste primaire-kleur | Midden | Diverse knoppen | `v05`,`b02`,`c01` | [zeker] |
| 4 | Detail-vs-editor: identieke kop, andere betekenis rechtsboven (Opslaan vs Bewerken) | Midden | 3-slot kop | `v02` vs `b02` | [zeker] |
| 5 | Kosten-kaart: kop-bedrag en detailregels lopen visueel in elkaar; trap ontbreekt | Midden | Kosten-kaart | `v03` | [zeker] |
| 6 | Producteditor schap-grid bont/druk; botst licht met "rustig, niet druk" | Midden | Schap-keuzeraster | `c01` | [twijfel] |
| 7 | Auto-illustratie zweeft kaderloos tussen velden | Laag | Illustratie | `v02` | [twijfel] |
| 8 | `v03` sectie met 3–4 grijze ghost-knoppen onder elkaar oogt monotoon/vlak | Laag | Knoppenstrook | `v03` | [twijfel] |
| 9 | "Foto toevoegen" twee verschillende vormen (brede knop vs. vierkante tegel) | Laag | Foto-affordance | `v05` vs `c01` | [zeker] |
| 10 | Bon-regel herhaalt de productnaam (titel + metaregel) | Laag | Bon-regel | `b02` | [zeker] |
| 11 | Chip-grid rechterrand rafelig (ongelijke chipbreedtes) | Laag | Schap-grid | `c01` | [twijfel] |
| 12 | "Ongeteld: €122,00" krap tegen onderrand | Laag | Bontotaal-regel | `b03` | [twijfel — mogelijk crop] |

---

*Opmerking voor de vervolgstap: de kleur-claims (#1, #3) zijn het waard om naast de theme-tokens
te leggen — concreet of "Splitsen met het huishouden" daadwerkelijk `ocher`/`ocherSoft` gebruikt
en of de FAB hetzelfde token deelt; en of "Opslaan"/"Bewaar" uit één `ModalHeader`-component komen
(dan is het label-fix één plek). De screenshots zijn statisch; oker-vs-forest is duidelijk genoeg
om niet aan compressie te wijten, maar exacte tinten horen tegen de tokens geverifieerd.*
