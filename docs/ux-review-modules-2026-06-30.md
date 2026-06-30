# UX-review — Voertuigen, Bonnen & Catalogus/producteditor (2026-06-30)

> **Onafhankelijke UX/interactie-review** op basis van device-rooktest-screenshots ronde 2
> (moto g72, dev-client, branch `main`). Drie modules die nog géén UX-review hadden:
> **Voertuigen**, **Bonnen** (kassabonnen) en de **Catalogus + producteditor**. Géén statustracker —
> actuele status leeft in [`huishoek-backlog.md`](../huishoek-backlog.md) §6.
>
> **Lees-instructie.** Dit zijn *statische* screenshots: interactie en navigatie zijn niet
> waarneembaar. Elk punt is daarom getagd **[zeker]** (zichtbaar in beeld) of **[aanname]**
> (vermoeden over de werking — te verifiëren tegen de broncode). Toetsing gebeurt tegen
> [`DESIGN.md`](../DESIGN.md): de zeven principes, het Editor-/knop-/header-contract.

---

## 1. Samenvatting

De drie modules ogen consistent met de huistaal (warme tokens, ronde kaarten, emoji-iconen,
ModalHeader-koppen) en de Bonnen-module volgt het lees-detail → "Bewerken" → editor-patroon van
recepten netjes. Het scherpste UX-knelpunt is **Voertuigen**: een auto openen toont direct de
**editor** (Annuleer · titel · Opslaan) in plaats van een lees-detail met "Aanpassen"-knop, wat
afwijkt van plant/huisdier/recept en het editor-contract uit DESIGN.md doorbreekt. Daarnaast valt
op: de Voertuig-editor mist sectiekoppen (lange, dichte lijst — herhaling van de 2026-06-26-bevinding),
de Bonnen-knoprollen "Splitsen" (oker/primair) vs "Naar voorraad" (secundair) verdienen een check op
of de oker-knop terecht de primaire actie is, en de Catalogus-rij heeft **twee tikdoelen** (naam =
editor, stepper = aantal) zonder zichtbare affordance dat de naam de editor opent. De copy is
overwegend goed Nederlands; enkele microcopy-nits (test-/placeholderdata zoals "Halfvolle melk 10 kgs"
zijn buiten scope). Geprioriteerde lijst onderaan.

---

## 2. Per module

### 2.1 Voertuigen

**Wat goed werkt**
- De lijst (`v01`) is rustig en helder: één auto-kaart met naam, "Renault Clio · 2019",
  gele kenteken-badge `JZP70N`, en "Volgende: vri 25 dec." in `forest`. De gele kenteken-badge
  (de delight uit de vorige ronde) zit er. Oker FAB "+ Voertuig" rechtsonder volgt de
  aanmaak-conventie. **[zeker]**
- De editor (`v02`) heeft een fijne, talvrije RDW-affordance ("Merk en model opgehaald bij de RDW")
  en een sympathieke auto-illustratie met "Rood · Hatchback · APK t/m 13-03-2028" als
  samenvattende meta. **[zeker]**
- De Kosten-kaart (`v03`) is informatie-rijk en eerlijk: groot "€109,86 / maand" met jaarbedrag,
  een uitsplitsing (vaste lasten / onderhoud / afschrijving), geschatte restwaarde, én een
  expliciete uitleg dat afschrijving een schatting is en niet in WieBetaaltWat meerekent. Dat is
  vergevingsgezinde, transparante copy (principe 7). **[zeker]**

