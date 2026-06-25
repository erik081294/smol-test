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
> — zijn geconsolideerd in §6 (PERF-3…9, SEC-1…7, A11Y-1/2, UX-43/44, INF-11, BOO-12); **SEC-1**
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
| BOO-12 | Boodschappen | Decimale hoeveelheid-invoer | 2 | Could | S | ⏳ | BOO-5 | **Bevinding (UX-doorlichting C2, [plan 18](docs/plans/18-ux-verbeterplan.md)).** `parseQuantity('2.5 kg')` → `{count:2, unit:'.5 kg'}`; merge geeft `'3 .5 kg'` ([`lib/quantity.js:13`](lib/quantity.js#L13)), geen test. **Fix:** beslis of decimaal ondersteund moet zijn → regex+format+round-trip-test, óf een test die het (afgekapte) gedrag vastlegt. Pure module → mutatie-ratchet groen. Geen migratie. |
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
| PLT-1 | Platform | Notificaties & herinneringen | 2 | Should | M | 🔧 | — | **Plan 05.** Trap 1 (lokaal) werkt; trap 2 (remote `notify` Edge Function) productie-klaar, migr. `0018`/`0023` live. **Rest = flip-on:** secret zetten, `functions deploy notify`, Database Webhook op `tasks`, 2-account-test — zie [`docs/notify-setup.md`](docs/notify-setup.md). **Gate vóór deploy: SEC-5** (notify-payload valideren, [plan 17](docs/plans/17-security-remediatie.md)). |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | 2 | Could | M | 🔧 | — | **Gebouwd.** Feed afgeleid uit `task_completions` (geen migratie): `lib/activity.js` + `app/(tabs)/activiteit.js` + Thuis-kaart; identieke acties samengevouwen. **Rest:** realtime bijwerken bevestigen. **Bekend:** taakhernoeming ververst de feed-titel niet realtime. |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | 3 | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | **Doel:** eigen camerascherm (`expo-camera`/`CameraView`) met kader/overlay/feedback i.p.v. de native camera; gedeeld asset-formaat `{uri,base64,ext}`. Deelt camerafundament met BOO-9; generiek `CaptureSession`-primitief voor batch (PLA-9). Vereist dev build. |
| INF-1 | Platform | Live-Supabase-verificatie + RLS-tests | 1 | Must | S | 🔧 | — | **Alle migraties `0001`–`0036` live** (geverifieerd via `list_migrations`, 2026-06-22). Kern-RLS/RPC's bewezen via `docs/rls-connector-check.sql` (13/13). Volledige suite 587 tests (569 pass / 18 RLS-skip zonder secrets). **JS-RLS-suite mét secrets tegen live gedraaid (2026-06-25): 15/18 cases groen** (schone, committed 18-case-suite) — de 3 falende vielen om op de Supabase **auth rate-limit**, géén RLS-schending (zie **INF-12** voor de batch/backoff-fix). De SEC-ronde breidt deze suite uit (SEC-1/SEC-4) en refactort de setup naar `create_household`; de volledige-groen-run loopt dus mee met de SEC-verificatie. **Rest:** 18/18 via de INF-12-fix + 2-account-rooktest (`VERIFICATIE.md` Stap 3). |
| INF-3 | Platform | E2E-tests (Maestro) | 2 | Should | M | 🔧 | — | **Scaffolds gebouwd (plan 08).** Maestro (lichte YAML); 3 kritieke flows in `.maestro/` (taak toevoegen+afvinken, uitgave splitsen, boodschap+undo). **Rest:** kalibreren tegen een draaiende build. |
| INF-4 | Platform | Foutrapportage/monitoring (Sentry) | 2 | Should | S | 🔧 | — | **Gewired (plan 08).** `@sentry/react-native` + config-plugin; `lib/monitoring.js` (env-gated, no-op zonder DSN) + app-brede `lib/ErrorBoundary.js`. **Rest:** DSN + een build om echte rapportage te verifiëren. |
| INF-5 | Platform | Release-pijplijn (EAS) | 2 | Should | M | 🔧 | — | **Config gestaged (plan 08).** `eas.json` (dev/preview/prod, APK→AAB, submit `internal`) + `expo-dev-client` + `docs/eas-setup.md`. **Rest:** `eas login`/`init`, secrets, eerste build + Play-submit (wacht op Play-account). |
| STR-4 | Platform/UX | Ontbrekende gedeelde componenten | 1.5 | Should | S | ✅ | — | **Af.** Gedeelde componenten: `AvatarSelect`/`EmojiPicker`/`ListSkeleton`/`Editor`/`Collapsible`/`DateStepper`/`SwipeRow`/`Celebrate` (`lib/ui.js`); PhotoPicker geëxtraheerd. Plant- & bon-picker nu óók op de gedeelde `offerImagePicker` (2026-06-23) — alle foto-schermen één codepad. |
| STR-10 | Platform/UX | Empty states + illustraties | 1.5 | Should | M | 🔧 | — | **Eigen illustratie-systeem** `lib/illustrations.js` (themeable, 8 scènes) via `illustration`-prop op `Empty`, gewired op alle hoofdtabs. **Rest:** laatste 6 scènes visueel nalopen. |
| INF-8 | Platform | Realtime-primitief & scoping | 1.5 | Should | M | 🔧 | — | **Af (C1–C4).** `lib/useRealtimeReload.js` (C1) + household-gefilterde subscripties (C2, migr. `0025`) + incrementeel patchen `lib/realtimePatch.js` (C3) + gebundelde household-channel `lib/realtimeHub.js` (C4). **Rest:** patch + gebundelde subscriptie 2-richtingen op toestel bevestigen. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | 2 | Should | S | 🔧 | — | **Gebouwd + gedeployed.** Per-gebruiker rate-limit (20/uur) via `record_receipt_scan`-RPC + `receipt_scans` (migr. `0026`) vóór de Orq-call + MIME-whitelist. **Rest:** happy-path (echte foto → Orq) op toestel bevestigen. **Open (security-doorlichting L1, [plan 17](docs/plans/17-security-remediatie.md)):** de rate-limit is fail-open ([`scan-receipt index.ts:75`](supabase/functions/scan-receipt/index.ts#L75)) → fail-closed maken + globale Orq-kostencap. |
| INF-10 | Platform | DB-advisor-hardening | 1.5 | Could | S | 🔧 | — | **B4 af** (vaste `search_path`, migr. `0024`). **Open (advisor 2026-06-22):** B5 `pg_trgm` uit `public`, B6 leaked-password-protection aan, + `EXECUTE` op SECURITY DEFINER-functies voor `anon` strakker. (3× `rls_enabled_no_policy` = bewust deny-all, geen lek.) **Security-doorlichting ([plan 17](docs/plans/17-security-remediatie.md)) bevestigt dit cluster:** M1 = anon EXECUTE op DEFINER-RPC's (revoke from anon/public), L4 = pg_trgm/leaked-password, L5 = de deny-all-zonder-policy (geen lek; evt. no-op deny-policy tegen advisor-ruis). **→ M1 GEBOUWD + LIVE (migr. `0042`-`0044`, 2026-06-25):** PUBLIC/anon-EXECUTE ingetrokken op de user-facing DEFINER-RPC's (create_expense/update_expense/create_purchase/update_purchase/add_groceries/bump_product_usage/join_household + create_household/insert_catalog_product/record_receipt_scan), authenticated behouden (live grant-check groen). Geleerd: Supabase verleent nieuwe functies EXECUTE **direct aan anon/authenticated** via default-privileges (niet alleen PUBLIC) → een revoke móét anon expliciet noemen. De RLS-helpers (is_member/is_owner/can_view/in_subgroup) blijven bewust executable (RLS-policies roepen ze aan). **Open:** B5 pg_trgm uit public, B6 leaked-password (dashboard-toggle). |
| INF-11 | Platform | Mutatie-baseline voor 5 nieuwe modules | 1.5 | Could | S | 🔧 | — | **Opgelost in de werkboom (2026-06-25, branch `feat/boodschappen-redesign`).** De 5 modules zijn **chirurgisch** aan `mutation-baseline.json` toegevoegd met de gemeten scores — `groceryCatalog` 98.7 % (76/77), `productImage` 100 % (21/21), `quantity` 94.3 % (33/35), `groceryCount` 92.3 % (12/13), `groceryList` 96.6 % (28/29); `total` herberekend (3040/3556 = 85.5 %). **Bewust géén `npm run test:mutation:baseline`** (die `--update` herschrijft álle baselines over de huidige werkboom — incl. half-afgemaakt SEC-werk — heen, en `--update --since` zou ongewijzigde modules juist wissen). Geen bestaande regel aangeraakt; geen migratie. **Rest:** committen + ratchet herkent de baselines (geen "nieuwe module"-notice meer). |
| INF-12 | Platform | RLS-integratiesuite: auth-rate-limit bij volledige run | 2 | Could | S | ⏳ | INF-1 | **Bevinding (security-uitvoering 2026-06-25).** De volledige [`tests/rls.integration.test.js`](tests/rls.integration.test.js) maakt ~45-60 testlogins in één run en raakt dan de Supabase auth-rate-limit (`Request rate limit reached` bij `signInWithPassword`) → de laatste ~6 tests falen flakey (níét door de SEC-fixes; de SEC-1/SEC-4-cases slaagden vóór de limiet). **Fix:** batch de suite per module-groep, of voeg een kleine backoff/retry tussen `makeUser`-calls toe. Geen migratie. |
| SEC-1 | Security | Tenant-isolatie: owner-escalatie dichten | 2 | Must | M | 🔧 | — | **→ GEBOUWD + LIVE (migr. `0041`, 2026-06-25).** `create_household`-RPC (atomair household+owner) + `revoke insert on household_members`; `createHousehold` ([`lib/household.js`](lib/household.js)) om naar RPC; RLS-tests (owner-escalatie geweigerd, atomaire aanmaak) + grant-checks live groen. **Rest:** 2-account device-rooktest na een build. (members_delete was al owner-only sinds 0002 — auditpunt op 0001 was achterhaald.) KRITIEK — K1, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-2 | Security | `run_recurring_expenses` afschermen (anon) | 2 | Must | S | 🔧 | — | **→ GEBOUWD + LIVE (migr. `0042`).** `revoke execute … from public, anon, authenticated`; live geverifieerd (anon/authenticated kunnen 'm niet meer aanroepen, cron/service_role wel). Client roept de RPC niet aan. H1, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-3 | Security | Sessie-token in SecureStore i.p.v. AsyncStorage | 2 | Should | M | 🔧 | INF-5 | **→ GEBOUWD (code + units).** `lib/secureStorage.js` (expo-secure-store + byte-veilige chunking, pure helpers getest) + `lib/supabase.js` gebruikt 'm op native met eenmalige migratie van een oude AsyncStorage-sessie (en wist die). Token zit daarna in Keychain/Keystore, niet meer in AsyncStorage → backup-exclusie wordt secundair. **Rest:** device-verificatie (token niet meer in RKStorage) na een build. H2, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-4 | Security | `households_update` → owner-only | 2 | Should | S | 🔧 | — | **→ GEBOUWD + LIVE (migr. `0041`).** `households_update` nu `using/with check (is_owner(id))`; RLS-test live groen (gewoon lid kan naam/invite_code niet wijzigen, owner wel). M2, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-5 | Security | `notify`-payload valideren vóór deploy | 2 | Should | S | 🔧 | PLT-1 | **→ GEBOUWD (code + units, mutatie-ratchet 80,2% ≥ baseline).** `notify/core.js`: recipientId-stringguard + `clampBody` (controletekens weren, lengte → MAX_BODY). Titel was al server-side getemplatet; de schil haalt tokens al per `recipientId` op (token-eigenaar intrinsiek). **Gate op PLT-1-deploy.** M4, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-6 | Security | Service-role-key uit de app-`.env` | 2 | Should | S | ⏳ | — | **Gedocumenteerde handmatige hygiëne-actie (niet automatisch uitgevoerd: de sleutel is nodig om de live RLS-tests te draaien en staat in jouw gitignored `.env`).** Aanbeveling: haal `SUPABASE_SERVICE_ROLE_KEY` uit de app-`.env`, injecteer 'm ad-hoc in de shell bij de import-/RLS-scripts, en roteer periodiek (SECURITY.md). M5, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-7 | Security | Supply-chain & CI-hygiëne | 2 | Could | S | ◐ | — | **L3 (CI-SSRF) GEBOUWD:** allowlist op de externe deltabestandsnaam in [`refresh-off-delta.mjs`](scripts/refresh-off-delta.mjs) (`assertSafeDeltaName`). **L2 (npm audit) uitgesteld:** 14 moderate, alle build-time Expo-toolketen, 0 high/critical, geen runtime-pad → meenemen bij de volgende Expo-SDK-bump (`npm audit fix` standalone riskeert de lockstep). L2+L3, [plan 17](docs/plans/17-security-remediatie.md). |
| PERF-1 | Platform | Query-vensters & bulk-RPC | 2 | Could | M | 🔧 | INF-8 | **Aggregaat-RPC af (migr. `0037`, live).** `household_expense_totals`/`household_completion_totals` (SECURITY INVOKER → RLS scopet de payload). Kosten-saldo en schoonmaak-eerlijkheid (all-time) rekenen exact zodra het `.limit(2000)`-venster vol is, anders ongewijzigd. **Rest:** P-H4 bulk-RPC bon→voorraad. |
| PERF-2 | Platform/UX | Waargenomen snelheid: instant tab-wissel (geen laad-flits) | 2 | Should | M | 🔧 | INF-8 | **Gebouwd.** Instant tab-wissel via in-memory SWR-cache `lib/dataCache.js` (household-gescopet, `clearCache()` op sign-out) — alle hooks seeden uit cache — + `freezeOnBlur` op de Tabs. Verweven met INF-8 C3. **Toestel bevestigd (2026-06-25, moto): tab-wissels instant, geen laad-flits.** **Rest:** soepelheid op web bevestigen. |
| PERF-3 | Platform/perf | Bundle: phosphor per-icoon importeren (i.p.v. barrel) | 2 | Should | S | ⏳ | — | **Bevinding (perf-audit 2026-06-24, [plan 16](docs/plans/16-performance-audit.md)) — grootste enkele bundle-/startup-win.** [`lib/icons.js:34`](lib/icons.js#L34) named-importeert uit de phosphor-barrel; Metro (SDK 56) doet géén tree-shaking → alle ~756 iconen (×6 gewichten) worden gebundeld + door Hermes geparset bij élke koude start, voor ~57 gebruikte. **Fix:** per-icoon subpath-import (`phosphor-react-native/src/icons/<Naam>`); `MAP` blijft identiek, 1 bestand, laag risico. Meet bundle-grootte vóór/na. Geen migratie. |
| PERF-4 | Platform/perf | Render hot-path: TaskRow + Home-widgets memoïseren | 2 | Should | M | ⏳ | — | **Bevinding (perf-audit, plan 16; UX-doorlichting D1, plan 18).** [`TaskRow`](lib/TaskRow.js#L15) is geen `React.memo`; `renderItem`/`onToggle` staan inline in [`taken.js:111,364`](app/(tabs)/taken.js#L364) → elke afvink/realtime-patch hertekent álle zichtbare rijen (20-60+). Idem Home: geen widget gememoiseerd → een `tasks`-patch hertekent óók niet-taak-tegels. **Fix:** kopieer het al-bestaande [`GroceryRow`-patroon](app/(tabs)/boodschappen.js#L27) (React.memo + useEvent-callbacks) naar taken/vandaag; wikkel `WidgetTile`/widget-componenten in `React.memo`. **+ UX-D4:** stabiliseer `useMealPlan(new Date())` in [`registry.js`](lib/widgets/registry.js) met een gememoiseerde datum (per-render `new Date()` triggert reloads); grotere "stagger N home-fetches" optioneel. **UX-D5 (primitives los memoïseren) bewust NIET** — rij-niveau is de juiste memo-grens. Meet re-renders vóór/na. Geen migratie. |
| PERF-5 | Platform/perf | Voorraad "plaats"-modus terug onder virtualisatie | 2 | Should | S | ⏳ | — | **Bevinding (perf-audit, plan 16; door 2 agents onafhankelijk).** In plaats-modus zet [`voorraad.js:146`](app/(tabs)/voorraad.js#L146) `listData=[]` en rendert de hele voorraad in `ListHeaderComponent` ([`:175`](app/(tabs)/voorraad.js#L175)) → FlatList virtualiseert niets; alle SwipeRows mounten ineens. **Fix:** maak er een `SectionList` van (zoals boodschappen/taken), `renderRow`→`renderItem` + `React.memo`-rij. Geen migratie. |
| PERF-6 | Platform/perf | Fuzzy-match & catalogus-zoek: per-keystroke normalisatie hoisten | 2 | Should | M | ⏳ | — | **Bevinding (perf-audit, plan 16).** (1) `matchFor` ongememoiseerd in render-body [`purchase/[id].js:244`](app/purchase/[id].js#L244) (lines.map × matcher over hele catalogus, per toetsaanslag); (2) [`productMatch.similarity:31`](lib/productMatch.js#L31) normaliseert de query P× + her-normaliseert de al-genormaliseerde `p.search`; (3) [`groceryCatalog.searchCatalog:231`](lib/groceryCatalog.js#L231) normaliseert 110 statische namen per keystroke. **Fix:** match in `useMemo`; query 1× normaliseren + `p.search` vertrouwen; `CATALOG_NORM` voorbouwen (als `ITEM_BY_NORM`). **Pure modules → unit-test + mutatie-ratchet groen** (gedrag identiek). Geen migratie. |
| PERF-7 | Platform/perf | Foto's resizen bij upload + expo-image-cache | 2 | Should | M | ⏳ | — | **Bevinding (perf-audit, plan 16).** [`photoPicker.js:10`](lib/photoPicker.js#L10) comprimeert op kwaliteit maar schaalt pixels niet → 2000-4000px-foto's in 56px-thumbnails via RN-`<Image>` (geen downsampling/cache op Fabric) → decode-hitches + geheugen/OOM-risico in fotorijke lijsten (recepten/dieren/planten/timelines). **Fix:** `expo-image-manipulator` resize→1280px in de gedeelde picker (dekt alle schermen); `expo-image` voor signed-URL-thumbnails (`recyclingKey`). Geen migratie. |
| PERF-8 | Platform/perf | Datalaag: query-vensters + koopfrequentie-RPC + reminder-hookstorm | 2 | Should | M | ⏳ | INF-8, PERF-1 | **Bevinding (perf-audit, plan 16).** (1) [`useProductFrequencies`](lib/useProducts.js#L87) laadt ÁLLE `purchase_items` ongelimiteerd + ongeïndexeerd op het Boodschappen-scherm → **RPC `household_buy_frequencies` + index `(household_id,product_id)`** (migratie). (2) [`usePurchases:24`](lib/usePurchases.js#L24) mist een laad-venster (zwaarste payload, full-refetch per event) → `.limit(PURCHASE_WINDOW)`. (3) [`useNotifications:19`](lib/useNotifications.js#L19) trekt useTasks+useMealPlan+usePantry app-breed op puur voor reminders → lichter `useTasksForReminders` + debounce. Bouw 2→3→1. Deels migratie. |
| PERF-9 | Platform/perf | Virtualisatie-tuning op de SwipeRow-lijsten | 2 | Could | S | ⏳ | — | **Bevinding (UX-doorlichting D3, [plan 18](docs/plans/18-ux-verbeterplan.md)).** Alleen [`catalog.js:216`](app/catalog.js#L216) zet `initialNumToRender`/`maxToRenderPerBatch`/`windowSize`/`removeClippedSubviews`; boodschappen/taken/kosten missen ze. **Fix:** kopieer die afstelling (geen `getItemLayout` — variabele rijhoogtes). Geen migratie. |
| TKN-2 | Taken/UX | Jaarweergave — activiteit-heatmap | 3 | Could | M | 🔧 | TKN-1 | **Gebouwd (activiteit-heatmap).** Jaar-scope van Taken: GitHub-achtig voltooiingen-raster uit `task_completions` (geen migratie) — `lib/yearHeatmap.js` + `YearHeatmap.js`/`YearActivity.js` (lazy realtime, lid-/categoriefilter). **Rest:** rendering + scroll + realtime op web/toestel bevestigen. **Perf-onderbouwing (audit, [plan 16](docs/plans/16-performance-audit.md)):** de heatmap rendert ~371 losse `View`/`Pressable`-nodes (53×7) in een ScrollView, niet gevirtualiseerd → mount-hitch + zware scroll. Jankt het op toestel: render als één `react-native-svg <Svg>` met `<Rect>`-cellen + één `onPress`+coördinaat→cel. |
| UX-9 | Platform/UX | Eigen lettertype verkennen (weg van het systeemfont/Inter) | 2 | Could | S | ⏳ | UX-1 | **Verkenning:** een eigen, leesbaar **variable font** (Inter bewust niet) — centraal via `expo-font` + `fontFamily` op de `type`-tokens in `lib/theme.js`. Eisen: Latin-Extended (NL-diacrieten), prettige cijfers, OFL. Kandidaten naast elkaar op toestel testen; keuze in `DESIGN.md`. |
| UX-12 | Platform/UX | Back vanuit een via-"Meer"-geopende tab gaat naar Home i.p.v. Meer | 1.5 | Should | S | 🔧 | UX-2 | **Gebouwd.** `backBehavior="history"` op de Tabs: Android-back keert naar de vórige tab. **Rest:** op Android-toestel (hardware-back + gebaar) + web verifiëren; anders de stack-push-variant (UX-10). |
| UX-13 | Platform/UX | Flexibele avatars: foto-upload + zelf-gebouwde avatar (personen én huishouden) | 2 | Should | M | ⏳ | UX-1, STR-4 | **Idee (gebruikerswens):** avatar van enkel emoji → keuze **emoji/foto/zelfgebouwde avatar**, voor leden én huishouden. Generieke descriptor (`kind: emoji\|photo\|builder`), nieuwe `avatars`-bucket + RLS, `Avatar`-component als switch. Builder via lokaal-gevendorde of zelf-getekende SVG (`react-native-svg`/`lib/illustrations.js`), geen runtime-dependency. Migratie nodig. |
| UX-23 | Platform/UX | Veeg-acties op de Vandaag-focus-taken | 1.6 | Could | S | ⏳ | UX-17 | **Bevinding (UXR-1, 2026-06-23).** De focus-taken op het Thuis-dashboard (`vandaag.js`) zijn afvinkbaar + tikbaar naar detail, maar missen de `SwipeRow`-veegacties die de Taken-tab nu wél heeft (links verwijderen, rechts uitstellen) → inconsistent. Wrap de focus-`TaskRow`s in `SwipeRow` met dezelfde undo-handlers. Klein; geen migratie. Kruisref **UX-43** (app-brede swipe-conventie). |
| UX-24 | Platform/UX | Laad-skeleton op het Thuis-dashboard | 1.6 | Could | S | ⏳ | UX-15 | **Bevinding (UXR-1, 2026-06-23).** Bij koud laden toont `vandaag.js` alleen de hero + een `RefreshControl`-spinner; de focus-lijst/widgetgrid poppen in. Een lichte skeleton (of placeholder-tegels) tijdens de eerste `loading` maakt het rustiger. Geen migratie. |
| UX-22 | Platform/UX | Drawers/sheets: nooit onder het toetsenbord + drie sluit-routes | 1.6 | Should | M | ⏳ | UX-5 | **Bevinding (gebruikerswens, 2026-06-23).** De "Gedeeld item toevoegen"-drawer (Samen-tab, [`delen.js`](app/(tabs)/delen.js)) rolt een eigen `Modal` zónder `KeyboardAvoidingView`: het invoerveld valt onder het toetsenbord. **Contract voor élke gedeelde drawer/sheet:** (a) bevat 'ie invoer, dan schuift de inhoud omhoog — nóóit onder het toetsenbord; (b) sluitbaar via álle drie: veeg omlaag, tik op de gedimde achtergrond, én kruisje/Annuleren in de `ModalHeader`. **Werk:** audit alle sheets; breng losse `Modal`-bouwsels onder op de gedeelde [`BottomSheet`](lib/ui.js#L758), zet `avoidKeyboard` aan voor sheets met invoer, en voeg het veeg-omlaag-gebaar toe (achtergrond-tik bestaat al daar, ontbreekt in `delen.js`). Geborgd in `DESIGN.md`. |
| UX-42 | Platform/UX | Header-icoonrechts opschonen: alleen uitleg/activeerbaar, geen verstopte navigatie | 1.6 | Should | M | ⏳ | — | **Bevinding (gebruikerswens, 2026-06-24).** De `ScreenHeader`-`right`-slot ([`lib/ui.js:631`](lib/ui.js#L631)) wordt door modules gebruikt als verstopte navigatie-/actie-snelkoppeling i.p.v. uitleg: Planten/Huisdieren → cross-tijdlijn (`timeline`), Boodschappen → catalogus + vaste boodschappen + bon (`search`/`repeat`/`receipt`), Kosten → inzichten + terugkerend (`price`/`repeat`), Maaltijden → recepten (`library`), Taken → klusjes-bibliotheek (`library`). Deze icoontjes zijn cryptisch en inconsistent (1–3 per scherm, label alleen in `accessibilityLabel`, niet in beeld) → verwarrend. **Wens:** rechtsboven hoort alléén een uitleg/informatie-drawer of een écht te-activeren element; de overige navigatie/acties moeten daar wég. **Verken:** inventariseer alle `right=`-gebruiken in `app/(tabs)/*`, bepaal per icoon de juiste bestemming (in-context knop/FAB-menu, sub-navigatie zoals `EtenNav`, of binnen het scherm zelf), en leg het kop-contract vast in `DESIGN.md`. Verkennend; geen migratie. |
| A11Y-1 | Platform/UX | Toegankelijkheid in de primitieven | 2 | Should | M | ⏳ | STR-4 | **Bevinding (UX-doorlichting A1-A4, [plan 18](docs/plans/18-ux-verbeterplan.md)); promotie van PLT-5.** (A1) `SwipeRow` `accessibilityActions`+`onAccessibilityAction` (veeg-acties nu screenreader-onbereikbaar, [`lib/ui.js:406`](lib/ui.js#L406)); (A2) toast `accessibilityLiveRegion`+announce ([`lib/toast.js:71`](lib/toast.js#L71)); (A3) `accessibilityRole="header"` op `ScreenHeader`/`SectionHeader`/`ModalHeader`; (A4) `Stepper` als `adjustable` + `accessibilityValue` + `t(...)` — **device-dump 2026-06-25 bevestigt:** de stepper-`ViewGroup` heeft wél een `content-desc` ("Aantal voor <naam>") maar is géén `adjustable` (de ±-knoppen zijn losse, niet-clickable `TextView`s) → screenreader kan de waarde niet bijstellen. **Eén fix per primitief werkt overal door.** Geen migratie. |
| A11Y-2 | Platform/UX | Toegankelijkheid op schermniveau | 2 | Should | M | ⏳ | A11Y-1 | **Bevinding (UX-doorlichting A5-A9, [plan 18](docs/plans/18-ux-verbeterplan.md)); promotie van PLT-5.** (A5) sub-44pt targets (catalog-prune, exact-split-input, Chip/SegmentedControl `minHeight:44`); (A6) losse `TextInput` → `Field`/label ([`expense/[id].js:232`](app/expense/[id].js#L232)); (A7) voorraad-status niet kleur-only ([`voorraad.js:121`](app/(tabs)/voorraad.js#L121)); (A8) `VisibilityPicker` → `AvatarSelect`; (A9) tag-long-press ook via `accessibilityActions`/menu. Geen migratie. |
| UX-43 | Platform/UX | Swipe-conventie uniformeren + verwijderen ontdekbaar | 1.6 | Should | M | ⏳ | UX-23 | **Bevinding (UX-doorlichting B1/B2, [plan 18](docs/plans/18-ux-verbeterplan.md)).** (B1) links-vegen is op Boodschappen *verwijderen* maar op Vandaag *uitstellen* ([`boodschappen.js:30`](app/(tabs)/boodschappen.js#L30) vs [`vandaag.js:266`](app/(tabs)/vandaag.js#L266)), strijdig met de `SwipeRow`-docstring → leg één app-brede conventie vast in **DESIGN.md** + comment. (B2) verwijderen op de boodschappenlijst is alleen via swipe/stepper-naar-0 (per ongeluk → meteen weg) → zichtbare ingang + prullenbak-icoon op waarde 1. Kruisref UX-23. Geen migratie. |
| UX-44 | Platform/UX | Usability quick wins (catalogus/feedback/stepper) | 1.6 | Could | M | ⏳ | — | **Bevinding (UX-doorlichting B3-B8, [plan 18](docs/plans/18-ux-verbeterplan.md)).** (B3) "Aanpassen" prominenter (potlood in header) + hint dat widgets sleepbaar zijn; (B4) prune-microcopy "Product verbergen"; (B5) klaar-moment via `Celebrate` als alles afgevinkt is; (B6) feedback-timing custom-item gelijktrekken (toast ná succes); (B7) eenheid in de `Stepper` (`formatValue`); (B8) suggesties wegklikbaar, aparte `refreshing`-state, zoek-dropdown-backdrop dimmen, bon-link stabieler. Geen migratie. |
| UXR-1 | UX-review | Ontleding: Vandaag / overzicht | 1.6 | Should | S | ✅ | — | **Teardown gedaan (2026-06-23).** `vandaag.js` is strak (VDG-epic): heldere 5-sec-lens (hero → focus → grid → "alles bekijken" → FAB), één primaire actie (FAB), nette affordances. Bevindingen → nieuwe rijen **UX-23** (veeg-acties op focus-taken, consistent met Taken) en **UX-24** (laad-skeleton bij koud laden). Lens: [`docs/plans/14`](docs/plans/14-ux-module-teardown.md). |
| UXR-2 | UX-review | Ontleding: Taken & de tasks-weergaven | 1.6 | Should | M | ⏳ | STR-1 | **Verkennend.** `taken.js` + de weergaven `agenda.js`/`schoonmaak.js` + `task/[id].js`. Kerntoets: klopt de STR-1-rolverdeling (één bron, drie weergaven) écht in gebruik, of voelt Agenda redundant? Rotatie-/filter-microcopy, dode einden, ontbrekende snelle acties. Zie plan 14. |
| UXR-3 | UX-review | Ontleding: Boodschappen | 1.6 | Should | S | ✅ | — | **Teardown gedaan (2026-06-23).** `boodschappen.js` is compleet (snel toevoegen → product-hints → "misschien weer nodig" → afvinken → afgevinkte wissen + undo → vaste boodschappen/catalogus/bon). **Quick win meteen meegenomen:** `blurOnSubmit={false}` op de toevoegbalk zodat het toetsenbord openblijft voor razendsnel achter-elkaar toevoegen (matcht de DESIGN-intentie). Geen verdere doodlopende einden gevonden. Zie plan 14. |
| UXR-4 | UX-review | Ontleding: Kosten & delen | 1.6 | Should | M | ⏳ | — | **Verkennend.** `kosten.js`, `expense/[id].js`, `kosten-inzichten.js`, `delen.js`, `resource/[id].js`. Beslismomenten: split-type wijzigen, "settle"-suggesties uitleggen, reservering-conflict-waarschuwing, saldo-transparantie. Zie plan 14. |
| UXR-5 | UX-review | Ontleding: Keuken-loop (Maaltijden + Voorraad) | 1.6 | Should | M | ⏳ | — | **Verkennend.** `maaltijden.js`, `recipe/[id].js`, `voorraad.js` — de reis menu → boodschappen → koken → voorraad bijwerken. Ingrediënt-bewerk-affordance, "deze week boodschappen halen", porties-stepper, voorraad-urgentie. Zie plan 14. |
| UXR-6 | UX-review | Ontleding: Zorg-modules (Planten + Huisdieren) | 1.6 | Should | M | ⏳ | — | **Verkennend.** `planten.js`/`plant/*` + `huisdieren.js`/`pet/*` (gedeelde verzorgings-/tijdlijn-infra). Kaart zonder handeling (waterbeurt/dierzorg niet af te vinken vanaf de kaart), verzorging bewerken, soort wijzigen, tijdlijn-acties. Zie plan 14. |
| UXR-7 | UX-review | Ontleding: Setup & beheer | 1.6 | Should | S | ⏳ | — | **Verkennend.** `huishouden.js` (leden/subgroepen/module-toggles), `onboarding.js`, `instellingen.js`. Eerste-keer-flow, behoud van invoer bij tab-wissel, zichtbaarheid van trigger-knoppen en toggle-feedback. Zie plan 14. |
| UXR-8 | UX-review | Ontleding: Activiteit & navigatie-weefsel | 1.6 | Could | S | ⏳ | UX-12 | **Verkennend.** `activiteit.js` (read-only feed: filter/zoek/duiding van iconen, naar-bron-deeplink) + cross-module terugkeer/deeplinks. Sluit aan op UX-10 ("vorige"-lintje) en UX-12 (back-gedrag). Zie plan 14. |

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
