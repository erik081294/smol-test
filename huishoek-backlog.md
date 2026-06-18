# Huishoek — Productbacklog & Moduledenken

Dit document werkt je ideeën uit tot een richtinggevende backlog. Het begint met de
fundamentele architectuurkeuze die alle modules raakt (zichtbaarheid via subgroepen),
beschrijft daarna elke module met passende ondersteuning, en eindigt met een
gefaseerde roadmap. De losse backlog-items met status, schattingen en prioriteit staan
in de canonieke statustabel verderop in dit document (§6).

> **Bron van waarheid.** De gestructureerde backlog wordt nu in dit Markdown-bestand
> bijgehouden (§6 — "Backlog-status"). Het oude `huishoek-backlog.xlsx` is **verouderd**
> en wordt niet meer onderhouden (binair, geen statuskolom, slecht te diffen in git).

> **Build-ready plannen.** Uitgewerkte, direct-implementeerbare plannen voor de volgende
> ronde (Fase 2/3 + platform/infra) staan in [`docs/plans/`](docs/plans/00-overzicht.md):
> voltooiingen-log + eerlijkheid/rotatie (01), boodschappen-intelligentie (02), grote
> aankopen (03), kosten & autodelen (04), notificaties (05) en platform-hardening (06).

> **Status-update (laatst herzien: 2026-06-17).** Fase 0 **én** Fase 1 zijn **af in de
> code** (werkboom). Gebouwd en aanwezig:
> - **Fase 0** — **FND-1** (subgroepen + zichtbaarheid: `subgroups`/`subgroup_members`,
>   RLS-helpers `can_view`/`in_subgroup`, `lib/visibility.js`, `VisibilityPicker`,
>   subgroep-beheer in `huishouden.js`) en **FND-2** (module-framework: `lib/modules.js`,
>   `enable_module_rls()`, migratie `0003`). Daar bovenop **module-toggles** (aan/uit per
>   huishouden én gebruiker, migratie `0004`, `effectiveModules()`) — staat hieronder als
>   nieuw item **FND-4**.
> - **Fase 1** — alle vier de modules geïmplementeerd (migraties `0005`–`0009`, pure logica
>   + units, hooks en schermen): **Agenda** (AGE-1), **Schoonmaak** (SCH-1 + SCH-2),
>   **Kosten/WieBetaaltWat** (KOS-1 + KOS-2), **Planten** (PLA-1 t/m PLA-4). Zie
>   `huishoek-specs-fase1.md` voor de spec + genomen keuzes.
> - **Boven de spec uit** — plantfoto-opslag en **plantendagboek** (PLA-5, migraties
>   `0010`+`0011`, `lib/plantPhoto.js`); een **Phosphor icon-/design-systeem** (`DESIGN.md`,
>   `lib/icons.js`, `lib/theme.js`, `lib/ui.js`) → item **UX-1**; een **"Meer"-overflow-tab**
>   in de navigatie → item **UX-2**; en een **CI-pipeline** + testkader
>   (`.github/workflows/ci.yml`, `tests/*`) → item **INF-2**.
> - **Fase 2 — eerste no-migratie-stappen (2026-06-17)** — **KLU-2** klus-bibliotheek +
>   **KLU-3** seizoenssuggesties (`lib/choreLibrary.js`, `lib/ChoreLibrarySheet.js`, één-tik-
>   toevoegen vanaf het Taken-scherm) en **PLA-7** (plantfoto-cover — bleek al gebouwd).
>   Alles op de live schema (`0011`), géén nieuwe migratie, met units.
>
> - **Fase 2 — voltooiingen-log (2026-06-18, plan 01)** — **SCH-3** eerlijkheidsoverzicht +
>   **KLU-4** beurtrotatie, beide op een nieuwe voltooiingen-log `task_completions`
>   (migratie `0012` + kolom `tasks.rotation`). Pure logica `lib/fairness.js`/`lib/rotation.js`
>   met units, hook `useTaskCompletions`, component `FairnessBars`, UI op Schoonmaak +
>   taak-editor. Migratie `0012` is **live gepusht** en de RLS-integratietests zijn
>   **groen** tegen de live DB (118 tests, 0 skipped) — zie INF-1.
>
> **Fase 1 live geverifieerd (2026-06-18):** de migraties `0004`–`0012` staan op het
> live Supabase-project (DB op `0012`) en de RLS-integratietests draaien groen tegen
> de live DB (118 tests, 0 skipped) → item **INF-1** ✅. Resteert alleen de handmatige
> 2-account-rooktest (`VERIFICATIE.md` Stap 3).
>
> - **Volgende ronde = Fase 1.5 "Strak & af" (2026-06-18)** — vóór de ambitieuze
>   Fase 2-data-features eerst de bestaande app echt strak maken. De app heeft een
>   sterk design-systeem (`lib/theme.js`, `lib/ui.js`, `DESIGN.md`) maar voelt op
>   mid-tier schermen kaal: zelfgebouwde UI i.p.v. de bibliotheek, geen optimistic
>   UI/haptics/undo, en taken die op vier schermen (Vandaag/Taken/Agenda/Schoonmaak)
>   opduiken zonder heldere rolverdeling. Uitgewerkt als items **STR-1 t/m STR-11**
>   in §6 en build-ready in [`docs/plans/07-strakke-app.md`](docs/plans/07-strakke-app.md).
>   Geen migratie — dit is "toepassen wat al bestaat".
>
> - **Fase 1.5 grotendeels af (2026-06-18)** — STR-1/2/3/5/6/8/11 ✅ in de code;
>   STR-4/7/9/10 🔧 (gebouwd, nog visueel/web te valideren). Laatste twee gaten dicht:
>   **STR-8 haptics** (`expo-haptics` toegevoegd + `lib/haptics.js`, ingehaakt op
>   afvinken/opslaan/fout) en **STR-5 zichtbare acties** (geen verborgen long-press meer;
>   Schoonmaak-actieknop in-flow i.p.v. zwevend). Resteert: de 🔧-items op web narlopen.
>
> Dit document blijft het waarom/overzicht; de specs zijn het hoe.

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
- **Plantendagboek**: foto's over tijd zodat je groei en gezondheid ziet.

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
kosten-koppeling aan modules (KOS-3) en de autodeel-basis (AUT-1/2). Hier zit het meeste
bouwwerk; lever in trappen op. **Al af:** KLU-2 klus-bibliotheek, KLU-3 seizoenssuggesties,
PLA-7 plantfoto-cover (no-migratie-voorlopers) en — via plan 01 (migratie 0012) —
beurtrotatie/eerlijkheid (KLU-4, SCH-3) op een nieuwe voltooiingen-log.