**Punten**
- **Auto openen = direct de editor, geen lees-detail.** `v02` toont de kop "Annuleer · Cliootje ·
  Opslaan" — een editor-kop, geen detail-kop. Plant/huisdier/recept tonen eerst een **lees-detail**
  met een "Aanpassen"/"Bewerken"-knop (zie DESIGN.md: "Detailschermen krijgen een `ModalHeader`
  (titel + sluiten)", en de lees/bewerk-splitsing). Voertuigen lijkt die leeslaag over te slaan.
  Risico: (a) inconsistent met de andere modules (principe 5 — voorspelbaar); (b) je landt meteen in
  een bewerkbaar formulier met "Annuleer", wat bij per-ongeluk-tikken op een veld onbedoelde
  wijzigingen + een discard-dialoog uitlokt; (c) de rijke read-only info (kosten, historie) staat nu
  ín de editor i.p.v. een rustig leesscherm. **Vraag te verifiëren: is er een aparte
  `vehicle/[id]`-detailroute, of is de editor het enige detailscherm?** **[aanname — te verifiëren]**
- **Editor mist sectiekoppen.** `v02`/`v03` lopen van Naam → Kenteken → Merk/Model → Bouwjaar/Km →
  illustratie → "Delen met" → "Delen via Samen" → "Prijs per km" → Notities → Kosten → historie
  zonder `SectionHeader`-groepering. Het scherm is lang en dicht; de denkstap-volgorde uit DESIGN.md
  (Wat · Wie · Wanneer · Details · Delen met · Verwijderen) is wel ruwweg gevolgd, maar visuele
  sectie-ankers ontbreken. Dit is exact de 2026-06-26-bevinding (§1.17) — controleer of die
  herstructurering daadwerkelijk is doorgevoerd of nog openstaat. **[zeker]** (de afwezigheid van
  koppen is zichtbaar)
- **"Delen met" vs "Delen via Samen" — twee deel-concepten naast elkaar.** `v02` toont een rij
  "Delen met · Hele huishouden" (met chevron, opent vermoedelijk de VisibilityPicker) én vlák
  eronder een toggle "Delen via Samen" (maakt de auto reserveerbaar/deelbaar in kosten). Twee
  verschillende "delen"-betekenissen met bijna identieke labels, direct boven elkaar — risico op
  begripsverwarring (welke "delen" doet wat?). Overweeg de Samen-toggle een eigen label te geven dat
  niet met "Delen" begint (bijv. "Reserveerbaar via Samen" / "Beschikbaar voor de Samen-module").
  **[zeker]** (beide zichtbaar); **[aanname]** dat het verwarrend werkt.
- **Onderhoudshistorie + log-formulier.** `v03`/`v05`: "Onderhoudshistorie · 1", "+ Onderhoud loggen"
  (opent inline formulier `v05`), "Onderhoudsboekje openen", en één historie-entry "Onderhoud ·
  2026-06-25". Het inline log-formulier (`v05`) is helder en compleet (Wat is er gedaan? / Datum /
  Km-stand / Kosten / Notitie / Foto / "Ook als gedeelde uitgave (WieBetaaltWat)" / "Loggen" als
  forest-primary). Klein punt: de historie-entry toont alleen "Onderhoud" + datum — geen
  beschrijving, km-stand of kosten in de rij, terwijl die wel zijn ingevoerd. Mogelijk een
  lege/0-staat-weergave; **te verifiëren of een ingevulde entry meer toont.** **[aanname — te
  verifiëren]**
- **Drie deels-overlappende knoppen onder elkaar.** `v03` toont "+ Vaste last toevoegen",
  "+ Onderhoud loggen" én "Onderhoudsboekje openen" als drie grijze/secundaire blokken vlak na
  elkaar. Dat is veel gelijkwaardige actie-ruis; de hiërarchie tussen "iets loggen" en "het boekje
  bekijken" is vlak. Overweeg de lees-actie ("Onderhoudsboekje openen") visueel lichter dan de
  toevoeg-acties. **[zeker]**
- **"Voertuig verwijderen" onderaan** (`v03`/`v05`) staat netjes helemaal onderaan, los van de
  bevestiging — conform DESIGN.md. **[zeker]** Goed.

### 2.2 Bonnen (kassabonnen)

