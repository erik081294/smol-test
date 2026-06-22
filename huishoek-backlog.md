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

> **Status-update (laatst herzien: 2026-06-19).** Fase 0 **én** Fase 1 zijn **af in de
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
> - **Fase 2 — Boodschappen-intelligentie + AI-scan (2026-06-19, plan 02)** — **BOO-5**
>   productcatalogus/matching, **BOO-2** handmatige bon (trap 1) en **BOO-3** prijstracker
>   gebouwd (datalaag + hooks + schermen); migratie `0013` **live** (DB op `0013`), RLS-tests
>   groen (**155 tests**). Daarbovenop **BOO-7** AI-bonscan via een `scan-receipt` Edge Function
>   naar de **Orq.ai**-gateway (foto → JSON → bewerkbare editor als vangnet). Alle code
>   **gecommit + gepusht**; resteert de **web-rooktest** (→ 🔧) en, account-afhankelijk, het
>   activeren van de Orq-deployment + secrets voor de scan.
>
> - **i18n-locale-detectie af (2026-06-19)** — `lib/i18nRuntime.js` (commit c68592a):
>   apparaat-taaldetectie (`expo-localization`) + taalwissel + persistentie, gewired in
>   `app/_layout.js`. Het laatste open stuk van **INF-6** is daarmee dicht.
>
> - **Fase B — dev-build klaar + toestel-rooktest gedaan (2026-06-19)** — de EAS Android
>   `development`-build is **finished** (APK, build `76fd754c…`) en geïnstalleerd op een
>   **moto g72 (Android 13)**. Gestart via **USB + `adb reverse`** met een dev-client-deeplink
>   naar `localhost:8081` (omzeilt de firewall-LAN-val — `--localhost` niet eens nodig).
>   **Rooktest groen op toestel** (screenshots + UI-dumps): login, navigatie + álle tabs
>   renderen; taken afvinken (doorrol bevestigd: 25 jul→1 aug→8 aug); boodschap
>   toevoegen/verwijderen + **undo-toast** (`'Melk' gewist` + Ongedaan maken); productcatalogus
>   (BOO-5), prijstracker-detail + empty state (BOO-3), bon-editor (BOO-2, incl. "Scan bon"-knop
>   + lopende totaalcontrole) en kosten/saldo ("Je staat gelijk") — **geen redbox/JS-fouten**,
>   sterke a11y-labels. Daarmee **INF-7 ✅** en de boodschappen-🔧 **BOO-2/3/5 op toestel
>   bevestigd**. **Rest:** bon écht end-to-end opslaan (`create_purchase`), BOO-7-scan
>   (Orq-secrets), INF-3 Maestro-kalibratie + INF-4 Sentry-DSN, en de 2-account-rooktest
>   (`VERIFICATIE.md` Stap 3). Mini-bug gezien: spatie mist in kosten-metaregel
>   ("1 deelnemer· 18 jun.").
>
> - **Volgende ronde gepland (2026-06-20): drie features met max. gebruikerswaarde** —
>   build-ready uitgewerkt in `docs/plans/`: **09 Slimme keuken-loop** (Maaltijden MLT-1/MLT-2
>   + Voorraad VOO-1, bovenop de catalogus), **05 Notificaties** (PLT-1, geactualiseerd:
>   lokaal + remote, incl. maaltijd-/voorraad-herinneringen) en **04 Kosten & autodelen**
>   (KOS-3/4, AUT-1/2, geactualiseerd: bon→uitgave nu echt via `purchases`). Samenhang:
>   menu → lijst → voorraad → herinneringen → kosten. Nieuwe migraties (vanaf `0016`); nog te bouwen.
>
> - **Volgende ronde GEBOUWD (2026-06-20, branch `claude/keuken-notif-kosten`)** — alle drie
>   de features staan in code, getest (units groen, lint 0 errors) met RLS-integratietests
>   erbij: **MLT-1/MLT-2/VOO-1** (keuken-loop, migratie `0016`), **PLT-1** (notificaties
>   lokaal+remote, `0018`), **KOS-3/4 + AUT-1/2** (kosten & autodelen, `0017`). Status 🔧:
>   migraties `0016`–`0018` nog **live pushen** + RLS-tests met secrets + web-/toestel-rooktest
>   (zie `VERIFICATIE.md`), dan → ✅. Pure logica: `lib/mealPlan.js`, `lib/pantry.js`,
>   `lib/notifications.js` (uitgebreid), `lib/reservations.js`, `lib/recurringExpense.js`.
>
> - **Kleine UX-ronde GEBOUWD (2026-06-22, branch `claude/backlog-review-plan-6mhws5`)** —
>   drie no-migratie-items, units groen + lint 0 errors: **UX-8** opstart-/wachtscherm
>   (geen onboarding-flits meer; pure gate `lib/appRoute.js` + `SplashWait`) → ✅,
>   **UX-11** kleinere FAB met label → ✅, en **UX-12** back-naar-Meer via
>   `backBehavior="history"` → 🔧 (nog een Android-toestelcheck).
>
> - **Specs uitgewerkt voor de volgende ronde (2026-06-22)** — Grote-aankopen (plan 03)
>   bewust **uitgesteld**; in plaats daarvan zijn vier andere ontwikkelingen build-ready
>   gemaakt in [`docs/plans/`](docs/plans/00-overzicht.md): **10** Taken-redesign (TKN-1/3,
>   TKN-2 onderzoek), **11** interactie-/navigatie-polish (UX-6 dialoogsysteem + UX-10
>   "vorige"-lintje), **12** Vandaag-widget-grid-epic (VDG-1..8, gefaseerd) en **13** kleine
>   features (PLA-8 cross-plant tijdlijn, BOO-8 aankoopfrequentie). Status van deze items in
>   de tabel blijft ⏳ (gespecificeerd, nog te bouwen); zie de stap-voor-stap-volgorde in
>   plan 00.
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