**Fase 3 — Slim & verbonden — ⏳ LATER**
AI-soortherkenning planten (PLA-6), AI-bonextractie (BOO-7), supermarktvergelijking (BOO-4)
op je eigen mandje, frequentie-voorspelling (BOO-8), agenda-device-sync (AGE-2) en autodelen
tussen bevriende huishoudens (AUT-3).

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

Statuslegenda: **✅ Gereed** (gebouwd, code aanwezig) · **🔧 Te verifiëren** (gebouwd, nog
te valideren tegen live Supabase) · **⏳ Open** (nog te bouwen). Inspanning is een T-shirt-maat
(S/M/L). Deze tabel vervangt `huishoek-backlog.xlsx`.

| ID | Module | Feature | Fase | Prio | Insp. | Status | Afh. | Notitie |
|----|--------|---------|------|------|-------|--------|------|---------|
| FND-1 | Fundament | Subgroepen & zichtbaarheid | 0 | Must | L | ✅ | — | `subgroups`/`subgroup_members`, `can_view`, `lib/visibility.js`, migratie 0003. |
| FND-2 | Fundament | Module-architectuur | 0 | Must | M | ✅ | — | `lib/modules.js`, `enable_module_rls()`, migratie 0003. |
| FND-3 | Fundament | Kinderprofielen | 0 | Should | M | ⏳ | FND-1 | Open vraag (§5). Begin evt. met 'profiel zonder account' onder een ouder. |
| FND-4 | Fundament | Module-toggles (huishouden + gebruiker) | 0 | Should | M | ✅ | FND-2 | Default-on; owner zet uit per huishouden, lid per gebruiker. Migratie 0004, `effectiveModules()`. |
| KLU-1 | Klussen | Basis taken | 1 | Must | — | ✅ | — | Eenmalige + terugkerende klussen. Gereed in v1.0. |
| KLU-2 | Klussen | Klus-bibliotheek | 2 | Should | S | ✅ | FND-2 | Vaste lijst veelvoorkomende klussen + default recur-instellingen. `lib/choreLibrary.js` + `ChoreLibrarySheet` (één-tik-toevoegen vanaf het Taken-scherm). Geen migratie. |
| KLU-3 | Klussen | Seizoenssuggesties | 3 | Could | S | ✅ | KLU-2 | Regelgebaseerd op maand (`months` per klus, `seasonalChores()`); getoond als "Past bij &lt;maand&gt;" in de bibliotheek-sheet. |
| KLU-4 | Klussen | Beurtrotatie | 2 | Could | M | ✅ | FND-2 | Rotatie-volgorde (`tasks.rotation uuid[]`, migratie 0012); bij doorrollen springt `assigned_to` naar de volgende (`lib/rotation.js` → `nextAssignee`). UI in de taak-editor; indicator in `TaskRow`. |
| BOO-1 | Boodschappen | Gedeelde lijst | 1 | Must | — | ✅ | — | Realtime + afvinken. Gereed in v1.0. |
| BOO-2 | Boodschappen | Bonnetje scannen — foto + bevestigen | 2 | Should | L | ⏳ | BOO-5 | Trap 1. Levert aankoophistorie + prijsdata; correcties trainen matching. |
| BOO-3 | Boodschappen | Prijstracker | 2 | Should | M | ⏳ | BOO-2 | Prijs per product over tijd en per supermarkt. |
| BOO-4 | Boodschappen | Supermarktvergelijking | 3 | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-5 | Boodschappen | Productcatalogus & matching | 2 | Must | M | ⏳ | FND-2 | Kritisch fundament voor prijstracker en vergelijking. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | 3 | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie | 3 | Could | L | ⏳ | BOO-2 | Trap 3. Multimodaal model + bevestiging als vangnet; kosten per scan meewegen. |
| BOO-8 | Boodschappen | Aankoopfrequentie leren | 3 | Could | M | ⏳ | BOO-3 | Begin als simpele 'je koopt dit meestal rond nu'-suggestie. |
| PLA-1 | Planten | Plant toevoegen + foto | 1 | Must | M | ✅ | FND-2 | Foto-opslag via Supabase Storage (migratie 0010, `lib/plantPhoto.js`). |
| PLA-2 | Planten | Soortdatabase + verzorgingsregels | 1 | Must | M | ✅ | — | Geseed via migratie 0009; regelgebaseerd, uitlegbaar. |
| PLA-3 | Planten | Verzorgingsschema op maat | 1 | Should | M | ✅ | PLA-2 | `lib/plantCare.js` → terugkerende taken per seizoen. |
| PLA-4 | Planten | Verzorgingskaart | 1 | Should | S | ✅ | PLA-2 | `careCard()` in `app/plant/[id].js`. |
| PLA-5 | Planten | Plantendagboek | 2 | Could | S | ✅ | PLA-1 | Vervroegd gebouwd: foto's over tijd. Migratie 0011 (`plant_photos`). |
| PLA-6 | Planten | AI-soortherkenning | 3 | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-7 | Planten | Plantfoto-cover automatisch | 2 | Could | S | ✅ | PLA-5 | Nieuwste dagboekfoto is de omslag (`plants.photo_path`) — al geregeld in `addPlantPhoto`/`deletePlantPhoto` en getoond op de plantkaart. Geen extra werk nodig. |
| SCH-1 | Schoonmaak | Kamer-/zonegerichte taken | 1 | Should | M | ✅ | FND-2 | Zones + `tasks.zone_id`. Migratie 0006, `lib/useZones.js`. |
| SCH-2 | Schoonmaak | Schoonmaakrooster in één keer | 1 | Should | M | ✅ | SCH-1 | Template → meerdere terugkerende taken. `lib/cleaningTemplates.js`. |
| SCH-3 | Schoonmaak | Beurtverdeling + eerlijkheidsoverzicht | 2 | Could | M | ✅ | SCH-1 | Voltooiingen-log `task_completions` (migratie 0012) lost de doorrol-amnesie op; `completeTask` logt nu elke beurt. `lib/fairness.js` → `tally`, hook `useTaskCompletions`, component `FairnessBars`, kaart "Wie deed hoeveel" (Week/Maand/Alles) op het Schoonmaak-scherm. |
| AAN-1 | Grote aankopen | Aankoop-dossier | 2 | Should | M | ⏳ | FND-1 | Titel, budgetrange, deadline, wie beslist mee. Subgroep-gescoped. |
| AAN-2 | Grote aankopen | Opties verzamelen | 2 | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. |
| AAN-3 | Grote aankopen | Vergelijktabel | 2 | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | 2 | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing bewaren. |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | 3 | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-1 | Agenda | Kalenderweergave + subgroep-filter | 1 | Should | L | ✅ | FND-1 | Eigen maandgrid (geen native lib). `lib/agenda.js`, migratie 0005. |
| AGE-2 | Agenda | Sync met telefoon-agenda | 3 | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| KOS-1 | Kosten | WieBetaaltWat — uitgaven & splitsen | 1 | Should | L | ✅ | FND-1 | Splitsing gelijk/aandeel/exact; `create_expense` RPC. Migratie 0007. |
| KOS-2 | Kosten | Saldo-overzicht & vereffenen | 1 | Should | M | ✅ | KOS-1 | Greedy schuldminimalisatie in `lib/expenses.js`. |
| KOS-3 | Kosten | Kosten koppelen aan modules | 2 | Could | M | ⏳ | KOS-1 | Een boodschap/aankoop direct als gedeelde uitgave. |
| AUT-1 | Autodelen | Gedeeld item + reserveringskalender | 2 | Could | M | ⏳ | KOS-1 | Reserveringen op een gedeelde resource. |
| AUT-2 | Autodelen | Gebruik → kosten | 2 | Could | M | ⏳ | AUT-1 | Kilometers/tankbeurten → uitgaven, gesplitst naar gebruik. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | 3 | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| UX-1 | Platform | Design-/icon-systeem (Phosphor) | 1 | — | M | ✅ | — | `DESIGN.md`, `lib/icons.js`, tokens in `lib/theme.js`, componenten in `lib/ui.js`. |
| UX-2 | Platform | "Meer"-overflow-tab navigatie | 1 | — | S | ✅ | FND-2 | `primary`/`MORE_TAB` in `lib/modules.js`, `app/(tabs)/meer.js`. Houdt tabbalk leesbaar. |
| INF-1 | Platform | Live-Supabase-verificatie + RLS-tests | 1 | Must | S | ✅ | — | Migraties 0004–0012 live gepusht (DB op `0012`); RLS-integratietests groen tegen de live DB (118 tests, 0 skipped, 2026-06-18). Resteert alleen de handmatige 2-account-rooktest (`VERIFICATIE.md` Stap 3). |
| INF-2 | Platform | CI-pipeline + testkader | 1 | Should | S | ✅ | — | `.github/workflows/ci.yml`, `node:test`-units onder `tests/`. |
| INF-6 | Platform | i18n-fundament | 2 | Should | S | 🔧 | — | **Laag gelegd:** `lib/i18n.js` (`t(key, vars)` met `{var}`-interpolatie, zichtbare key-fallback, `setLang`/`registerDict`, simpele `plural`), units `tests/i18n.test.js` (6, groen). Eén referentiescherm gemigreerd (`app/(tabs)/taken.js`). **Regel:** nieuwe code gebruikt `t(...)`. **Rest:** overige schermen incrementeel migreren; later `expo-localization` voor locale-detectie. Plan 06. |
| STR-1 | Platform/UX | IA: één bron `tasks`, expliciete weergaven | 1.5 | Must | M | ✅ | — | **Af:** zone reist mee met de taak (`useTasks` embed `zone:zones`, optie `select` in `useCollection`), zichtbaar in `TaskRow` (Taken/Vandaag/Agenda) en bewerkbaar in de taak-editor (zone-kiezer + `zone_id`); per-zone "Taak toevoegen" op Schoonmaak opent dezelfde editor (`?zone=`). Agenda/Schoonmaak hebben nu "dit is een weergave"-subtitels ("Je taken op de kalender", "Je taken per ruimte — afvinken werkt overal door"). Schoonmaak blijft bewust onder "Meer": het is een gespecialiseerde onderhouds-weergave, geen dagelijkse primaire tab. Plan 07 §A. |
| STR-2 | Platform/UX | Navigatie-helderheid | 1.5 | Should | S | ✅ | STR-1 | **Af:** `chevron`-prop op `ItemRow` als expliciete "dit is tikbaar"-affordance op navigerende rijen (Meer-modules, huishouden-subgroepen) — niet op afvink-rijen (die hebben al een checkbox). Detailschermen gebruiken consistent `ModalHeader` (terug/sluit). Schoonmaak-plaatsing heroverwogen → bewust onder "Meer" (zie STR-1). |
| STR-3 | Platform/UX | Schermen naar `lib/ui.js` trekken | 1.5 | Must | M | ✅ | — | **Af — 0 rauwe `TouchableOpacity` in heel `app/`.** Alle editors (taak/plant/uitgave) + alle tab-schermen (boodschappen/huishouden/planten/kosten/agenda/meer/schoonmaak) op `ItemRow`/`IconButton`/`Chip`/`Pressable` + tokens. Bug gefixt: planten-kaart rekte bij oneven aantal de rij vol (ghost-spacer). Pluralisatie "1 deelnemer" gefixt (kosten). |
| STR-4 | Platform/UX | Ontbrekende gedeelde componenten | 1.5 | Should | S | 🔧 | — | **`AvatarSelect`, `EmojiPicker` en `ListSkeleton` af** (in `lib/ui.js`). `EmojiPicker` vervangt de 2× zelfgebouwde emoji-keuzes (onboarding + huishouden-subgroep); `ListSkeleton` is de zachte laad-placeholder (pulseert, reduce-motion-aware) in Boodschappen/Taken i.p.v. abrupt inpoppen. **Rest:** `PhotoPicker` — bewust uitgesteld: nu maar 1 gebruiker (plant-editor), de inline-implementatie werkt; extractie levert geen dedup-winst op dit moment. |
| STR-5 | Platform/UX | Zichtbare item-acties + één primaire actie | 1.5 | Should | M | ✅ | STR-9 | **Af:** geen verborgen long-press meer in `app/` — delete is overal een zichtbare trailing `IconButton` + undo-toast (bewust i.p.v. `Swipeable`: beter ontdekbaar, web-veilig). Schoonmaak: de zwevende `position:absolute`-knop weg → "Weekschema opzetten" in-flow als lijst-footer (bij zones) of als `Empty`-actie (geen rooster). Boodschappen-`+` is een duidelijke ocher-actieknop in de toevoegbalk. |
| STR-6 | Platform/UX | Inline formulier-validatie | 1.5 | Should | S | ✅ | — | **Af:** alle veld-validaties tonen nu inline (`Field`-`error` + foutregel onder de control) i.p.v. blokkerende `Alert` — in taak-, uitgave-, plant-editor, auth-welkom, onboarding en huishouden-subgroep. `Alert` resteert alleen voor bevestigingen (verwijderen) en server-/permissie-fouten. Fout wist bij wijzigen van het veld. |
| STR-7 | Platform/UX | Optimistic UI | 1.5 | Must | M | 🔧 | — | **Gebouwd:** optimistische `update`/`remove` met rollback in `useCollection` (raakt alle modules); `completeTask`/`uncompleteTask` vinken nu direct af (statuswijziging vóór het loggen). Realtime herlaadt de serverwaarheid. Te valideren op web. Vervangt PLT-2. |
| STR-8 | Platform/UX | Haptics | 1.5 | Could | S | ✅ | — | **Af:** `expo-haptics` toegevoegd (bleek nog niet geïnstalleerd) + `lib/haptics.js` (`tapLight`/`success`/`error`, no-op op web/zonder hardware, fire-and-forget). `tapLight` zit in `Checkbox` (afvinken + elke keuze, overal via `TaskRow`); `success`/`error` op opslaan resp. validatie-/serverfout in de taak-, uitgave- en plant-editor. |
| STR-9 | Platform/UX | Toast + ongedaan-maken | 1.5 | Should | M | 🔧 | — | **Gebouwd:** `lib/toast.js` (`ToastProvider`/`useToast`) in `app/_layout.js`; uitgesteld-wissen met "Ongedaan maken" voor Boodschappen-`afgevinkt wissen` én nu ook voor **losse item-deletes** (long-press → item lokaal verbergen, echte delete pas bij verlopen toast, terugdraaibaar zonder re-insert). **Rest:** undo uitrollen naar de overige modules (taak/uitgave/plant-delete) — sluit aan op STR-5 (swipe). |
| STR-10 | Platform/UX | Empty states + illustraties | 1.5 | Should | M | 🔧 | — | **Eigen illustratie-systeem** `lib/illustrations.js` (vaste stage, platte geometrie, palet-tokens, themeable/dark-mode-proof) met 8 scènes (mok/klembord/kar/plant/munten/kalender/bezem/figuurtjes), via een `illustration`-prop op `Empty`. Gewired op Vandaag/Taken/Boodschappen/Planten/Kosten/Agenda/Schoonmaak + groepen-leegstaat. Stijl goedgekeurd (Taken/Today); laatste 6 nog visueel na te lopen. |
| STR-11 | Platform/UX | Beweging via `motion`-tokens | 1.5 | Could | S | ✅ | — | **Af:** `lib/motion.js` — `animateNextLayout()` (zachte `LayoutAnimation` op de eerstvolgende lijst-mutatie, gevoed door de `motion`-tokens) + `prefersReducedMotion()` (gecachte vlag, luistert naar wijzigingen). Gewired op Boodschappen (toevoegen/afvinken/wissen) en Taken (afvinken). "Vier-de-voortgang": het vinkje popt zacht op bij afvinken (`Checkbox`, spring, overal in de app via `TaskRow`). Alles no-op bij "verminder beweging". |

