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

> **Status (laatst herzien: 2026-06-25).** Fase 0, 1 en 1.5 zijn af; Fase 1.6 quick wins
> (UX-15 t/m UX-20) af incl. herbruikbaar `SwipeRow`-veegprimitief (PR #37, op toestel
> geverifieerd) — de teardown-sessies (UXR-1..8) zijn de resterende 1.6-stap. Fase 2
> grotendeels gebouwd (boodschappen-intelligentie, keuken-loop, kosten/autodelen,
> notificaties, de Vandaag-widgetgrid en het taken-redesign). **Nieuw (2026-06-24/25):** drie
> multi-agent-doorlichtingen — performance ([plan 16](docs/plans/16-performance-audit.md)),
> security ([plan 17](docs/plans/17-security-remediatie.md)) en UX/a11y/correctheid ([plan 18](docs/plans/18-ux-verbeterplan.md))
> — zijn geconsolideerd in §6 (PERF-3…9, SEC-1…7, A11Y-1/2, UX-43/44, INF-11); **SEC-1**
> (owner-escalatie) is kritiek en hoort vóór nieuw feature-werk. De keuken-/boodschappen-redesign-ronde
> ([plan 15](docs/plans/15-keuken-boodschappen-widgets.md), branch `feat/boodschappen-redesign`) is op
> toestel geverifieerd (2026-06-25, moto via USB): `npm test` + mutatie-ratchet + lint groen en de
> niet-veeg-flows bevestigd (categorie-schappen, instant 0-based stepper, sluitende zoek-dropdown,
> Keuken-omgeving zonder 7-dagen-strip-crash, widget-grid); veeg-gebaren door Erik zelf. Zie het
> verificatie-blok in plan 15. De actuele open/te-verifiëren
> punten staan in de tabel (§6); het volledige chronologische verloop in
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

**Fase 1.6 — Modules van half naar af (UX-diepgang) — ◐ DEELS (quick wins af)**
Geen nieuwe features en geen migratie: we ontleden de *bestaande* modules scherm voor
scherm, beslissing voor beslissing en flow voor flow, en dichten de "halve" randen.
Waar Fase 1.5 de app *visueel cohesief* maakte (tokens/componenten/feel), gaat deze ronde
over de **interactie-laag**: ontbrekende states (laden/leeg/fout), data die je niet kunt
bedienen, inconsistente verwijder-/bulk-acties en onduidelijke beslismomenten. Twee sporen:
voor-de-hand-liggende quick wins (UX-15 t/m UX-20) en verkennende, gezamenlijke
module-teardowns (UXR-1 t/m UXR-8) die zelf weer concrete §6-rijen opleveren. De lens en
werkwijze staan build-ready in [`docs/plans/14`](docs/plans/14-ux-module-teardown.md).

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

**Security-hardening (los van de fasen) — ⏳ DO-NOW voor de kritieke twee.**
De security-doorlichting ([`docs/plans/17`](docs/plans/17-security-remediatie.md)) levert SEC-1 t/m SEC-7.
**SEC-1** (owner-escalatie — een kritieke tenant-isolatiefout) en **SEC-2** (anon `run_recurring_expenses`)
horen **vóór** nieuw feature-werk; de rest loopt mee in Fase 2. M1/L4/L5 vallen onder INF-10, L1 onder INF-9;
M3 (gedeeld bewerken van uitgaven/aankopen) is een **bewuste keuze** — zie §5.

