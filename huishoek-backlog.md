# Huishoek — Productbacklog & Moduledenken

Dit document is het **waarom/overzicht** van Huishoek: de fundamentele
architectuurkeuze (zichtbaarheid via subgroepen), de modules met passende
ondersteuning, en de actieve, gefaseerde backlog. Het is bewust kort gehouden —
afgerond werk en build-historie staan elders, zodat de actieve lijst scanbaar blijft.

**Verwante documenten**
- [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md) — afgeronde items (✅) met volledige notities.
- [`huishoek-voortgang.md`](huishoek-voortgang.md) — chronologisch logboek van wat wanneer is gebouwd.
- [`huishoek-specs-fase1.md`](huishoek-specs-fase1.md) — de spec + genomen keuzes van Fase 1 (het *hoe*).
- [`docs/plans/`](docs/plans/00-overzicht.md) — build-ready, direct-implementeerbare plannen per ronde.
- Naslag (how-to): `README.md`, `DESIGN.md`, `VERIFICATIE.md`, `docs/*-setup.md`.

> **Status (laatst herzien: 2026-06-22).** Fase 0, 1 en 1.5 zijn af; Fase 2 grotendeels
> gebouwd (boodschappen-intelligentie, keuken-loop, kosten/autodelen, notificaties,
> de Vandaag-widgetgrid en het taken-redesign). De actuele open/te-verifiëren punten
> staan in de tabel (§6); het volledige chronologische verloop in
> [`huishoek-voortgang.md`](huishoek-voortgang.md).

---

## 1. De kernkeuze: modules, subgroepen en zichtbaarheid

Je beschrijft drie dingen die makkelijk door elkaar lopen, maar het zijn aparte assen:

- **Module** = *wat voor soort werk*: klussen, boodschappen, planten, schoonmaak, aankopen, agenda, kosten.
- **Subgroep** = *wie het mag zien/doen*: het hele huishouden, alleen de ouders, "ik", of een ad-hoc groepje zoals "papa + Tim (voetbal)".
- **Kosten/autodeel** = een laag die *over* modules heen ligt en aan items en gebeurtenissen geld koppelt.

De schaalbare keuze is om **zichtbaarheid een eigenschap van elk item te maken, niet van
de module**. Een boodschappenlijst is een item in module *boodschappen* dat zichtbaar is
voor subgroep *gezin*; Tims voetbaltraining is een item in module *agenda* dat zichtbaar
is voor subgroep *ouders + Tim*. Zo hoef je nooit een aparte app of een apart huishouden
te maken voor "de ouders" — je maakt een subgroep en koppelt items eraan.

```
Huishouden "Familie de Vries"
│
├── Subgroepen
│   ├── 👨‍👩‍👧‍👦 Iedereen        (default — alle leden)
│   ├── 👩‍❤️‍👨 Ouders          (alleen volwassenen)
│   ├── ⚽ Voetbal Tim       (papa, mama, Tim)
│   └── 🔒 Privé–Erik        (alleen Erik)
│
└── Items dragen één zichtbaarheid:
    ├── 🛒 Boodschappenlijst  → zichtbaar voor: Iedereen
    ├── 📅 Voetbaltraining    → zichtbaar voor: Voetbal Tim
    ├── 🛠️ Schuur opruimen     → zichtbaar voor: Ouders
    └── 🎁 Cadeau voor mama    → zichtbaar voor: Ouders (papa)
```

**Waarom dit beter is dan losse huishoudens:** kinderen zien hun eigen agenda en taken
zonder de ruis (en gevoeligheden) van de ouders; ouders houden één overzicht. Eén
verjaardagscadeau-lijst blijft buiten het zicht van degene voor wie het bedoeld is. En
het autodeel-/kostenstuk kan over subgroepen heen werken (zie module Kosten).

**Datamodel-impact (bovenop het bestaande schema):**
- nieuwe tabel `subgroups` (per huishouden) en `subgroup_members`
- kolom `visibility_subgroup_id` op `tasks`, `groceries`, en de nieuwe moduletabellen
- de Row Level Security wordt uitgebreid: lid van het huishouden **én** lid van de
  subgroep waaraan het item hangt (of het item hangt aan "Iedereen")

Dit is item **FND-1** in de backlog en is een *blocker* voor de subgroep-afhankelijke
delen van de andere modules. De modules werken ook zónder subgroepen (alles = Iedereen),
dus je kunt subgroepen gefaseerd invoeren.

---

## 2. Modules en hun ondersteuning

Elke module heeft een eigen "slimme" laag die hem onderscheidt van een platte lijst.
Hieronder per module: het doel, de basisfunctie, en de verrijking die jij beschreef.

### 🛠️ Klussen
Eenmalige en terugkerende taken in en rond huis. *Dit is grotendeels af* (vorige sessie).
Verrijking voor later:
- **Klus-bibliotheek** met veelvoorkomende klussen + standaard-interval (cv-druk checken,
  rookmelder testen, dakgoot, ontkalken) zodat je ze met één tik toevoegt.
- **Seizoenssuggesties**: in oktober "tuinslang aftappen", in maart "zonnescherm nalopen".
- **Toewijzing met beurtrotatie**: een terugkerende klus die automatisch rouleert tussen
  leden, zodat niet steeds dezelfde persoon "de gewonnene" is.