> **Single source of truth.** Deze tabel is de énige plek voor projectstatus (wat af / open).
> Maak géén losse `handover`-/`vervolgplan`-/status-docs meer — werk deze tabel bij. Naslag
> (how-to) hoort in `README.md`, `DESIGN.md`, `VERIFICATIE.md` en `docs/*-setup.md`; eenmalige
> analyses (zoals `docs/audit-2026-06-21.md`) en `docs/plans/*` zijn historische onderbouwing,
> geen status. Verificatie van RLS/RPC's zonder secrets: `docs/rls-connector-check.sql`.

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
| BOO-2 | Boodschappen | Bonnetje — handmatig invoeren (trap 1) | 2 | Should | L | ✅ | BOO-5 | **Datalaag + UI af (plan 02, 2026-06-19); editor op toestel bevestigd (2026-06-19).** Bon invoeren met regels (winkel/datum/aantal/eenheid/prijs), live matching-suggestie per regel + lopend-totaal-controle: `app/purchase/[id].js`, hook `lib/usePurchases.js`, RPC `create_purchase` (migratie 0013, **live**). Foto optioneel/later (bucket `receipts`, 0014). Toestel-rooktest: editor + alle velden + "Scan bon"-knop + totaalcontrole renderen, geen JS-fouten. **Rest:** één bon écht end-to-end opslaan (matching → `create_purchase`). |
| BOO-3 | Boodschappen | Prijstracker | 2 | Should | M | ✅ | BOO-2 | **Datalaag + UI af (plan 02); op toestel bevestigd (2026-06-19).** Productdetail `app/product/[id].js`: laatste prijs per winkel, min/max/trend, sparkline (`react-native-svg`) over de bonregels. Pure kern `lib/priceTrack.js` + units groen; data via `useProductPrices`. Toestel: detail rendert + nette empty state "Nog geen prijsdata" (geen svg-crash). |
| BOO-4 | Boodschappen | Supermarktvergelijking | 3 | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-5 | Boodschappen | Productcatalogus & matching | 2 | Must | M | ✅ | FND-2 | **Datalaag + UI af (plan 02); op toestel bevestigd (2026-06-19).** Tabel `products` (household-breed, is_member-RLS, migratie 0013 **live**, RLS-integratietest groen), hook `lib/useProducts.js`, pure matching `lib/productMatch.js` + units. Catalogus-sheet + product-autocomplete + inline "nieuw product" in `app/(tabs)/boodschappen.js`; `groceries.product_id`-koppeling. Toestel: catalogus-sheet laadt producten + opent productdetail. **Globale catalogus-import omgebouwd (2026-06-21):** van de OFF-API naar de **OFF data-dump** (OFF's eigen aanbeveling voor bulk) — streaming `scripts/import-off-dump.mjs` + pure, unit-geteste filter `lib/offCatalog.js` (NL-subset, kwaliteitsfouten eruit, beste taalnaam, dedup op code). DRY-RUN + connector-upsert/zoek geverifieerd. ODbL/CC-BY-SA-attributie in `app/catalog.js`. Runbook + licentie/share-alike-noot: `docs/off-catalog.md`. Draaien (dump + service-role) = handmatige stap. **Vers houden (2026-06-21):** incrementele delta-refresh `scripts/refresh-off-delta.mjs` — watermerk in `catalog_sync_state` (migr. `0028`), idempotent, gat-detectie (self-heal → volle her-import), gedeelde streaming-ingest (`scripts/off-ingest.mjs`) met de volle import. **Dagelijkse scheduled GitHub Action** (`.github/workflows/off-catalog-refresh.yml`, no-op tot de secrets gezet zijn). Pure delta-logica `lib/offDelta.js` + units; refresher lokaal DRY-RUN-geverifieerd + sync-state via connector. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | 3 | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie (foto → regels) | 3 | Could | L | 🔧 | BOO-2 | **Gebouwd (2026-06-19).** "Scan bon"-knop in de bon-editor → foto → Supabase Edge Function `scan-receipt` (Deno) proxiet naar de **Orq.ai AI Gateway** (model-router, vision) → gestructureerde JSON (winkel/datum/regels in centen) → vult de bewerkbare editor; gebruiker controleert (totaal-check + per-regel matching) vóór opslaan = vangnet. `ORQ_API_KEY` server-side (secret), functie achter `verify_jwt`. **Rest (jouw account):** Orq-deployment `receipt-extractor` aanmaken + secrets zetten + `supabase functions deploy scan-receipt` — zie [`docs/orq-receipt-scan.md`](docs/orq-receipt-scan.md). Kosten per scan via Orq meewegen. |
| BOO-8 | Boodschappen | Aankoopfrequentie leren | 3 | Could | M | ✅ | BOO-3 | **Gebouwd:** pure heuristiek `lib/buyFrequency.js` (`purchaseIntervals`/`frequencyEstimate`/`frequencyLabel` — mediaan-interval, `dueScore = daysSince/medianDays`, null bij <2 aankopen; units in `tests/buyFrequency.test.js`). Aggregatiehook `useProductFrequencies()` (bonregels join purchases, household-gescopet). UI: "Misschien weer nodig"-rij in `app/(tabs)/boodschappen.js` met producten waarvan `dueScore >= 1`, één tik = toevoegen via de bestaande flow; toont het uitlegbare label + "voor het laatst N dagen geleden". Niet opdringerig: alleen bij genoeg historie (live DB heeft nu 1 aankoop/product → rij verschijnt terecht niet). Begon als simpele 'je koopt dit meestal rond nu'-suggestie. |
| BOO-11 | Boodschappen | Vaste boodschappen (snel toevoegen uit je repertoire) | 2 | Should | M | 🔧 | BOO-5 | **Gebouwd (2026-06-21).** Leunt op je geschiedenis: een "Vaste boodschappen"-sheet (de `repeat`-knop op Boodschappen) toont je eigen `products` per schap (gecategoriseerd via `catalog_categories`), gesorteerd op gebruik → recency → naam, met een filter. Eén tik = op de lijst (blijft open voor meerdere); producten die al op de open lijst staan tonen "✓ op je lijst" (geen dubbels); de chevron opent de prijstracker. Gebruiksteller `products.times_added`/`last_added_at` via trigger op groceries-insert (migr. `0029`, backfill uit historie — connector-bewezen). Pure groepering/sortering `lib/favoriteGroceries.js` + units. Lege-staat van de lijst wijst nu ook naar je vaste boodschappen. **"Meest gekozen"-sectie** bovenaan (globale top-8 op gebruik). **Subtiel verbergen:** lang-indrukken verbergt een product uit dit overzicht (huishouden-breed, `products.hidden` migr. `0030`, undo-toast), met een "{n} verborgen tonen"-schakelaar + een Verborgen-sectie om weer te tonen (lid-write via `products_member`-RLS, connector-bewezen). **Rest:** rendering/realtime op een toestel bevestigen. |
| BOO-9 | Boodschappen | Barcode scannen → catalogus | 2 | Should | M | ◐ | BOO-5, VOO-1 | **Datalaag af (2026-06-21); scanner-UI is device-gated.** Geen migratie nodig voor matching — `catalog_products.code` (0014) is de EAN. **Af:** `lib/barcode.js` (normaliseren + GTIN-checksum + UPC-A→EAN-13) + `lib/openFoodFacts.js` (live OFF-lookup + pure parser) + units `tests/barcode.test.js` (canonieke EAN/UPC/EAN-8); `lib/barcodeLookup.js` (`lookupBarcode` → catalogus, anders OFF + toevoegen); RPC `insert_catalog_product` (migr. `0027`, `on conflict do nothing` zodat de gedeelde catalogus organisch groeit zónder curated data te overschrijven — connector-bewezen). Live-scan + dump-import delen nu **één categorie-brein** (`lib/offCategoryMap`): een gescand product krijgt meteen het juiste schap i.p.v. "Overig" (de categorie wordt ook door de RPC bewaard, migr. `0031` — review-fix). **Rest (vereist dev build):** `expo-camera` (~56) toevoegen → scanner-scherm (`CameraView` `onBarcodeScanned` → `lookupBarcode` → bottom-sheet: tik = `useGroceries.add(name,null,id)` óf `usePantry.add({catalogProductId:id})`; `unknown`/`invalid` → bestaande inline-nieuw-product-flow) + een scan-knop op Boodschappen/Voorraad. |
| BOO-10 | Boodschappen | Bonnen bewerkbaar maken | 2 | Could | M | 🔧 | BOO-2 | **Gebouwd (2026-06-21).** Symmetrie met bewerkbare uitgaven: `update_purchase`-RPC (migr. `0033`, kop bijwerken + regels atomair vervangen, spiegel van `update_expense`) + `usePurchases.updatePurchase`; `app/purchase/[id].js` heeft nu een "Bewerken"-knop die de read-only bon in dezelfde editor opent (voorgevuld), met behoud van de Splitsen/Voorraad-acties. `update_purchase` mirrort de connector-bewezen `update_expense` (de connector-rollbacktest kon hier niet draaien wegens een approval-gate). **Rest:** bewerken op een toestel bevestigen. |
| PLA-1 | Planten | Plant toevoegen + foto | 1 | Must | M | ✅ | FND-2 | Foto-opslag via Supabase Storage (migratie 0010, `lib/plantPhoto.js`). |
| PLA-2 | Planten | Soortdatabase + verzorgingsregels | 1 | Must | M | ✅ | — | Geseed via migratie 0009; regelgebaseerd, uitlegbaar. |
| PLA-3 | Planten | Verzorgingsschema op maat | 1 | Should | M | ✅ | PLA-2 | `lib/plantCare.js` → terugkerende taken per seizoen. |
| PLA-4 | Planten | Verzorgingskaart | 1 | Should | S | ✅ | PLA-2 | `careCard()` in `app/plant/[id].js`. |
| PLA-5 | Planten | Plant-tijdlijn (foto's + notities) | 2 | Could | S | ✅ | PLA-1 | Vervroegd gebouwd: posts over tijd op één verticale rail in `app/plant/[id].js`. Migratie 0011 (`plant_photos`). **2026-06-22:** het losse "Dagboek"-stripje (horizontale thumbnails) was dubbelop met de tijdlijn en is weg; de **tijdlijn** is nu de enige weergave. Je kunt nu ook een **notitie zonder foto** plaatsen (knop naast de Tijdlijn-kop) — `addPlantNote` in `lib/usePlants.js`, `photo_path` nullable + `photo_or_note`-check (migratie **0035**, nog te pushen). Notitie-posts worden bewust nooit de cover; `deletePlantPhoto` slaat storage over bij een notitie en herstelt de cover alleen op echte foto's. |
| PLA-6 | Planten | AI-soortherkenning | 3 | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-7 | Planten | Plantfoto-cover automatisch | 2 | Could | S | ✅ | PLA-5 | Nieuwste dagboekfoto is de omslag (`plants.photo_path`) — al geregeld in `addPlantPhoto`/`deletePlantPhoto` en getoond op de plantkaart. Geen extra werk nodig. |
| PLA-8 | Planten | Cross-plant tijdlijn (alle planten) | 2 | Could | M | ✅ | PLA-5 | **Gebouwd (volgens aanrader b):** header-`IconButton` (`timeline`) in `app/(tabs)/planten.js` → eigen route `app/plant/timeline.js`; hook `useHouseholdPlantTimeline()` (join `plants(id,name)`, RLS-gescopet, realtime); dag-secties via pure `lib/plantTimeline.js` (`groupTimelineByDay`/`relativeDayLabel`, units). **Oorspronkelijke notitie:** Sub-overzicht: één tijdlijn van álle planten door elkaar (foto's + notities), nieuwste eerst, met per post een mini-thumb/notitie-icoon, de **plantnaam** + datum, en tik → naar de plant-detail. Lost een echt gat op: nu zie je groei/zorg alleen plant-voor-plant; een gecombineerde feed laat je "wat gebeurde er deze maand in huis" terugbladeren — visueler en plant-specifieker dan de tekst-only **Activiteit**-tab (die uit de voltooiingen-log komt). **Plaatsing (afgewogen):** (a) *segmented control* bovenaan Planten — **Rooster ⇆ Tijdlijn** (Foto's-app-patroon: Bibliotheek/Voor jou): meest vindbaar, maar laadt veel foto's op het hoofdscherm; (b) **header-actie → eigen route `/plant/tijdlijn`** *(aanbevolen)*: houdt het raster de rustige default, geen extra last op het hoofdscherm, en de aparte route kan **pagineren**/lazy-loaden; (c) *ingeklapte sectie* op het hoofdscherm: rommeliger en alsnog grid-belasting. **Aanrader: (b)** — een `IconButton` (icoon `feed`/`timeline`) in de `ScreenHeader` van `app/(tabs)/planten.js` naar een nieuwe route. **Data:** nieuwe hook `useHouseholdPlantTimeline()` → `plant_photos` van het actieve huishouden, `order(created_at desc)`, **joinen met `plants(name)`** voor het label; RLS scoopt al op parent-zichtbaarheid (geen lek). **Performance:** signed URLs zijn per-foto en duur → **pagineren** (bv. 30/pagina, infinite scroll) en URL-resolve per zichtbare rij (`usePlantPhotoUrl` per item, zoals nu) of een batch-`createSignedUrls`. **Hergebruik:** de `TimelineEntry`/rail-component uit `app/plant/[id].js` generaliseren (prop voor de plantnaam-regel) en **dag-/maandkoppen** toevoegen voor de cross-plant-versie. **Empty state:** illustratie `plants` + "Nog niets om terug te bladeren". Geen migratie (leunt op 0011/0035). |
| PLA-9 | Planten | Bulk planten toevoegen ("plant-rondje" met rollende camera) | 3 | Could | L | ⏳ | PLA-1, UX-7 | **Idee (gebruikerswens):** in één doorlopende beweging je huis "rondlopen" en plant ná plant met de camera vastleggen, mét begeleiding per plant, en pas **achteraf** de details afmaken. Lost de frictie op dat je nu vóór élke volgende plant het volledige formulier (soort, ruimte, water, zichtbaarheid) moet doorlopen — te traag om er 10 in één keer toe te voegen. **Flow (state machine, per plant):** een camera-scherm met een **gekleurd kader/chrome** rond de zoeker (geen full-bleed): de bovenrand toont de **voortgang** ("3 toegevoegd · nu plant 4") + een hint, de onderrand de sluiter + **"Afronden"**. Na de sluiter een korte **review "Staat 'ie er goed op?"** (Behouden / Opnieuw), dan **"Geef hem een naam"** (autofocus-veld), dan **"Notitie toevoegen?"** (optioneel → als tijdlijn-notitie), dan **"Volgende plant"** (terug naar de camera, teller +1) of **"Afronden"**. Bewust **minimale invoer** per plant: alleen foto + naam (+ notitie). **Direct persisteren per plant (aanbevolen):** elke "Volgende"/"Afronden" schrijft de plant meteen weg via het bestaande `addPlant` (`lib/usePlants.js`) → een onderbreking verliest niets, en de foto gaat als omslag + eerste tijdlijnpost mee (`addPlantPhoto`). Een minimale plant is geldig zónder soort door **`waterDays` te defaulten** (bijv. 7) — de huidige `save`-validatie eist een soort *óf* een waterinterval; geen schema-wijziging. Zichtbaarheid = default huishouden. **Details achteraf afmaken ("review & verrijken"):** na **Afronden** een **batch-overzicht** van precies de planten uit déze sessie (ids in-memory meegeven aan de afrond-route — geen DB-kolom nodig), elk met een duidelijke **"nog afmaken"-markering** (ontbrekende **soort** + **ruimte**). Per rij inklapbaar de bekende velden uit de nieuwe-plant-editor (soortzoeker `searchSpecies`, `LOCATIONS`-chips, watergeefdagen, `VisibilityPicker`) → in één doorloop verrijken en bewaren (`updatePlant`). **Plaatsing/ingang (afgewogen):** (a) een **tweede actie op de "+"-FAB** van Planten — tik = één plant (huidig), lang-indrukken/menu = "Meerdere toevoegen"; (b) een **header-actie** (camera/stapel-icoon) → eigen route `app/plant/bulk.js`; (c) alleen vanuit de **lege staat**. **Aanrader: (b)**, met (a) als snelle ingang — houdt de gewone "+" ongewijzigd en geeft de batch-flow een eigen, volledig camera-scherm. **Leunt op UX-7 (in-app camera):** dit is de **eerste afnemer van het generieke `CaptureSession`-primitief** (zie UX-7) — het gekleurde kader + voortgang/hints zíjn de UX-7-overlay, hier geconfigureerd met de plant-flow (naam → notitie → volgende, *opslaan-en-door*); het herbruikbare `CameraCapture` levert de gedeelde asset `{uri,base64,ext}`. Houd de plant-specifieke logica (naam/notitie/afmaken) gescheiden van de generieke lus, zodat boodschappen/schoonmaak later dezelfde sessie met een andere config draaien. **Vereist een dev build** (`expo-camera`; niet in Expo Go/web). **Fallback** zonder in-app camera: dezelfde begeleide lus bovenop `offerImagePicker`/`pickImageAsset` (bibliotheek/native camera in een loop) — minder mooi (geen eigen kader), zelfde flow; web houdt de bibliotheek-picker. **Hergebruik:** `addPlant`/`updatePlant`/`addPlantPhoto`/`addPlantNote` (`lib/usePlants.js`), de asset-helpers (`lib/photoPicker.js`), de editor-velden + `searchSpecies`/`LOCATIONS`/`VisibilityPicker` uit `app/plant/[id].js`, `Editor`/`Field`/`Chip`/`Button` (`lib/ui.js`), haptics + toast. **Geen migratie** (leunt op `plants` 0010 + `plant_photos` 0011/0035). **Edge cases:** permissie geweigerd → fallback-lus; midden in de flow stoppen → reeds-opgeslagen planten blijven + toast "{n} planten toegevoegd — details nog afmaken"; lege naam → vereisen óf auto-naam "Plant {n}" die je later wijzigt; Android-back = "Afronden". **Latere synergie (PLA-6 AI-soortherkenning):** de review-stap kan straks de **soort uit de foto** voorstellen en de naam voorvullen → nóg minder typen per plant. |
| SCH-1 | Schoonmaak | Kamer-/zonegerichte taken | 1 | Should | M | ✅ | FND-2 | Zones + `tasks.zone_id`. Migratie 0006, `lib/useZones.js`. |
| SCH-2 | Schoonmaak | Schoonmaakrooster in één keer | 1 | Should | M | ✅ | SCH-1 | Template → meerdere terugkerende taken. `lib/cleaningTemplates.js`. |
| SCH-3 | Schoonmaak | Beurtverdeling + eerlijkheidsoverzicht | 2 | Could | M | ✅ | SCH-1 | Voltooiingen-log `task_completions` (migratie 0012) lost de doorrol-amnesie op; `completeTask` logt nu elke beurt. `lib/fairness.js` → `tally`, hook `useTaskCompletions`, component `FairnessBars`, kaart "Wie deed hoeveel" (Week/Maand/Alles) op het Schoonmaak-scherm. **Eenheid-caption (2026-06-21, commit `3d1b758`):** *"Afgevinkte schoonmaaktaken per lid"* onder de titel maakt duidelijk dat de kale telling (bijv. 64) om voltooiingen gaat. |
| AAN-1 | Grote aankopen | Aankoop-dossier | 2 | Should | M | ⏳ | FND-1 | Titel, budgetrange, deadline, wie beslist mee. Subgroep-gescoped. |
| AAN-2 | Grote aankopen | Opties verzamelen | 2 | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. |
| AAN-3 | Grote aankopen | Vergelijktabel | 2 | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | 2 | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing bewaren. |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | 3 | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-1 | Agenda | Kalenderweergave + subgroep-filter | 1 | Should | L | ✅ | FND-1 | Eigen maandgrid (geen native lib). `lib/agenda.js`, migratie 0005. |
| AGE-2 | Agenda | Sync met telefoon-agenda | 3 | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| KOS-1 | Kosten | WieBetaaltWat — uitgaven & splitsen | 1 | Should | L | ✅ | FND-1 | Splitsing gelijk/aandeel/exact; `create_expense` RPC. Migratie 0007. **Gehard 2026-06-21 (migr. `0025`):** `create_expense`/`update_expense` valideren dat `paid_by` + elke deelnemer lid is (S-M1); `expense_shares`-schrijfpolicy aangescherpt tot de maker van de parent-uitgave (S-M2); `expense_shares.household_id` gedenormaliseerd voor gefilterde realtime (C2) + `REPLICA IDENTITY FULL` (migr. `0032`) zodat verwijderingen realtime doorkomen. **Bekend (review):** `update_expense` met lege/NULL `p_shares` zou alle shares wissen — de client stuurt dit nooit (computeShares geeft altijd ≥1 share); een harde guard is een eventuele follow-up. |
| KOS-2 | Kosten | Saldo-overzicht & vereffenen | 1 | Should | M | ✅ | KOS-1 | Greedy schuldminimalisatie in `lib/expenses.js`. |
| KOS-3 | Kosten | Kosten koppelen aan modules | 2 | Could | M | ✅ | KOS-1 | **Plan 04 — gebouwd; migratie `0017` live (2026-06-20)**. Bon → "Splitsen met huishouden" via `expenses.source_type/source_id`; `create_expense` uitgebreid. |
| KOS-4 | Kosten | Terugkerende uitgaven | 2 | Could | M | ✅ | KOS-1 | **Plan 04 — gebouwd; `0017` live**. `recurring_expenses` + `useRecurringExpenses` (idempotent via partiële unieke index) + `app/recurring-expense`. **Server-side** `run_recurring_expenses()` + dagelijkse `pg_cron`-schedule (migratie `0020`, **live + cron actief 2026-06-20**) materialiseert nu ook zonder open app. |
| KOS-5 | Kosten | Inzichten & budget | 2 | Should | M | ✅ | KOS-1 | **Gebouwd; migratie `0019` live (2026-06-20)**. `expenses.category` (CHECK + index `(household_id, spent_on)`), `households.monthly_budget_cents`, `create_expense` met `p_category`. `lib/insights.js` (per maand/categorie, budgetstatus) + `app/kosten-inzichten.js`: 6-maands-staafgrafiek, maandkiezer, budget-voortgangsbalk, categorie-uitsplitsing. |
| AUT-1 | Autodelen | Gedeeld item + reserveringskalender | 2 | Could | M | ✅ | KOS-1 | **Plan 04 — gebouwd; `0017` live**. Module `delen`, `shared_resources` + `reservations` (kind-RLS), reserveren met dubbelboek-waarschuwing (`lib/reservations.js`). **Reserveringen-kalender** (maandweergave + lijst-toggle via `agenda.monthMatrix` / `reservations.reservationsByDay`) toegevoegd. |
| AUT-2 | Autodelen | Gebruik → kosten | 2 | Could | M | ✅ | AUT-1 | **Plan 04 — gebouwd; `0017` live**. "Kosten verdelen" naar gebruik (km → `computeShares` shares) of gelijk, via `create_expense`. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | 3 | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| MLT-1 | Maaltijden | Weekmenu → boodschappenlijst | 2 | Should | M | ✅ | BOO-5 | **Plan 09 — gebouwd; migratie `0016` live (2026-06-20)**. `app/(tabs)/maaltijden.js` (week-overzicht), "Boodschappen aanvullen" via `add_groceries` (behoefte − voorraad), units `lib/mealPlan.js`. |
| MLT-2 | Maaltijden | Recepten + ingrediënten | 2 | Should | M | ✅ | BOO-5 | **Plan 09 — gebouwd; `0016` live**. `recipes`/`recipe_ingredients`, `app/recipe/[id].js`, gekoppeld aan producten/catalogus (`useProducts.suggestFor`). Ingrediënten inline bewerkbaar via UX-3. |
| MLT-3 | Maaltijden | Recept-foto | 2 | Could | S | 🔧 | MLT-2 | **Gebouwd (2026-06-21).** Omslagfoto in de recept-editor (`app/recipe/[id].js`), gespiegeld op de plantfoto-flow. Storage-bucket `recipes` + household-gescopete RLS (migr. `0034`, mirror van `0010`); `recipes.photo_path` bestond al (`0016`). Gedeelde helpers: `lib/photoPicker.js` (STR-4) + `lib/photoStorage.js` (generieke upload/signed-URL); `useRecipes.addRecipePhoto`/`useRecipePhotoUrl`. **Rest:** kiezen/uploaden/tonen op een toestel bevestigen (camera + storage). |
| VOO-1 | Voorraad | Voorraad + houdbaarheid | 2 | Should | M | ✅ | BOO-5 | **Plan 09 — gebouwd; `0016` live**. `app/(tabs)/voorraad.js` (urgentie/plaats, status-badges, "op de lijst"), bij te vullen uit een bon. Units `lib/pantry.js`. |
| VOO-2 | Voorraad | Voorraad vullen via barcode | 2 | Could | S | ⏳ | BOO-9, VOO-1 | Scan-resultaat van BOO-9 ook direct als voorraad-item kunnen toevoegen (naast op de lijst). Deelt de scan-flow; alleen een extra bestemming. |
| PLT-1 | Platform | Notificaties & herinneringen | 2 | Should | M | 🔧 | — | **Plan 05 — trap 1 af; migratie `0018` (`push_tokens`) live (2026-06-20)**. Trap 1 lokaal (`expo-notifications`, `useNotifications`, prefs-scherm) werkt. **Trap 2 remote nu productie-klaar (2026-06-21):** `notify` opgesplitst in pure kern (`core.js`, event-router + handler-registry, 7 units in `tests/notify.test.js`) + impure schil (`index.ts`) met gedeeld-geheim-check (`x-notify-secret`, fail-closed + constant-time), idempotentie + audit (`push_deliveries`, migratie `0023`), batchen (≤100) en automatische opruiming van dode tokens (`DeviceNotRegistered`). `verify_jwt=false` in `config.toml`. **Rest = flip-on** (migratie `0023` is live sinds 2026-06-21): secret `NOTIFY_WEBHOOK_SECRET` zetten, `functions deploy notify` (nog niet gedeployed), Database Webhook op `tasks`, 2-account-toesteltest — exact in `docs/notify-setup.md`. |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | 2 | Could | M | 🔧 | — | **Gebouwd (2026-06-21).** Afgeleid uit de voltooiingen-log `task_completions` (geen nieuwe tabel), RLS-gescopet, realtime via het gedeelde `useRealtimeReload`-primitief (INF-8). Pure kern `lib/activity.js` (event→NL-regel via registry, uitbreidbaar naar uitgaven/bonnen; `relativeTime`; `buildFeed`) + units `tests/activity.test.js`; hook `lib/useActivity.js` (actor-naam uit de geladen leden, à la `fairness.js`). UI: scherm `app/(tabs)/activiteit.js` (module onder "Meer", `feed`-icoon) + Thuis-kaart `ActivityCard` (laatste 3 → doorlink). 208 tests groen, lint 0 errors. **Feed-compressie (2026-06-21, commit `3d1b758`):** opeenvolgende identieke acties worden samengevouwen tot één regel met teller — *"Erik vinkte 'Badkamer schoonmaken' 8× af"* — via groepering van aaneengesloten gelijke events in `buildFeed` (units uitgebreid in `tests/activity.test.js`), zodat een vaak-afgevinkte terugkerende taak de feed niet overspoelt. **Rendering + compressie op toestel bevestigd (2026-06-21);** realtime nog te bevestigen. **Bekende beperking (review):** een taakhernóeming ververst de feed-titel niet realtime (de feed luistert op `task_completions`, niet op `tasks`); de titel klopt weer bij de volgende completion/pull-to-refresh. Later: extra event-typen (uitgave/bon) in de registry. |
| UX-1 | Platform | Design-/icon-systeem (Phosphor) | 1 | — | M | ✅ | — | `DESIGN.md`, `lib/icons.js`, tokens in `lib/theme.js`, componenten in `lib/ui.js`. |
| UX-2 | Platform | "Meer"-overflow-tab navigatie | 1 | — | S | ✅ | FND-2 | `primary`/`MORE_TAB` in `lib/modules.js`, `app/(tabs)/meer.js`. Houdt tabbalk leesbaar. |
| UX-3 | Platform/UX | Editor-flow & bewerkbare records | 2 | Should | M | ✅ | STR-3 | **Gebouwd (UX-sweep, PR #6, 2026-06-21).** Gedeelde `Editor`-scaffold (vaste Bewaar-knop) + `Collapsible` + gedeelde `DateStepper` in `lib/ui.js`; vaste veldvolgorde *wat→wie→wanneer→details→delen→verwijderen*; "Delen met" ingeklapt (`VisibilityPicker collapsible`, strings naar i18n). **Bewerkbare uitgaven** (`update_expense`-RPC, migratie `0022` live) + recept-ingrediënten inline bewerkbaar. Uitgave-datumveld; recurring → undo-toast; reserveren "Hele dag". Conventie in `DESIGN.md`. 189 tests groen. **Dirty-guard (2026-06-21, commit `3d1b758`):** de gedeelde `Editor` vraagt nu bij sluiten/terug-drukken van een *gewijzigd* formulier om bevestiging (`confirmDiscard`, cross-platform: Alert op native / `window.confirm` op web; Android-back onderschept), opt-in via een `dirty`-prop; de taak-editor (`app/task/[id].js`) detecteert dirty via een momentopname bij openen. De andere editors kunnen later dezelfde prop doorgeven. De native Alert wordt te zijner tijd vervangen door het eigen dialoog-systeem (UX-6). |
| UX-4 | Platform/UX | Dark mode afmaken | 2 | Could | M | ✅ | UX-3 | **Gebouwd + op toestel geverifieerd (2026-06-21, commits `a2a42fe` + `e0f050c`).** Geen zware context-migratie nodig gebleken: `lib/theme.js` heeft nu een **light- én dark-palet**; `colors` is één **live, in-place gemuteerd** object (alle `colors.*`-inline-styles lezen automatisch het nieuwe palet), en `type`/`categoryMeta` lezen hun kleur via een **getter** i.p.v. een vooraf-berekende waarde — zo werkt een wissel zónder de (in dev bevroren) style-objecten te muteren. `lib/useTheme.js` bepaalt de effectieve modus (voorkeur systeem/licht/donker + apparaat-schema) en past het palet toe; de **root-remount via `key={`${lang}-${mode}`}`** in `app/_layout.js` (zelfde truc als de taalwissel) hertekent de boom met de nieuwe kleuren. Beeldstijl: "binnenkort"-banner weg, keuze werkt **live**; thema-bewuste `StatusBar`. `app.config.js` `userInterfaceStyle: 'automatic'` + **expo-system-ui** (DayNight-theme, `values-night/`) → vereiste een native rebuild. Handmatig **licht↔donker** over meerdere schermen nagelopen + een contrast-finetuning (`e0f050c`: diepere bg, lichtere kaarten zodat ze oplichten, zichtbare icoon-vlekken). **Bekende beperking:** `Appearance.getColorScheme()` geeft in de **expo-dev-client** altijd `'light'` (de DevLauncher-host overschrijft de night-detectie) → het **'Systeem'**-thema volgt het apparaat pas in een standalone/preview/productie-build; handmatig Licht/Donker werkt overal. |
| UX-5 | Platform/UX | Veilige onderrand overal (edge-to-edge insets: tabbalk, toast, sheets/modals) | 1.5 | Should | S | ✅ | — | **Bug (Android-app + mobiel web): inhoud die op `bottom:0` zit valt onder de systeem-navigatieknoppen** (terug/home/recent bij 3-knops, of de gebaarbalk). Geraakt: (a) de **tabbalk**, (b) de **toast**, en (c) **élke onderaan-ingeschoven sheet/modal** — de laatste knop/inhoud (bv. "Notitie bewaren"/"Verwijderen" in de **Dagboekfoto**-sheet, "Toevoegen" in *recept kiezen* en de *boodschappen-preview*) eindigt áchter de controls. **Oorzaak:** sinds Expo SDK 52+ is **edge-to-edge standaard aan** op Android (in SDK 56 niet meer uit te zetten) → de app tekent áchter de transparante systeembalken. De tabbalk in `app/(tabs)/_layout.js` heeft een **harde `height: 86` zonder `paddingBottom`/safe-area-inset** (een vaste hoogte overschrijft de automatische inset-correctie van React Navigation); de toast heeft een vaste `BOTTOM_OFFSET = 96` (`lib/toast.js`); en de losse bottom-sheets zetten hun paneel direct op `justifyContent:'flex-end'` zónder onder-inset. **Gewenst gedrag (zoals andere apps het cross-device doen): edge-to-edge mét window-insets** — inhoud pal bóven de navigatie-controls, het inset-gebied eronder als rustige witruimte; controls blijven in beeld (géén immersive/verbergen). Patroon van Apple's *Safe Area Layout Guide* (home-indicator ~34pt) en Google's *WindowInsets*/`enableEdgeToEdge`. **Consequente fix (één bron):** `useSafeAreaInsets()` (`react-native-safe-area-context`, al in de app). **✅ Gedaan voor sheets/modals:** gedeelde **`BottomSheet`** in `lib/ui.js` past nu `paddingBottom: Math.max(insets.bottom, space.md)` toe (+ gedimde tik-om-te-sluiten-achtergrond + optionele toetsenbord-ontwijking); `maaltijden` (recept kiezen + boodschappen-preview) en de **Dagboekfoto**-sheet (`app/plant/[id].js`) zijn erop overgezet. **✅ Gedaan voor tabbalk + toast (2026-06-22, geverifieerd op Android-emulator API 36, 3-knops + gebaarnav):** de tabbalk (`app/(tabs)/_layout.js`) krijgt een vaste contenthoogte plus de onder-inset als ademruimte: `height: 56 + Math.max(insets.bottom, space.sm)` met `paddingBottom` idem, via `useSafeAreaInsets()`. Bewust géén `86 + insets.bottom` (eerste poging): de oude 86 hád al ~37 dp eigen onderwitruimte, dus de volle inset eróverheen maakte de balk te hoog — `Math.max` (net als de `BottomSheet`) zet de inset *als* ademruimte met een nette minimumrand wanneer er geen systeem-inset is. De toast-offset (`lib/toast.js`) is `BOTTOM_OFFSET + insets.bottom` zodat 'ie boven de tabbalk blijft zweven. De FAB's zitten allemaal op tab-schermen → zweven boven de inset-gecorrigeerde tabbalk (geen wijziging); de Editor-scaffold gebruikt `SafeAreaView` (handelt de inset zelf af). iOS (home-indicator) profiteert mee. Klein, gelokaliseerd; geen migratie. |
| UX-6 | Platform/UX | Eigen dialoog-/bevestigings- & actiesheet-systeem (native `Alert` vervangen) | 2 | Should | M | ✅ | STR-6, STR-9 | **Gebouwd:** `lib/dialog.js` — `DialogProvider` + `useDialog()` (Promise-based `confirm`/`alert`/`menu`), gemount ná `ToastProvider` in `app/_layout.js`; thema-/dark-mode-bewust, `prefersReducedMotion`-bewust, a11y-focus op de primaire actie. Zelfstandig (geen `ui.js`-import → geen cyclus) met een module-singleton `dialog` voor niet-component-code (`lib/db.js`, `lib/photoPicker.js`, `confirmDiscard` in `lib/ui.js`). **Alle ~66 `Alert.alert`-aanroepen + de web-`window.confirm`-takken in 20 bestanden gemigreerd** (één codepad voor alle platforms). Geverifieerd op de emulator (confirm + actiesheet). **Oorspronkelijke notitie:** De app gebruikte ~50× de **native `Alert.alert`** (+ `window.confirm` op web) voor bevestigingen, foutmeldingen en de foto-bronkeuze — buiten onze stijl, en de knoppen **vuren niet op web** (de reden dat STR-6/STR-9 al veel Alerts verving door inline-validatie + undo-toast). **Doel:** een gethemed dialoog-/sheet-systeem in `lib/ui.js`, met één provider (zoals `ToastProvider`), web-veilig: (1) **`Dialog`/`confirm`** — gestylde bevestiging met titel/body/acties (vervangt de **dirty-guard** `confirmDiscard` in `lib/ui.js` + de delete-/serverfout-`Alert`s); (2) **`ActionSheet`** — bottom-sheet voor keuzes (vervangt de `Alert.alert`-actiesheet camera/bibliotheek/verwijderen in `lib/photoPicker.js` → `offerImagePicker`); (3) **`Banner`/inline error** — niet-blokkerend (sluit aan op STR-6). Te migreren: de ~20 bestanden met `Alert.alert` (meeste hits `app/plant/[id].js`, `app/purchase/[id].js`, `app/(tabs)/boodschappen.js`, `lib/photoPicker.js`). **Andere apps** vervangen native dialogen vrijwel altijd door eigen modals voor merkconsistentie + gelijk gedrag op iOS/Android/web. Animatie via Reanimated (al aanwezig); respecteer `prefersReducedMotion` (`lib/motion.js`). |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | 3 | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | Nu opent fotograferen de **native camera-app** via `ImagePicker.launchCameraAsync` (`lib/photoPicker.js`) — geen grip op kader/overlay/feedback. **Doel:** een eigen camera-scherm met **`expo-camera`** (`CameraView`) in onze stijl: een net **kader/masker** met de juiste verhouding per doel (bon = staand/lang; plant/recept = vierkant of 4:3), **overlay-hints** ("zorg dat de hele bon in beeld is"), **visuele feedback** (sluiter-flash, haptische tik via `lib/haptics.js`, scherpstel-indicator) en een review-stap (behouden/opnieuw). Eén herbruikbaar `CameraCapture`-scherm dat de **gedeelde asset-vorm** `{uri, base64, ext}` teruggeeft (STR-4 `pickImageAsset`), zodat bon (BOO-2/7), plant (PLA-1), recept (MLT-3) en voorraad/product er zónder wijziging op aansluiten; bibliotheek-import blijft de fallback. **Deelt `expo-camera` met BOO-9** (barcodescanner) — bouw ze op één camerafundament (zelfde permissie-flow, één scherm met modus *foto* vs *scan*). **Vereist een dev build** (native module; niet in Expo Go/web → web houdt de bibliotheek-picker). **Andere apps:** een eigen cameralaag is standaard zodra je overlays/uitlijning/merkstijl wilt; documentscanners (bonnen) voegen vaak randdetectie/auto-uitsnede toe — hier een latere uitbreiding. **Batch-modus = generiek primitief (houd 't flexibel).** De zwaarste afnemer is PLA-9 (bulk "plant-rondje"), maar ontwerp de batch-/voortgangsmodus **module-agnostisch en config-gedreven** zodat meer modules 'm hergebruiken: een **`CaptureSession`-primitief** bovenop `CameraCapture` met per afnemer een config — de overlay-/voortgangskopij (teller "{n} toegevoegd" + hints), de "volgende"-lus + review-stap, en wát er per opname gebeurt (*opslaan-en-door* vs *verzamelen-tot-afronden*) plus de optionele review-velden. Denkbare afnemers: **boodschappen** (meerdere bonnen/producten achter elkaar), **schoonmaak** (voor/na-foto's bij een klus/zone), **voorraad** (reeks producten). Telkens dezelfde lus, andere config; PLA-9 is louter de plant-configuratie van dit primitief. |
| INF-1 | Platform | Live-Supabase-verificatie + RLS-tests | 1 | Must | S | 🔧 | — | Migraties 0004–**0025** live (DB op `0025`); op 2026-06-21 via de Supabase-connector toegepast: **`0023` (`push_deliveries`, PLT-1 trap 2)**, **`0024` (`function_search_path`, B4)** en **`0025` (`expense_shares_hardening`, B1/B2 + C2)** — geverifieerd via `list_migrations` + advisors. Kern-RLS + RPC's bewezen via **`docs/rls-connector-check.sql`** (13/13, rol/JWT-impersonatie + rollback, geen secrets nodig). Units **196 / 0 fail** (18 RLS-integratietests lokaal geskipt zonder secrets). Resteert: de volledige JS-RLS-suite mét secrets + egress + de handmatige 2-account-rooktest (`VERIFICATIE.md` Stap 3). Verificatierecept zonder secrets: `docs/rls-connector-check.sql`. |
| INF-2 | Platform | CI-pipeline + testkader | 1 | Should | S | ✅ | — | `.github/workflows/ci.yml`: **lint + units**. `node:test`-units onder `tests/`; ESLint via `eslint-config-expo` (flat config, `eslint.config.js`) als CI-stap die op errors faalt (`no-undef`/`react/jsx-no-undef` = vangnet tegen runtime-`ReferenceError`s zoals "nl is not defined"). De nieuwe React-compiler-regels (`react-hooks/refs|static-components|set-state-in-effect`) staan bewust op "warn". |
| INF-6 | Platform | i18n-fundament | 2 | Should | S | ✅ | — | **Af — hele app gemigreerd + locale-detectie.** `lib/i18n.js` (`t(key, vars)` met `{var}`-interpolatie, zichtbare key-fallback, `setLang`/`getLang`/`registerDict`, simpele `plural`), units `tests/i18n.test.js` (6, groen). Alle zichtbare copy (headers, filters, empty states, sectie-titels, toasts, Alerts, validatie-/foutmeldingen, a11y-labels, pluralisatie) op álle schermen via `t(...)`: 8 tab-schermen + `TaskRow` én de editors (taak/uitgave/plant), auth-welkom, onboarding en huishouden. Bewust níét vertaald (data, geen UI-copy): `LOCATIONS` (opgeslagen waarde van `plant.location`), weekdag-afkortingen (locale-tokens, later via date-fns) en `categoryMeta`/module-labels. **Regel:** nieuwe code gebruikt `t(...)`. **Automatische locale-detectie nu óók af** (commit c68592a): `lib/i18nRuntime.js` — `useLang`-hook (taalwissel herrendert via `useSyncExternalStore`), `initLocale()` leest `expo-localization` apparaat-taal bij eerste start (opgeslagen keuze wint, anders device, anders `nl`-default) + persistentie via AsyncStorage; gewired in `app/_layout.js`. Plan 06. |
| STR-1 | Platform/UX | IA: één bron `tasks`, expliciete weergaven | 1.5 | Must | M | ✅ | — | **Af:** zone reist mee met de taak (`useTasks` embed `zone:zones`, optie `select` in `useCollection`), zichtbaar in `TaskRow` (Taken/Vandaag/Agenda) en bewerkbaar in de taak-editor (zone-kiezer + `zone_id`); per-zone "Taak toevoegen" op Schoonmaak opent dezelfde editor (`?zone=`). Agenda/Schoonmaak hebben nu "dit is een weergave"-subtitels ("Je taken op de kalender", "Je taken per ruimte — afvinken werkt overal door"). Schoonmaak blijft bewust onder "Meer": het is een gespecialiseerde onderhouds-weergave, geen dagelijkse primaire tab. Plan 07 §A. |
| STR-2 | Platform/UX | Navigatie-helderheid | 1.5 | Should | S | ✅ | STR-1 | **Af:** `chevron`-prop op `ItemRow` als expliciete "dit is tikbaar"-affordance op navigerende rijen (Meer-modules, huishouden-subgroepen) — niet op afvink-rijen (die hebben al een checkbox). Detailschermen gebruiken consistent `ModalHeader` (terug/sluit). Schoonmaak-plaatsing heroverwogen → bewust onder "Meer" (zie STR-1). |
| STR-3 | Platform/UX | Schermen naar `lib/ui.js` trekken | 1.5 | Must | M | ✅ | — | **Af — 0 rauwe `TouchableOpacity` in heel `app/`.** Alle editors (taak/plant/uitgave) + alle tab-schermen (boodschappen/huishouden/planten/kosten/agenda/meer/schoonmaak) op `ItemRow`/`IconButton`/`Chip`/`Pressable` + tokens. Bug gefixt: planten-kaart rekte bij oneven aantal de rij vol (ghost-spacer). Pluralisatie "1 deelnemer" gefixt (kosten). |
| STR-4 | Platform/UX | Ontbrekende gedeelde componenten | 1.5 | Should | S | 🔧 | — | **`AvatarSelect`, `EmojiPicker`, `ListSkeleton` én `Editor`/`Collapsible`/`DateStepper` af** (in `lib/ui.js`; laatste drie via UX-3). `EmojiPicker` vervangt de 2× zelfgebouwde emoji-keuzes; `ListSkeleton` is de zachte laad-placeholder. **PhotoPicker geëxtraheerd (2026-06-21):** `lib/photoPicker.js` (`pickImageAsset`/`offerImagePicker`, web/native, generieke `photo.*`-i18n) + `lib/photoStorage.js` (generieke upload/signed-URL), nu gebruikt door de nieuwe recept-foto (MLT-3). **Rest:** de bestaande `app/plant/[id].js`- en `app/purchase/[id].js`-pickers nog migreren naar de gedeelde helpers (low-risk follow-up; bewust niet blind gedaan zonder toestel-verificatie). |
| STR-5 | Platform/UX | Zichtbare item-acties + één primaire actie | 1.5 | Should | M | ✅ | STR-9 | **Af:** geen verborgen long-press meer in `app/` — delete is overal een zichtbare trailing `IconButton` + undo-toast (bewust i.p.v. `Swipeable`: beter ontdekbaar, web-veilig). Schoonmaak: de zwevende `position:absolute`-knop weg → "Weekschema opzetten" in-flow als lijst-footer (bij zones) of als `Empty`-actie (geen rooster). Boodschappen-`+` is een duidelijke ocher-actieknop in de toevoegbalk. |
| STR-6 | Platform/UX | Inline formulier-validatie | 1.5 | Should | S | ✅ | — | **Af:** alle veld-validaties tonen nu inline (`Field`-`error` + foutregel onder de control) i.p.v. blokkerende `Alert` — in taak-, uitgave-, plant-editor, auth-welkom, onboarding en huishouden-subgroep. `Alert` resteert alleen voor bevestigingen (verwijderen) en server-/permissie-fouten. Fout wist bij wijzigen van het veld. |
| STR-7 | Platform/UX | Optimistic UI | 1.5 | Must | M | ✅ | — | **Af — runtime bevestigd op web (2026-06-19).** Optimistische `update`/`remove` met rollback in `useCollection` (raakt alle modules); `completeTask`/`uncompleteTask` vinken direct af (statuswijziging vóór het loggen). Realtime herlaadt de serverwaarheid. Vervangt PLT-2. |
| STR-8 | Platform/UX | Haptics | 1.5 | Could | S | ✅ | — | **Af:** `expo-haptics` toegevoegd (bleek nog niet geïnstalleerd) + `lib/haptics.js` (`tapLight`/`success`/`error`, no-op op web/zonder hardware, fire-and-forget). `tapLight` zit in `Checkbox` (afvinken + elke keuze, overal via `TaskRow`); `success`/`error` op opslaan resp. validatie-/serverfout in de taak-, uitgave- en plant-editor. |
| STR-9 | Platform/UX | Toast + ongedaan-maken | 1.5 | Should | M | ✅ | — | **Af — uitgerold naar alle modules (plan 08 fase A1), runtime bevestigd op web (2026-06-19).** `lib/toast.js` (`ToastProvider`/`useToast`) + uitgesteld-wissen voor Boodschappen én nu **taak/uitgave/plant-delete**: de editor markeert het item via de nieuwe module-globale `lib/pendingDeletes.js`-store (units in `tests/pendingDeletes.test.js`), navigeert terug, en de echte delete volgt pas bij het verlopen van de toast — "Ongedaan maken" haalt de markering weg, zónder re-insert (geen id-/historie-churn). `useCollection`/`useExpenses` filteren pending-ids via `useSyncExternalStore`. De blokkerende confirm-`Alert` verdween daarmee (die vuurde bovendien niet op web). |
| STR-10 | Platform/UX | Empty states + illustraties | 1.5 | Should | M | 🔧 | — | **Eigen illustratie-systeem** `lib/illustrations.js` (vaste stage, platte geometrie, palet-tokens, themeable/dark-mode-proof) met 8 scènes (mok/klembord/kar/plant/munten/kalender/bezem/figuurtjes), via een `illustration`-prop op `Empty`. Gewired op Vandaag/Taken/Boodschappen/Planten/Kosten/Agenda/Schoonmaak + groepen-leegstaat. Stijl goedgekeurd (Taken/Today); laatste 6 nog visueel na te lopen. |
| STR-11 | Platform/UX | Beweging via `motion`-tokens | 1.5 | Could | S | ✅ | — | **Af:** `lib/motion.js` — `animateNextLayout()` (zachte `LayoutAnimation` op de eerstvolgende lijst-mutatie, gevoed door de `motion`-tokens) + `prefersReducedMotion()` (gecachte vlag, luistert naar wijzigingen). Gewired op Boodschappen (toevoegen/afvinken/wissen) en Taken (afvinken). "Vier-de-voortgang": het vinkje popt zacht op bij afvinken (`Checkbox`, spring, overal in de app via `TaskRow`). Alles no-op bij "verminder beweging". |
| INF-8 | Platform | Realtime-primitief & scoping | 1.5 | Should | M | 🔧 | — | **C1+C2 af (2026-06-21).** De gedupliceerde realtime-/channel-boilerplate uit 7 hooks geëxtraheerd naar `lib/useRealtimeReload.js` (C1); de brede `expense_shares`/`purchase_items`-subscripties filteren nu op `household_id` (C2 — migr. `0025` voegde `expense_shares.household_id` toe, `purchase_items` had die al). Lost audit A-H1/A-H2 + deels P-H1/P-H3 op. **Rest (C3, vereist device-verificatie):** incrementeel patchen uit `payload.new/.old` i.p.v. full refetch (alleen platte `select '*'`-collecties; embedded-select-hooks blijven reload-on-event) + kanalen bundelen tot één household-channel. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | 2 | Should | S | 🔧 | — | **Gebouwd + gedeployed (2026-06-21, v2 via connector).** Audit S-M4 opgelost: per-gebruiker rate-limit (20/uur, schuivend venster) via `record_receipt_scan`-RPC + tabel `receipt_scans` (migr. `0026`, RPC-rollbacktest 3→ok/4e→geweigerd) **vóór** de betaalde Orq-call, plus MIME-whitelist (jpeg/png/webp). Pure kern naar `scan-receipt/core.js` + units (`tests/scanReceipt.test.js`). **Rest:** happy-path (echte foto → Orq) op een toestel bevestigen (egress/Orq-key niet beschikbaar in de web-container). |
| INF-10 | Platform | DB-advisor-hardening | 1.5 | Could | S | 🔧 | — | **B4 af (migr. `0024`):** vaste `search_path` op `enable_module_rls`/`search_catalog`. **Rest:** `pg_trgm` uit `public` naar een eigen schema (B5 — let op de afhankelijke trigram-index op `catalog_products.search`) + leaked-password-protection aanzetten (B6 — Auth-dashboard, geen connector-tool). |
| PERF-1 | Platform | Query-vensters & bulk-RPC | 2 | Could | M | ⏳ | INF-8 | Audit P-H2: limit/tijdsvenster op `task_completions`/`expenses`/`tasks` (nu volledige lijsten). P-H4: bulk-RPC voor bon→voorraad i.p.v. rij-voor-rij. Pak na C3 (INF-8) zodat het op het nieuwe realtime-primitief bouwt. |
| PERF-2 | Platform/UX | Waargenomen snelheid: instant tab-wissel (geen laad-flits) | 2 | Should | M | ⏳ | INF-8 | **Doel: van tab wisselen moet *instant* voelen.** Nu opent bij (vrijwel) elke tab-wissel kort een **laad-skelet** vóór de inhoud staat — dat wil de gebruiker weg. **Oorzaak:** elk tab-scherm haalt zijn data via hooks (`useCollection`, `lib/useTasks.js`, `useExpenses`, `usePantry`, …) die **bij elke mount opnieuw** starten met `loading=true` + een **lege lijst** en vers van het netwerk fetchen; er is **geen cache tussen mounts** en de `Tabs` gebruiken **geen `freezeOnBlur`/state-behoud**, dus een tab-wissel toont telkens de `ListSkeleton` (`app/(tabs)/taken.js`, `boodschappen.js`, `voorraad.js`, `delen.js`, `maaltijden.js`, …) terwijl dezelfde data opnieuw geladen wordt. **Fix-richtingen (kies bewust, gelaagd):** (a) **client-cache met stale-while-revalidate** — toon meteen de eerder geladen data en ververs stil op de achtergrond (React Query/SWR óf een eigen lichte in-memory store per `household_id`+tabel, sluit aan op `useRealtimeReload`/INF-8); geen skeleton meer bij hervisite. (b) **`freezeOnBlur`** op de `Tabs` (`app/(tabs)/_layout.js`) zodat een bezochte tab niet hard remount/refetcht. (c) **skeleton-drempel** (~150–200 ms): toon het laad-skelet pas als de fetch écht langer duurt, zodat een snelle hervisite geen flits geeft. (d) gedeelde huishoud-data **hoisten** naar een provider zodat tabs dezelfde in-memory data delen i.p.v. elk apart te laden. **Aanpak:** gelaagd en meetbaar — eerst (a)+(c) als grootste winst per inspanning, daarna (b)/(d) waar nodig; respecteer realtime-waarheid (cache mag stale tonen, moet snel bijtrekken). Bouwt voort op INF-8 (realtime-primitief) en raakt PERF-1 (query-vensters). Verifiëren op dev build/web met echte navigatie, niet blind bouwen. Géén migratie. |
| VDG-1 | Vandaag/UX | Widget-framework: registry, descriptors & host | 3 | Should | L | ✅ | FND-2, STR-3 | **Epic Vandaag-redesign (fundering) — zie §7.6.** Generaliseer het huidige `HOME_CARDS`/`SummaryCard`-patroon (`lib/home/cards.js`, `lib/home/SummaryCard.js`) naar een echte **widget-registry** `lib/widgets/`: elke module declareert ≥1 widget-descriptor `{ key, module, sizes:['compact'\|'breed'\|'groot'], variant:['speels'\|'neutraal'], hook, render }`. Een `WidgetHost` rendert op `key`+`size`+`variant` en roept (net als nu) de module-hook zélf aan zodat de Rules of Hooks intact blijven en widgets `null` kunnen geven zonder nieuws. Eén bron van waarheid voor "welke widgets bestaan er".  **Gebouwd (Fase A+B):** pure grid-engine `lib/widgets/grid.js` (`packGrid`/`deriveDefaultLayout`/`moveWidget`, units), per-module kleurschema's `lib/widgets/colorSchemes.js` (playful/neutral, `widgetScheme`), pure samenvattingen `lib/widgets/summaries.js` (units), `WidgetTile`-skelet + `registry.js` (descriptors, ≥2 widgets voor taken/boodschappen), gerenderd als 2-koloms grid in `app/(tabs)/vandaag.js`. Oude `lib/home/cards.js`+`SummaryCard` vervangen. Geverifieerd op de emulator. |
| VDG-2 | Vandaag/UX | Grid-layout-engine (cell-spans, responsive) | 3 | Could | M | ✅ | VDG-1 | Pure, unit-testbare **tegel-pak-logica**: een kolom-grid (2 kolommen op telefoon, meer op web/tablet) waarin widgets cellen beslaan — beknopt `compact` (1×1), `breed` (2×1) en uitgebreid `groot` (2×2). Geen React in de kern (zoals `lib/agenda.js`/`lib/fairness.js`): in → lijst `{widgetKey, size}`; uit → geplaatste tegels met posities. De grid-renderer leest de registry (VDG-1) en plaatst de tegels; vervangt de verticale `SummaryCard`-stapel in `app/(tabs)/vandaag.js`.  **Gebouwd (Fase A+B):** pure grid-engine `lib/widgets/grid.js` (`packGrid`/`deriveDefaultLayout`/`moveWidget`, units), per-module kleurschema's `lib/widgets/colorSchemes.js` (playful/neutral, `widgetScheme`), pure samenvattingen `lib/widgets/summaries.js` (units), `WidgetTile`-skelet + `registry.js` (descriptors, ≥2 widgets voor taken/boodschappen), gerenderd als 2-koloms grid in `app/(tabs)/vandaag.js`. Oude `lib/home/cards.js`+`SummaryCard` vervangen. Geverifieerd op de emulator. |
| VDG-3 | Vandaag/UX | Bewerkmodus: widgets zelf plaatsen (drag-and-drop) | 3 | Could | L | ✅ | VDG-2, VDG-4 | **Zelf samenstellen.** Een bewerkmodus (long-press of "Aanpassen"-knop): widgets **verslepen/herschikken**, **van grootte wisselen** (compact↔breed↔groot), **verwijderen**, en via een **"+ widget"-kiezer** toevoegen (gegroepeerd per module, met live preview). Bouwt op `react-native-reanimated` (aanwezig) + `react-native-gesture-handler`. Wijzigingen schrijven naar de layout-store (VDG-4). Web-veilig (val terug op pijl-/menu-herschikken waar drag niet kan).  **Gebouwd (bewerkmodus):** 'Aanpassen'-toggle op Vandaag; per tegel een toegankelijke controlebalk — herschikken (‹/›, pure `moveWidget`), grootte (`resizeWidget`), verwijderen (`removeWidget`) en een widget-picker (`addWidget`, via `dialog.menu`). Mutaties gesynct via `useHomeLayout`. **Vinger-drag gebouwd:** `lib/widgets/WidgetGrid.js` — absolute grid + react-native-gesture-handler (`Pan().activateAfterLongPress`) + Reanimated; long-press tilt de tegel op (schaal + schaduw, volgt de vinger) en de andere widgets schuiven realtime mee (withSpring) terwijl je eroverheen sleept; bij loslaten valt 'ie in z'n slot en wordt de volgorde gesynct bewaard. GestureHandlerRootView toegevoegd in app/_layout.js. De knop-herschik (‹/›) blijft als a11y-/web-route. Op de emulator geverifieerd incl. DB-round-trip. Geverifieerd op de emulator + DB-write. |
| VDG-4 | Vandaag/UX | Layout-persistentie & slimme defaults | 3 | Could | M | ✅ | VDG-1 | Bewaar **per gebruiker** welke widgets waar staan, met welke grootte en variant (volgorde + size + variant + module-key). Optie A: nieuwe tabel `home_layouts` (user-scoped RLS, één rij per gebruiker per huishouden, JSON-kolom `layout`) — migratie; Optie B: lokaal + sync-pref. **Default-layout** afgeleid van de ingeschakelde modules (`effectiveModules()`) zodat een nieuwe gebruiker meteen een zinnige Vandaag heeft. Reset/herstel-naar-default. Sluit aan op het module-toggle-model (FND-4).  **Gebouwd (Fase C, Optie A — gesynct):** migratie `0036_home_layout.sql` (tabel `home_layouts`, per gebruiker/huishouden, RLS + realtime; toegepast op de live DB). Hook `lib/useHomeLayout.js` laadt/bewaart (upsert) met val-terug op `deriveDefaultLayout`; `app/(tabs)/vandaag.js` rendert de bewaarde layout. Cross-device via realtime. |
| VDG-5 | Vandaag/UX | Twee stijlen per widget: speels + neutraal | 3 | Could | M | ✅ | VDG-1, VDG-6 | Elke widget rendert in **twee varianten**: een **speelse**, module-getinte stijl (eigen kleurvlak/gradient, een illustratie-accent uit `lib/illustrations.js`, meer persoonlijkheid) én een **neutrale**, rustige stijl (de huidige `SummaryCard`-look: wit, ingetogen). Per widget omschakelbaar in de bewerkmodus. De variant is een descriptor-as (VDG-1), geen aparte component — zelfde data, andere skin.  **Gebouwd (Fase A+B):** pure grid-engine `lib/widgets/grid.js` (`packGrid`/`deriveDefaultLayout`/`moveWidget`, units), per-module kleurschema's `lib/widgets/colorSchemes.js` (playful/neutral, `widgetScheme`), pure samenvattingen `lib/widgets/summaries.js` (units), `WidgetTile`-skelet + `registry.js` (descriptors, ≥2 widgets voor taken/boodschappen), gerenderd als 2-koloms grid in `app/(tabs)/vandaag.js`. Oude `lib/home/cards.js`+`SummaryCard` vervangen. Geverifieerd op de emulator. |
| VDG-6 | Vandaag/UX | Per-module kleur- & beeldtaal-tokens | 3 | Could | M | ✅ | UX-1 | Fundering voor de speelse variant (VDG-5) en het "kleurrijke" doel. `lib/theme.js` kent nu alleen **categorie**-kleuren (`catKlus`/`catHuishouden`/`catPlant`/…); voeg een **module-merkkleurset** toe (bv. boodschappen=oker, kosten=info-blauw, planten=groen, maaltijden=klei, agenda=berry) met soft/tint-varianten, **licht + donker** (spiegelt de bestaande dubbele paletten), AA-contrast bewaakt. Koppel aan `lib/illustrations.js` (al themebaar) voor speelse accenten per module. Eén tokenlaag → widgets erven de kleur automatisch.  **Gebouwd (Fase A+B):** pure grid-engine `lib/widgets/grid.js` (`packGrid`/`deriveDefaultLayout`/`moveWidget`, units), per-module kleurschema's `lib/widgets/colorSchemes.js` (playful/neutral, `widgetScheme`), pure samenvattingen `lib/widgets/summaries.js` (units), `WidgetTile`-skelet + `registry.js` (descriptors, ≥2 widgets voor taken/boodschappen), gerenderd als 2-koloms grid in `app/(tabs)/vandaag.js`. Oude `lib/home/cards.js`+`SummaryCard` vervangen. Geverifieerd op de emulator. |
| VDG-7 | Vandaag/UX | Widget-bibliotheek: meerdere widgets per module (beknopt + uitgebreid) | 3 | Could | L | ✅ | VDG-2, VDG-5 | Concreet **≥2 widgets per module** bouwen, elk in een **beknopt** (één stat/regel) en **uitgebreid** format (lijst/preview/mini-grafiek/snelactie), gemapt op de grid-sizes. Voorbeelden: **Taken** focus-lijst · voortgangsring; **Boodschappen** "te halen"-teller · mini-lijst · snel-toevoegen; **Kosten** saldo · maand-mini-grafiek (`Sparkline`/`BarChart` bestaan al); **Planten** water-vandaag · volgende beurt · cover-foto; **Agenda** vandaag · komende-week-strip; **Maaltijden** "vanavond" · weekmenu-strip; **Voorraad** bijna-op-teller · urgente lijst; **Activiteit** feed-strip. Hergebruikt de module-hooks die de huidige kaarten al gebruiken.  **Gebouwd (Fase A+B):** pure grid-engine `lib/widgets/grid.js` (`packGrid`/`deriveDefaultLayout`/`moveWidget`, units), per-module kleurschema's `lib/widgets/colorSchemes.js` (playful/neutral, `widgetScheme`), pure samenvattingen `lib/widgets/summaries.js` (units), `WidgetTile`-skelet + `registry.js` (descriptors, ≥2 widgets voor taken/boodschappen), gerenderd als 2-koloms grid in `app/(tabs)/vandaag.js`. Oude `lib/home/cards.js`+`SummaryCard` vervangen. Geverifieerd op de emulator. |
| VDG-8 | Vandaag/UX | Grid: toegankelijkheid, performance & reduced-motion | 3 | Could | M | ✅ | VDG-3, VDG-7 | Een aanpasbare DnD-grid is een a11y-/perf-valkuil: bied een **schermlezer-alternatief** voor herschikken (verplaats-omhoog/omlaag-acties, duidelijke labels/rollen), **lazy widget-hooks** (alléén geplaatste/zichtbare widgets abonneren zich realtime — voorkom dat álle module-hooks tegelijk op Vandaag draaien), en respecteer **`prefersReducedMotion`** (`lib/motion.js`) in de drag-/entree-animaties. 48dp-targets + AA-contrast óók in de speelse variant (DESIGN.md). Sluit aan op PLT-5 (a11y-audit) en INF-8/PERF-1 (realtime-/query-budget).  **Gebouwd (a11y/perf/reduced-motion):** alle bewerk-acties zijn gelabelde knoppen met ≥48dp hitSlop; layout-wissels via `animateNextLayout` (no-op bij reduced motion/web); alleen geplaatste widgets renderen → enkel hún module-hooks openen realtime (geen hook-storm). Volledige screenreader-drag-alternatief (verplaats voren/achteren) i.p.v. gestures. |
| TKN-1 | Taken/UX | Taken-pagina redesign: tijdscope-switcher (dag/week/maand + agenda) | 2 | Should | L | ✅ | AGE-1, STR-1 | **Gebouwd (Optie C — coexistentie via gedeeld component):** nieuwe `SegmentedControl` in `lib/ui.js`; `app/(tabs)/taken.js` herschreven met scope Dag·Week·Maand. Pure scope-helpers in `lib/agenda.js` (`groupByDay`/`weekDays`/`groupByWeek`, units in `tests/agenda.test.js`). Maandgrid + daglijst geëxtraheerd naar `lib/MonthView.js` en gedeeld door zowel de Maand-scope als de Agenda-tab (DRY). Achterstallig staat altijd bovenaan (Dag/Week). Geverifieerd op de emulator (alle scopes + Agenda-tab). TKN-2 (jaar) blijft onderzoek. **Oorspronkelijke notitie:** Vervang de huidige platte lijst (`app/(tabs)/taken.js`: één `FlatList` + categorie-`Chip`s + open/done-toggle, géén tijdsbesef) door een **tijdscope-switcher** (segmented control) **Dag · Week · Maand · Jaar** die bepaalt over welk venster de taken getoond worden. **Dag:** chronologische daglijst (taken met `due_at` op die dag + ongedateerd-bakje), via `sortDayTasks`/`groupByDate` uit `lib/agenda.js`. **Week:** 7-daagse strook/lijst met dagkoppen. **Maand:** **hergebruik de bestaande agenda-maandweergave** (`monthMatrix` uit `lib/agenda.js`, het maandgrid van AGE-1) — "de agenda-view waar nuttig". **Jaar:** → **TKN-2** (onderzoek). Gelaagd: pure kern in `lib/agenda.js` uitbreiden (week-/dag-/scope-grouping, unit-getest, géén React) → hook/UI → animatie (`lib/motion.js` voor scope-wissel). Géén migratie (leunt op `tasks`/`due_at`). **Open vraag:** overlapt sterk met de losse **Agenda-tab** (AGE-1) — samenvoegen of naast elkaar? Zie §7.7. Validatie op dev build/web, niet blind bouwen. |
| TKN-2 | Taken/UX | Jaarweergave — onderzoek & uitvraag | 3 | Could | S | ⏳ | TKN-1 | **Onderzoek/uitvraag — nog niet bouwen.** Bij de jaar-scope (TKN-1) is nog onbekend wat de meest waardevolle weergave is. **Uit te vragen + verkennen:** wil de gebruiker (a) een **activiteit-heatmap** (GitHub-bijdrage-grid van voltooiingen per dag over het jaar, voedbaar uit de voltooiingen-log `task_completions`, migratie 0012); (b) een **maand-voor-maand-overzicht** (12 mini-maandjes / dichtheid per maand); (c) een **seizoens-/jaarplanner** voor terugkerende & seizoensklussen (leunt op KLU-3 `months`/`seasonalChores()` — "wat staat dit jaar nog te gebeuren"); of (d) een combinatie. Bepaal scope + databron ná de uitvraag; pas dán een eigen TKN-rij voor de bouw. Mogelijk geen migratie (afgeleid uit `task_completions`/`tasks`). |
| TKN-3 | Taken/UX | Schaalbare filterbediening (categorie/module · persoon · subgroep · status) | 2 | Should | M | ✅ | TKN-1 | **Gebouwd:** "Filter"-knop met teller (`activeFilterCount`) → `BottomSheet` met gegroepeerde keuzes: categorie (multi, met `countBy`-tellers), toegewezen aan (`AvatarSelect`), groep (subgroep-chips), status (open/af/alles). Actieve filters als verwijderbare ✕-chips boven de lijst + "Wis alles". Pure kern in `lib/agenda.js` (`applyTaskFilters`/`countBy`/`activeFilterCount` + predicaten, units in `tests/agenda.test.js`). Orthogonaal aan de scope (TKN-1). Geverifieerd op de emulator. **Oorspronkelijke notitie:** De huidige filters (horizontale categorie-`Chip`-rij + open/done-toggle in `app/(tabs)/taken.js`) schalen slecht: bij **veel modules/categorieën** wordt de chip-rij een lange horizontale scroll (lage ontdekbaarheid), en bij **veel huishoudleden** is er nog géén "toegewezen aan"-filter. **Doel:** één compacte, schaalbare filter-affordance náást de tijdscope — een **"Filter"-knop met teller** die een **`BottomSheet`** opent (hergebruik `lib/ui.js`) met gegroepeerde keuzes: **categorie/module**, **toegewezen aan** (lid-avatars, `AvatarSelect`), **zichtbaarheid/subgroep** (`VisibilityPicker`) en **status** (open/af). Actieve filters tonen als **verwijderbare chips** onder de header + **"wis alles"**; selectie blijft combineerbaar met de scope (TKN-1) en blijft per sessie bewaard. Pure filter-/telkern in `lib/` (unit-getest), web- en a11y-veilig (48dp-targets, labels). Géén migratie. |
| UX-8 | Platform/UX | Opstart-/wachtscherm i.p.v. flitsende "Huishouden aanmaken" | 1.5 | Should | S | ✅ | — | **Gebouwd.** Datalaag-fix: `hasFetched`-vlag in `lib/household.js` + pure gate-beslissing `appRoute()` in `lib/appRoute.js` (units in `tests/appRoute.test.js`) — een nog-niet-opgehaalde lege lijst telt niet meer als "geen huishouden", dus geen onboarding-flits. `app/_layout.js` gebruikt `appRoute` als enige bron van waarheid. UI: kale `ActivityIndicator` vervangen door `SplashWait` (`lib/ui.js`) — illustratie (`lib/illustrations.js`) + tagline, thema-/dark-mode-bewust, zachte entree (respecteert `prefersReducedMotion`). Geen migratie. Resteert: visuele controle op web/device. |
| UX-9 | Platform/UX | Eigen lettertype verkennen (weg van het systeemfont/Inter) | 2 | Could | S | ⏳ | UX-1 | **Verkenning + één centrale wissel.** Nu draagt de app **geen eigen lettertype**: de `type`-tokens in `lib/theme.js` (`display…caption` + `button`) zetten alleen `fontSize`/`lineHeight`/`fontWeight`/`letterSpacing`, géén `fontFamily` → alles valt terug op het **platform-systeemfont** (SF Pro op iOS, Roboto op Android). `expo-font` is al een plugin (klaar om te laden), nog ongebruikt. **Doel:** een **eigen, onderscheidend** lettertype dat tóch **goed leesbaar** is op klein formaat én **flexibel** — d.w.z. een **variable font** met een breed gewichtsbereik (de schaal gebruikt 400→800), zodat één bestand alle gewichten dekt. **`Inter` bewust níét** (te standaard/veelgebruikt — exact de reden voor dit item). **Eisen aan een kandidaat:** (1) volledige **Latin-Extended** dekking voor NL-diacrieten (ë/ï/é…); (2) prettige, leesbare **cijfers** (de app is cijferzwaar: prijzen, saldo's, tellingen — overweeg tabular/lining numbers); (3) vrije/embed-bare licentie (**OFL** o.i.d.); (4) goede hinting op kleine maten. **Te verkennen (variable, karaktervol-maar-leesbaar):** Bricolage Grotesque, Hanken/Schibsted Grotesk, General Sans, Mona Sans, Onest, Plus Jakarta Sans, Figtree, Instrument Sans — eventueel een **display-font voor `display`/`h1`/`h2` + een rustiger leesfont voor body** (koppeling). **Aanpak:** typografie zit volledig centraal in `lib/theme.js` → laden via `expo-font`/`useFonts` + `fontFamily` aan de tokens toevoegen = één plek. Zet **2–3 kandidaten naast elkaar** op echte schermen (cijferzwaar: Kosten/saldo; tekstzwaar: plant-tijdlijn) en **op toestel** verifiëren (render verschilt iOS/Android). **Let op:** per font de `letterSpacing` herijken, de `fontWeight`→named-instance-mapping kloppend krijgen, en de bundel beperken (**subsetten** naar Latin + Latin-Extended; variable fonts kunnen groot zijn). Documenteer de keuze in `DESIGN.md` (type-schaal §). Géén migratie. |
| UX-10 | Platform/UX | "Vorige"-lintje linksboven (terug-knop mét herkomst-naam) | 2 | Should | M | ✅ | UX-1 | **Gebouwd:** `backLabel`-prop op `ModalHeader` (`lib/ui.js`) toont een tikbaar ‹-lintje met de herkomst-naam i.p.v. de naamloze ✕; herkomst via pure `lib/navMeta.js` (`DETAIL_PARENT` + `backLabelFor(routeKey, fromKey?)`, units in `tests/navMeta.test.js`, labels uit `lib/modules.js`). Doorgevoerd op 8 ✕-detailschermen (plant, plant/timeline, product, resource, catalog, kosten-inzichten, herinneringen, beeldstijl); editors (Annuleer·titel·Bewaar) en de purchase-detail (Annuleer·Bewerk) houden hun bestaande terug-affordance. a11y-label "Terug naar {label}" via `common.backTo`. Geverifieerd op de emulator. **Oorspronkelijke notitie:** Navigatie-helderheid (vervolg op STR-2). Detailschermen sluiten nu met een **naamloze ✕ rechtsboven** (`ModalHeader` in `lib/ui.js`) en de editors met "Annuleer" — geen van beide zegt **wáár je heen gaat**. **Doel:** een iOS-achtig **"vorige"-lintje linksboven**: een chevron `‹` + **de naam van het scherm/tab waar terug-navigeren naartoe gaat** ("‹ Boodschappen", "‹ Planten"), zodat de herkomst expliciet is en de navigatie heel duidelijk wordt. **Aanpak:** nieuwe gedeelde **`BackBar`** (of een `back`-variant/-prop op `ModalHeader`) in `lib/ui.js`, doorgevoerd op de ~18 detailschermen (`app/plant/[id]`, `app/purchase/[id]`, `app/product/[id]`, `app/expense/[id]`, `app/recipe/[id]`, `app/resource/[id]`, `app/recurring-expense/[id]`, `app/task/[id]`, `app/catalog`, `app/kosten-inzichten`, `app/herinneringen`, `app/beeldstijl`…). **Herkomst-naam bepalen:** primair een **per-route ouder-tab-mapping** (bv. plant-detail → "Planten", bon/product → "Boodschappen", uitgave → "Kosten") als betrouwbare basis; verfijn waar nuttig met de **echte vorige route** uit de Expo Router-stack (`useNavigation`/`getState`). **Deep-link/koude start** (geen echte "vorige"): val terug op de logische ouder-tab. **a11y + web-veilig:** `accessibilityRole="button"`, label "Terug naar {scherm}", chevron-icoon links, 48dp-target; labels via `t(...)` (i18n). Vervangt/aanvult de ✕-sluitvorm; behoudt de Annuleer·titel·Bewaar-vorm voor editors. Géén migratie. |
| UX-11 | Platform/UX | FAB kleiner + label "wat je toevoegt" naast de + | 2 | Should | S | ✅ | UX-1 | **Gebouwd.** `FAB` (`lib/ui.js`) collapsed 58→52dp (icon 28→26), extended-variant met compactere padding/icoon. Alle **7 schermen** geven nu een kort, gelokaliseerd `label` mee (extended-modus): **Taak** (vandaag/taken), **Afspraak** (agenda), **Uitgave** (kosten), **Plant** (planten), **Product** (voorraad), **Item** (delen) — `fab.*`-sleutels in `lib/i18n.js`; de volledige zin blijft `accessibilityLabel`. Geen migratie. Resteert: visuele controle van maat/uitlijning op web/device. |
| UX-12 | Platform/UX | Back vanuit een via-"Meer"-geopende tab gaat naar Home i.p.v. Meer | 1.5 | Should | S | 🔧 | UX-2 | **Gebouwd; toestelcheck open.** Opgelost met **`backBehavior="history"`** op de `Tabs` (`app/(tabs)/_layout.js`): Android-back keert terug naar de vórige tab i.p.v. de initiële (Vandaag), dus vanuit een via Meer geopende module → terug op Meer. Eén navigator-prop, globaal — geen per-scherm back-handler nodig. **Resteert:** verifiëren op **Android-toestel** (hardware-back **én** gebaar) + web; valt dat tegen, dan alsnog de stack-push-variant (UX-10). Geen migratie. |
| UX-13 | Platform/UX | Flexibele avatars: foto-upload + zelf-gebouwde avatar (personen én huishouden) | 2 | Should | M | ⏳ | UX-1, STR-4 | **Idee (gebruikerswens):** een avatar is nu één **emoji** (`avatar_emoji` op leden; de `EmojiPicker` in `lib/ui.js` dient ook het huishouden). Geef **personen** de keuze om óók een **eigen foto** te uploaden óf een **grappige avatar te bouwen** (à la Duolingo/Bitmoji), en geef het **huishouden** dezelfde flexibiliteit. **Datamodel — van emoji naar een avatar-descriptor (één bron, 3 soorten):** generaliseer `avatar_emoji` naar een kleine descriptor met `kind: 'emoji' \| 'photo' \| 'builder'` — `emoji` `{emoji}` (huidige default + fallback, blíjft werken), `photo` `{path}` (Supabase Storage), `builder` `{style, options}` (de gekozen avatar-onderdelen als **JSON**, niet als afbeelding → klein + scherp op elke maat). Migratie: nieuwe nullable kolommen (bv. `avatar_kind`, `avatar_photo_path`, `avatar_builder jsonb`) op de leden-tabel **én** het huishouden, met `avatar_emoji` als terugval → **achterwaarts compatibel**. De `Avatar`-component (`lib/ui.js`) wordt een switch over `kind`: emoji-tekst / `<Image>` met signed URL / `SvgXml`. **Foto-pad hergebruikt het bestaande fundament:** `lib/photoPicker.js` (`offerImagePicker`/`pickImageAsset`, STR-4) + `lib/photoStorage.js` (generieke upload/signed-URL); nieuwe Storage-bucket `avatars` met household-gescopete RLS (mirror van `0010` plant / `0034` recept). Profiteert later van UX-7 (in-app camera + uitsnede). **Avatar-builder — library-onderzoek (RN/Expo; `react-native-svg` 15.15 zit al in de app):** **• DiceBear** (`@dicebear/core` + `@dicebear/collection`) — **rijkste bron om lokaal van te vendoren**: 35+ stijlen incl. **avataaars**, **big-smile**, **open-peeps**, **notionists**, **fun-emoji**, **adventurer**, **bottts**; rendert als SVG-string via **`SvgXml`** uit `react-native-svg` (al aanwezig). *(De PNG-HTTP-API is een netwerk-call → bewust niet gebruiken, zie no-dependency hieronder.)* Seed-gebaseerd, maar **elk kenmerk is een optie-array** → je bouwt zelf een **kiezer-UI** door per groep (huid, haar, ogen, mond, bril, kleding…) de opties te tonen en de keuze als JSON te bewaren. Actief onderhouden; licenties per stijl (CC0 / CC BY 4.0 / gratis commercieel) — per gekozen stijl checken. **• Avataaars** (Pablo Stanley) — de klassieke "bouw-je-eigen" cartoon-stijl (Bitmoji-/Duolingo-gevoel); het simpelst via **DiceBears `avataaars`-stijl** (meteen onderhouden) met expliciete optie-enums per onderdeel. **• BigHeads** (`@bigheads/core` / `react-native-bigheads`, of de recentere fork `extended-bigheads`) — **charmantste, meest Duolingo-achtige** illustratiestijl met expliciete props (`skinTone`, `hair`, `eyes`, `mouth`, `accessory`, `clothing`…) → de fijnste "sleutel-aan-de-knoppen"-builder. **Risico:** `react-native-bigheads` is sinds **2020** niet bijgewerkt en `@bigheads/core` mikt op web-SVG → **RN-render eerst valideren** (via `SvgXml`/wrapper). **• Boring Avatars** (`boring-avatars`) — geometrisch/abstract, géén "gezicht bouwen"; bruikbaar als **auto-avatar uit een seed** (naam/id) als luxe-fallback, niet als de gewenste builder. **• Ready Player Me** (3D via WebView) — **te zwaar** (account/SDK/webview); niet aanrader. **Géén runtime-dependency — lokaal vendoren of zelf tekenen (besluit gebruiker).** We nemen géén van deze libraries als npm-/netwerk-afhankelijkheid (de DiceBear-HTTP-API is bovendien een netwerk-call → uit). Avatars zijn enkel **SVG-onderdelen die we met `react-native-svg` (al in de app) zelf samenstellen**, dus we kopiëren de bron lokaal óf tekenen 'm in eigen stijl. Licenties maken dit schoon: **DiceBear-core + BigHeads = MIT** (code kopiëren mag, LICENSE-notice meenemen); **Open Peeps & Notionists = CC0** (publiek domein, géén naamsvermelding); **Avataaars = gratis voor commercieel gebruik**. **Twee lokale routes:** **(a) Vendoren** — kopieer de SVG-onderdelen van één gekozen stijl naar `lib/avatar/` (CC0 **Open Peeps**/**Notionists** = juridisch het schoonst; of de MIT **BigHeads**-onderdelen, die als hand-gecodeerde SVG-componenten het makkelijkst porten naar `react-native-svg`-primitieven `Svg`/`G`/`Path`) + een mini-composer die de descriptor-`options` naar een avatar rendert. **(b) Zelf tekenen** — bouw een kleine set onderdelen (gezichten, haar, accessoires) in **onze eigen beeldtaal** via `lib/illustrations.js` (het bestaande react-native-svg-illustratiesysteem + de `svg-illustraties`-skill) → 100% eigendom, perfecte merk-match, geen externe art/licentie; iets meer ontwerpwerk. **Aanrader:** **(b) als de tijd het toelaat** (past in de huisstijl + het bestaande illustratiesysteem), anders **(a) met CC0 Open Peeps/Notionists** als snelle, schone start. In beide gevallen: een eigen **builder-sheet** die per optie-groep (huid, haar, ogen, mond, accessoires…) bladert, en bewaar **alleen de gekozen opties (JSON)**; render live met `SvgXml` of directe `react-native-svg`-componenten. Houd de descriptor **generiek** zodat emoji/foto/builder door elkaar kunnen — per lid én per huishouden. **UI:** in `app/(tabs)/huishouden.js` (lid bewerken + huishouden bewerken) de huidige `EmojiPicker` vervangen door een **avatar-kiezer met 3 tabs** (Emoji · Foto · Bouwen). **Hergebruik:** `Avatar`/`EmojiPicker`/`AvatarSelect` (`lib/ui.js`), de foto-helpers, `SvgXml`. **Migratie:** ja (kolommen + `avatars`-bucket + RLS). **a11y:** `accessibilityLabel` = de naam (zoals nu). |

---

## 7. Nieuwe suggesties (uitgebreid)

> **Volgende ronde (gekozen 2026-06-21):** twee sporen die elkaar versterken — een
> **"afmaken"-spoor** (**PLT-1 trap 2**: remote push live) en een **"nieuwe waarde"-spoor**
> (**BOO-9** barcode scannen → catalogus, + **VOO-2** naar voorraad), plus **PLT-6**
> activiteitenfeed (goedkoop bovenop de bestaande log + realtime). Samen maken ze de
> boodschappen-/keukenloop compleet én proactief. Meegenomen housekeeping deze ronde:
> backlog vervist (UX-3, INF-1→`0022`), **BOO-10** bewerkbare bonnen, **MLT-3** recept-foto
> + **STR-4** PhotoPicker-extractie. **UX-4** (dark mode) was die ronde bewust uitgesteld,
> maar is op **2026-06-21 alsnog gebouwd + op een dev build geverifieerd** (zie UX-4 ✅) —
> bleek geen ~40-bestanden context-migratie, maar een live-gemuteerd palet + getter-tokens
> + root-remount. Bewust níét nu: AI-assistent over eigen data (AI-1) — geparkeerd.

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
- ✅ **Veilige onderrand overal** (UX-5) — tabbalk, toast én elke onderaan-ingeschoven sheet/modal
  vielen op Android (app + mobiel web) onder de systeem-navigatieknoppen: edge-to-edge zonder
  window-insets. Consequente fix via `useSafeAreaInsets()`: de gedeelde `BottomSheet` (`lib/ui.js`)
  voor sheets/modals (o.a. Dagboekfoto, recept kiezen), de tabbalk (`app/(tabs)/_layout.js`) telt de
  onder-inset bij hoogte + padding, en de toast-offset (`lib/toast.js`) zweeft boven de hogere
  tabbalk. Raakte elk scherm. Zie §6.
- **Eigen dialogen/sheets i.p.v. native `Alert`** (UX-6) — gethemed bevestigingen, dirty-guard en
  foto-bron-sheet in onze stijl, web-veilig. Vervangt ~50 `Alert.alert`-aanroepen. Zie §6.
- **In-app camera in eigen stijl** (UX-7) — `expo-camera` met kader/overlay/visuele feedback voor
  foto's van bonnen/planten/recepten; deelt het camerafundament met de barcodescanner (BOO-9). Zie §6.

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
- **E2E-tests** (INF-3) — 🔧 **scaffolds gebouwd (plan 08 fase D):** Maestro gekozen (lichte
  YAML); 3 kritieke flows in `.maestro/` (taak toevoegen+afvinken, uitgave splitsen,
  boodschap toevoegen+undo) + `.maestro/README.md`. Geschreven tegen de echte NL-teksten,
  **nog te kalibreren tegen een draaiende build** (geen toestel beschikbaar bij het schrijven).
- **Foutrapportage/monitoring** (INF-4) — 🔧 **gewired (plan 08 fase C):** `@sentry/react-native`
  geïnstalleerd + config-plugin in `app.config.js`; `lib/monitoring.js` (env-gated op
  `EXPO_PUBLIC_SENTRY_DSN`, no-op zonder DSN, `sendDefaultPii:false`) en een app-brede
  `lib/ErrorBoundary.js` (nette NL-fallback) in `app/_layout.js`. **Rest:** DSN + een build
  om echte rapportage te verifiëren.
- **Release-pijplijn** (INF-5) — 🔧 **config gestaged (plan 08 fase B/E):** `eas.json`
  (development/preview/production-profielen, Android APK→AAB, autoIncrement, submit naar
  `internal`-track) + `expo-dev-client` + `docs/eas-setup.md`. **Rest:** `eas login`/`init`,
  secrets, eerste build + Play-submit (wacht op Play-account in goedkeuring).
- ~~**Meertaligheid (i18n-fundament)** (INF-6)~~ — ✅ **af** (`lib/i18n.js` + units; héle app
  gemigreerd naar `t(...)`). Alleen `expo-localization` voor locale-detectie rest, apart. Zie §6.
- **Meertaligheid (i18n-fundament)** (INF-6) — strings nu nog NL-hardcoded; een i18n-laag
  voorbereiden maakt latere talen goedkoop.
- **Expo-Go-toestel-deblokkade** (INF-7) — ✅ **opgelost & bewezen (2026-06-19).** Dev build
  i.p.v. Expo Go (`expo-dev-client` + `eas.json` development-profiel). De EAS `development`-APK
  is gebouwd, geïnstalleerd op een moto g72 (Android 13) en draait via **USB + `adb reverse`**
  met een dev-client-deeplink naar `localhost:8081` (omzeilt de firewall-/ngrok-blokkade;
  `--localhost` niet nodig). Volledige rooktest groen, geen JS-fouten. Web blijft fallback.

### 7.6 Epic: Vandaag-redesign — modulaire, kleurrijke widget-grid

> **Status:** ⏳ ontwerp/idee — **nog niet bouwen** (backlog-only). De losse items staan als
> **VDG-1 t/m VDG-8** in §6. Dit is het waarom/hoe; de tabel is de status.

**Waarom.** `/vandaag` ("Thuis", `app/(tabs)/vandaag.js`) is nu een rustig maar *vast*
statusoverzicht: groet + focus-takenlijst + een verticale stapel `SummaryCard`s (één per module
mét nieuws, `lib/home/cards.js`). Overzichtelijk, maar (a) **niet aanpasbaar** — de gebruiker kan
niets kiezen of herschikken; (b) **uniform** groen/grijs — geen module-eigen kleur of speelsheid;
(c) **één vorm** — elke module krijgt exact dezelfde kaart. De ambitie: maak Vandaag een
**persoonlijk, kleurrijk dashboard** dat de gebruiker zélf samenstelt uit widgets.

**De vijf pijlers (= de wens):**
1. **Modulair & kleurrijk** — widgets i.p.v. uniforme kaarten; elke module krijgt een eigen kleur-
   en beeldtaal (VDG-6).
2. **Zelf plaatsen in een grid** — een cell-grid waarin de gebruiker widgets sleept, herschikt, van
   grootte wisselt en toevoegt/verwijdert; de layout wordt per gebruiker bewaard (VDG-2/3/4).
3. **Meerdere widgets per module** — elke module levert ≥2 widget-typen uit één registry (VDG-1, VDG-7).
4. **Speelse én neutrale stijl** — elke widget kan in een speelse, module-getinte skin óf een rustige
   neutrale skin (VDG-5).
5. **Beknopt én uitgebreid** — elke widget bestaat in een compact format (één stat) en een uitgebreid
   format (lijst/preview/mini-grafiek), gekoppeld aan de grid-grootte (VDG-7).

**Voorbeeld-widgetmatrix** (richting, niet uitputtend — minstens twee per module, elk compact +
uitgebreid, elk speels + neutraal):

| Module | Widget-ideeën |
|--------|---------------|
| Taken | focus-lijst (vandaag/achterstallig) · voortgangsring "x/y af" |
| Boodschappen | "te halen"-teller · mini-lijst · snel-toevoegen-veld |
| Kosten | jouw saldo · maand-mini-grafiek (`BarChart`) · "deze maand uitgegeven" |
| Planten | water-vandaag · volgende beurt · cover-foto-tegel |
| Agenda | wat is er vandaag · komende-week-strip |
| Maaltijden | "vanavond eten we…" · weekmenu-strip |
| Voorraad | bijna-op-teller · urgente-items-lijst |
| Activiteit | feed-strip (laatste gebeurtenissen) |

**Aanpak (gelaagd, zoals de rest van de app).** Pure kern eerst (widget-registry + grid-pak-logica,
unit-getest, géén React — vgl. `lib/agenda.js`/`lib/fairness.js`) → dan hooks/persistentie → dan
UI/animatie. Hergebruikt wat er al is: de module-hooks achter de huidige kaarten, `lib/illustrations.js`
(themebaar), `lib/motion.js`, `Sparkline`/`BarChart`, en het module-/toggle-model (`lib/modules.js`,
FND-4). **Geen big-bang:** VDG-1 (framework) + VDG-2 (grid) kunnen eerst de bestaande kaarten 1-op-1 in
een grid zetten (neutrale variant); daarna kleur (VDG-6), varianten (VDG-5), bewerkmodus (VDG-3) en de
bredere widgetbibliotheek (VDG-7).

**Risico's / let op.** Een aanpasbare drag-and-drop-grid is een toegankelijkheids- én performance-
valkuil (VDG-8): bied een schermlezer-alternatief voor herschikken, en laat **niet alle module-hooks
tegelijk** draaien (lazy per geplaatste widget — anders abonneert Vandaag in één klap elke module
realtime). Raakt ook PLT-5 (a11y-audit) en INF-8/PERF-1 (realtime-/query-budget). De visuele en
interactie-validatie hoort op een dev build/web, niet blind gebouwd.

### 7.7 Epic: Taken-pagina-redesign — tijdscope-switcher + schaalbare filters

> **Status:** ⏳ ontwerp/idee — **nog niet bouwen** (backlog-only). De losse items staan als
> **TKN-1/TKN-2/TKN-3** in §6 (+ de wachtscherm-fix **UX-8**, los maar in dezelfde sessie bedacht).
> Dit is het waarom/hoe; de tabel is de status.

**Waarom.** `/taken` (`app/(tabs)/taken.js`) is nu een **platte lijst zonder tijdsbesef**: één
`FlatList` met een horizontale categorie-`Chip`-rij + een open/af-toggle. Je ziet álle open taken op
een hoop, los van wanneer ze spelen — geen "wat moet er vandaag / deze week / deze maand". Tegelijk
leeft er een aparte **Agenda-tab** (AGE-1) die exact dezelfde `tasks` op een maandgrid toont. De
ambitie: maak Taken de plek waar je **in- en uitzoomt op de tijd**, en hergebruik de agenda-weergave
waar die het meest waarde heeft.

**De wens (drie sporen):**
1. **Tijdscope-switcher** (TKN-1) — een segmented control **Dag · Week · Maand · Jaar** bovenaan die
   bepaalt over welk venster de taken getoond worden. Per scope een passende weergave:
   - **Dag** — chronologische daglijst (taken met `due_at` op die dag) + een "ongedateerd/altijd"-bakje;
     vooruit/terug bladeren per dag.
   - **Week** — 7-daagse weergave met dagkoppen (lijst of strook), week-navigatie.
   - **Maand** — **hergebruik de bestaande agenda-maandweergave** (`monthMatrix`/`groupByDate`/
     `dominantCategory` uit `lib/agenda.js`, het maandgrid van AGE-1): tik een dag → de taken van die dag.
     Dít is "de agenda-view waar nuttig".
   - **Jaar** — nog open → **TKN-2** (onderzoek & uitvraag).
2. **Schaalbare filters** (TKN-3) — vervang de losse chip-rij door één **"Filter"-knop met teller** die
   een `BottomSheet` opent met gegroepeerde keuzes: **categorie/module**, **toegewezen aan** (lid-avatars),
   **zichtbaarheid/subgroep** en **status**. Actieve filters als **verwijderbare chips** + **"wis alles"**.
   Dit schaalt waar de horizontale chip-rij dat niet doet — zowel bij **veel modules** (lange scroll →
   gegroepeerd in een sheet) als bij **veel gebruikers** (een echte "toegewezen aan"-filter i.p.v. niets).
   Filters zijn orthogonaal aan de scope: je combineert ze (bv. "deze week" × "Erik" × "schoonmaak").
3. **Jaarweergave-onderzoek** (TKN-2) — bij jaar is nog onbekend wat het meest waardevol is. Verken +
   vraag uit: een **activiteit-heatmap** (voltooiingen per dag, GitHub-stijl, uit `task_completions`),
   een **maand-voor-maand-overzicht** (12 mini-maandjes), of een **seizoens-/jaarplanner** voor
   terugkerende & seizoensklussen (KLU-3 `seasonalChores()`). Beslis scope ná de uitvraag.

**Aanpak (gelaagd, zoals de rest van de app).** Pure kern eerst: breid `lib/agenda.js` uit met
scope-grouping (dag/week, naast het bestaande `monthMatrix`) en zet de filter-/telkern in `lib/`, beide
**unit-getest, géén React** (vgl. `lib/agenda.js`/`lib/fairness.js`). Daarna de hook/scherm-state
(huidige scope + cursor-datum + actieve filters, per sessie bewaard) en pas dan UI/animatie
(`lib/motion.js` voor de scope-wissel, `prefersReducedMotion` respecteren). Hergebruikt wat er al is:
het agenda-maandgrid (AGE-1), `TaskRow`, `lib/ui.js` (`BottomSheet`, `Chip`, `AvatarSelect`,
`VisibilityPicker`) en de optimistische `useTasks`-mutaties. **Geen migratie** — alles leunt op `tasks`/
`due_at`/`task_completions`.

**Open vraag — verhouding tot de Agenda-tab (AGE-1).** Als Taken zelf een maand-/agenda-weergave krijgt,
overlapt dat sterk met de losse Agenda-tab. Drie opties: (a) **Agenda opgaan in Taken** (de scope-switcher
ís de agenda; Agenda-tab vervalt) — minst dubbel, maar raakt de navigatie/`lib/modules.js`; (b) **naast
elkaar laten** (Taken = takenbeheer met scopes, Agenda = puur kalender/afspraken met subgroep-filter) —
minste churn, maar twee maandgrids; (c) **gedeelde weergave-component**, twee ingangen. Beslis dit vóór
de bouw; het bepaalt of TKN-1 ook AGE-1 herschikt. De visuele/interactie-validatie hoort op een dev
build/web, niet blind gebouwd.

**Los meegenomen — UX-8 (opstart-/wachtscherm).** Niet strikt onderdeel van het taken-redesign, maar in
dezelfde sessie gesignaleerd: bij inloggen flitst soms kort "Huishouden aanmaken" (onboarding) voor een
gebruiker die al een huishouden heeft, en het wachtscherm is een kale spinner. Fix = "nog niet geladen"
onderscheiden van "echt geen huishouden" in `lib/household.js` (geen valse onboarding-redirect) + een net
wachtscherm met illustratie (`lib/illustrations.js`) i.p.v. de `ActivityIndicator`. Zie UX-8 in §6.
