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

> **Status (laatst herzien: 2026-06-26).** Device-verificatiebatch op een verse lokale dev-client
> bevestigde MLT-4 (keuken-loop) en TML-1 (tijdlijn) end-to-end incl. DB-schrijfpad; doc-hygiëne
> opgeschoond (SEC-3 → archief, stale FND-1-afhankelijkheden gecorrigeerd, §7-duplicaten weg). Fase 0, 1 en 1.5 zijn af; Fase 1.6 quick wins
> (UX-15 t/m UX-20) af incl. herbruikbaar `SwipeRow`-veegprimitief (PR #37, op toestel
> geverifieerd) — de teardown-sessies (UXR-1..8) zijn de resterende 1.6-stap. Fase 2
> grotendeels gebouwd (boodschappen-intelligentie, keuken-loop, kosten/autodelen,
> notificaties, de Vandaag-widgetgrid en het taken-redesign). **Nieuw (2026-06-24/25):** drie
> multi-agent-doorlichtingen — performance ([plan 16](docs/plans/16-performance-audit.md)),
> security ([plan 17](docs/plans/17-security-remediatie.md)) en UX/a11y/correctheid ([plan 18](docs/plans/18-ux-verbeterplan.md))
> — zijn geconsolideerd in §6 (PERF-3…9, SEC-1…7, A11Y-1/2, UX-43/44, INF-11). De kritieke
> security-items **SEC-1** (owner-escalatie), **SEC-2** en **SEC-4** zijn inmiddels **✅ gebouwd, live
> en geverifieerd** (live RLS-suite 775 pass, 2026-06-26 → archief). De keuken-/boodschappen-redesign-ronde
> ([plan 15](docs/plans/15-keuken-boodschappen-widgets.md), branch `feat/boodschappen-redesign`) is op
> toestel geverifieerd (2026-06-25, moto via USB): `npm test` + mutatie-ratchet + lint groen en de
> niet-veeg-flows bevestigd (categorie-schappen, instant 0-based stepper, sluitende zoek-dropdown,
> Keuken-omgeving zonder 7-dagen-strip-crash, widget-grid); veeg-gebaren door Erik zelf. Zie het
> verificatie-blok in plan 15. De actuele open/te-verifiëren
> punten staan in de tabel (§6); het volledige chronologische verloop in
> [`huishoek-voortgang.md`](huishoek-voortgang.md).
>
> **Nieuw (2026-06-28) — toestelfeedback-ronde Boodschappen + losse wensen.** Gebouwd: Boodschappen-UX
> (BOO-15 zoekbalk-herfocus, BOO-16 wis-knop, BOO-17 afvink/verwijder-feedback, BOO-14 compactere kop
> — eerste stap) — **alle vier device-bevestigd 2026-06-30** (BOO-15/16/17 → ✅/archief; BOO-14 stap 1 ✓,
> stap 2 data-gated). FND-5 (multi-huishouden bleek al gebouwd → feedback bij wisselen toegevoegd) en
> PLT-10 (camera-web-guard; swipe/BottomSheet-web nog open) **wachten nog op device-rooktest.** **INF-13 ✅ → archief** (`emailRedirectTo` in code +
> dashboard Site URL/allowlist door de eigenaar gefixt; onderzoek toonde dat de localhost-link
> de activatie niet blokkeerde). UXR-9 klaargezet als [plan 20](docs/plans/20-schoonmaak-teardown.md).
> Detail in §6 + voortgangslog.
>
> **Nieuw (2026-06-30) — device-rooktest drie sporen + onafhankelijke UX-review.** Op de moto (live
> dev-client) bevestigd → **✅ → archief:** SCH-4 (zelf rooster samenstellen + "Rooster bekijken"-filter),
> BOO-15/16/17 (zoekbalk-herfocus, wis-knop, afvink/verwijder-feedback). **PLA-10** plant-zijde bevestigd
> (huisdier-parity ongetest, geen huisdier in testhuishouden); **BOO-14** stap 1 bevestigd, stap 2 data-gated.
> Een UX Design Review-subagent doorlichtte de screenshots → [`docs/ux-review-rooktest-2026-06-30.md`](docs/ux-review-rooktest-2026-06-30.md)
> (14 punten). **Alle 14 afgehandeld → UXR-10 ✅ → archief:** de 3 "hoog" bleken grotendeels
> screenshot-artefacten (taak-onderknop = bewuste UX-39, blijft; bulk-prullenbak heeft al label+undo;
> dropdown is al tap-to-add) en de echte midden/lage punten zijn gebouwd + device-bevestigd (footer-kleur,
> "In takenlijst tonen", herhaal-blok plain-language, **#8 taak-dedup bij rooster-opbouw**, dropdown-scrim,
> leaderboard "nog niets"). Detail in voortgangslog + UXR-10 (archief).
>
> **Nieuw (2026-07-03) — multidimensionale review-fixronde (P0–P6 + CI).** De handmatig-
> geverifieerde delen van de review van 2026-07-02 ([`docs/reviews/2026-07-02-app-review.md`](docs/reviews/2026-07-02-app-review.md))
> integraal gebouwd op branch `fix/review-2026-07-02`, DoD groen (`npm test` 918 pass/0 fail/28
> RLS-skip, typecheck + `eslint .` schoon, mutatie-ratchet op de gewijzigde modules). Kort:
> **P0** foutpaden — `runResult` (fout≠leeg) + `error` uit alle data-hooks + foutbanner op 9
> schermen (Kosten niet meer onterecht "quitte"); **P1** refetch-storm (in-flight dedupe,
> `useActivity` bron-selectief, `effectiveModules`-memo, notif-signature-guard); **P2** dark-mode-
> contrast (`onAccent`, runtime chip-fg, `pickReadable`); **P4** correctheid (pantry-aggregatie,
> generatie-guard, 3 datumbugs, groceries-race); **P6** architectuur (`entityDiary`, care-diff puur,
> dode `useCatalog.js` weg); **P3** testdekking (RLS voor pets/vehicles/groceries/logs, openFoodFacts +
> secureStorage); **CI** service-role-key uit `ci.yml`, `rls-check` op migratie-push. Volledige
> uitwerking in het voortgangslog. **Follow-ups (device/dashboard-verificatie nodig):** 44pt-tikdoelen +
> tabbar-fontschaling (→ **A11Y-2**), `HouseholdCtx`-value-memo (~20 handlers stabiliseren), wachtwoord-
> recovery op **native** (web werkt; native deep-link + Supabase-allowlist voor `/herstel` open), en de
> `useCollection` rollback-extractie. **Niet gedraaid in de review:** Security/Datamodel/Platform-dimensies
> (aparte sessie via workflow-resume).

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

Dit was item **FND-1** en is **✅ gebouwd** (Fase 0): tabellen `subgroups`/`subgroup_members`
(migr. `0001`), de zichtbaarheidskolommen + pure helpers ([`lib/visibility.js`](lib/visibility.js)),
beheer-UI in [`huishouden.js`](app/(tabs)/huishouden.js) en de `VisibilityPicker` in de editors
(taak/uitgave/plant/huisdier/voertuig). Subgroep-afhankelijke *vervolg*features (bv. de
tijdlijn-subgroepfilter TML-8) leunen hierop, maar FND-1 zelf is geen open blocker meer.
De modules werken ook zónder subgroepen (alles = Iedereen).

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
- **Producteditor & "opslaan in catalogus?"-prompt**: voeg je een item toe dat nog niet
  in de catalogus staat, dan biedt de app aan het op te slaan zodat het hele huishouden
  het voortaan sneller terugvindt. Ja → een producteditor (naam, afbeelding, emoji,
  categorie, eenheid, …) die ook voor bestaande catalogusproducten werkt; aanpassingen
  gelden huishouden-breed. Zie BOO-13.

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

### 📰 Tijdlijn / Prikbord — het sociale hart (upgrade van Activiteit)
De huidige **Activiteit**-module (PLT-6) is een lees-only feed: een tijdlijn van afgevinkte taken,
afgeleid uit de voltooiingen-log. We bouwen 'm uit tot een echt **prikbord met tijdlijn** — het
sociale hart van het huishouden, in plaats van een passief logboek. De volledige, build-ready
uitwerking staat in [`docs/plans/19-tijdlijn-prikbord.md`](docs/plans/19-tijdlijn-prikbord.md);
hieronder het *waarom* en de vier samenstellende delen:

- **Handgeschreven berichten met grote foto's** — een lid plaatst een bericht (tekst en/of meerdere
  foto's groot in beeld), zichtbaar voor het huishouden of een subgroep (het bestaande
  zichtbaarheidscontract). Dit is de **hoofdmoot** van de tijdlijn.
- **Pinnen** — belangrijke berichten ("de wifi-code", "vakantie-checklist") blijven bovenaan staan.
- **Reageren, twee niveaus** — een **emoji-reactie kan op álles**, ook op systeem-events (👏 onder
  "Tim vinkte de afwas af" — motiverend); een **geschreven reactie (comment) kan alléén op
  handgeschreven berichten**.
- **Activiteit als laag eronder** — de automatische events (taak afgevinkt, uitgave toegevoegd,
  plant water gehad, …) blijven bestaan, maar als een **samenvouwbare laag** onder de berichten,
  niet kris-kras ertussen. De bestaande, bewust source-agnostische event-engine (`lib/activity.js`,
  een `FORMATTERS`-registry per event-type) wordt hiervoor verbreed — precies waar die al op
  voorgesorteerd was.