---

## 7. Nieuwe suggesties (uitgebreid)

Een brede brainstorm voor volgende rondes. Voorgestelde ID's reserveren ruimte in de tabel;
neem ze pas op zodra ze "echt" worden. Gegroepeerd naar afstand/aard.

### 7.1 Bestaande modules verdiepen (laaghangend fruit)
- ~~**KLU-2 klus-bibliotheek**~~ — ✅ **gebouwd** (`lib/choreLibrary.js` + `ChoreLibrarySheet`):
  vaste lijst (rookmelder, cv-druk, ontkalken) met één-tik-toevoegen vanaf het Taken-scherm.
- ~~**KLU-3 seizoenssuggesties**~~ — ✅ **gebouwd** als deel van dezelfde bibliotheek
  (`months` per klus → "Past bij &lt;maand&gt;"-sectie). Regelgebaseerd, geen migratie.
- ~~**Plantfoto-cover automatisch (PLA-7)**~~ — ✅ blijkt al **gebouwd**: de nieuwste
  dagboekfoto is al de omslag (`plants.photo_path`) en wordt op de plantkaart getoond.
- ~~**SCH-3 eerlijkheidsoverzicht**~~ — ✅ **gebouwd** (plan 01). De voltooiings-log
  `task_completions` (migratie 0012) lost de doorrol-amnesie op: `completeTask` logt nu
  elke beurt, óók bij doorrollende terugkerende taken. "Wie deed hoeveel" staat op het
  Schoonmaak-scherm (`lib/fairness.js`, `useTaskCompletions`, `FairnessBars`). Tegelijk
  ✅ **KLU-4 beurtrotatie** op dezelfde log/migratie (`lib/rotation.js`).