De canonieke statustabel in §6 bevat per item: module, feature, baan (Now/Next/Later),
prioriteit (MoSCoW), een ruwe inspanningsschatting (T-shirt), status en een korte notitie
over de aanpak.

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
- **Gedeeld bewerken van uitgaven/aankopen** (→ security-M3): **beslist (2026-06-25) — ja, bewust.**
  Iedereen in het huishouden mag een uitgave/aankoop aanpassen (gedeelde administratie);
  `update_expense`/`update_purchase` krijgen géén creator-check. Vastgelegd in [`docs/plans/17`](docs/plans/17-security-remediatie.md).

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
>   Verwijs naar het plan i.p.v. het hier te herhalen — géén mini-plannen in een cel.
> - Een idee zonder rij hoort in §7; zodra het "echt" wordt, krijgt het hier een rij.
> - **Baan = wanneer je het oppakt** (`Now` / `Next` / `Later`), niet de oude fase-as. Het
>   fase-/roadmapverhaal staat in §4; de tabel sorteert op wat nú telt.
> - **Verificatie-ratchet — cap op 🔧.** `🔧 Te verifiëren` is geen eindstation: staan er
>   **meer dan ~10** items op 🔧, draai dan eerst een toestel-verificatie-batch (de gebundelde
>   checklist in [`VERIFICATIE.md`](VERIFICATIE.md) → "Te-verifiëren-batch") vóór nieuw bouwwerk.
>   Een 🔧 dat op toestel is bevestigd → ✅ → archief. *(De teller staat nu ruim boven de cap →
>   de eerstvolgende device-sessie is een verificatie-batch, geen nieuw bouwwerk.)*
>
> Eenmalige analyses (`docs/audit-*.md`) en `docs/plans/*` zijn historische onderbouwing, geen status.
> Verificatie van RLS/RPC's zonder secrets: `docs/rls-connector-check.sql`.

Statuslegenda: **🔧 Te verifiëren** (gebouwd, nog te valideren tegen live Supabase) ·
**⏳ Open** (nog te bouwen) · **◐ Deels** (datalaag af, rest device-gated). Afgeronde
items (**✅**) staan in [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).
**Baan**: `Now` (actief/do-now) · `Next` (eerstvolgende golf) · `Later` (lange staart —
Fase 3 / nieuwe modules / verkennend). Inspanning is een T-shirt-maat (S/M/L).