### 🛒 Boodschappen — met bonnetjes-scan & prijstracker
Basis (gedeelde realtime lijst) is af. De verrijking is het meest ambitieuze onderdeel:
- **Bonnetje scannen** → foto van de kassabon, OCR haalt regels (product, aantal, prijs)
  eruit. Dit vult een **aankoophistorie** per huishouden.
- **Prijstracker**: per product de prijs over tijd, en per supermarkt. "Melk: €1,19 bij
  AH, €1,09 bij Jumbo, trend ↑ 8% dit kwartaal."
- **Supermarktvergelijking**: voor je standaard-mandje schat de app de totaalprijs per
  winkel op basis van je eigen historie.
- **Aankoopfrequentie leren**: de app merkt dat je ~elke 5 dagen melk koopt en stelt
  voor het op de lijst te zetten voordat het op is. Begint als simpele "je koopt dit
  meestal rond nu"-suggestie, geen zware voorspelling.

> **Realistische aanpak voor de scan.** Bonnetjes-OCR is lastig: elke keten heeft een
> andere bonopmaak. Drie groeitrappen, oplopend in kwaliteit en kosten:
> 1. **Foto + handmatig bevestigen** — OCR doet een voorzet, gebruiker corrigeert. Direct
>    bruikbaar, leert meteen je correcties.
> 2. **Per-keten parsers** voor de grote drie/vier (AH, Jumbo, Lidl, Plus) waar het
>    bonformaat redelijk stabiel is.
> 3. **AI-extractie** (multimodaal model) dat een bon naar gestructureerde regels omzet,
>    met de bevestigingsstap als vangnet.
>
> Begin bij trap 1 — die levert al de prijstracker en frequentie-data op. Productmatching
> ("Halfvolle melk 1L" = "AH Halfvolle melk") is het echte werk; los dat op met een
> genormaliseerde productcatalogus per huishouden voordat je ketens gaat vergelijken.

### 🪴 Planten — met foto, soort & verzorgingsschema op maat
Een eigen module, want planten hebben een heel andere ritmiek dan klussen.
- **Plant toevoegen**: foto maken, naam geven, locatie (woonkamer/balkon), en de
  **plantsoort** kiezen uit een lijst (later: AI herkent de soort uit de foto).