> **Instelbaar — wat komt er wél/niet op?** De tijdlijn is filterbaar op vier assen: per **module**
> (wel taken, geen boodschappen), per **gebeurtenis-type** (wel "taak voltooid", niet "lijst-item
> toegevoegd"), per **persoon/lid**, en per **zichtbaarheid/subgroep** (die laatste leunt op FND-1).
> Net als bij module-toggling zijn er **twee lagen**: het huishouden (owner) zet de basis, elk lid
> verfijnt voor zichzelf — een huishouden-uitzetting wint van de gebruiker.
>
> **Aanpak — bouwvolgorde.** Begin met het fundament (berichten + foto's, TML-1; dit hernoemt de
> `activiteit`-module naar `tijdlijn`), bouw daarna pinnen, reacties en comments erop (TML-2/3/4),
> haal de events terug als samengevouwen laag (TML-5, de eigenlijke PLT-6-upgrade) en sluit af met de
> filterinstellingen (TML-6/7, en TML-8 zodra subgroepen bestaan). Hergebruik overal beproefde lagen
> — `enable_module_rls`, het kind-tabel-patroon van `plant_photos`, `photoPicker` (downscalet al), de
> twee-lagen-toggle van `household_modules`/`user_module_prefs` — i.p.v. parallelle logica.

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

**Security-hardening (los van de fasen) — de kritieke items zijn af.**
De security-doorlichting ([`docs/plans/17`](docs/plans/17-security-remediatie.md)) leverde SEC-1 t/m SEC-7.
**SEC-1** (owner-escalatie — een kritieke tenant-isolatiefout), **SEC-2** (anon `run_recurring_expenses`)
en SEC-4 zijn **✅ gebouwd, live en geverifieerd** (live RLS-suite 775 pass, 2026-06-26 → archief);
SEC-3 idem (SecureStore). De rest (SEC-5 gated op de notify-deploy, SEC-6 sleutelhygiëne, SEC-7 CI)
loopt mee in Fase 2. M1/L4/L5 vallen onder INF-10, L1 onder INF-9;
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
>   Een 🔧 dat op toestel is bevestigd → ✅ → archief. *(Verificatie-batch gedraaid 2026-06-26
>   op een verse lokale dev-client (moto via USB, live metro). **Naar ✅ → archief:** MLT-4 (keuken-loop),
>   TML-1 (tijdlijn, tekst + foto), BOO-11 (vaste boodschappen), MLT-3 (recept-foto-upload), en — via de
>   live RLS-suite **775 pass / 0 fail** — SEC-1/2/4 (tenant-isolatie/owner-escalatie/owner-update) en
>   INF-1 (live-RLS-verificatie). HUI-1 lege staat en VTG-1 detail (RDW/kosten/delen) device-bevestigd.
>   **PLT-1 push on-device tick device-bevestigd 2026-07-03** (token in `push_tokens` → taak toegewezen
>   door ander lid → `notify` 200 → FCM-notificatie op de moto) → ✅ → archief; SEC-5 was al ✅.
>   **Resterende 🔧 vragen externe resources** (geen losse device-tik):
>   BOO-7/INF-9 (Orq-deploy), INF-4 (Sentry-build + crash), INF-5 (EAS/Play-account), INF-3 (Maestro-
>   kalibratie), SEC-6/7 (sleutelhygiëne/CI). VTG-2/3/4 hebben statusreconciliatie nodig
>   (UI is op toestel aanwezig — zie VTG-1).)*
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
| IOS-1 | Platform | iOS-readiness: uit de Android-monocultuur (enabler + reality-check) | Now | Should | M | 🔧 | REV-2 | **Enabler gebouwd (2026-07-05) → [plan 25](docs/plans/25-ios-readiness.md).** We testen alleen op Android (Maestro/`dev-device`/CI); nooit een `ios/`-prebuild gedraaid → nul testlagen raken iOS. **Geverifieerd tegen de echte config/live-host** (niet uit geheugen): (1) **geen first-tap crash** — `expo config --type introspect` toont de camera/foto-`UsageDescription`-keys in de opgeloste iOS-`Info.plist` óók zonder de plugin te lijsten (Expo SDK 56 past module-config-plugins auto toe; Engelse defaults) → weerlegt de "crasht zonder permissie-strings"-aanname, bevestigt INF-5; (2) **live universal links dood** — huishoek.app AASA serveert live nog `REPLACE_APPLE_TEAM_ID` (REV-2 §P8-restpunt); (3) **cloud-simulator = experimenteel** (`expo:eas-simulator`), buildsleutel `ios.simulator` wél correct. **Gedaan:** `eas.json` `development` → `ios:{simulator:true}`; `app.config.js` `expo-image-picker`-plugin met NL camera/foto-copy (introspect-geverifieerd). **Spijtvrije route:** goedkope observability-enabler nu + **lichte periodieke reality-check** (EAS-sim smoke bij milestone/na een divergentie-hotspot — géén per-PR-CI, geen dubbel onderhoud); config-checklist (APNs/submit/icoon/AASA-herdeploy) bewust uitgesteld tot livegang (`credentials/README.md`). **Rest:** eerste `eas build -p ios --profile development` + smoke langs de hotspots (modals/`pageSheet`, KAV-`padding`, gestures, schaduw) → basislijn in `huishoek-voortgang.md`; daarna cadans bewaken. **Update (2026-07-05):** eerste iOS-build **groen** (EAS, `development`-profiel, SDK56 simulator-artefact) — app compileert/linkt voor iOS, config valide, géén build-blokkade; EAS-tunnel v2 werkt op ons netwerk (Mode C haalbaar). **Maar geen draai-oppervlak:** cloud-sim geweigerd (*"device run sessions not enabled for this account"*) + geen lokale sim (alleen CLI-Xcode, geen admin) + geen device → **visuele hotspot-smoke uitgesteld** tot er een oppervlak is (gebruikersbesluit 2026-07-05). Livegang-checklist gestart: App ID `app.huishoek` onder Team `J3DDDK3JB2` (= de AASA-Team-ID) met **Push Notifications** + **Associated Domains** capabilities. **APNs (2026-07-06):** auth-key `2982HKDV22` (Sandbox & Production, Team-Scoped) aangemaakt + geüpload naar EAS voor `production`/`app.huishoek` (team-scoped ⇒ dekt ook `.dev`/`.preview`); end-to-end push pas te bevestigen met een device/TestFlight-build (`credentials/README.md`). **Submit-config compleet (2026-07-06):** App Store Connect-app `Huishoek` aangemaakt + `eas.json` `submit.production.ios` volledig ingevuld (`ascAppId` 6787762811, `ascApiKeyId` LBMNK76NT6, `ascApiKeyIssuerId`, `.p8` in gitignored `credentials/`) → géén `REPLACE_`-placeholders meer, `eas submit -p ios` klaar. **Rest livegang:** app-icoon/splash (INF-5), AASA-herdeploy (REV-2 §P8), native auth-deep-links (herstel.js), en een echte productie-build; draai-oppervlak voor de visuele smoke blijft de open afhankelijkheid. |
| AI-1 | Assistent | Huishoek Assistent (AI-laag via Orq) | Now | Should | L | ⏳ | LRN-1 | **Van geparkeerd → lopend (2026-07-04).** Chat-assistent over eigen huishouddata: agent-loop server-side (edge function `assistant`), Orq-deployment `huishoek_assistant` als gateway (patroon `scan-receipt`), tools = RLS-gescopete queries + pure `lib/*.js`; writes altijd propose→confirm→execute; gesprekken creator-privé (géén standaard module-RLS — privacylek anders). Design-verkenning + fasering (0a–6, incl. "Huisregels"-NL-automations): [plan 23](docs/plans/23-assistent.md). **Gebouwd (2026-07-04, offline-deel fase 1):** pure laag ([`lib/assistantUi.js`](lib/assistantUi.js) catalog-poortwachter · [`assistant/core.js`](supabase/functions/assistant/core.js) loop-kern · tool-registry — sinds AI-8 (2026-07-05) opgesplitst in skill-files [`_shared/tools/`](supabase/functions/_shared/tools/index.js), toolnamen `<moduleKey>_<onderwerp>`) — unit-getest, `@ts-check`, mutatie 94,9/90,8/93,3%; migratie [`0068`](supabase/migrations/0068_assistent.sql) (creator-privé RLS + `record_assistant_call` incl. household-plafond) **live via MCP**; edge function [`assistant/index.ts`](supabase/functions/assistant/index.ts) **gedeployed** met secrets `ORQ_API_KEY`+`ORQ_ASSISTANT_MODEL=eu.claude-sonnet-5`; app-schil (module-entry, [`app/(tabs)/assistent.js`](app/(tabs)/assistent.js), `useAssistant`, `AssistantMessageView`, i18n/help/iconen). **0c-spike = GO** (Orq-proxy: tool-calls, tool-ronde én SSE bewezen; credits + AI-Studio-key staan). **E2E live-bevestigd (2026-07-04):** curl met user-JWT → 200 met echte data, én **device-rooktest op de moto** (lege staat + chips, chip-tap → antwoord met échte open-taken-kaart, signaleert zelf de achterstallige taak). **Rest fase 1:** golden-set eval in Orq; ~~markdown rendert plat~~ (opgelost in AI-5, 2026-07-04); daarna fase 2 (SSE in de app ✅ AI-5 + gen-UI volledig + instappunten). Orq MCP-server koppelen: `claude mcp add` (door Erik). |
| REV-2 | Fundament | Opvolging app-review-addendum (Security/Datamodel/Platform, P7–P9) | Next | Should | M | ⏳ | — | **Addendum 2026-07-04** op [de app-review](docs/reviews/2026-07-02-app-review.md): de 3 ontbrekende dimensies gedraaid + live advisor-scan; quick wins direct gefixt (verify_jwt-config, push-token-opruiming bij logout, CI-Node 22, kapot npm-script). **P7 DB-hardening GEBOUWD + LIVE (2026-07-04, migr. [`0070`](supabase/migrations/0070_security_datamodel_hardening.sql), via MCP):** rekey-guard-trigger op 16 tabellen (household_id + creator-kolom onveranderlijk — dicht de 0066-UPDATE-omzeiling Sec-1 zónder gedeeld bewerken te breken), aangescherpte insert-policies expenses/recurring_expenses (Data-10), **replica identity FULL op 23 extra tabellen** (Data-2 high: realtime-DELETEs bereiken huisgenoten nu wél), share-guards in create/update_expense + CHECK ≥ 0 (Data-3 — som==bedrag bewust géén eis: subset-splits zijn legitiem, 19/56 live), 3 indexen (Data-7). Elk onderdeel live SQL-geverifieerd (rekey geblokkeerd + legitiem bewerken werkt + share-guards); 3 nieuwe scenario's in `rls.integration.test.js` (draaien in rls-check op main). **Rest:** realtime-DELETE op toestel bevestigen (huisgenoot verwijdert → andere toestel); **P8 deels af (2026-07-04):** `deploy:web` doet nu export→Sentry-source-map-upload (env-gated op `SENTRY_AUTH_TOKEN`)→`.map`-strip→publish ([`scripts/deploy-web.mjs`](scripts/deploy-web.mjs)); `@opentelemetry/api` naar devDependencies (Plat-5). **P8-rest:** applinks-`REPLACE_`-placeholders → join-deeplink dood (Erik: keystore-SHA/Team-ID), app-icoon vóór store-build, eerstvolgende web-deploy mét token draaien ter verificatie. **Sec-3 + Data-5 GEBOUWD + LIVE (2026-07-05, migr. [`0071`](supabase/migrations/0071_peek_invite_privacy_en_bereik_checks.sql)):** `peek_invite` geeft voor niet-geldige tokens alleen nog de status (naam/emoji/uitnodiger/id → null — gedragsneutraal: de UI gebruikt die velden alleen bij `valid`) + bereik-CHECKs op purchases/purchase_items/pantry_items (quantity > 0, centen ≥ 0; live data vooraf schoon bevonden). Live SQL-geverifieerd + RLS-scenario in de suite. **Data-6 GEBOUWD + LIVE (2026-07-05, migr. [`0072`](supabase/migrations/0072_rls_initplan_wrapping.sql)):** de 23 policies met een naakte `auth.uid()` → `(select auth.uid())` via **ALTER POLICY** (init-plan-caching: één evaluatie per query i.p.v. per rij; command + rol-scope onaangeroerd, dus gedragsbehoudend). Advisor `auth_rls_initplan` van 23 → **0**; spot-check bevestigt dat de policies nog afdwingen (gespoofte `created_by` geblokkeerd, eigen insert werkt, select gescoped). P9 push-poets open (permissie-pre-prompt, receipts-check, kanaal HIGH). Ontwerpkeuzes: account-verwijdering/GDPR (Data-1), completions-historie vs cascade (Data-4). |
| AI-2 | Assistent | Orq v3-router + trace-metadata + monitoring-runbook + guidelines-doc | Now | Should | M | 🔧 | AI-1 | **Code-kant af (2026-07-04, ronde A [plan 24](docs/plans/24-assistent-volwassen.md)).** Route-onderzoek via MCP-JSON-RPC: `deployments/invoke` én agents **negeren per-request tools** (empirisch, ook met `tool_choice=required`) → **v3-router (`/v3/router/responses`) is de route**: dynamische tools ✓ `thread` ✓ `metadata` (gehashte ids) ✓ trace_id ✓ tool-result-ronde ✓ — alles live bewezen. `index.ts` dual-route (provider-prefix in `ORQ_ASSISTANT_MODEL` → router; anders proxy), Responses-parsers in `core.js` (20 tests), gedeployed; traces met `session_id`=conversatie opvraagbaar via MCP `list_traces`. Orq-agent `huishoek_assistant` staat klaar als toekomstige prompt-thuisbasis (guidelines §3). Guidelines + runbook ingeweven (docs/README, CLAUDE.md). **Rest (Erik):** `supabase secrets set ORQ_ASSISTANT_MODEL=google/eu.claude-sonnet-5` → dan E2E+trace-verificatie (ik); Orq MCP koppelen (`claude mcp add`); dashboard-opruiming: deployments `huishoek_assistant` (boilerplate) + `huishoek_assistant_v2` + agent `huishoek_toolprobe`; **zai-provider-key heeft geen saldo** (glm-5.2 → z.ai-429) — weghalen (dan Orq-credits) of opwaarderen vóór het AI-3-experiment. |
| AI-3 | Assistent | Golden-set + evaluators + eval-gate (experiment geparkeerd) | Now | Should | M | ◐ | AI-2 | **Kern gebouwd (2026-07-04):** [`tests/assistant-golden.json`](tests/assistant-golden.json) (29 NL-cases incl. 8× "geen tool") + meta-test die 'm tegen de registry bewaakt; eval-runner [`scripts/assistant-eval.mjs`](scripts/assistant-eval.mjs) (eerste-beurt tool-F1 + args-subset + no-tool, baseline in `assistant-eval-baseline.json`, tolerantie 2pp — **F1 96 / args 100 / geen-tool 100** na de beknopt+suggest_replies-prompt); Orq-judges `huishoek-nl-toon` + `huishoek-groundedness` (drempel ≥70) via MCP aangemaakt. **Geparkeerd op verzoek:** het sonnet-vs-GLM-experiment + schaduwdraai (GLM ook geblokkeerd: Orq's zai-route geeft z.ai-429 zonder eigen key; alternatief = ander GLM-provider-model activeren). **Wekelijkse loop 1× gedraaid (2026-07-05):** echte gesprekken gereviewd → golden-set naar 34 cases (chip-teksten, 2 capability-vragen die in productie tóch tools uitlokten, write-intent pre-AI-8); eval F1 96,4 / args 100 / geen-tool 100, baseline herijkt. **Rest:** judges aan productie-traffic hangen (vergt agent/deployment-route). |
| AI-6 | Assistent | Chat-UX-poets (stop, tool-status, retry, haptics) | Next | Should | M | ◐ | AI-5 | **Deels vervroegd (2026-07-04):** antwoordopties-patroon af — `suggest_replies`-pseudo-tool (elke beurt 2–4 tikbare chips; vrij typen blijft altijd, guidelines §8) + BEKNOPT-prompt (1–3 zinnen, data in kaarten, details via deep-link); live bewezen ("Je hebt 1 open taak, met deadline 23 juli." + 3 chips). **Ronde-E-kern gebouwd (2026-07-04):** stop-knop (abort; partial blijft staan als bericht, server persisteert de volledige beurt), retry-chip op een foutbubble, haptics (tik bij antwoord, error-tril bij fout), tool-statusregel uit de stream (`statusLabel` per tool). **Rest:** collapsible tool-calls, message-actions, scroll-anchoring, reduced-motion + device-check; actief gesprek onthouden over een remount heen (nu begint een remount — bv. na een deeplink — leeg; het gesprek staat wel in de sheet). |
| AI-7 | Assistent | A2UI-alignment gen-UI (surface/patch, +3 nodes) | Later | Could | M | ⏳ | AI-5 | Ronde F: `assistantUi.js` → surface + patch-op-id + gescheiden data-model (A2UI v0.9 wire-contract, platte tree blijft werken); nodes `progress`/`image`/`chips`. ~~onAction-bridge~~ → vervroegd geland met AI-8 (2026-07-05): [`lib/assistantActions.js`](lib/assistantActions.js) (besluit-whitelist + status-stempeling). **Bewuste beslissing (2026-07-06, plan 26):** AI-16 ronde 1 heeft het wire-protocol níét nodig — de live-interactie (porties-herrekening) is client-lokaal en puur gebouwd; de platte tree blijft de compat-vorm, dus dit blijft `Later` zonder iets te blokkeren. |
| AI-10 | Assistent | Assistent overal + mens↔AI-overdracht (briefs, scherm-context, edit-voorstel) | Now | Should | L | 🔧 | AI-8 | **Gebouwd (2026-07-05).** (1) **Module-briefs**: elke skill-file exporteert `<MODULE>_BRIEF`; snapshot toont één regel per actieve module (progressive disclosure; exact vastgepind per pack-test). (2) **Scherm-context**: client stuurt `screen` (moduleKey) mee → snapshot-regel "aanwijzing, geen beperking". (3) **Assistent overal**: [`assistantProvider`](lib/assistantProvider.js) (één gespreksstate app-breed — lost het AI-6-remount-restpunt op) + [`AssistantSheet`](lib/AssistantSheet.js)-overlay + **AI-first FAB's** op taken/vandaag/maaltijden (bewuste herziening plan 23 §5: FAB → chat met focus; "Zelf invoeren" = uitwijk naar de klassieke editor). (4) **Mens↔AI-overdracht**: "Bewerken" op de bevestigingskaart → generieke edit-sheet ([`EDITABLE_FIELDS`](lib/assistantActions.js), registry-contract-getest + propose-roundtrip) → `decision:'edit'` hervalideert via dezelfde pure `propose()`, status blijft pending, `edited_by_user` in audit-spoor → `openProposalsNote` geeft de AI de actuele versie in de volgende beurt. **Edge v12/v13 gedeployed (CLI) + E2E live bewezen:** voorstel → edit (Testmelk→Testhavermelk 2 pakken) → AI kent de bewerking → confirm voert de bewerkte args uit → undo; kapotte edit → nette 400. Eval-gate 100/100/100 (38 cases, productie-tokenbudget — 400-token-reasoning-artefact gefixt). **Device-bevestigd (2026-07-05, moto, donker):** AI-first FAB op taken opent de `AssistantSheet`-overlay; dezelfde overlay + hetzelfde gesprek blijven staan over de tabs taken/thuis/boodschappen heen (één app-brede gespreksstate bewezen). Edit-flow end-to-end: "Bewerken" → edit-sheet ("Voorstel bewerken", Naam/Hoeveelheid per item) → naam Testmelk→Testhavermelk → **Bewaren** → de kaart her-valideert en toont "Testhavermelk" → **Doen** voert de bewerkte args uit → item landt in de echte lijst. Scherm-context/briefs impliciet actief (leeg gesprek toont module-relevante chips). **Observaties (geen blokker):** (a) hardware-back binnen de edit-sheet klapt de hele overlay dicht tot het onderliggende scherm en reset het gesprek — het app-brede gesprek overleeft een terug-tot-home dus niet; (b) na een edit die de item-identiteit wijzigt (testmelk→testhavermelk) her-oppert het model in vervolgbeurten de oorspronkelijke "testmelk" (de originele vraag geldt als onvervuld) — edge-gedrag door het wijzigen van de identiteit i.p.v. alleen de hoeveelheid. **Rest:** FAB-uitrol naar overige modules zodra die write-tools krijgen. |
| AI-11 | Assistent/Boodschappen | Assistent gebruikt de productcatalogus + auto-categoriseren van nieuwe producten | Next | Should | M | ⏳ | AI-8, BOO-9 | **Idee → rij (2026-07-05, Erik).** Twee samenhangende sporen. (1) **Catalogus-koppeling in de assistent**: bij `boodschappen_toevoegen` matcht de assistent vrije tekst tegen de bestaande productcatalogus (`searchCatalog`/`search_catalog` + de eigen `catalog_products`) — óf de tool zoekt zelf, óf een tweede, goedkoop model matcht de voorgestelde regels tegen bestaande producten (naam-normalisatie/dedupe: "melk, 2 pakken" → catalogusproduct "Melk"). Zo krijgen assistent-toevoegingen dezelfde schap/emoji/eenheid als een handmatige toevoeging i.p.v. losse dubbele regels. (2) **Auto-categoriseren buiten de catalogus**: staat een toegevoegd product níét in de catalogus, categoriseer het dan bij toevoegen met een **goedkoop model** (schap/`category` uit de `catalog_categories`-taxonomie) i.p.v. de terugval op 'overig'. Raakt: [`lib/groceryCatalog.js`](lib/groceryCatalog.js) (`searchCatalog`/`categoryMeta`), [`_shared/tools/boodschappen.js`](supabase/functions/_shared/tools/boodschappen.js), `useProducts.ensureProduct`. **Open:** waar het goedkope model draait (edge tool-ronde vs. async na insert) + modelkeuze binnen kostenbudget/eval-gate (guidelines). |
| AI-12 | Assistent/Keuken | Recept-flow (zoeken/voorstellen) + stap-voor-stap-actie-orkestratie | Now | Should | L | 🔧 | AI-8, AI-10 | **Gebouwd (2026-07-05, Erik-bevindingen).** Loste op dat de assistent een gerecht blind als vrije tekst op het weekmenu knalde (er was geen recept-tool). **Recept-flow:** `maaltijden_recept_zoeken` (read, doorzoekt het receptenboek) + `maaltijden_recept_opslaan` (write/HITL — AI stelt een volledig recept voor als nieuw gen-UI-kaarttype **`recipe`** via een `preview`-array uit `propose()`, náást de bevestigingskaart); goedgekeurd recept wordt gekoppeld ingepland (`maaltijden_plannen` kreeg optioneel UUID-gevalideerd `recipe_id`; undo-whitelist `+recipes`, ingrediënten cascaden). **Stap-voor-stap-orkestratie** (drie compositie-hendels, geen nieuwe transactie — guidelines §10): agent-policy bundelt bij één beslissing / rijgt over beslispunten via `suggest_replies`; bundelen is een presentatielaag — bij ≥2 open voorstellen toont de client één *"Akkoord met alles"* (`pendingActionIds`) die ze via het bestaande confirm-endpoint na elkaar bevestigt (elke actie blijft atomair + los undo-baar). Recept-triggering chirurgisch afgesteld op Sonnet-5 (3 takken) → **eval-gate 100/100/100 (43 cases)**, geen regressie op kaal inplannen. Guidelines §9 (recipe-kaart + write-preview) + §10 (orkestratie); 5 golden-cases (rec-01..05). **Keyboard-fix:** volledige-scherm-chat-tab gaf Android `behavior={undefined}` → composer onder het toetsenbord; nu `'height'` (patroon lib/ui.js). **Edge live + recept-opslaan geatomiseerd (2026-07-05, AI-14):** `maaltijden_recept_opslaan.execute` deed losse per-recept inserts → een partiële fout liet niet-undobare weesrecepten achter; nu één DEFINER-RPC `save_recipes` (migr. [`0073`](supabase/migrations/0073_assistant_save_recipes_rpc.sql), **live via MCP**, `anon`/`public`-execute ingetrokken) — edge **v15 gedeployed**, RPC + scoping live geverifieerd, eval-gate 100/100/100. **Rest:** device-rooktest van de recept-kaart + "Akkoord met alles"; daarna → ✅. |
| AI-13 | Assistent | Chat-ruimte beter benutten (voorgestelde antwoorden, invoerpositie, navbar onder sheet) | Next | Should | S | 🔧 | AI-6, AI-10 | **Device-bevinding (2026-07-05, Erik).** Drie layout-problemen in de chat. (1) ~~**Voorgestelde antwoorden** nemen te veel verticale ruimte / blokkeren de scroll~~ → **opgelost (AI-14):** de chip-rij is nu één horizontaal-scrollende `ScrollView` i.p.v. wrappend ([`AssistantChat.js`](lib/AssistantChat.js)). (2) **Chat-invoer staat te hoog** — veel lege ruimte eronder; vermoedelijk de vaste sheet-hoogte `height*0.78` in [`AssistantSheet.js`](lib/AssistantSheet.js) i.c.m. KeyboardAvoiding/safe-area — de invoer moet onderaan verankeren. (3) **Navbar (tab-bar) komt onder de drawer/sheet uit** — de overlay-laag van [`AssistantSheet`](lib/AssistantSheet.js) dekt de tab-bar niet af (z-index/insets). Verwant aan AI-6-rest (scroll-anchoring). **(2)+(3) opgelost via AI-15 (2026-07-05):** de chat-overlay is herbouwd van `BottomSheet` naar een full-screen `Modal` met kruisje + keyboard-avoiding — invoer blijft boven het toetsenbord, de tab-bar wordt afgedekt, geen lege ruimtes/gesture-conflict. **Device-geverifieerd (moto, screenshots)** → alle drie de punten opgelost. |
| AI-14 | Assistent | Hardening-ronde (multi-agent review-opvolging AI-8/10/12) | Now | Should | M | 🔧 | AI-10, AI-12 | **Gebouwd (2026-07-05).** Drie-sporen-review (HITL-keten / client-laag / losse-eindjes-inventaris) op het verse assistent-werk: HITL-keten fundamenteel solide bevonden (creator-privé autorisatie, single-winner race-claim, server-side render tegen injectie). **Gefixt:** (1, HIGH) AI-first FAB was een dode knop als de Assistent-module uitstond → valt nu terug op "Zelf invoeren" ([`assistantProvider.js`](lib/assistantProvider.js)); (2, data) recept-opslaan geatomiseerd (zie AI-12: RPC `save_recipes`, migr. `0073`, edge v15); (3) gesprek reset nu bij huishouden-wissel — geen kruisbesmetting meer ([`useAssistant.js`](lib/useAssistant.js)); (4) "Akkoord met alles" stopt bij de eerste fout + unmount-guard (pure [`confirmSequence`](lib/assistantActions.js)); (5) retry dedupliceert de user-beurt niet meer (pure `dropStrandedTurn`); (6) lege-respons → tekst-fallback i.p.v. blanco bubble; (7) anti-injectie: newline-sanitatie van voorstel-tekst in de systemprompt (`openProposalsNote`). Live-verificatie: geen migratie-drift (DB `0073`), advisor 0 nieuwe issues, `auth_rls_initplan` bevestigd 0. 5 nieuwe pure-helper-tests, mutatie-ratchet groen, eval-gate 100/100/100, typecheck + `eslint .` groen. **Observatie (a) uit AI-10 weerlegd:** de code houdt het gesprek vast over sheet/tab/thema-remount (root-provider bóven Gate's remount-key) — device-hertest aanbevolen. **Device-rooktest groen (moto, 2026-07-05):** crash-sweep 15/15 + alle 5 Maestro-flows ✓ + logcat schoon → AI-14 regressie-vrij op toestel; en passant een AI-10-los-eindje in het device-net gedicht (zie INF-3). **Rest:** handmatige device-check van de assistent-specifieke gedragingen (chip-scroll, "Akkoord met alles", FAB-terugval bij uitgezette module — geen betrouwbare Maestro-flow mogelijk door de LLM-afhankelijkheid); daarna → ✅. |
| AI-15 | Assistent | Chat-overlay-herbouw + boodschappen afvinken + beslis-opties (device-feedback) | Now | Should | M | 🔧 | AI-10, AI-12 | **Gebouwd (2026-07-05, device-feedback Erik).** Vijf punten na echt gebruik. (1+5) **Chat-overlay herbouwd** van een swipe-`BottomSheet` naar een full-screen `Modal` met kruisje ([`AssistantSheet.js`](lib/AssistantSheet.js)): de swipe-to-dismiss botste met scrollen, het toetsenbord viel over de invoer, de tab-bar schemerde door en er waren grote lege ruimtes. Nu keyboard-avoiding (invoer altijd boven het toetsenbord), navbar afgedekt, geen gesture-conflict — **device-geverifieerd (moto, screenshots)**; lost AI-13-(2)/(3) op. (4) **LLM-response full-width** zonder bubble (gebruikersbeurt houdt de bubble) → kaarten/tekst krijgen de hele breedte ([`AssistantChat.js`](lib/AssistantChat.js)). (1) **Boodschappen afvinken kon niet** — geen prompting-bug maar een ontbrekende tool: nieuwe HITL-write-tool [`boodschappen_afvinken`](supabase/functions/_shared/tools/boodschappen.js) (matcht case-insensitief op naam, `checked=true`, géén undo-spoor want geen insert; EDITABLE_FIELDS + contracttests). (3a) **Beslis-opties**: `suggest_replies`-prompt aangescherpt naar concrete AskUserQuestion-stijl vervolgstappen na een voorstel/actie (geen kaart-knoppen herhalen). Units + descriptor-contract + 2 golden-cases; **eval-gate 100/100/100 (45 cases)**; edge **v16 gedeployed**. **Rest:** device-verificatie van de afvink-HITL-flow (toestel losgekoppeld tijdens de sessie); trace-review van de nieuwe beslis-opties. |
| AI-16 | Assistent | A2UI: industry-leading interactieve gen-UI-componenten (grafiek/rooster/recept) | Now | Should | L | ◐ | AI-15 | **Ronde 1 gebouwd (2026-07-06) → [plan 26](docs/plans/26-gen-ui-componenten.md).** +3 node-types (§9-max): (1) **`chart`** — één-serie staafgrafiek met tik-inspectie en relief-labels, gevoed door `kosten_maandoverzicht` (uitgaven per week, pure `weeklyExpensePoints`); (2) **`schedule`** — weekmenu-rooster met álle vensterdagen (gaten zichtbaar, `today` server-side); (3) **`choice`** — AskUserQuestion-beslis-kaart bij ≥2 recept-treffers (tik = gewone gebruikersbeurt; sluit AI-15-(3a)-lijn af). Plus **verrijkte `recipe`**: porties-stepper met live ingrediënt-herrekening — puur/client-lokaal ([`lib/assistantGenUi.js`](lib/assistantGenUi.js), ratchet 98,3%). Tool-descriptions/prompt/`data` byte-identiek → geen eval-gate nodig; server-nodes dragen text-fallback voor oude clients. **Afh.-beslissing:** AI-7-wire-protocol bleek voor deze ronde niet nodig (zie AI-7). **Rest:** edge-deploy (samen met de open AI-17-deploy), device-verificatie (chart-tik/rooster/choice/stepper, beide thema's), ronde 2 (choice breder bv. AI-11; `image`/`progress`; lijn-variant). |
| AI-17 | Assistent | AI-actie-laag: schaalbaar ontsluiten (manifest + scaffold) + per-lid capability-controle | Now | Should | L | 🔧 | AI-8, AI-10 | **Fundament gebouwd (2026-07-06).** Antwoord op "hoe ontsluiten we alle modules/logica schaalbaar als AI-acties, makkelijk te managen, met per-gebruiker controle?" → vier blinde vlekken benoemd (B1 dubbel domein-schema, B2 geen app↔edge-brug, B3 client-gestuurde module-poort, B4 geen capability-concept). Model: **gecureerd + scaffold** (géén auto-CRUD-per-tabel — blaast tool-budget op, Sonnet-5 onder-triggert). **Gebouwd:** (1) **capability-manifest** — elke skill-file exporteert `_MANIFEST`, [`tools/index.js`](supabase/functions/_shared/tools/index.js) leidt `ASSISTANT_TOOLS`+`MODULE_BRIEFS` af uit één lijst; elke tool draagt een `risk`-tier; **byte-identiek** voor het model (golden-set groen). (2) **pure policy** [`lib/aiCapabilities.js`](lib/aiCapabilities.js) (`ai:write`/`ai:spend`/`ai:destructive`, default-on; mutatie 91,9%). (3) **server-afgedwongen** — `filterTools` `canUse`-poort + [`index.ts`](supabase/functions/assistant/index.ts) leidt de moduleset server-side af (niet meer de client-hint) + her-check vóór `execute`; edge importeert nu de pure `lib/modules.js`+`lib/aiCapabilities.js` (app↔edge-brug). (4) migratie [`0074`](supabase/migrations/0074_assistant_capabilities.sql) **live via MCP** (`user_ai_capabilities` per lid, owner-beheerd; advisor schoon; RLS-scenario in de suite). (5) **beheer-UI** owner-only in het huishouden-scherm ([`lib/useAiCapabilities.js`](lib/useAiCapabilities.js)). (6) coverage/budget-meta-test. Suite **1171 pass**, typecheck+`eslint .` schoon, docs [`assistent-architectuur.md`](docs/assistent-architectuur.md) §1+§11. **Bewust → fase 2:** tool-factory + gedeeld veld-schema, en de 5 lege modules (planten/huisdieren/voertuigen/tijdlijn/delen). **Rest (verificatie):** edge-deploy (bundel-brug bevestigen), device-smoke beheer-UI, eval-gate draaien (geen regressie verwacht). |
| AI-9 | Assistent | Geheugen v1 (pgvector hybrid + async extractie + beheer-UI) | Later | Could | L | ⏳ | AI-4 | Ronde H: migratie `assistant_memories` (**eerstvolgend vrij nummer — 0071/0072/0073/0074 zijn bezet (0074 = `user_ai_capabilities`, AI-17), dus 0075**; vector + 'dutch' tsvector, user/household-scope-RLS) + hybrid-RRF-RPC; `remember_fact` (HITL) + async extractor (aparte deployment, dedupe); beheer-scherm; memory-gebruik zichtbaar in chat. |
| LRN-1 | Fundament | Launch-readiness (10k-review) | Now | Must | M | 🔧 | — | **Doorgevoerd** (zie [`docs/launch-readiness-2026-06-26.md`](docs/launch-readiness-2026-06-26.md)): migr. `0055` (SEC-5 join-leak weg) + `0056`/`0057` (scan-receipt getrapte rate-limit: burst/dag-quota/globaal) **live**; `scan-receipt` edge-function **gedeployed** (v3, fail-closed); realtime-`setAuth`, reload-debounce, tijdlijn-paginering/orphan-cleanup, ErrorBoundary, heatmap-memo, vehicleCosts-fix. **Rest:** live-RLS- + device-verificatie; captcha + realtime-tier + Orq-budgetalert bewust uitgesteld. |
| ARCH-4 | Fundament | i18n/ui per domein-namespace splitsen | Later | Could | S | ⏳ | — | [`lib/i18n.js`](lib/i18n.js) (~1226 rgl) / [`lib/ui.js`](lib/ui.js) (~1260 rgl) opdelen om merge-wrijving te dempen. Puur opruimen, gedragsneutraal. **Bewust uitgesteld naar een dedicated sessie (2026-06-27):** een blinde verplaatsing van ~600 i18n-keys + UI-componenten (1200+ rgl) is gedragsneutraal maar **niet hier runtime te verifiëren** (een gemiste key/component-export breekt pas op toestel/web) — past niet bij de stabiliteits-prioriteit zonder draaiende app. Seam aanwezig: i18n heeft al `registerDict()`. Doen mét een draai-/rooktest + een key-set-guard-test. |
| ARCH-5 | Fundament | Formulier-fundament: useEntityForm full-mode + inline validatie + RevealLink | Now | Should | M | 🔧 | ARCH-1 | **Pilot gebouwd (2026-07-01) → [plan 22](docs/plans/22-formulier-fundament.md).** Aanleiding: invoer voelt als "eindeloze formuliertjes". Fundament (gedragsneutraal, additief): [`useEntityForm`](lib/useEntityForm.js) **full-mode** (`dirty` via optionele serialize, `reset` na async load, `validateField` voor onBlur-live-validatie); pure helpers `firstErrorField`/`isDirty` in [`formValidation.js`](lib/formValidation.js) (unit-getest, ratchet **91,5%**); [`useErrorScroll`](lib/ui.js) (scroll-naar-eerste-fout) + [`RevealLink`](lib/ui.js) (één affordance voor optionele velden — `Field` forwardt `onBlur` al). **Pilot:** [`app/task/[id].js`](app/task/%5Bid%5D.js) herbouwd op full-mode (~20 useState → hook-values, handmatige snapshot-dirty → hook-`dirty`, twee ad-hoc onthul-links → `RevealLink`, live-titelvalidatie + scroll-naar-fout) — **identiek** payload/regels/deep-links/verwijder-flow. `npm test` 820 pass, typecheck + eslint 0 err. **Uitrol (2026-07-01):** de 6 overige editors (expense/purchase/recipe/plant/vehicle/pet) op full-mode herbouwd — hook-`values` + `dirty`-discard-guard + onBlur-live-validatie + scroll-naar-fout, gedragsneutraal in payload/regels; de guard geëxtraheerd naar herbruikbare [`useDiscardGuard`](lib/ui.js) zodat ook vehicle (eigen ModalHeader) 'm krijgt. `npm test` 820 pass, typecheck + `eslint .` 0 err, ratchet ongewijzigd. Gemerged als **PR #108**. **Gedeelde lijst-logica (2026-07-01, plan 22 step 2):** het ~16× hand-gekopieerde `includes ? filter : [...]`-toggle-idioom + de regellijst-ops naar het pure, geteste [`lib/listField.js`](lib/listField.js) (`toggleValue`/`addItem`/`removeAt`/`updateAt`, mutatie **100%**), geadopteerd in de editors — een gedeelde `<DynamicList>`-UI bleek een geforceerde abstractie (bon = index-kaarten, recept = key-composer). **Device-geverifieerd (2026-07-01):** nieuwe Maestro-flow [`05-editor-guard.yaml`](.maestro/05-editor-guard.yaml) draait groen op toestel (moto) — leeg opslaan → inline fout, iets invullen → **discard-guard**-bevestiging, "Blijven" behoudt, "Sluiten zonder opslaan" gooit weg (geen rij). Samen met `02-uitgave` (expense-create) + de crash-sweep (alle 15 schermen renderen) bewijst dit het gedeelde fundament (Editor/useEntityForm/useDiscardGuard) op toestel; de flow bewaakt het voortaan reproduceerbaar. **Plan 22 afgerond (2026-07-01):** step 3 = gedeelde foto-flow-hook [`useEntityPhoto`](lib/useEntityPhoto.js) (busy + verse-URL-nonce + picker/upload/error), geadopteerd in plant/pet/recipe; device-geverifieerd (detail + editors renderen schoon, rooktest groen). **Rest:** alleen nog optionele per-editor handmatige device-check van plant/pet/vehicle/recipe/purchase (gedeeld mechanisme al bewezen via flow 05 + expense-create + de sweep). |
| FND-3 | Fundament | Kinderprofielen | Later | Should | M | ⏳ | FND-1 | Open vraag (§5): eigen login of 'profiel zonder account' onder een ouder. Raakt privacy + subgroep-beveiliging. |
| BOO-4 | Boodschappen | Supermarktvergelijking | Later | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | Later | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie (foto → regels) | Later | Could | L | 🔧 | BOO-2 | **Gebouwd** (`scan-receipt` → Orq vision → bewerkbare editor). **Rest (jouw account):** Orq-deploy + secrets — [`docs/orq-receipt-scan.md`](docs/orq-receipt-scan.md). |
| BOO-9 | Boodschappen | Barcode scannen → catalogus | Next | Should | M | ◐ | BOO-5, VOO-1 | **Datalaag af; scanner-UI device-gated** (`lib/barcode.js`/`barcodeLookup.js`/`openFoodFacts.js`, RPC `insert_catalog_product`, migr. `0027`/`0031`). **Bevinding 2026-06-26:** de scan-trigger leeft in de **bon-flow** ([`app/purchase/[id].js`](app/purchase/[id].js#L117) `onScanPress` → `offerImagePicker` → barcode uit de foto), niet als losse live `expo-camera`-scanner; die bon-editor heeft bovendien zelf nog geen UI-entry-point (zie BOO-10). **Rest:** of een eigen live-camera-scanknop in boodschappen/catalogus, óf eerst BOO-10's entry-point; dán end-to-end scannen op toestel. |
| BOO-14 | Boodschappen | Lijst krijgt meer schermruimte (verken-item, toestelfeedback 2026-06-28) | Next | Should | M | ◐ | — | **Stap 1 (2026-06-28):** de vaste "Catalogus openen"-knop + bonnen-link samengevoegd tot één compacte rij. **Stap 2 (2026-06-29):** "Misschien weer nodig" is nu **inklapbaar** (optie 3) — standaard ingeklapt zodat de lijst de schermruimte krijgt; de kop toont het aantal en klapt op één tik uit (de horizontale kaarten-rail blijft edge-to-edge). [`app/(tabs)/boodschappen.js`](app/(tabs)/boodschappen.js). **Open (kies/combineer):** (1) kop laten inklappen bij scrollen (compacte titel, subtitle weg/samengevoegd); (2) catalogus/bonnen naar header-actie — let op: sluit op **UX-42** (kop-rechts = alleen uitleg/gelabelde acties, geen losse navigatie). **Rooktest 2026-06-30:** stap 1 (compacte "Catalogus \| Bonnen"-rij) device-bevestigd; stap 2 (inklap) is **code-bevestigd maar niet op toestel reproduceerbaar** — de sectie is data-gated op aankoopfrequentie (`dueScore ≥ 1`), die het testhuishouden niet heeft (bewust geen aankoophistorie op de live DB gefabriceerd). UX-review (`docs/ux-review-rooktest-2026-06-30.md`) → zie **UXR-10**. **Rest:** open ontwerpkeuzes (1)/(2). |
| PLA-6 | Planten | AI-soortherkenning | Later | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-9 | Planten | Bulk planten toevoegen ("plant-rondje" met rollende camera) | Later | Could | L | ⏳ | PLA-1, UX-7 | **Idee:** doorlopende camera-flow plant ná plant (foto+naam+notitie), elk direct `addPlant`. Leunt op UX-7 (`CaptureSession`). Dev build; geen migratie. |
| PLA-10 | Planten | Meer controle over de verzorgingstaken | Next | Should | M | 🔧 | PLA-3 | **Eerste stap gebouwd (2026-06-29, via UXR-6/[plan 21](docs/plans/21-zorg-teardown.md)).** **Statuscorrectie:** een verzorgingstaak was vanaf het detail níét te openen — plant- én huisdier-detail gaven de taakrijen geen `onPress`, dus `TaskRow` viel via `taskHref` terug op ditzélfde detail (dode tik). **Nu:** de taakrijen openen de taak-editor (interval/frequentie/weekdagen/herhaal-einde) op [`app/plant/[id].js`](app/plant/%5Bid%5D.js) én [`app/pet/[id].js`](app/pet/%5Bid%5D.js) (parity). **+ "Taak toevoegen"** op de plant → `/task/new?plant=<id>`: de taak-editor kreeg een `plant`-passthrough (category `plant` + `plant_id` in de payload, symmetrisch met `zone`). **Open (in [plan 21](docs/plans/21-zorg-teardown.md)):** expliciet pauzeren/hervatten (staat-keuze → mogelijk migratie), plant-visibility overnemen bij een handmatige taak, evt. een per-plant care-overzicht (huisdier-`openCareSheet`-stijl). **Rooktest 2026-06-30 (moto):** verzorgingstaak op het plant-detail opent nu de taak-editor (geen dode tik) ✓; "+ Taak toevoegen" → opgeslagen taak verschijnt mét plant-koppeling onder Verzorgingstaken ✓. Huisdier-parity níét getest (geen huisdier in testhuishouden) — code is symmetrisch. UX-review vond een editor-bug (nieuw-modus = twee bevestigplekken) → **UXR-10**. **Rest:** plan-21-beslissingen (pauzeren/visibility/care-overzicht) + huisdier-parity op een toestel met huisdier. |
| HUI-1 | Huisdieren | Huisdier-verzorging (module) | Next | Should | L | 🔧 | — | **Gebouwd (migr. `0038`, live):** `pets`/`pet_log` + bucket; `lib/petCare.js` (8 typen) → checklist die `tasks` (cat. `huisdier`) aanmaakt; tijdlijn+gewicht. **Device 2026-06-25:** module + lege-staat renderen ✓. **Rest:** gevulde detail (foto/checklist/tijdlijn) niet getest (geen huisdier in testhuishouden). |
| AAN-1 | Grote aankopen | Aankoop-dossier | Later | Should | M | ⏳ | — | Titel/budget/deadline/beslissers, subgroep-gescoped (FND-1 is af). Plan [`03`](docs/plans/03-grote-aankopen.md). **Bewust uitgesteld.** |
| AAN-2 | Grote aankopen | Opties verzamelen | Later | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-3 | Grote aankopen | Vergelijktabel | Later | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | Later | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | Later | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-2 | Agenda | Sync met telefoon-agenda | Later | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | Later | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| VOO-2 | Voorraad | Voorraad vullen via barcode | Later | Could | S | ⏳ | BOO-9, VOO-1 | Scan-resultaat van BOO-9 ook als voorraad-item. Deelt de scan-flow; extra bestemming. |
| TML-3 | Tijdlijn | Emoji-reacties (op berichten én systeem-events) | Later | Should | M | 🔧 | TML-1 | **Gebouwd voor posts + live**: migratie `timeline_reactions` (repo `0067`) live, pure `aggregateReactions` (`lib/timeline.js`, ratchet 93.8%), `lib/useReactions.js` + `ReactionBar`; live-RLS-test bewijst member/toggle/forge/`can_view`-lek (RLS-suite 29/29). **Rest:** reacties op systeem-events (hoort bij TML-5's folding) + toestel-smoketest. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). |
| TML-4 | Tijdlijn | Tekstreacties/comments (alléén op berichten) | Later | Should | M | ⏳ | TML-1 | `timeline_comments` (kind-tabel, erft post-zichtbaarheid); thread onder de post. Systeem-events: geen comment. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). Migratie. |
| TML-6 | Tijdlijn | Filterinstellingen (per module + event-type, twee lagen) | Later | Should | M | ⏳ | TML-5 | `lib/timelineFilter.js` (default-on, huishouden-uitzetting wint, vgl. `effectiveModules`) + `household_timeline_prefs`/`user_timeline_prefs` (spiegelen migr. `0004`). Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). Migratie. |
| TML-7 | Tijdlijn | Filter per persoon/lid | Later | Could | S | ⏳ | TML-6 | `axis='member'` erbij in `timelineFilter` + ledenlijst-toggles. Geen extra migratie. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). |
| TML-8 | Tijdlijn | Filter per zichtbaarheid/subgroep | Later | Could | M | ⏳ | TML-6 | `axis='subgroup'` — **weergave**-filter bovenop de RLS. FND-1 (subgroepen) is af; hangt nu enkel op TML-6 (filter-fundament). Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | Next | Could | M | 🔧 | — | **Gebouwd** (`lib/activity.js`+`activiteit.js`, geen migratie). **Rest:** realtime bevestigen. **Bekend:** hernoeming ververst feed-titel niet realtime. **Wordt uitgebouwd tot de Tijdlijn/Prikbord-module (TML-1…8, [plan 19](docs/plans/19-tijdlijn-prikbord.md));** de event-engine `lib/activity.js` blijft de events-laag (TML-5). |
| PLT-7 | Platform | Beter uitnodigingssysteem (persoonlijke 24u-link) | Next | Should | M | 🔧 | — | **Gebouwd:** migr. [`0053`](supabase/migrations/0053_household_invites.sql) (`household_invites` + DEFINER-RPC's `create_invite`/`peek_invite`(anon)/`accept_invite`/`revoke_invite`); `lib/invites.js` (units, ratchet **93%**); web-first join-scherm [`app/join/[token].js`](app/join/[token].js) (preview→auth→accept→download-placeholders) + pending-melding [`PendingInviteBanner`](lib/PendingInviteBanner.js) op onboarding/vandaag; invite-UI in [`huishouden.js`](app/(tabs)/huishouden.js) (rol vooraf lid/beheerder, delen via sharesheet, intrekken). Web-first & account-gebonden (geen deferred deep linking). **Migr. `0053` is live** (geverifieerd 2026-06-26); de RLS-isolatie `household_invites` + `accept/peek/revoke` is groen in de live-integratiesuite (onderdeel van de **775 pass**-meting van 2026-06-26; het eerdere getal 729 was een oudere run). **Web-build LIVE op Cloudflare Pages (geverifieerd 2026-07-01):** `huishoek.app` serveert de SPA — `/`, `/welcome` én `/join/<token>` geven HTTP 200 (server: cloudflare), via `npm run deploy:web` (`expo export --platform web` → `wrangler pages deploy`). De backlog zei eerder "CF-auth/deploy nog open" — **stale**. **Rest:** **echte store-links** i.p.v. de download-placeholders op `/join`; een end-to-end web/device join-rooktest (invite → preview → auth → accept → in het huishouden). Kind-rol → FND-3; wachtwoordloos → PLT-8. |
| PLT-10 | Platform | Web-mobile: swipen + camera werkend krijgen (crasht nu) | Next | Should | M | ◐ | — | **Camera-deel gebouwd (2026-06-28):** [`offerImagePicker`](lib/photoPicker.js) laat op web de camera-rij weg (de systeem-camera via `expo-image-picker` is op web-mobile onbetrouwbaar/gooit) en stuurt nu op `kind` i.p.v. een vaste index → alleen "uit bibliotheek/bestand". **Bevinding swipe:** `SwipeRow` ([`lib/ui.js`](lib/ui.js)) is al web-geguard (geeft de kale rij terug op web), dus de crash zit waarschijnlijk **niet** daar maar in de gedeelde [`BottomSheet`](lib/ui.js#L892): geneste `GestureHandlerRootView` + een Reanimated-`Pan`-worklet die op web kan omvallen (geen reanimated-babel-plugin expliciet). **Sentry-bevinding (2026-07-01):** in 90 dagen productie **0 issues** behalve HUISHOEK-1 (nu gefixt) — ondanks live web-verkeer op `huishoek.app` is er **geen enkele BottomSheet/gesture-crash waargenomen**. De "crasht op web"-titel stamt uit een oude hypothese; die is nu **onbevestigd**. **Rest (web-run nodig):** de `BottomSheet`-gesture op web guarden blíjft een nette hardening (backdrop/kruisje blijven; swipe-to-dismiss uit), maar niet blind wijzigen — via Sentry bewaken en pas fixen als er echt een crash binnenkomt. **Derde web-crash gevonden + gefixt via Sentry (2026-06-30, HUISHOEK-1):** de gedeelde `DialogHost` ([`lib/dialog.js`](lib/dialog.js#L129)) riep bij het openen `findNodeHandle()` aan voor screenreader-focus — react-native-web ondersteunt dat niet (gooit), dus élke `dialog.alert/confirm/menu` op web-mobile crashte (gezien op `huishoek.app/welcome`, na signup). Nu geguard op `Platform.OS === 'web'` (op web doet `setAccessibilityFocus` toch niets). Native ongewijzigd. |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | Later | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | **Doel:** eigen camerascherm (`expo-camera`) + generiek `CaptureSession`-primitief (deelt met BOO-9, batch PLA-9). Dev build. |
| INF-3 | Platform | E2E-tests (Maestro) | Next | Should | M | 🔧 | — | **Error-bewuste rooktest, op toestel groen** ([`docs/rooktest.md`](docs/rooktest.md)): `npm run rooktest` = deeplink-crash-sweep (15 schermen) + **5** Maestro behavior-flows + logcat-oordeel + exit-code, self-cleanend (runner ruimt `E2E…`-rijen op DB-niveau op). Selectors op `t-*`-id's (`lib/ui.js` + tabs). Flow `05-editor-guard` dekt het formulier-fundament (validatie + discard-guard, ARCH-5). **Bijgewerkt 2026-07-05:** de FAB-flows (`01-taak`/`04-swipe`/`05-editor-guard`) volgen nu de **AI-first FAB** (AI-10) — tik FAB → "Zelf invoeren" → editor; ze faalden stil sinds AI-10 de FAB naar de assistent-chat leidde (de open overlay verborg daarna de tab-bar voor de vervolg-flows). **Rest:** evt. in CI/EAS-workflow hangen. |
| INF-4 | Platform | Foutrapportage/monitoring (Sentry) | Next | Should | S | 🔧 | — | **Gewired** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `lib/monitoring.js` env-gated + `ErrorBoundary`. **Sentry-project aangemaakt** (`evdn/huishoek`, EU-region `de.sentry.io`, 2026-06-26); DSN **live als EAS-env** (`EXPO_PUBLIC_SENTRY_DSN` op `@evdns-team/huishoek`, prod/preview/dev, 2026-06-26) + lokaal in `.env`; `metro.config.js` via `getSentryExpoConfig` genereert de source maps + debug-ID's. **Source-map-upload via de EAS↔Sentry-dashboard-integratie** (Expo-UI gekoppeld → EAS uploadt zelf, `SENTRY_DISABLE_AUTO_UPLOAD=true` gezet; geen handmatige `SENTRY_AUTH_TOKEN` nodig). Setup-runbook in [`docs/eas-setup.md`](docs/eas-setup.md). **Sentry bevestigd live in productie (2026-06-30):** ving zijn eerste echte fout (HUISHOEK-1, `release Huishoek@1.0.0`, env `production`) mét onze `context: render`-tag uit de `ErrorBoundary` → leidde direct tot de dialog-web-fix (zie **PLT-10**). Web-ruisfilter toegevoegd in [`lib/monitoring.js`](lib/monitoring.js) (`ignoreErrors: /\.at is not a function/` — scanbots/pre-ES2022-engines). **Rest:** de web-build-frames kwamen nog **geminified** binnen (gs/hs) — web-source-map-upload nog te verifiëren; en een crash uit een **native** cloud-build gesymboliceerd terugzien (EAS↔Sentry-integratie). |
| INF-5 | Platform | Release-pijplijn (EAS) | Next | Should | M | 🔧 | — | **Config gestaged** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `eas.json` + `docs/eas-setup.md`. **Eerste EAS-build gedraaid (2026-07-02):** development-profiel, Android-APK, `FINISHED` (build `241b0a4f`) — remote Android-credentials + auto-keystore, env's uit de `development`-omgeving geladen, `google-services.json` via secret file-env. Bevestigt dat de pijplijn end-to-end werkt. **Rest:** productie-`app-bundle` + `eas submit` (wacht op Play-account). |
| INF-8 | Platform | Realtime-primitief & scoping | Next | Should | M | 🔧 | — | **Af (C1–C4):** `useRealtimeReload`+household-filter (migr. `0025`)+`realtimePatch`+`realtimeHub`. **Rest:** patch+gebundelde subscriptie op toestel. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | Next | Should | S | 🔧 | — | **Gebouwd+gedeployed:** per-gebruiker rate-limit (migr. `0026`)+MIME-whitelist. **Open (L1, [plan 17](docs/plans/17-security-remediatie.md)):** rate-limit fail-open → fail-closed + Orq-kostencap. **Rest:** happy-path op toestel. |
| INF-10 | Platform | DB-advisor-hardening | Next | Could | S | 🔧 | — | B4 af (migr. `0024`); **M1 GEBOUWD+LIVE** (migr. `0042`–`0044`: anon/PUBLIC-EXECUTE ingetrokken op user-facing DEFINER-RPC's, `authenticated` + RLS-helpers behouden). **Migr. `0058` LIVE (2026-06-26, advisor-geverifieerd):** anon/PUBLIC-EXECUTE ingetrokken op de RLS-helpers (`is_member`/`is_owner`/`in_subgroup`/`can_view` — `authenticated` bewust behouden voor policy-evaluatie) + de trigger-fns (`handle_new_user`/`check_subgroup_household`/`cleanup_vehicle_resource`, uit alle rollen). Advisors bevestigen: anon-WARN op de helpers weg en trigger-fns niet meer geflagd; geen ERROR. **B5 LIVE (2026-06-27):** `pg_trgm` verplaatst van `public` → `extensions`-schema (migr. `0064`); de gin_trgm_ops-opclass + de catalogus-index verhuisden mee, `search_catalog` kreeg `extensions` in z'n search_path. Geverifieerd: pg_trgm in `extensions`, index intact, zoeken geeft nog treffers. **Open:** B6 leaked-password (dashboard-toggle, jouw account). [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-6 | Security | Service-role-key uit de app-`.env` | Next | Should | S | ⏳ | — | Handmatige hygiëne (sleutel nodig voor live RLS-tests, staat in gitignored `.env`): uit de app-`.env` halen, ad-hoc in de shell injecteren, periodiek roteren (SECURITY.md). M5, [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-7 | Security | Supply-chain & CI-hygiëne | Next | Could | S | ◐ | — | **L3 GEBOUWD:** SSRF-allowlist in `refresh-off-delta.mjs`. **L2 uitgesteld:** 14 moderate (build-time Expo, 0 high) → meenemen bij de volgende SDK-bump. [plan 17](docs/plans/17-security-remediatie.md). |
| PERF-1 | Platform | Query-vensters & bulk-RPC | Next | Could | M | 🔧 | INF-8 | **Aggregaat-RPC af (migr. `0037`, live):** `household_*_totals` (SECURITY INVOKER → RLS scopet). **Rest:** P-H4 bulk-RPC bon→voorraad. |
| PERF-4 | Platform/perf | Render hot-path: TaskRow + Home-widgets memoïseren | Next | Should | M | 🔧 | — | **Gebouwd** ([`lib/TaskRow.js`](lib/TaskRow.js) + [`lib/widgets/registry.js`](lib/widgets/registry.js) gememoiseerd, `useMemo` per widget-samenvatting). Code-geverifieerd 2026-06-25; **device:** widget-grid/lijsten renderen soepel, niet onder afvink-stress gemeten. [plan 16](docs/plans/16-performance-audit.md). |
| PERF-5 | Platform/perf | Voorraad "plaats"-modus terug onder virtualisatie | Next | Should | S | 🔧 | — | **Gebouwd** ([`voorraad.js`](app/(tabs)/voorraad.js#L100): één `SectionList` + `React.memo`-rij voor beide views i.p.v. alles in `ListHeaderComponent`). Code-geverifieerd 2026-06-25; **device:** scherm + "Op urgentie/bewaarplaats"-toggle renderen ✓, maar voorraad is leeg → gevulde `SectionList` niet observeerbaar zonder data. [plan 16](docs/plans/16-performance-audit.md). |
| PERF-7 | Platform/perf | Foto's resizen bij upload + expo-image-cache | Next | Should | M | 🔧 | — | **Gebouwd** ([`photoPicker.js`](lib/photoPicker.js#L27): lazy `expo-image-manipulator` → resize+compress, stille fallback zonder de native module). Code-geverifieerd 2026-06-25. **Rest:** activeert in een dev-build; foto-upload op toestel meten. [plan 16](docs/plans/16-performance-audit.md). |
| PERF-8 | Platform/perf | Datalaag: query-vensters + koopfrequentie-RPC + reminder-hookstorm | Next | Should | M | 🔧 | INF-8, PERF-1 | **Grotendeels af.** Index (migr. `0045`, `purchase_items(household_id,product_id)`), `usePurchases`-venster (`PURCHASES_WINDOW=200`) en reminder-**debounce** (1500ms in [`useNotifications`](lib/useNotifications.js)) bestonden al. **2026-06-27:** server-side **koopfrequentie-RPC** `product_purchase_dates` (migr. `0065`, SECURITY INVOKER, **live**+geverifieerd) → [`useProductFrequencies`](lib/useProducts.js) groepeert niet meer client-side. **`useTasksForReminders` bewust niet gebouwd (2026-06-27):** de 1500ms-debounce + de gedeelde `useCollection`-cache (één `tasks`-subscriptie, niet per-scherm) dekken de hookstorm al; een aparte reminder-hook zou logica dupliceren = schuld. **Rest:** device-rooktest van de "misschien weer nodig"-suggesties. [plan 16](docs/plans/16-performance-audit.md). |
| PERF-9 | Platform/perf | Virtualisatie-tuning op de SwipeRow-lijsten | Next | Could | S | 🔧 | — | **Gebouwd** (`initialNumToRender`/`maxToRenderPerBatch`/`windowSize` staan nu op boodschappen/taken/kosten/voorraad). Code-geverifieerd 2026-06-25; **device:** boodschappen/taken-lijsten renderen vlot, scroll-stress niet apart gemeten. [plan 18](docs/plans/18-ux-verbeterplan.md) D3. |
| UX-9 | Platform/UX | Eigen lettertype verkennen (weg van het systeemfont/Inter) | Later | Could | S | ⏳ | UX-1 | Verkenning: variable font (geen Inter) via `expo-font` op de `type`-tokens. Latin-Extended, OFL. Keuze in `DESIGN.md`. |
| UX-13 | Platform/UX | Flexibele avatars: foto-upload + zelf-gebouwde avatar (personen én huishouden) | Later | Should | M | ⏳ | UX-1, STR-4 | **Idee:** avatar emoji→foto/zelfgebouwd, leden+huishouden. `kind: emoji\|photo\|builder`, `avatars`-bucket+RLS, `Avatar`-switch; builder via `react-native-svg`. Migratie nodig. |
| UX-42 | Platform/UX | Header-icoonrechts opschonen: alleen uitleg/activeerbaar, geen verstopte navigatie | Next | Should | M | 🔧 | — | **Grotendeels al gerealiseerd + nu gecodificeerd (2026-06-29).** Inventarisatie: **álle** tab-kop-`right`-slots dragen nu uitsluitend de [`ModuleHelpButton`](lib/ui.js); de oude cryptische losse icoonknoppen zijn weg. Module-specifieke vervolgnavigatie (Planten→tijdlijn, Kosten→inzichten/terugkerend, Taken→klusbibliotheek) leeft als **gelabelde `actions`** onderin de help-drawer i.p.v. een naamloos icoon. Het kop-contract is vastgelegd in [`DESIGN.md`](DESIGN.md) ("Kop-rechts = uitleg + gelabelde acties, nooit verstopte navigatie"). **Open ontwerpvraag:** is een gelabelde actie ín de ⓘ-drawer ontdekbaar genoeg, of moet een veelgebruikte vervolgactie (bv. Inzichten) als `Button` ín de inhoud staan? Per scherm wegen — device/UXR-werk. **Device-rooktest 2026-07-01 ✅ (contract):** Kosten-ⓘ-drawer toont uitleg + gelabelde acties ("Inzichten"/"Terugkerende uitgaven"); "Inzichten" navigeert daadwerkelijk (functioneel, niet decoratief). **Rest:** alleen nog de ontwerpvraag hierboven (drawer-actie vs `Button` in de inhoud). |
| A11Y-2 | Platform/UX | Toegankelijkheid op schermniveau | Next | Should | M | ◐ | A11Y-1 | **Grotendeels gebouwd** ([`voorraad.js`](app/(tabs)/voorraad.js#L54): status niet kleur-only via `accessibilityLabel`; form-velden via `Field`; resterende rauwe `TextInput`s zijn bewuste compacte inline-velden). **Device-bevestigd 2026-06-25 (dump):** toevoeg-invoer als gelabelde `EditText`, tegels/tabs/FAB als benoemde knoppen, checkbox-rol+status. **Rest:** 44pt-targets nameten. [plan 18](docs/plans/18-ux-verbeterplan.md) A5-A9. |
| UX-44 | Platform/UX | Usability quick wins (catalogus/feedback/stepper) | Next | Could | M | ◐ | — | **Deels gebouwd** (`Celebrate` in [`ui.js`](lib/ui.js), gebruikt in `taken.js`). **Device-bevestigd 2026-06-25:** eenheid-in-`Stepper` zichtbaar ("− 2 bak +", "− 2 kg +"). **Rest:** overige B3-B8 (microcopy, feedback-timing, suggesties wegklikbaar) nalopen. [plan 18](docs/plans/18-ux-verbeterplan.md) B3-B8. |
| UXR-4 | UX-review | Ontleding: Kosten & delen | Later | Should | M | ⏳ | — | Verkennend: `kosten.js`/`expense`/`kosten-inzichten.js`/`delen.js`. Split-type, settle-uitleg, saldo-transparantie. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-5 | UX-review | Ontleding: Keuken-loop (Maaltijden + Voorraad) | Later | Should | M | ⏳ | — | Verkennend: `maaltijden.js`/`recipe`/`voorraad.js` — menu→boodschappen→koken→voorraad. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-6 | UX-review | Ontleding: Zorg-modules (Planten + Huisdieren) | Next | Should | M | 🔧 | — | **Klaargezet + eerste stap gebouwd (2026-06-29) → [plan 21](docs/plans/21-zorg-teardown.md):** huidige stand code-geverifieerd, de PLA-10-wensen, en de open beslissingen (pauzeren-staat? plant-visibility? per-plant overzicht? lege-staat-handelingen). **Doorgevoerd:** de "verzorging bewerken"-eerste-stap (zie **PLA-10**) — dode tik weg op plant + huisdier, "Taak toevoegen" op de plant. **Rest:** de teardown-sessie samen doorlopen → concrete `PLA-NN`/`HUI-NN`-rijen; "kaart-zonder-handeling" en soort-wijzigen-parity nog ontleden. Lens/werkwijze: [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-7 | UX-review | Ontleding: Setup & beheer | Later | Should | S | ⏳ | — | Verkennend: `huishouden.js`/`onboarding.js`/`instellingen.js`. Eerste-keer-flow, invoer-behoud, toggle-feedback. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-8 | UX-review | Ontleding: Activiteit & navigatie-weefsel | Later | Could | S | ⏳ | UX-12 | Verkennend: `activiteit.js` + cross-module deeplinks/terugkeer. Sluit op UX-10/UX-12. [plan 14](docs/plans/14-ux-module-teardown.md). |
| UXR-9 | UX-review | Ontleding: Schoonmaak (samen strak zetten) | Next | Should | M | 🔧 | SCH-4 | **Klaargezet + uitgevoerd (2026-06-28→29) → [plan 20](docs/plans/20-schoonmaak-teardown.md).** Beslissingen genomen en gebouwd (zie **SCH-4**): schoonmaaktaak = `zone_id` (zone-as in `applyTaskFilters`); **deeplink naar Taken** i.p.v. een eigen rooster-weergave (hergebruik de bestaande filters/scopes); custom rooster = **terugkerende taken zonder migratie** (`buildCustomSchedule`); zone-keuze in de builder put uit sjabloon- + bestaande zones (losse zone-CRUD-UI bewust nog niet). **Rooktest 2026-06-30 (moto):** de hele loop bevestigd — "Rooster opstellen" → Zelf-samenstellen (zone + cadans, live preview) → "Opzetten" → taak verschijnt in de zone; "Rooster bekijken" → Taken met Week-scope + actief Schoonmaak-filter (zie **SCH-4**, gearchiveerd). UX-review vond schoonmaak-opvolgpunten (footer-knoppen/kleur, "Rooster bekijken"-copy, dubbele taaknamen) → **UXR-10**. **Rest:** evt. losse zone-beheer-UI (beslissing D) als dat later nodig blijkt. |
| UXR-11 | UX-review | Opvolging device-rooktest ronde 2 (Voertuigen/Bonnen/Catalogus) | Next | Should | M | ◐ | — | **Device-rooktest 2026-06-30** (VTG-1..4 + BOO-10 → ✅/archief; BOO-13 ingang/render bevestigd) + **twee onafhankelijke subagent-reviews** (UX + visueel) → geprioriteerd **verbeterplan** in [`docs/verbeterplan-modules-2026-06-30.md`](docs/verbeterplan-modules-2026-06-30.md), met élke bevinding tegen de code geverifieerd. **Reeds gefixt (deze PR):** "1 producten"-meervoud, bon-leesdetail-kop "Annuleer"→"Sluiten", dubbele productnaam in de bon-regel. **Beslissingen (geverifieerd, niet unilateraal gewijzigd):** B1 "Opslaan" vs "Bewaar" app-breed (5 schermen overriden naar "Opslaan", rest default "Bewaar"); B2 "Splitsen"-knop ocher→forest? (welke bon-actie is primair); B3 "Delen met" vs "Delen via Samen"-labels. **Groter werk:** C1 **voertuig opent direct de editor i.p.v. een lees-detail** (breekt het DESIGN.md-contract — grootste item), C2 catalogusrij-affordance (twee tikdoelen), C3 voertuig-editor-sectiekoppen, C4 schap-grid inklappen, C5 kosten-kaart-trap, C6 foto-affordance unificeren. **Non-issues (agent-aanname onjuist):** stepper-`−` dimt al op 0; bon read/edit-splitsing is correct. **Ronde 3 device-rooktest 2026-07-01 (dev-client) — afgerond:** UX-22, UX-42, HUI-2, FND-5 én de BOO-13-rest alle op toestel bevestigd (zie §E–F van het verbeterplan). **Drie op-toestel gevonden bugs gefixt** (elk tegen code + live DB geverifieerd): (1) eigen product onvindbaar via catalogus-zoek → pure `searchOwnProducts` + catalog-merge; (2) huisdier-lijstkaart toonde "Anders" i.p.v. het eigen label → `speciesLabel`; (3) nieuw huishouden aanmaken lukte niet (gate kaatste weg van `/onboarding`) → gate + onboarding-navigatie. typecheck + eslint + `npm test` **810 pass / 0 fail** groen; ratchet favoriteGroceries 85.4%. |

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
- **Data-export & print** (PLT-4) — boodschappenlijst/saldo als CSV of deelbare tekst. *(Zie ook de
  losse opmerking onder §5: account-/data-verwijdering als store-/AVG-vereiste.)*
- **Wachtwoordloze login: magic-link / OTP** (PLT-8) — registreren/inloggen zonder wachtwoord te
  verzinnen (Supabase `signInWithOtp` → e-mailcode of magic-link). Vooral wrijvingsloos voor **nieuwe
  genodigden** via PLT-7. **Voor nu bewust e-mail+wachtwoord;** dit is de latere upgrade. Cross-cutting
  (raakt álle sign-up, niet alleen invites) → eigen rij wanneer het echt wordt.

  > PLT-5 (toegankelijkheids-audit) en PLT-7 (uitnodigingssysteem) zijn **gepromoot naar §6**
  > (resp. A11Y-1/2 en PLT-7) — daarom hier weggehaald, conform de §7-regel "verdwijnt hier".
- **Losse items via web delen (netwerkeffect)** (PLT-9) — bv. een boodschappenlijst deelbaar via een
  web-link, laagdrempelig zónder app, als groeimotor bovenop de web-build van PLT-7. Leunt op dezelfde
  Expo Web-host + token-/zichtbaarheidsaanpak. Later uitwerken.

### 7.3 Nieuwe module-ideeën
- **Documenten- & garantiekluis** (DOC-1) — bonnetjes/handleidingen/garanties/contracten per item;
  herinnering bij aflopende garantie. Hergebruikt het Storage-patroon van Planten.
- **Gezamenlijke wensen-/cadeaulijst** (WEN-1) — verlanglijst per lid; subgroep-privacy zorgt dat
  de ontvanger zijn eigen cadeau niet ziet (precies het scenario uit §1).

### 7.4 Slim & verbonden (Fase 3, AI/extern)
- De "slimme" eindfase staat grotendeels al in §6: PLA-6 (AI-soortherkenning), BOO-7
  (AI-bonextractie), BOO-4 (supermarktvergelijking), AUT-3 (autodelen tussen huishoudens).
- **AI-assistent over je eigen data** (AI-1) — natuurlijke-taalvragen ("wat gaf ik deze maand aan
  boodschappen uit?", "welke plant heeft water nodig?") bovenop de bestaande tabellen.
  **Niet meer geparkeerd** — status in §6, ontwerp in [plan 23](docs/plans/23-assistent.md).

> De volledige uitwerking van de afgeronde epics **Vandaag-widgetgrid** (VDG) en
> **Taken-redesign** (TKN) staat in [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).