- **Agenda: losse afspraken zonder taak-overhead** (AGE-3) — nu is elke afspraak een `tasks`-rij;
  overweeg een lichtere "event"-flow voor puur-agenda-items (begin/eindtijd, geen afvinken).
- **Kosten: terugkerende uitgaven** (KOS-4) — huur/abonnementen die maandelijks automatisch
  als uitgave verschijnen; sluit aan op de bestaande recurrence-logica.

### 7.2 Cross-cutting platform
- **Notificaties & herinneringen** (PLT-1) — push/lokale notificaties: "3 taken vandaag",
  "Monstera water geven". Raakt elke module; `expo-notifications`. Hoge waarde.
- **FND-3 kinderprofielen concreet** — profiel-zonder-account onder een ouder als eerste stap;
  ontgrendelt subgroep-privacy in de praktijk.
- **Offline-modus / optimistic UI** (PLT-2) — acties direct tonen, sync op de achtergrond;
  gezinnen gebruiken de app onderweg met wisselend bereik. *Optimistic UI is opgenomen als
  **STR-7** (Fase 1.5); de volledige offline-modus blijft hier als latere uitbreiding.*
- **Globaal zoeken** (PLT-3) — over taken/boodschappen/planten/uitgaven heen.
- **Data-export & print** (PLT-4) — boodschappenlijst/saldo als CSV of deelbare tekst.
- **Toegankelijkheids-audit** (PLT-5) — sluit aan op `DESIGN.md` (48dp-targets, contrast AA,
  font-scaling); systematisch nalopen + smoke-test met VoiceOver/TalkBack. *Wordt deels
  geraakt door de cohesie-slag **STR-3/STR-4** (Fase 1.5): schermen die uit `lib/ui.js`
  zijn opgebouwd erven de toegankelijkheid; de systematische audit blijft hier.*