**Wat goed werkt**
- De lees/bewerk-splitsing is **wél** correct hier: `b02` is een lees-detail ("Annuleer · APpie ·
  **Bewerken**") en `b03` is de editor ("Bon bewerken · Bewaar"). Dit volgt het recepten-patroon en
  het DESIGN.md-contract netjes — fijne consistentie. **[zeker]**
- De editor (`b03`) heeft een sterke "Scan bon"-affordance bovenaan met uitleg-copy ("Maak een foto
  van de kassabon — we vullen de regels alvast in. Controleer daarna de prijzen."), datum met
  chevron-navigatie, en per regel een gekoppeld product (`≈ Halfvolle melk 10 kgs · gekoppeld`),
  aantal-stepper en eenheid-chips (stuk/pak/kg/g/l/ml). De "≈ ... gekoppeld"-chip is een mooie,
  begrijpelijke koppel-indicator. **[zeker]**
- "Bontotaal (optioneel)" met lopende "Ongeteld: €122,00"-feedback onder het veld is een nette
  controle-affordance (klopt de som?). **[zeker]**

**Punten**
- **Knoprollen op het lees-detail: "Splitsen met het huishouden" (oker/primair) vs "Naar voorraad"
  (secundair).** `b02` zet "Splitsen met het huishouden" als gevulde oker-knop (primair) en "Naar
  voorraad" als secundair grijs. Vraag: is *splitsen* de bedoelde primaire actie van een bon, of is
  *naar voorraad zetten* (de boodschappen daadwerkelijk verwerken) minstens zo belangrijk? Twee
  vrijwel even-zware acties op een leesscherm; DESIGN.md vraagt "één primaire actie per scherm"
  (principe 4). Verifieer of de oker-primary terecht splitsen is. **[zeker]** (de rolverdeling is
  zichtbaar); **[aanname]** dat de keuze discutabel is.
- **Lege-staat / 1-product-formulering.** Lijst `b00` toont "APpie · 19 jun. 2026 · 1 producten ·
  €122,00". "1 **producten**" is een meervoud-fout bij telwoord 1 — moet "1 product" zijn. **[zeker]**
  (copy/microcopy)
- **Bon-detail-kop heet "Annuleer" i.p.v. "Sluiten".** `b02` is een leesscherm (geen bewerkingen),
  maar de linkerkop zegt "Annuleer". Op een puur lees-detail is "Sluiten"/"Klaar" of een kruisje
  logischer dan "Annuleer" (dat suggereert dat je iets ongedaan maakt). DESIGN.md: detailschermen
  krijgen een ModalHeader met "sluiten". **[zeker]**
- **Datum-format inconsistent tussen schermen.** `b00` "19 jun. 2026", `b02` "19 juni 2026", `b03`
  "vrijdag 19 juni". Drie verschillende datumweergaven binnen één flow. Niet fout op zich (lijst vs
  detail vs editor mogen verschillen), maar verifieer of dit bewust is. **[zeker]**

### 2.3 Catalogus + producteditor

**Wat goed werkt**
- De catalogus (`c00`) is scanbaar: zoekbalk, horizontaal scrollende filter-chips (Alles / Eerder
  gekozen / Groente & fruit / …), en rijen met emoji + naam + schap-label + stepper. De sectiekop
  "Eerder gekozen" met klok-icoon helpt oriëntatie. **[zeker]**
- De producteditor (`c01`) volgt het editor-contract (Annuleer · "Product bewerken" · Bewaar), met
  "Foto toevoegen"-tegel, naam, en een overzichtelijk **Schap-keuzegrid** (18 categorieën als chips
  met emoji, "Dranken" geselecteerd in forest). Het grid is rustig, twee koloms, elke chip heeft
  emoji + label (betekenis nooit via kleur alleen — principe 2). **[zeker]**

**Punten**
- **Twee tikdoelen in één rij, zonder ontdekbaarheid.** `c00`: de naam links opent (aanname) de
  producteditor, de stepper rechts regelt het aantal. Er is **geen zichtbare affordance** dat de
  naam tikbaar is en naar de editor leidt — geen chevron, geen onderscheidende stijl. Een gebruiker
  die het aantal wil aanpassen tikt op de stepper; dat de náám iets heel anders doet (editor openen)
  is niet ontdekbaar en kan tot onbedoelde navigatie leiden. Risico: verwarring + mis-tikken
  (principe 1/5). Overweeg een subtiele affordance op het naam-deel (bv. chevron, of de editor via
  een expliciet potlood/lang-indrukken). **[zeker]** dat er geen visuele affordance is; **[aanname]**
  dat naam → editor (gedrag niet zichtbaar in statisch beeld).
- **Stepper toont "0" met actieve `−`.** `c00`: elke rij staat op "0" met zowel `−` als `+`
  zichtbaar. De vorige ronde (2026-06-26 §3b) noteerde dat de Stepper `−` al dimt/deactiveert op 0;
  in deze screenshot oogt de `−` echter niet duidelijk gedimd. Verifieer dat de `−` op 0
  daadwerkelijk gedeactiveerd/gedimd is (anders een no-op tikdoel). **[aanname — te verifiëren]**
- **Schap-grid: 18 categorieën — overzichtelijk maar lang.** `c01` toont het volledige grid in de
  editor; dat is veel keuze in beeld en duwt de velden eronder (standaard-eenheid, emoji-picker) ver
  naar onderen. Voor een editor is een altijd-volledig-uitgeklapt 18-tegel-grid fors. Overweeg of
  het ingeklapt kan met de huidige keuze als samenvatting (vergelijk het Collapsible-patroon). Het
  grid zelf is wél netjes en consistent. **[zeker]**
- **Catalogus-rij: schap-label als enige meta.** Onder elke naam staat alleen de eenheid (pak / bak
  / stuk / kg). Dat is compact en goed; geen punt, ter bevestiging genoemd. **[zeker]**
- **Terug-knop "‹ Boodschappen"** staat als forest-tekst-link linksboven op `c00`/`b00` — consistent
  tussen Catalogus en Bonnen, beide subschermen van Boodschappen. **[zeker]** Goed.

---

## 3. Geprioriteerde punten

| # | Punt | Ernst | Type | Module | Tag |
|---|------|-------|------|--------|-----|
| 1 | Auto openen toont direct de editor (Annuleer/Opslaan) i.p.v. lees-detail + "Aanpassen" — wijkt af van plant/huisdier/recept | hoog | consistentie | Voertuigen | aanname |
| 2 | Twee tikdoelen per catalogus-rij (naam → editor, stepper → aantal) zonder zichtbare affordance op de naam | hoog | UX | Catalogus | aanname |
| 3 | "1 producten" — meervoud-fout bij telwoord 1 (moet "1 product") | midden | copy | Bonnen | zeker |
| 4 | "Splitsen met het huishouden" (oker/primair) vs "Naar voorraad": twee even-zware acties; is splitsen terecht primair? | midden | UX | Bonnen | aanname |
| 5 | Voertuig-editor mist `SectionHeader`-groepering (lang/dicht) — herhaling 2026-06-26 §1.17 | midden | UX | Voertuigen | zeker |
| 6 | "Delen met" (zichtbaarheid) vs "Delen via Samen" (reserveren) — bijna identieke labels boven elkaar | midden | copy/UX | Voertuigen | zeker |
| 7 | Bon-lees-detail-kop heet "Annuleer" i.p.v. "Sluiten" op een puur leesscherm | midden | consistentie | Bonnen | zeker |
| 8 | Schap-grid (18 tegels) altijd volledig uitgeklapt in editor — duwt velden ver omlaag | midden | UX | Catalogus | zeker |
| 9 | Drie deels-overlappende secundaire acties onder elkaar (Vaste last / Onderhoud loggen / Boekje openen) — vlakke hiërarchie | laag | UX | Voertuigen | zeker |
| 10 | Stepper "0" — is `−` daadwerkelijk gedeactiveerd/gedimd op 0? | laag | UX | Catalogus | aanname |
| 11 | Onderhoudshistorie-rij toont alleen "Onderhoud" + datum, geen beschrijving/km/kosten | laag | UX | Voertuigen | aanname |
| 12 | Datum-format verschilt per scherm (19 jun. 2026 / 19 juni 2026 / vrijdag 19 juni) | laag | consistentie | Bonnen | zeker |

---

> **Verificatie-checklist voor de codebase-toetsing.** De [aanname]-punten 1, 2, 4, 10, 11 vragen om
> bron-/gedragscontrole: (1) bestaat er een aparte `vehicle/[id]`-leesdetailroute naast de editor?
> (2) wat doet een tik op de catalogus-productnaam vs de stepper, en is er een affordance? (4) welke
> bon-actie is bedoeld als primair? (10) dimt/deactiveert de `Stepper` `−` op 0? (11) toont een
> ingevulde onderhouds-entry meer dan label + datum? De [zeker]-punten zijn direct uit het beeld af
> te lezen.