| ID | Module | Feature | Baan | Prio | Insp. | Status | Afh. | Notitie |
|----|--------|---------|------|------|-------|--------|------|---------|
| FND-3 | Fundament | Kinderprofielen | Later | Should | M | ⏳ | FND-1 | Open vraag (§5): eigen login of 'profiel zonder account' onder een ouder. Raakt privacy + subgroep-beveiliging. |
| BOO-4 | Boodschappen | Supermarktvergelijking | Later | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | Later | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie (foto → regels) | Later | Could | L | 🔧 | BOO-2 | **Gebouwd** (`scan-receipt` → Orq vision → bewerkbare editor). **Rest (jouw account):** Orq-deploy + secrets — [`docs/orq-receipt-scan.md`](docs/orq-receipt-scan.md). |
| BOO-11 | Boodschappen | Vaste boodschappen (snel toevoegen uit je repertoire) | Next | Should | M | 🔧 | BOO-5 | **Gebouwd** (`lib/favoriteGroceries.js`, migr. `0029`/`0030`): eigen `products` per schap, één-tik toevoegen, "Meest gekozen". **Rest:** rendering/realtime op toestel. |
| BOO-9 | Boodschappen | Barcode scannen → catalogus | Next | Should | M | ◐ | BOO-5, VOO-1 | **Datalaag af; scanner-UI device-gated** (`lib/barcode.js`/`openFoodFacts.js`, RPC `insert_catalog_product`, migr. `0027`/`0031`). **Rest (dev build):** `expo-camera`-scanner + scan-knop. |
| BOO-10 | Boodschappen | Bonnen bewerkbaar maken | Next | Could | M | 🔧 | BOO-2 | **Gebouwd** (`update_purchase`-RPC, migr. `0033`): "Bewerken" opent de bon in de editor. **Rest:** op toestel. |
| PLA-6 | Planten | AI-soortherkenning | Later | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-9 | Planten | Bulk planten toevoegen ("plant-rondje" met rollende camera) | Later | Could | L | ⏳ | PLA-1, UX-7 | **Idee:** doorlopende camera-flow plant ná plant (foto+naam+notitie), elk direct `addPlant`. Leunt op UX-7 (`CaptureSession`). Dev build; geen migratie. |
| HUI-1 | Huisdieren | Huisdier-verzorging (module) | Next | Should | L | 🔧 | — | **Gebouwd (migr. `0038`, live):** `pets`/`pet_log` + bucket; `lib/petCare.js` (8 typen) → checklist die `tasks` (cat. `huisdier`) aanmaakt; tijdlijn+gewicht. **Rest:** foto/checklist/tijdlijn/realtime op toestel. |
| HUI-2 | Huisdieren | Eigen diersoort toevoegen | Later | Should | S | ⏳ | HUI-1 | **Idee:** vrij soort-label (+emoji) i.p.v. de vaste 8; `type:'anders'` blijft fallback. Lichte migratie (`species_label`), additief. Soortkiezer in `app/pet/[id].js` → "Anders, namelijk…". |
| VTG-1 | Voertuigen | Voertuig + onderhoudsschema (module) | Later | Should | M | ⏳ | — | **Nieuwe module, auto-onderhoud (zie §2):** `vehicles` + `lib/vehicleCare.js`-sjablonen → checklist-`tasks` (cat. `voertuig`). Plannen op datum én km. Migratie nodig. |
| VTG-2 | Voertuigen | Onderhoud plannen: kosten & historie | Later | Should | M | ⏳ | VTG-1, KOS-1 | Per beurt verwacht/werkelijk → jaarbegroting; kosten → WieBetaaltWat (KOS-1); historie via `vehicle_log` (`pet_log`-patroon). Zie §2. |
| VTG-3 | Voertuigen | Kenteken → auto-type via RDW | Later | Should | S | ⏳ | VTG-1 | Kenteken → merk/model via RDW open data (`lib/rdw.js`, normaliseren+cachen). Niet-blokkerend, stille fallback. Zie §2. |
| VTG-4 | Voertuigen | Voertuig delen via de Samen/Delen-module (auto = default) | Later | Should | M | ⏳ | VTG-1, AUT-1 | Voertuig = gedeelde resource (`shared_resources` kind `auto`), default aan; idempotente koppeling via `resource_id`. Zie §2. Migratie nodig. |
| AAN-1 | Grote aankopen | Aankoop-dossier | Later | Should | M | ⏳ | FND-1 | Titel/budget/deadline/beslissers, subgroep-gescoped. Plan [`03`](docs/plans/03-grote-aankopen.md). **Bewust uitgesteld.** |
| AAN-2 | Grote aankopen | Opties verzamelen | Later | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-3 | Grote aankopen | Vergelijktabel | Later | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | Later | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | Later | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-2 | Agenda | Sync met telefoon-agenda | Later | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | Later | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| MLT-3 | Maaltijden | Recept-foto | Next | Could | S | 🔧 | MLT-2 | **Gebouwd** (bucket `recipes`+RLS, migr. `0034`; gedeelde `lib/photoPicker.js`). **Rest:** kiezen/uploaden/tonen op toestel. |
| VOO-2 | Voorraad | Voorraad vullen via barcode | Later | Could | S | ⏳ | BOO-9, VOO-1 | Scan-resultaat van BOO-9 ook als voorraad-item. Deelt de scan-flow; extra bestemming. |
| PLT-1 | Platform | Notificaties & herinneringen | Next | Should | M | 🔧 | — | **Plan [`05`](docs/plans/05-notificaties.md).** Trap 1 lokaal werkt; trap 2 remote `notify` productie-klaar (migr. `0018`/`0023` live). **Rest = flip-on** (secret, deploy, webhook, 2-account) — [`docs/notify-setup.md`](docs/notify-setup.md). **Gate: SEC-5.** |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | Next | Could | M | 🔧 | — | **Gebouwd** (`lib/activity.js`+`activiteit.js`, geen migratie). **Rest:** realtime bevestigen. **Bekend:** hernoeming ververst feed-titel niet realtime. |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | Later | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | **Doel:** eigen camerascherm (`expo-camera`) + generiek `CaptureSession`-primitief (deelt met BOO-9, batch PLA-9). Dev build. |
| INF-1 | Platform | Live-Supabase-verificatie + RLS-tests | Now | Must | S | 🔧 | — | Migraties `0001`–`0036` live; kern-RLS 13/13 (`docs/rls-connector-check.sql`); suite 599 (578 pass/21 skip). **JS-RLS mét secrets live nu 21/21 groen** — de auth-rate-limit die ~3 flows liet omvallen is opgelost via **INF-12** (2026-06-25, 2× back-to-back bevestigd). SEC-ronde breidt de suite uit (SEC-1/SEC-4) + refactort naar `create_household`. **Rest:** 2-account-rooktest (`VERIFICATIE.md`). |
| INF-3 | Platform | E2E-tests (Maestro) | Next | Should | M | 🔧 | — | **Scaffolds** (plan [`08`](docs/plans/08-professioneel-hardening.md)): 3 flows in `.maestro/`. **Rest:** kalibreren tegen een build. |
| INF-4 | Platform | Foutrapportage/monitoring (Sentry) | Next | Should | S | 🔧 | — | **Gewired** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `lib/monitoring.js` env-gated + `ErrorBoundary`. **Rest:** DSN + build. |
| INF-5 | Platform | Release-pijplijn (EAS) | Next | Should | M | 🔧 | — | **Config gestaged** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `eas.json` + `docs/eas-setup.md`. **Rest:** `eas init`, secrets, eerste build (wacht op Play-account). |
| STR-10 | Platform/UX | Empty states + illustraties | Next | Should | M | 🔧 | — | **Eigen `lib/illustrations.js`** (8 scènes) op alle hoofdtabs. **Rest:** laatste 6 scènes nalopen. |
| INF-8 | Platform | Realtime-primitief & scoping | Next | Should | M | 🔧 | — | **Af (C1–C4):** `useRealtimeReload`+household-filter (migr. `0025`)+`realtimePatch`+`realtimeHub`. **Rest:** patch+gebundelde subscriptie op toestel. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | Next | Should | S | 🔧 | — | **Gebouwd+gedeployed:** per-gebruiker rate-limit (migr. `0026`)+MIME-whitelist. **Open (L1, [plan 17](docs/plans/17-security-remediatie.md)):** rate-limit fail-open → fail-closed + Orq-kostencap. **Rest:** happy-path op toestel. |
| INF-10 | Platform | DB-advisor-hardening | Next | Could | S | 🔧 | — | B4 af (migr. `0024`); **M1 GEBOUWD+LIVE** (migr. `0042`–`0044`: anon/PUBLIC-EXECUTE ingetrokken op user-facing DEFINER-RPC's, `authenticated` + RLS-helpers behouden). **Open:** B5 pg_trgm uit `public`, B6 leaked-password (dashboard). [plan 17](docs/plans/17-security-remediatie.md). |
| INF-11 | Platform | Mutatie-baseline voor 5 nieuwe modules | Next | Could | S | 🔧 | — | **Opgelost in de werkboom (2026-06-25):** 5 modules chirurgisch aan `mutation-baseline.json` (total 3040/3556 = 85.5 %); bewust géén `--update`. **Rest:** committen. [plan 18](docs/plans/18-ux-verbeterplan.md). |
| SEC-1 | Security | Tenant-isolatie: owner-escalatie dichten | Now | Must | M | 🔧 | — | **GEBOUWD+LIVE (migr. `0041`):** `create_household`-RPC (atomair) + `revoke insert on household_members`; `createHousehold`→RPC; RLS-tests+grant-checks live groen. **Rest:** 2-account device-rooktest. K1, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-2 | Security | `run_recurring_expenses` afschermen (anon) | Now | Must | S | 🔧 | — | **GEBOUWD+LIVE (migr. `0042`):** `revoke execute … from public, anon, authenticated`; live geverifieerd (alleen cron/service_role). H1, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-3 | Security | Sessie-token in SecureStore i.p.v. AsyncStorage | Next | Should | M | 🔧 | INF-5 | **GEBOUWD (code+units):** `lib/secureStorage.js` (expo-secure-store + chunking) + `lib/supabase.js` op native, eenmalige migratie van de oude AsyncStorage-sessie. **Rest:** device-verificatie (token weg uit RKStorage). H2, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-4 | Security | `households_update` → owner-only | Now | Should | S | 🔧 | — | **GEBOUWD+LIVE (migr. `0041`):** `using/with check (is_owner(id))`; RLS-test live groen (lid kan naam/invite_code niet wijzigen). M2, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-5 | Security | `notify`-payload valideren vóór deploy | Next | Should | S | 🔧 | PLT-1 | **GEBOUWD (code+units, ratchet 80,2%):** `notify/core.js` recipientId-guard + `clampBody`; titel al server-side getemplatet. **Gate op PLT-1-deploy.** M4, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-6 | Security | Service-role-key uit de app-`.env` | Next | Should | S | ⏳ | — | Handmatige hygiëne (sleutel nodig voor live RLS-tests, staat in gitignored `.env`): uit de app-`.env` halen, ad-hoc in de shell injecteren, periodiek roteren (SECURITY.md). M5, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-7 | Security | Supply-chain & CI-hygiëne | Next | Could | S | ◐ | — | **L3 GEBOUWD:** SSRF-allowlist in `refresh-off-delta.mjs`. **L2 uitgesteld:** 14 moderate (build-time Expo, 0 high) → meenemen bij de volgende SDK-bump. [plan 17](docs/plans/17-security-remediatie.md). |
| PERF-1 | Platform | Query-vensters & bulk-RPC | Next | Could | M | 🔧 | INF-8 | **Aggregaat-RPC af (migr. `0037`, live):** `household_*_totals` (SECURITY INVOKER → RLS scopet). **Rest:** P-H4 bulk-RPC bon→voorraad. |
| PERF-2 | Platform/UX | Waargenomen snelheid: instant tab-wissel (geen laad-flits) | Next | Should | M | 🔧 | INF-8 | **Gebouwd** (in-memory SWR-cache `lib/dataCache.js` + `freezeOnBlur`). **Toestel bevestigd (2026-06-25, moto).** **Rest:** soepelheid op web. |
| PERF-3 | Platform/perf | Bundle: phosphor per-icoon importeren (i.p.v. barrel) | Next | Should | S | ⏳ | — | Grootste bundle-/startup-win ([plan 16](docs/plans/16-performance-audit.md)): [`lib/icons.js:34`](lib/icons.js#L34) bundelt alle ~756 iconen voor ~57 gebruikte (geen tree-shaking). **Fix:** per-icoon subpath-import; `MAP` identiek. Meet bundle vóór/na. |
| PERF-4 | Platform/perf | Render hot-path: TaskRow + Home-widgets memoïseren | Next | Should | M | ⏳ | — | [plan 16](docs/plans/16-performance-audit.md) + UX-D1/D4: `TaskRow`/Home-widgets niet gememoiseerd → elke afvink hertekent alle rijen. **Fix:** kopieer het `GroceryRow`-patroon; stabiliseer `useMealPlan`-datum. D5 bewust niet. |
| PERF-5 | Platform/perf | Voorraad "plaats"-modus terug onder virtualisatie | Next | Should | S | ⏳ | — | [plan 16](docs/plans/16-performance-audit.md) (2 agents): [`voorraad.js:146`](app/(tabs)/voorraad.js#L146) rendert de hele voorraad in `ListHeaderComponent` → niets gevirtualiseerd. **Fix:** `SectionList` + `React.memo`-rij. |
| PERF-6 | Platform/perf | Fuzzy-match & catalogus-zoek: per-keystroke normalisatie hoisten | Next | Should | M | ⏳ | — | [plan 16](docs/plans/16-performance-audit.md): `matchFor`+`similarity`+`searchCatalog` her-normaliseren per keystroke. **Fix:** `useMemo`, query 1× normaliseren, `CATALOG_NORM` voorbouwen. Pure → ratchet groen. |
| PERF-7 | Platform/perf | Foto's resizen bij upload + expo-image-cache | Next | Should | M | ⏳ | — | [plan 16](docs/plans/16-performance-audit.md): [`photoPicker.js:10`](lib/photoPicker.js#L10) schaalt pixels niet → decode-hitches/OOM in fotorijke lijsten. **Fix:** `expo-image-manipulator` →1280px + `expo-image`-cache. |
| PERF-8 | Platform/perf | Datalaag: query-vensters + koopfrequentie-RPC + reminder-hookstorm | Next | Should | M | ⏳ | INF-8, PERF-1 | [plan 16](docs/plans/16-performance-audit.md): `useProductFrequencies` ongelimiteerd/ongeïndexeerd → RPC+index; `usePurchases`-venster; reminder-hookstorm → `useTasksForReminders`+debounce. Bouw 2→3→1. Deels migratie. |
| PERF-9 | Platform/perf | Virtualisatie-tuning op de SwipeRow-lijsten | Next | Could | S | ⏳ | — | [plan 18](docs/plans/18-ux-verbeterplan.md) D3: alleen `catalog.js` zet `initialNumToRender`/`windowSize`/… → kopieer die afstelling naar boodschappen/taken/kosten. |
| TKN-2 | Taken/UX | Jaarweergave — activiteit-heatmap | Next | Could | M | 🔧 | TKN-1 | **Gebouwd** (heatmap uit `task_completions`, geen migratie). **Rest:** rendering/scroll/realtime op web/toestel. **Perf ([plan 16](docs/plans/16-performance-audit.md)):** jankt het → render als één `<Svg>` met `<Rect>`-cellen. |
| UX-9 | Platform/UX | Eigen lettertype verkennen (weg van het systeemfont/Inter) | Later | Could | S | ⏳ | UX-1 | Verkenning: variable font (geen Inter) via `expo-font` op de `type`-tokens. Latin-Extended, OFL. Keuze in `DESIGN.md`. |
| UX-12 | Platform/UX | Back vanuit een via-"Meer"-geopende tab gaat naar Home i.p.v. Meer | Next | Should | S | 🔧 | UX-2 | **Gebouwd** (`backBehavior="history"`). **Rest:** Android-back (hardware+gebaar)+web; anders stack-push (UX-10). |
| UX-13 | Platform/UX | Flexibele avatars: foto-upload + zelf-gebouwde avatar (personen én huishouden) | Later | Should | M | ⏳ | UX-1, STR-4 | **Idee:** avatar emoji→foto/zelfgebouwd, leden+huishouden. `kind: emoji\|photo\|builder`, `avatars`-bucket+RLS, `Avatar`-switch; builder via `react-native-svg`. Migratie nodig. |
| UX-23 | Platform/UX | Veeg-acties op de Vandaag-focus-taken | Next | Could | S | ⏳ | UX-17 | Bevinding UXR-1: focus-taken (`vandaag.js`) missen de `SwipeRow`-veegacties van de Taken-tab → wrap in `SwipeRow`. Kruisref UX-43. |
| UX-24 | Platform/UX | Laad-skeleton op het Thuis-dashboard | Next | Could | S | ⏳ | UX-15 | Bevinding UXR-1: koud laden van `vandaag.js` toont alleen hero+spinner → lichte skeleton/placeholder-tegels. |
| UX-22 | Platform/UX | Drawers/sheets: nooit onder het toetsenbord + drie sluit-routes | Next | Should | M | ⏳ | UX-5 | **Contract voor élke sheet:** (a) inhoud schuift omhoog bij invoer; (b) sluitbaar via veeg-omlaag, backdrop-tik én kruisje. **Werk:** losse `Modal`s (o.a. `delen.js`) → gedeelde [`BottomSheet`](lib/ui.js#L758) met `avoidKeyboard`. In `DESIGN.md`. |
| UX-42 | Platform/UX | Header-icoonrechts opschonen: alleen uitleg/activeerbaar, geen verstopte navigatie | Next | Should | M | ⏳ | — | De `ScreenHeader`-`right`-slot wordt als verstopte navigatie gebruikt (Planten/Boodschappen/Kosten/Maaltijden/Taken) → cryptisch. **Wens:** rechtsboven alleen uitleg/activeerbaar; overige acties wég. **Verken:** inventariseer `right=`-gebruik, herplaats per icoon, kop-contract in `DESIGN.md`. |
| A11Y-1 | Platform/UX | Toegankelijkheid in de primitieven | Next | Should | M | ⏳ | STR-4 | Bevinding A1-A4 ([plan 18](docs/plans/18-ux-verbeterplan.md)): `SwipeRow` `accessibilityActions`, toast live-region, header-rol, `Stepper` `adjustable` (device-dump bevestigt: ±-knoppen niet bedienbaar via screenreader). **Eén fix per primitief werkt overal door.** |
| A11Y-2 | Platform/UX | Toegankelijkheid op schermniveau | Next | Should | M | ⏳ | A11Y-1 | Bevinding A5-A9 ([plan 18](docs/plans/18-ux-verbeterplan.md)): 44pt-targets, losse `TextInput`→`Field`, voorraad-status niet kleur-only, `VisibilityPicker`→`AvatarSelect`, tag-actie via menu. |
| UX-43 | Platform/UX | Swipe-conventie uniformeren + verwijderen ontdekbaar | Next | Should | M | ⏳ | UX-23 | Bevinding B1/B2 ([plan 18](docs/plans/18-ux-verbeterplan.md)): links-vegen = verwijderen (Boodschappen) vs uitstellen (Vandaag) → één conventie in `DESIGN.md`; verwijderen ontdekbaar (prullenbak op waarde 1). |
| UX-44 | Platform/UX | Usability quick wins (catalogus/feedback/stepper) | Next | Could | M | ⏳ | — | Bevinding B3-B8 ([plan 18](docs/plans/18-ux-verbeterplan.md)): "Aanpassen" prominenter, prune-microcopy, `Celebrate` bij klaar, feedback-timing, eenheid in `Stepper`, suggesties wegklikbaar. |
| UXR-2 | UX-review | Ontleding: Taken & de tasks-weergaven | Later | Should | M | ⏳ | STR-1 | Verkennend: `taken.js`+`agenda.js`/`schoonmaak.js`+`task/[id].js`. Klopt de STR-1-rolverdeling in gebruik? [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-4 | UX-review | Ontleding: Kosten & delen | Later | Should | M | ⏳ | — | Verkennend: `kosten.js`/`expense`/`kosten-inzichten.js`/`delen.js`. Split-type, settle-uitleg, saldo-transparantie. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-5 | UX-review | Ontleding: Keuken-loop (Maaltijden + Voorraad) | Later | Should | M | ⏳ | — | Verkennend: `maaltijden.js`/`recipe`/`voorraad.js` — menu→boodschappen→koken→voorraad. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-6 | UX-review | Ontleding: Zorg-modules (Planten + Huisdieren) | Later | Should | M | ⏳ | — | Verkennend: `planten`/`huisdieren`. Kaart-zonder-handeling, verzorging bewerken, soort wijzigen. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-7 | UX-review | Ontleding: Setup & beheer | Later | Should | S | ⏳ | — | Verkennend: `huishouden.js`/`onboarding.js`/`instellingen.js`. Eerste-keer-flow, invoer-behoud, toggle-feedback. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-8 | UX-review | Ontleding: Activiteit & navigatie-weefsel | Later | Could | S | ⏳ | UX-12 | Verkennend: `activiteit.js` + cross-module deeplinks/terugkeer. Sluit op UX-10/UX-12. [plan 14](docs/plans/14-ux-module-teardown.md). |

---

## 7. Nieuwe suggesties (brainstorm)

Een brede brainstorm voor volgende rondes: ideeën die nog **géén rij in §6 hebben**.
Voorgestelde ID's reserveren ruimte; zodra een idee "echt" wordt, krijgt het een rij in
§6 (en verdwijnt hier). Gegroepeerd naar afstand/aard.

### 7.1 Bestaande modules verdiepen
- **UX-diepgang per module (Fase 1.6)** — de gestructureerde teardowns (UXR-1 t/m UXR-8) en
  quick wins (UX-15 t/m UX-20) staan nu in §6; elke teardown-sessie levert hier of in §6 weer
  nieuwe, concrete verbeterrijen op. Framework: [`docs/plans/14`](docs/plans/14-ux-module-teardown.md).
- **Agenda: losse afspraken zonder taak-overhead** (AGE-3) — nu is elke afspraak een `tasks`-rij;
  overweeg een lichtere "event"-flow voor puur-agenda-items (begin/eindtijd, geen afvinken).

### 7.2 Cross-cutting platform
- **Offline-modus / volledige optimistic UI** (PLT-2) — acties direct tonen, sync op de achtergrond
  (optimistic UI deels al via STR-7; de volledige offline-modus blijft hier als latere uitbreiding).
- **Globaal zoeken** (PLT-3) — over taken/boodschappen/planten/uitgaven heen.
- **Data-export & print** (PLT-4) — boodschappenlijst/saldo als CSV of deelbare tekst.
- **Toegankelijkheids-audit** (PLT-5) — **→ gepromoot naar §6 als A11Y-1/A11Y-2** (UX-doorlichting,
  [`docs/plans/18`](docs/plans/18-ux-verbeterplan.md)): primitieven (SwipeRow/toast/header/Stepper) +
  schermniveau (targets/labels/kleur-only). De device-smoke-test met VoiceOver/TalkBack hoort bij die rijen.

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