- **Verzorgingsschema op maat**: op basis van soort + locatie + seizoen genereert de app
  een water- en voedingsschema (bijv. "water elke 5 dagen, in winter elke 10; voeding
  1× per maand maart–september"). Dit komt terug als terugkerende taken in de plant-module.
- **Verzorgingskaart** per plant: licht, water, voeding, hervpotten, veelvoorkomende
  problemen (gele blaadjes = te veel water).
- **Plant-tijdlijn**: foto's én losse notities over tijd zodat je groei en gezondheid
  ziet (één verticale rail per plant). Een **cross-plant tijdlijn** (alle planten door
  elkaar, nieuwste eerst) is een logisch sub-overzicht — zie PLA-8.

> **Realistische aanpak.** Begin met een **soortdatabase met verzorgingsregels** (een paar
> honderd populaire kamer- en tuinplanten dekken het meeste). Het schema is dan
> regelgebaseerd, niet AI — betrouwbaar en uitlegbaar. AI-soortherkennig uit foto is een
> aparte, latere stap (eigen model of een plant-ID API); de handmatige soortkeuze blijft
> altijd als terugval bestaan.

### 🧹 Schoonmaak
Lijkt op klussen maar verdient een eigen ritme-laag:
- **Kamer-/zonegericht**: per ruimte een set terugkerende taken (badkamer wekelijks,
  ramen per kwartaal).
- **Schoonmaakrooster** dat je in één keer opzet ("standaard weekschema") i.p.v. taak
  voor taak.
- **Beurtverdeling** over leden, met een licht "eerlijkheids"-overzicht: wie deed hoeveel.
- Deelt de terugkeer- en toewijzingslogica met Klussen (DRY), maar met eigen weergave.

### 🛍️ Grote aankopen — gezamenlijk onderzoek & besluit
Voor de "we denken na over een nieuwe wasmachine/auto/bank"-situaties.
- **Aankoop-dossier** per overweging: titel, budgetrange, deadline, wie beslist mee.
- **Opties verzamelen**: kandidaten met prijs, link, foto, en losse **overwegingen**
  (voor/tegen) die elk lid kan toevoegen.
- **Vergelijktabel**: opties naast elkaar op de criteria die er voor jullie toe doen.
- **Stemmen/voorkeur** per lid, zodat een gezin samen tot een keuze komt zonder eindeloze
  appjes.
- **Beslissing vastleggen**: gekozen optie + waarom, als naslag.
- Later: prijswijziging-signalering voor een gevolgde optie.

### 📅 Agenda (impliciet nodig voor "afspraken" + subgroepen)
Je voorbeeld (voetbaltraining van het ene kind niet in de agenda van het ander) vraagt om
een agenda-laag die per subgroep filtert. Afspraken bestaan al als taakcategorie; de
verrijking is een echte **kalenderweergave** met subgroep-filter en eventueel sync naar
de telefoon-agenda. Dit is de natuurlijke plek waar subgroepen het meest zichtbaar worden.

### 🚗 Voertuigen — auto-onderhoud & kosten plannen
Een eigen module voor het onderhoud van de auto('s) van het huishouden. Leunt op dezelfde
infrastructuur als Planten en Huisdieren (een eigen domeintabel + verzorgings-/onderhoudstemplates
die terugkerende `tasks` aanmaken) en op de Kosten-laag (§3) voor het geld.
- **Voertuig toevoegen**: merk/model, bouwjaar, kenteken en km-stand; later meerdere voertuigen.
- **Kenteken → auto-type (RDW)**: voor een auto vul je alleen het **kenteken** in; de app haalt
  merk, handelsbenaming/model en voertuigsoort op uit de **open data van de RDW** en vult het
  auto-type voor je in (handmatig overschrijven blijft kunnen).
- **Onderhoud plannen**: een onderhoudsschema uit een sjabloon (APK, grote/kleine beurt, olie
  verversen, banden wisselen zomer/winter, distributieriem) dat — net als bij huisdieren —
  als voor-aangevinkte checklist terugkerende taken aanmaakt. Plannen kan op **datum** én op
  **km-stand** ("volgende beurt over 15.000 km").
- **Kosten plannen & bijhouden**: per onderhoudsbeurt een verwachte en een werkelijke prijs,
  zodat je een jaarbegroting voor de auto ziet. Gerealiseerde kosten koppelen aan
  **WieBetaaltWat** (§3) zodat ze meelopen in de saldo's — een natuurlijke uitbreiding van
  het autodeel-/kostenstuk.
- **Onderhoudshistorie** per voertuig: een tijdlijn van uitgevoerd onderhoud met datum,
  km-stand, kosten en een losse notitie (hergebruikt het log-patroon van `pet_log`).
- **Inbrengen in de Samen/Delen-module**: een voertuig kan tegelijk een **gedeelde resource** worden
  in de bestaande Delen-module (reserveringskalender + kosten-naar-gebruik, AUT-1/2). Voor **auto's is
  dit de default** — een nieuwe auto staat meteen klaar om te reserveren en samen te bekostigen,
  bovenop het onderhoud.

> **Aanpak — bouwvolgorde.** Begin regelgebaseerd, net als de huisdier-routines: een handvol
> onderhoudssjablonen in code (`lib/vehicleCare.js`), betrouwbaar en uitlegbaar. Bouw eerst het
> voertuig + onderhoudsschema (VTG-1), daarna de kosten-/historielaag bovenop WieBetaaltWat (VTG-2),
> de RDW-lookup (VTG-3) en het delen via de Samen-module (VTG-4). Hergebruik overal bestaande,
> beproefde lagen — `tasks`-recurrence, `create_expense`, `shared_resources` — i.p.v. parallelle logica.
>
> **Robuustheid & stabiliteit.** De **RDW-lookup is een verrijking, geen vereiste**: hij draait
> niet-blokkerend (debounced, met timeout) en valt bij een trage/onbereikbare RDW, geen internet of
> een onbekend kenteken stil terug op handmatige invoer — een auto opslaan kan altijd zónder lookup.
> Het kenteken wordt eerst lokaal genormaliseerd en gevalideerd (geen call bij evident ongeldige
> invoer) en het resultaat wordt op het voertuig **gecachet** (één call per kenteken, fair-use richting
> de RDW; kenteken alleen binnen het huishouden opgeslagen, niet gelogd). Het **delen** gebeurt
> **idempotent en transactioneel**: voertuig + gekoppelde `shared_resources`-rij in één RPC, met een
> unieke 1-op-1 `resource_id`, zodat opnieuw opslaan nooit dubbele resources maakt; de gedeelde
> resource erft de zichtbaarheid (subgroep/RLS) van het voertuig. Verwijderen waarschuwt bij **actieve
> reserveringen** en ruimt de koppeling netjes op (geen wees-resources).
>
> **Gebruiksgemak.** Voor een auto vul je in de praktijk alleen het kenteken in (de rest wordt
> ingevuld en blijft overschrijfbaar) en staat delen meteen aan — met één duidelijke schakelaar om dat
> uit te zetten. Onderhoud, reserveringen en kosten hangen aan hetzelfde voertuig en zijn over en weer
> deeplinkbaar. Km-gebaseerd plannen vraagt periodiek een km-stand-update; houd dat licht (een prompt,
> geen sensor) en degradeer naar datum-only zolang er (nog) geen km-stand bekend is.

---

## 3. 💶 Kosten & informeel autodelen (WieBetaaltWat)

Dit wordt een laag bovenop de modules, niet een losse module — want kosten ontstaan
*in* modules (een boodschap, een grote aankoop, een gedeelde tankbeurt).

**WieBetaaltWat-kern:**
- **Uitgaven** met bedrag, betaler, en deelnemers (wie deelt mee in de kosten).
- **Splitsing**: gelijk, op aandeel, of exact bedrag per persoon.
- **Saldo-overzicht**: wie staat rood/groen t.o.v. wie, met "vereffen"-suggesties die het
  aantal onderlinge betalingen minimaliseren.
- **Subgroep-scoping**: een uitgave hoort bij een subgroep (de ouders verrekenen
  onderling; de kinderen zien dat niet).

**Informeel autodelen — een toepassing van dezelfde laag:**
- Een **gedeeld item "auto"** (of boormachine, aanhanger) met een eenvoudige
  **reserveringskalender**: wie gebruikt 'm wanneer.
- **Gebruik koppelen aan kosten**: kilometers of tankbeurten worden uitgaven die volgens
  gebruik worden gesplitst. "Erik reed 120 km, tankbeurt €80 → naar rato verdeeld."
- Werkt binnen een huishouden én — later — tussen bevriende huishoudens via een gedeelde
  subgroep, zodat het echt "informeel autodelen met de buren" wordt.

> **Volgorde:** bouw eerst WieBetaaltWat zelfstandig (uitgaven + splitsen + saldo). Het
> autodeel-concept is dan "gedeeld item + reservering + uitgave-koppeling" erbovenop, en
> levert weinig extra datamodel op. Zo heb je snel waarde en groeit het autodelen er
> organisch uit.

---

## 4. Voorgestelde roadmap

De fasering volgt afhankelijkheid en waarde-per-inspanning, niet de volgorde waarin je de
ideeën noemde.

**Fase 0 — Fundament (blokkeert de rest) — ✅ AF**
Subgroepen + zichtbaarheid (FND-1), de module-architectuur zodat nieuwe modules
"inpluggen" (FND-2), en module-toggles per huishouden/gebruiker (FND-4). Gebouwd; hierna
kan alles parallel. (FND-3, kinderprofielen, is nog open — zie §5.)

**Fase 1 — Snelle, zelfstandige waarde — ✅ AF (op live-verificatie na)**
Agenda (AGE-1), Schoonmaak-rooster (SCH-1/2), WieBetaaltWat-basis (KOS-1/2) en de
Planten-module met handmatige soortkeuze + regelgebaseerd schema (PLA-1 t/m PLA-4, plus
plantendagboek PLA-5). Alles gebouwd met groene units. **Open:** migraties pushen + RLS-tests
tegen live Supabase (INF-1, zie `VERIFICATIE.md`).

**Fase 1.5 — Strak & af — ⏳ VOLGENDE**
Geen nieuwe features, maar de bestaande app van "kaal" naar "strak". Vijf thema's
(STR-1 t/m STR-11): informatie-architectuur & navigatie (één bron `tasks`, expliciete
weergaven voor Agenda/Schoonmaak), component-cohesie (mid-tier schermen consequent uit
`lib/ui.js` + tokens), interactie-feel (optimistic UI, haptics, toast + ongedaan-maken),
helderheid van bediening (zichtbare item-acties i.p.v. verborgen long-press, inline
validatie) en empty states + beweging. Geen migratie; leunt volledig op het bestaande
design-systeem. Build-ready in [`docs/plans/07`](docs/plans/07-strakke-app.md).

**Fase 2 — De ambitieuze data-features — ⏳ DAARNA**
Boodschappen-bonnetjes (trap 1→2) met productcatalogus + prijstracker (BOO-2/3/5),
Grote-aankopen-dossiers (AAN-1 t/m AAN-4),
kosten-koppeling aan modules (KOS-3) en de autodeel-basis (AUT-1/2). Hier komt ook de
**Voertuigen-module** (auto-onderhoud + kosten plannen, RDW-kenteken & delen via de Samen-module, VTG-1 t/m 4) en de eigen-diersoort-uitbreiding
op Huisdieren (HUI-2). Hier zit het meeste
bouwwerk; lever in trappen op. **Al af:** KLU-2 klus-bibliotheek, KLU-3 seizoenssuggesties,
PLA-7 plantfoto-cover (no-migratie-voorlopers), de **Huisdieren-module** (HUI-1, migr. 0038),
en — via plan 01 (migratie 0012) — beurtrotatie/eerlijkheid (KLU-4, SCH-3) op een nieuwe voltooiingen-log.

**Fase 3 — Slim & verbonden — ⏳ LATER**
AI-soortherkenning planten (PLA-6), AI-bonextractie (BOO-7), supermarktvergelijking (BOO-4)
op je eigen mandje, frequentie-voorspelling (BOO-8), agenda-device-sync (AGE-2) en autodelen
tussen bevriende huishoudens (AUT-3). Hier hoort ook de **in-app camera in eigen stijl** (UX-7,
kader/overlay/feedback) met daarbovenop de **bulk-plantvastlegging** (PLA-9, "plant-rondje":
rollende camera → naam → notitie → volgende, details achteraf afmaken).

De canonieke statustabel in §6 bevat per item: module, feature, fase, prioriteit (MoSCoW),
een ruwe inspanningsschatting (T-shirt), status en een korte notitie over de aanpak.

---

## 5. Open vragen om later te beslissen

Deze hoeven nu niet beantwoord, maar bepalen wel de uitwerking:

- **Kinderaccounts** (→ FND-3): krijgen kinderen een eigen login, of zijn het "profielen
  zonder account" onder een ouder? Dit raakt privacy én de subgroep-beveiliging.
- **Bonnetjes-bron** (→ BOO-2/6/7): alleen fotoscan, of ook digitale bonnen
  (e-mail/AH-app-koppeling)? Digitaal is veel betrouwbaarder dan OCR als de bron beschikbaar is.
- **Autodelen-vertrouwen** (→ AUT-3): blijft het binnen het huishouden, of moet het écht
  tussen aparte huishoudens werken? Dat laatste vraagt een uitnodig-/vertrouwensmodel tussen
  huishoudens dat verder gaat dan de huidige invite-code.

---

## 6. Backlog-status (canoniek)

> **Single source of truth voor actieve status.** Deze tabel is de énige plek voor de
> status van **lopend en open werk** (⏳ Open / 🔧 Te verifiëren / ◐ Deels). Maak géén losse
> `handover`-/`vervolgplan`-/status-docs. **Spelregels tegen dichtslibben:**
> - Verplaats een item naar [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md)
>   zódra het ✅ Gereed is (mét zijn volledige notitie) — houd deze tabel bij de actieve items.
> - Zet build-historie ("gebouwd op datum X, migratie Y live") in
>   [`huishoek-voortgang.md`](huishoek-voortgang.md) of `docs/plans/*`, niet in de notitie-kolom.
> - Houd de notitie kort: de essentie + waar een uitgewerkt plan bestaat een link naar `docs/plans/NN-*.md`.
> - Een idee zonder rij hoort in §7; zodra het "echt" wordt, krijgt het hier een rij.
>
> Eenmalige analyses (`docs/audit-*.md`) en `docs/plans/*` zijn historische onderbouwing, geen status.
> Verificatie van RLS/RPC's zonder secrets: `docs/rls-connector-check.sql`.

Statuslegenda: **🔧 Te verifiëren** (gebouwd, nog te valideren tegen live Supabase) ·
**⏳ Open** (nog te bouwen) · **◐ Deels** (datalaag af, rest device-gated). Afgeronde
items (**✅**) staan in [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).
Inspanning is een T-shirt-maat (S/M/L).

| ID | Module | Feature | Fase | Prio | Insp. | Status | Afh. | Notitie |
|----|--------|---------|------|------|-------|--------|------|---------|
| FND-3 | Fundament | Kinderprofielen | 0 | Should | M | ⏳ | FND-1 | Open vraag (§5). Begin evt. met 'profiel zonder account' onder een ouder. |
| BOO-4 | Boodschappen | Supermarktvergelijking | 3 | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | 3 | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie (foto → regels) | 3 | Could | L | 🔧 | BOO-2 | **Gebouwd.** "Scan bon" → Edge Function `scan-receipt` → Orq.ai vision → JSON → bewerkbare editor (vangnet). **Rest (jouw account):** Orq-deployment + secrets + deploy — zie [`docs/orq-receipt-scan.md`](docs/orq-receipt-scan.md). |
| BOO-11 | Boodschappen | Vaste boodschappen (snel toevoegen uit je repertoire) | 2 | Should | M | 🔧 | BOO-5 | **Gebouwd.** "Vaste boodschappen"-sheet: eigen `products` per schap, gesorteerd op gebruik/recency, één-tik toevoegen; "Meest gekozen" + subtiel verbergen. `lib/favoriteGroceries.js`, migr. `0029`/`0030`. **Rest:** rendering/realtime op toestel bevestigen. |
| BOO-9 | Boodschappen | Barcode scannen → catalogus | 2 | Should | M | ◐ | BOO-5, VOO-1 | **Datalaag af; scanner-UI device-gated.** `lib/barcode.js`/`openFoodFacts.js`/`barcodeLookup.js` + RPC `insert_catalog_product` (migr. `0027`/`0031`). **Rest (dev build):** `expo-camera`-scannerscherm + scan-knop op Boodschappen/Voorraad. |
| BOO-10 | Boodschappen | Bonnen bewerkbaar maken | 2 | Could | M | 🔧 | BOO-2 | **Gebouwd.** `update_purchase`-RPC (migr. `0033`) + "Bewerken"-knop opent de bon in dezelfde editor. **Rest:** bewerken op toestel bevestigen. |
| PLA-6 | Planten | AI-soortherkenning | 3 | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-9 | Planten | Bulk planten toevoegen ("plant-rondje" met rollende camera) | 3 | Could | L | ⏳ | PLA-1, UX-7 | **Idee (gebruikerswens):** in één doorlopende camera-flow plant ná plant vastleggen (foto + naam + evt. notitie), details achteraf afmaken; elke plant direct persisteren via `addPlant`. Leunt op UX-7 (in-app camera, `CaptureSession`-primitief). Vereist dev build; geen migratie. |
| HUI-1 | Huisdieren | Huisdier-verzorging (module) | 2 | Should | L | 🔧 | — | **Gebouwd (migr. `0038`, live).** Nieuwe module die de plant-infra hergebruikt maar een eigen domein heeft: `pets`/`pet_log` + private bucket `pets`. Verzorgingsroutines per diersoort in `lib/petCare.js` (8 diertypen) → voor-aangevinkte checklist die `tasks` (category `huisdier` + `pet_id`) aanmaakt; tijdlijn met foto/notitie/**gewicht**; cross-pet tijdlijn. `lib/usePets.js`/`petPhoto.js`, `app/(tabs)/huisdieren.js` + `app/pet/*`. **Rest:** foto kiezen/uploaden, checklist-flow, tijdlijn + gewicht-log + realtime op toestel bevestigen. |
| HUI-2 | Huisdieren | Eigen diersoort toevoegen | 2 | Should | S | ⏳ | HUI-1 | **Idee (gebruikerswens):** zelf een ander dier benoemen i.p.v. alleen de vaste 8 typen. Nu vangt `type: 'anders'` (`lib/petCare.js`) de rest met de generieke 🐾-routine; uitbreiden naar een vrij **soort-label** (+ eigen emoji) dat de gebruiker invoert. Soortlabel opslaan op `pets` (lichte migratie: kolom `species_label`, of hergebruik een vrij veld) en tonen i.p.v. "Anders"; verzorgingschecklist valt terug op de `anders`-templates (handmatig bij te schaven). Soortkiezer in `app/pet/[id].js` krijgt een "Anders, namelijk…"-optie. **Robuust:** additief (bestaande `anders`-dieren blijven werken), label getrimd + lengte-gevalideerd, emoji optioneel met 🐾-fallback. |
| VTG-1 | Voertuigen | Voertuig + onderhoudsschema (module) | 2 | Should | M | ⏳ | — | **Idee (gebruikerswens): nieuwe module, auto-onderhoud.** Hergebruikt de plant-/huisdier-infra: nieuwe tabel `vehicles` (merk/model, bouwjaar, kenteken, km-stand) + onderhoudssjablonen in `lib/vehicleCare.js` (APK, grote/kleine beurt, olie, banden zomer/winter, distributieriem) → voor-aangevinkte checklist die terugkerende `tasks` (category `voertuig` + `vehicle_id`) aanmaakt. Plannen op **datum** én **km-stand**. `app/(tabs)/voertuigen.js` + `app/vehicle/*`. Migratie nodig. |
| VTG-2 | Voertuigen | Onderhoud plannen: kosten & historie | 2 | Should | M | ⏳ | VTG-1, KOS-1 | **Idee (gebruikerswens):** per onderhoudsbeurt een **verwachte** en **werkelijke** prijs → jaarbegroting per auto. Gerealiseerde kosten koppelen aan **WieBetaaltWat** (KOS-1) zodat ze meelopen in de saldo's. Onderhoudshistorie als tijdlijn (datum, km-stand, kosten, notitie) via een `vehicle_log` naar `pet_log`-patroon. |
| VTG-3 | Voertuigen | Kenteken → auto-type via RDW | 2 | Should | S | ⏳ | VTG-1 | **Idee (gebruikerswens):** bij een auto alleen het **kenteken** invoeren; de app haalt merk, handelsbenaming/model en voertuigsoort op via de **RDW open data** (dataset *Gekentekende voertuigen*, `opendata.rdw.nl`, geen auth) en vult het auto-type automatisch in. Lookup in `lib/rdw.js` (kenteken normaliseren + resultaat cachen op `vehicles`); handmatig overschrijven blijft mogelijk. **Niet-blokkerend** (debounced + timeout); offline/onbekend kenteken → stille fallback naar handmatige invoer. Web/native `fetch`; geen migratie naast VTG-1. |
| VTG-4 | Voertuigen | Voertuig delen via de Samen/Delen-module (auto = default) | 2 | Should | M | ⏳ | VTG-1, AUT-1 | **Idee (gebruikerswens):** een aangemaakt voertuig tegelijk een **gedeelde resource** maken in de bestaande Delen-module (`shared_resources` kind `auto` + `reservations` + kosten-naar-gebruik, AUT-1/2). Voor **auto's default aan**: bij aanmaken meteen een gekoppelde `shared_resources`-rij. Koppeling via `resource_id` op `vehicles` zodat onderhoud én reserveren/bekostigen op hetzelfde voertuig hangen. **Robuust:** idempotente/transactionele koppeling (geen dubbele resources), erft zichtbaarheid/RLS van het voertuig, waarschuwt bij actieve reserveringen vóór verwijderen. Migratie nodig. |
| AAN-1 | Grote aankopen | Aankoop-dossier | 2 | Should | M | ⏳ | FND-1 | Titel, budgetrange, deadline, wie beslist mee. Subgroep-gescoped. |
| AAN-2 | Grote aankopen | Opties verzamelen | 2 | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. |
| AAN-3 | Grote aankopen | Vergelijktabel | 2 | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | 2 | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing bewaren. |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | 3 | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-2 | Agenda | Sync met telefoon-agenda | 3 | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | 3 | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| MLT-3 | Maaltijden | Recept-foto | 2 | Could | S | 🔧 | MLT-2 | **Gebouwd.** Omslagfoto in de recept-editor; bucket `recipes` + RLS (migr. `0034`), gedeelde `lib/photoPicker.js`/`photoStorage.js`. **Rest:** kiezen/uploaden/tonen op toestel bevestigen. |
| VOO-2 | Voorraad | Voorraad vullen via barcode | 2 | Could | S | ⏳ | BOO-9, VOO-1 | Scan-resultaat van BOO-9 ook direct als voorraad-item toevoegen (naast op de lijst). Deelt de scan-flow; alleen een extra bestemming. |
| PLT-1 | Platform | Notificaties & herinneringen | 2 | Should | M | 🔧 | — | **Plan 05.** Trap 1 (lokaal) werkt; trap 2 (remote `notify` Edge Function) productie-klaar, migr. `0018`/`0023` live. **Rest = flip-on:** secret zetten, `functions deploy notify`, Database Webhook op `tasks`, 2-account-test — zie [`docs/notify-setup.md`](docs/notify-setup.md). |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | 2 | Could | M | 🔧 | — | **Gebouwd.** Feed afgeleid uit `task_completions` (geen migratie): `lib/activity.js` + `app/(tabs)/activiteit.js` + Thuis-kaart; identieke acties samengevouwen. **Rest:** realtime bijwerken bevestigen. **Bekend:** taakhernoeming ververst de feed-titel niet realtime. |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | 3 | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | **Doel:** eigen camerascherm (`expo-camera`/`CameraView`) met kader/overlay/feedback i.p.v. de native camera; gedeeld asset-formaat `{uri,base64,ext}`. Deelt camerafundament met BOO-9; generiek `CaptureSession`-primitief voor batch (PLA-9). Vereist dev build. |
| INF-1 | Platform | Live-Supabase-verificatie + RLS-tests | 1 | Must | S | 🔧 | — | **Alle migraties `0001`–`0036` live** (geverifieerd via `list_migrations`, 2026-06-22). Kern-RLS/RPC's bewezen via `docs/rls-connector-check.sql` (13/13). Units 296 (18 RLS-integratietests skippen lokaal zonder secrets). **Rest:** volledige JS-RLS-suite mét secrets + 2-account-rooktest (`VERIFICATIE.md` Stap 3). |
| INF-3 | Platform | E2E-tests (Maestro) | 2 | Should | M | 🔧 | — | **Scaffolds gebouwd (plan 08).** Maestro (lichte YAML); 3 kritieke flows in `.maestro/` (taak toevoegen+afvinken, uitgave splitsen, boodschap+undo). **Rest:** kalibreren tegen een draaiende build. |
| INF-4 | Platform | Foutrapportage/monitoring (Sentry) | 2 | Should | S | 🔧 | — | **Gewired (plan 08).** `@sentry/react-native` + config-plugin; `lib/monitoring.js` (env-gated, no-op zonder DSN) + app-brede `lib/ErrorBoundary.js`. **Rest:** DSN + een build om echte rapportage te verifiëren. |
| INF-5 | Platform | Release-pijplijn (EAS) | 2 | Should | M | 🔧 | — | **Config gestaged (plan 08).** `eas.json` (dev/preview/prod, APK→AAB, submit `internal`) + `expo-dev-client` + `docs/eas-setup.md`. **Rest:** `eas login`/`init`, secrets, eerste build + Play-submit (wacht op Play-account). |
| STR-4 | Platform/UX | Ontbrekende gedeelde componenten | 1.5 | Should | S | 🔧 | — | **Gedeelde componenten af:** `AvatarSelect`/`EmojiPicker`/`ListSkeleton`/`Editor`/`Collapsible`/`DateStepper` (`lib/ui.js`); PhotoPicker geëxtraheerd (`lib/photoPicker.js`/`photoStorage.js`). **Rest:** bestaande plant-/bon-pickers nog migreren naar de gedeelde helpers (low-risk). |
| STR-10 | Platform/UX | Empty states + illustraties | 1.5 | Should | M | 🔧 | — | **Eigen illustratie-systeem** `lib/illustrations.js` (themeable, 8 scènes) via `illustration`-prop op `Empty`, gewired op alle hoofdtabs. **Rest:** laatste 6 scènes visueel nalopen. |
| INF-8 | Platform | Realtime-primitief & scoping | 1.5 | Should | M | 🔧 | — | **Af (C1–C4).** `lib/useRealtimeReload.js` (C1) + household-gefilterde subscripties (C2, migr. `0025`) + incrementeel patchen `lib/realtimePatch.js` (C3) + gebundelde household-channel `lib/realtimeHub.js` (C4). **Rest:** patch + gebundelde subscriptie 2-richtingen op toestel bevestigen. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | 2 | Should | S | 🔧 | — | **Gebouwd + gedeployed.** Per-gebruiker rate-limit (20/uur) via `record_receipt_scan`-RPC + `receipt_scans` (migr. `0026`) vóór de Orq-call + MIME-whitelist. **Rest:** happy-path (echte foto → Orq) op toestel bevestigen. |
| INF-10 | Platform | DB-advisor-hardening | 1.5 | Could | S | 🔧 | — | **B4 af** (vaste `search_path`, migr. `0024`). **Open (advisor 2026-06-22):** B5 `pg_trgm` uit `public`, B6 leaked-password-protection aan, + `EXECUTE` op SECURITY DEFINER-functies voor `anon` strakker. (3× `rls_enabled_no_policy` = bewust deny-all, geen lek.) |
| PERF-1 | Platform | Query-vensters & bulk-RPC | 2 | Could | M | 🔧 | INF-8 | **Aggregaat-RPC af (migr. `0037`, live).** `household_expense_totals`/`household_completion_totals` (SECURITY INVOKER → RLS scopet de payload). Kosten-saldo en schoonmaak-eerlijkheid (all-time) rekenen exact zodra het `.limit(2000)`-venster vol is, anders ongewijzigd. **Rest:** P-H4 bulk-RPC bon→voorraad. |
| PERF-2 | Platform/UX | Waargenomen snelheid: instant tab-wissel (geen laad-flits) | 2 | Should | M | 🔧 | INF-8 | **Gebouwd.** Instant tab-wissel via in-memory SWR-cache `lib/dataCache.js` (household-gescopet, `clearCache()` op sign-out) — alle hooks seeden uit cache — + `freezeOnBlur` op de Tabs. Verweven met INF-8 C3. **Rest:** soepelheid op web/toestel bevestigen. |
| TKN-2 | Taken/UX | Jaarweergave — activiteit-heatmap | 3 | Could | M | 🔧 | TKN-1 | **Gebouwd (activiteit-heatmap).** Jaar-scope van Taken: GitHub-achtig voltooiingen-raster uit `task_completions` (geen migratie) — `lib/yearHeatmap.js` + `YearHeatmap.js`/`YearActivity.js` (lazy realtime, lid-/categoriefilter). **Rest:** rendering + scroll + realtime op web/toestel bevestigen. |
| UX-9 | Platform/UX | Eigen lettertype verkennen (weg van het systeemfont/Inter) | 2 | Could | S | ⏳ | UX-1 | **Verkenning:** een eigen, leesbaar **variable font** (Inter bewust niet) — centraal via `expo-font` + `fontFamily` op de `type`-tokens in `lib/theme.js`. Eisen: Latin-Extended (NL-diacrieten), prettige cijfers, OFL. Kandidaten naast elkaar op toestel testen; keuze in `DESIGN.md`. |
| UX-12 | Platform/UX | Back vanuit een via-"Meer"-geopende tab gaat naar Home i.p.v. Meer | 1.5 | Should | S | 🔧 | UX-2 | **Gebouwd.** `backBehavior="history"` op de Tabs: Android-back keert naar de vórige tab. **Rest:** op Android-toestel (hardware-back + gebaar) + web verifiëren; anders de stack-push-variant (UX-10). |
| UX-13 | Platform/UX | Flexibele avatars: foto-upload + zelf-gebouwde avatar (personen én huishouden) | 2 | Should | M | ⏳ | UX-1, STR-4 | **Idee (gebruikerswens):** avatar van enkel emoji → keuze **emoji/foto/zelfgebouwde avatar**, voor leden én huishouden. Generieke descriptor (`kind: emoji\|photo\|builder`), nieuwe `avatars`-bucket + RLS, `Avatar`-component als switch. Builder via lokaal-gevendorde of zelf-getekende SVG (`react-native-svg`/`lib/illustrations.js`), geen runtime-dependency. Migratie nodig. |
| UX-14 | Platform/UX | Dark-mode: donkere titels & pill-teksten leesbaar maken | 1.5 | Should | S | ⏳ | — | **Bug (gebruikerswens):** in donker thema blijven diverse **titels** en **teksten in pills/chips/badges** donker → te laag contrast. Oorzaak = hardcoded hex of fg-kleuren die niet op rendertijd uit de dark-tokens komen (`darkColors` in `lib/theme.js`); ook `*Soft`-tint-bg's (Badge) tegen een donkere fg nalopen. **Aanpak:** audit alle pill-achtige componenten (`Chip`/`Badge` in `lib/ui.js` + categorie-/status-labels) en sectie-titels op tokengebruik (`colors.ink`/`inkSoft`), verwijder vaste kleuren, check AA-contrast. Sluit aan op `DESIGN.md` en de toegankelijkheids-audit (PLT-5). Borg met een token-/contrast-check tegen regressie. |

---

## 7. Nieuwe suggesties (brainstorm)

Een brede brainstorm voor volgende rondes: ideeën die nog **géén rij in §6 hebben**.
Voorgestelde ID's reserveren ruimte; zodra een idee "echt" wordt, krijgt het een rij in
§6 (en verdwijnt hier). Gegroepeerd naar afstand/aard.

### 7.1 Bestaande modules verdiepen
- **Agenda: losse afspraken zonder taak-overhead** (AGE-3) — nu is elke afspraak een `tasks`-rij;
  overweeg een lichtere "event"-flow voor puur-agenda-items (begin/eindtijd, geen afvinken).

### 7.2 Cross-cutting platform
- **Offline-modus / volledige optimistic UI** (PLT-2) — acties direct tonen, sync op de achtergrond
  (optimistic UI deels al via STR-7; de volledige offline-modus blijft hier als latere uitbreiding).
- **Globaal zoeken** (PLT-3) — over taken/boodschappen/planten/uitgaven heen.
- **Data-export & print** (PLT-4) — boodschappenlijst/saldo als CSV of deelbare tekst.
- **Toegankelijkheids-audit** (PLT-5) — systematisch nalopen + smoke-test met VoiceOver/TalkBack
  (48dp-targets, contrast AA, font-scaling; sluit aan op `DESIGN.md` en STR-3/STR-4).

### 7.3 Nieuwe module-ideeën
- **Documenten- & garantiekluis** (DOC-1) — bonnetjes/handleidingen/garanties/contracten per item;
  herinnering bij aflopende garantie. Hergebruikt het Storage-patroon van Planten.
- **Gezamenlijke wensen-/cadeaulijst** (WEN-1) — verlanglijst per lid; subgroep-privacy zorgt dat
  de ontvanger zijn eigen cadeau niet ziet (precies het scenario uit §1).

### 7.4 Slim & verbonden (Fase 3, AI/extern)
- De "slimme" eindfase staat grotendeels al in §6: PLA-6 (AI-soortherkenning), BOO-7
  (AI-bonextractie), BOO-4 (supermarktvergelijking), AUT-3 (autodelen tussen huishoudens).
- **AI-assistent over je eigen data** (AI-1) — natuurlijke-taalvragen ("wat gaf ik deze maand aan
  boodschappen uit?", "welke plant heeft water nodig?") bovenop de bestaande tabellen. Geparkeerd.

> De volledige uitwerking van de afgeronde epics **Vandaag-widgetgrid** (VDG) en
> **Taken-redesign** (TKN) staat in [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).