- **Activiteiten-/wijzigingenfeed** (PLT-6) — "Tim vinkte 'stofzuigen' af", "Erik voegde melk toe".

### 7.3 Nieuwe module-ideeën
- **Voorraad / voorraadkast** (VOO-1) — wat is in huis + houdbaarheid; bijna op → suggestie
  naar de boodschappenlijst. Natuurlijke buur van Boodschappen.
- **Maaltijden / weekmenu** (MLT-1) — weekmenu plannen en daaruit automatisch een
  boodschappenlijst genereren. Sterke koppeling met Boodschappen + Voorraad.
- **Documenten- & garantiekluis** (DOC-1) — bonnetjes, handleidingen, garanties, contracten
  per item; herinnering bij aflopende garantie. Hergebruikt Storage-patroon van Planten.
- **Huisdier-verzorging** (HUI-1) — analoog aan Planten: voeren/medicatie/dierenarts als
  terugkerende taken; deelt vrijwel de hele plant-infrastructuur.
- **Gezamenlijke wensen-/cadeaulijst** (WEN-1) — verlanglijst per lid; subgroep-privacy zorgt
  dat de ontvanger zijn eigen cadeau niet ziet (precies het scenario uit §1).

### 7.4 Slim & verbonden (Fase 3, AI/extern)
- **PLA-6 AI-soortherkenning**, **BOO-7 AI-bonextractie**, **BOO-4 supermarktvergelijking**,
  **BOO-8 frequentie-voorspelling**, **AUT-3 autodelen tussen huishoudens** — reeds in de
  tabel; hier samengevat als de "slimme" eindfase.
- **AI-assistent over je eigen data** (AI-1) — natuurlijke-taalvragen ("wat gaf ik deze maand
  aan boodschappen uit?", "welke plant heeft water nodig?") bovenop de bestaande tabellen.

### 7.5 Kwaliteit & infra
- **E2E-tests** (INF-3) — Maestro of Detox voor de kritieke flows (onboarding, taak afvinken,
  uitgave splitsen) bovenop de bestaande units.
- **Foutrapportage/monitoring** (INF-4) — Sentry of vergelijkbaar voor crashes in productie.
- **Release-pijplijn** (INF-5) — EAS Build/Submit naar TestFlight/Play Internal.
- ~~**Meertaligheid (i18n-fundament)** (INF-6)~~ — 🔧 **laag gelegd** (`lib/i18n.js` + units;
  `taken.js` als referentie gemigreerd). Nieuwe code via `t(...)`; rest incrementeel. Zie §6.
- **Meertaligheid (i18n-fundament)** (INF-6) — strings nu nog NL-hardcoded; een i18n-laag
  voorbereiden maakt latere talen goedkoop.
- **Expo-Go-toestel-deblokkade** (INF-7) — firewall block-all + Defender-quarantaine van ngrok
  blokkeert nu toestel-testen (zie projectgeheugen); een werkende dev-flow op een echt toestel
  opzetten (dev build i.p.v. Expo Go, of tunnel-uitzondering).
