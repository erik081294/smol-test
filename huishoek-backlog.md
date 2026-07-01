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
>   **Resterende 🔧 vragen externe resources** (geen losse device-tik): PLT-1/SEC-5 (notify-deploy),
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
| LRN-1 | Fundament | Launch-readiness (10k-review) | Now | Must | M | 🔧 | — | **Doorgevoerd** (zie [`docs/launch-readiness-2026-06-26.md`](docs/launch-readiness-2026-06-26.md)): migr. `0055` (SEC-5 join-leak weg) + `0056`/`0057` (scan-receipt getrapte rate-limit: burst/dag-quota/globaal) **live**; `scan-receipt` edge-function **gedeployed** (v3, fail-closed); realtime-`setAuth`, reload-debounce, tijdlijn-paginering/orphan-cleanup, ErrorBoundary, heatmap-memo, vehicleCosts-fix. **Rest:** live-RLS- + device-verificatie; captcha + realtime-tier + Orq-budgetalert bewust uitgesteld. |
| ARCH-4 | Fundament | i18n/ui per domein-namespace splitsen | Later | Could | S | ⏳ | — | [`lib/i18n.js`](lib/i18n.js) (~1226 rgl) / [`lib/ui.js`](lib/ui.js) (~1260 rgl) opdelen om merge-wrijving te dempen. Puur opruimen, gedragsneutraal. **Bewust uitgesteld naar een dedicated sessie (2026-06-27):** een blinde verplaatsing van ~600 i18n-keys + UI-componenten (1200+ rgl) is gedragsneutraal maar **niet hier runtime te verifiëren** (een gemiste key/component-export breekt pas op toestel/web) — past niet bij de stabiliteits-prioriteit zonder draaiende app. Seam aanwezig: i18n heeft al `registerDict()`. Doen mét een draai-/rooktest + een key-set-guard-test. |
| ARCH-5 | Fundament | Formulier-fundament: useEntityForm full-mode + inline validatie + RevealLink | Now | Should | M | 🔧 | ARCH-1 | **Pilot gebouwd (2026-07-01) → [plan 22](docs/plans/22-formulier-fundament.md).** Aanleiding: invoer voelt als "eindeloze formuliertjes". Fundament (gedragsneutraal, additief): [`useEntityForm`](lib/useEntityForm.js) **full-mode** (`dirty` via optionele serialize, `reset` na async load, `validateField` voor onBlur-live-validatie); pure helpers `firstErrorField`/`isDirty` in [`formValidation.js`](lib/formValidation.js) (unit-getest, ratchet **91,5%**); [`useErrorScroll`](lib/ui.js) (scroll-naar-eerste-fout) + [`RevealLink`](lib/ui.js) (één affordance voor optionele velden — `Field` forwardt `onBlur` al). **Pilot:** [`app/task/[id].js`](app/task/%5Bid%5D.js) herbouwd op full-mode (~20 useState → hook-values, handmatige snapshot-dirty → hook-`dirty`, twee ad-hoc onthul-links → `RevealLink`, live-titelvalidatie + scroll-naar-fout) — **identiek** payload/regels/deep-links/verwijder-flow. `npm test` 820 pass, typecheck + eslint 0 err. **Rest:** device-rooktest Taken (nieuw/bewerken/herhaling/validatie/discard-guard). **Uitrol (plan 22):** 6 overige incrementeel-editors → full-mode + live-validatie, `<DynamicList>` (bon/recept), gedeeld foto-/loading-veld. |
| FND-3 | Fundament | Kinderprofielen | Later | Should | M | ⏳ | FND-1 | Open vraag (§5): eigen login of 'profiel zonder account' onder een ouder. Raakt privacy + subgroep-beveiliging. |
| FND-5 | Fundament | Wisselen tussen huishoudens (lid van meerdere tegelijk) | Next | Should | M | ✅ | FND-1 | **Statuscorrectie + feedback gebouwd (2026-06-28).** Bij onderzoek bleek dit al grotendeels gebouwd: `household_members` is many-to-many (migr. `0001`), [`useHousehold`](lib/household.js) laadt **álle** huishoudens van de gebruiker (`households[]` + `activeId`, gepersisteerd in AsyncStorage), accepteren van een tweede invite voegt toe zonder de eerste te verwijderen, en er staat al een **switcher** in [`huishouden.js`](app/(tabs)/huishouden.js) ("Wissel van huishouden"). Data-laag scopet reactief op `activeId` (useCollection her-sleutelt, realtime her-subscribet). **2026-06-28 toegevoegd:** feedback-toast bij wisselen (`household.switched`) + no-op-guard op het actieve huishouden. **Device-rooktest 2026-07-01 ✅:** 2e huishouden aangemaakt → app landt met het nieuwe huishouden actief en de **data her-scoopt** (leeg); terugwisselen geeft de toast "Nu actief: Vark's Huishouden" en her-scoopt terug. **Onderweg een blokkerende bug gevonden + gefixt:** "Nieuw of aansluiten bij huishouden" was onbereikbaar — de gate in [`app/_layout.js`](app/_layout.js) kaatste een lid mét huishouden meteen weg van `/onboarding`. De gate stuurt niet meer weg vanuit `onboarding`; [`onboarding.js`](app/onboarding.js) navigeert nu zélf de app in na een geslaagde create (eerste én extra huishouden). Optioneel nog: snellere switcher buiten de Huishouden-tab (kop). |
| BOO-4 | Boodschappen | Supermarktvergelijking | Later | Could | L | ⏳ | BOO-3 | Totaalprijs standaardmandje per winkel. Vereist betrouwbare matching. |
| BOO-6 | Boodschappen | Per-keten bon-parsers | Later | Could | M | ⏳ | BOO-2 | Trap 2. AH/Jumbo/Lidl/Plus. |
| BOO-7 | Boodschappen | AI-bonextractie (foto → regels) | Later | Could | L | 🔧 | BOO-2 | **Gebouwd** (`scan-receipt` → Orq vision → bewerkbare editor). **Rest (jouw account):** Orq-deploy + secrets — [`docs/orq-receipt-scan.md`](docs/orq-receipt-scan.md). |
| BOO-9 | Boodschappen | Barcode scannen → catalogus | Next | Should | M | ◐ | BOO-5, VOO-1 | **Datalaag af; scanner-UI device-gated** (`lib/barcode.js`/`barcodeLookup.js`/`openFoodFacts.js`, RPC `insert_catalog_product`, migr. `0027`/`0031`). **Bevinding 2026-06-26:** de scan-trigger leeft in de **bon-flow** ([`app/purchase/[id].js`](app/purchase/[id].js#L117) `onScanPress` → `offerImagePicker` → barcode uit de foto), niet als losse live `expo-camera`-scanner; die bon-editor heeft bovendien zelf nog geen UI-entry-point (zie BOO-10). **Rest:** of een eigen live-camera-scanknop in boodschappen/catalogus, óf eerst BOO-10's entry-point; dán end-to-end scannen op toestel. |
| BOO-13 | Boodschappen | Producteditor + "opslaan in catalogus?"-prompt bij nieuw item | Next | Should | M | 🔧 | BOO-5 | **Gebouwd (2026-06-27).** Migr. `0061` (`products.emoji`) + `0062` (`products.photo_path` + private bucket `product-images`, household-RLS — spiegelt recepten/0034), **live** via MCP, additief/nullable. Producteditor [`app/product/edit.js`](app/product/edit.js) op de gedeelde entity-editor ([`useEntityForm`](lib/useEntityForm.js) + [`Editor`](lib/ui.js)): naam, schap ([`CATEGORIES`](lib/groceryCatalog.js)), standaard-eenheid, **emoji** ([`EmojiPicker`](lib/ui.js)) én **foto** ([`offerImagePicker`](lib/photoPicker.js) → [`uploadPhoto`](lib/photoStorage.js), getoond via gecachete signed URL). [`useProducts`](lib/useProducts.js) `updateProduct`/`setProductPhoto`/`clearProductPhoto` schrijven naar de gedeelde rij → **huishouden-breed**. **Werkt voor álle catalogusproducten**: tik op een product in de Catalogus → editor (een bundel-/zoek-item wordt eerst aangemaakt = "opslaan", dán bewerken). **Prompt:** na een nieuw item toevoegen vraagt de Catalogus "even aankleden?" → editor. Bewerkte emoji/foto tonen in "Eerder gekozen" ([`ProductImageView`](lib/ProductImageView.js) prefereert foto → emoji → schap-emoji). **Rooktest 2026-06-30 (moto):** ingang + render device-bevestigd. **Rooktest 2026-07-01 (dev-client) — rest afgerond ✅:** editor **opslaan** bewezen (categorie-round-trip → "'Koffie' bijgewerkt"), **foto-upload** (actiesheet → native Google-Foto's-picker launcht clean, geen ActivityResultLauncher-crash → annuleer-terugkeer), de **"even aankleden?"-prompt** (Later/Aankleden) na een nieuw product, en de **onderkant** (standaard-eenheid + emoji-picker). **Bug gevonden + gefixt:** een zelf-aangemaakt product was **niet vindbaar via catalogus-zoek** ("Niets gevonden" → duplicaat) — zoeken doorzocht alleen de gebundelde `CATALOG`. Nieuwe pure [`searchOwnProducts`](lib/favoriteGroceries.js) + [`catalog.js`](app/catalog.js) merget eigen (vóóraan) + gebundelde matches, ontdubbeld op naam; op device bevestigd. **Vindbaarheid-affordance** (naam vs stepper) blijft **UXR-11 C2**. |
| BOO-14 | Boodschappen | Lijst krijgt meer schermruimte (verken-item, toestelfeedback 2026-06-28) | Next | Should | M | ◐ | — | **Stap 1 (2026-06-28):** de vaste "Catalogus openen"-knop + bonnen-link samengevoegd tot één compacte rij. **Stap 2 (2026-06-29):** "Misschien weer nodig" is nu **inklapbaar** (optie 3) — standaard ingeklapt zodat de lijst de schermruimte krijgt; de kop toont het aantal en klapt op één tik uit (de horizontale kaarten-rail blijft edge-to-edge). [`app/(tabs)/boodschappen.js`](app/(tabs)/boodschappen.js). **Open (kies/combineer):** (1) kop laten inklappen bij scrollen (compacte titel, subtitle weg/samengevoegd); (2) catalogus/bonnen naar header-actie — let op: sluit op **UX-42** (kop-rechts = alleen uitleg/gelabelde acties, geen losse navigatie). **Rooktest 2026-06-30:** stap 1 (compacte "Catalogus \| Bonnen"-rij) device-bevestigd; stap 2 (inklap) is **code-bevestigd maar niet op toestel reproduceerbaar** — de sectie is data-gated op aankoopfrequentie (`dueScore ≥ 1`), die het testhuishouden niet heeft (bewust geen aankoophistorie op de live DB gefabriceerd). UX-review (`docs/ux-review-rooktest-2026-06-30.md`) → zie **UXR-10**. **Rest:** open ontwerpkeuzes (1)/(2). |
| PLA-6 | Planten | AI-soortherkenning | Later | Could | L | ⏳ | PLA-1 | Plant-ID API of eigen model; handmatige keuze blijft terugval. |
| PLA-9 | Planten | Bulk planten toevoegen ("plant-rondje" met rollende camera) | Later | Could | L | ⏳ | PLA-1, UX-7 | **Idee:** doorlopende camera-flow plant ná plant (foto+naam+notitie), elk direct `addPlant`. Leunt op UX-7 (`CaptureSession`). Dev build; geen migratie. |
| PLA-10 | Planten | Meer controle over de verzorgingstaken | Next | Should | M | 🔧 | PLA-3 | **Eerste stap gebouwd (2026-06-29, via UXR-6/[plan 21](docs/plans/21-zorg-teardown.md)).** **Statuscorrectie:** een verzorgingstaak was vanaf het detail níét te openen — plant- én huisdier-detail gaven de taakrijen geen `onPress`, dus `TaskRow` viel via `taskHref` terug op ditzélfde detail (dode tik). **Nu:** de taakrijen openen de taak-editor (interval/frequentie/weekdagen/herhaal-einde) op [`app/plant/[id].js`](app/plant/%5Bid%5D.js) én [`app/pet/[id].js`](app/pet/%5Bid%5D.js) (parity). **+ "Taak toevoegen"** op de plant → `/task/new?plant=<id>`: de taak-editor kreeg een `plant`-passthrough (category `plant` + `plant_id` in de payload, symmetrisch met `zone`). **Open (in [plan 21](docs/plans/21-zorg-teardown.md)):** expliciet pauzeren/hervatten (staat-keuze → mogelijk migratie), plant-visibility overnemen bij een handmatige taak, evt. een per-plant care-overzicht (huisdier-`openCareSheet`-stijl). **Rooktest 2026-06-30 (moto):** verzorgingstaak op het plant-detail opent nu de taak-editor (geen dode tik) ✓; "+ Taak toevoegen" → opgeslagen taak verschijnt mét plant-koppeling onder Verzorgingstaken ✓. Huisdier-parity níét getest (geen huisdier in testhuishouden) — code is symmetrisch. UX-review vond een editor-bug (nieuw-modus = twee bevestigplekken) → **UXR-10**. **Rest:** plan-21-beslissingen (pauzeren/visibility/care-overzicht) + huisdier-parity op een toestel met huisdier. |
| HUI-1 | Huisdieren | Huisdier-verzorging (module) | Next | Should | L | 🔧 | — | **Gebouwd (migr. `0038`, live):** `pets`/`pet_log` + bucket; `lib/petCare.js` (8 typen) → checklist die `tasks` (cat. `huisdier`) aanmaakt; tijdlijn+gewicht. **Device 2026-06-25:** module + lege-staat renderen ✓. **Rest:** gevulde detail (foto/checklist/tijdlijn) niet getest (geen huisdier in testhuishouden). |
| HUI-2 | Huisdieren | Eigen diersoort toevoegen | Later | Should | S | ✅ | HUI-1 | **Gebouwd (2026-06-27).** Migr. `0063` (`pets.species_label`, additief/nullable, **live** via MCP). Bij soort "Anders" verschijnt een vrij "Anders, namelijk…"-veld ([`app/pet/[id].js`](app/pet/[id].js)); [`usePets.addPet`](lib/usePets.js) schrijft `species_label` (alleen bij `type:'anders'`). Pure [`speciesLabel(pet)`](lib/petCare.js) (eigen label wint, anders de vaste soort) — unit-getest. **Device-rooktest 2026-07-01 ✅:** "Anders" → vrij label; opslaan schrijft `species_label`; detail toont "Bidsprinkhaan". **Bug gevonden + gefixt:** de **lijstkaart** toonde nog "Anders" i.p.v. het eigen label (`petType(...).label` i.p.v. `speciesLabel(pet)`) — [`huisdieren.js`](app/(tabs)/huisdieren.js) gebruikt nu `speciesLabel`; op device bevestigd (kaart toont "Bidsprinkhaan"). |
| AAN-1 | Grote aankopen | Aankoop-dossier | Later | Should | M | ⏳ | — | Titel/budget/deadline/beslissers, subgroep-gescoped (FND-1 is af). Plan [`03`](docs/plans/03-grote-aankopen.md). **Bewust uitgesteld.** |
| AAN-2 | Grote aankopen | Opties verzamelen | Later | Should | M | ⏳ | AAN-1 | Kandidaten met prijs/link/foto + voor/tegen per lid. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-3 | Grote aankopen | Vergelijktabel | Later | Should | M | ⏳ | AAN-2 | Opties naast elkaar op zelfgekozen criteria. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-4 | Grote aankopen | Stemmen & besluit vastleggen | Later | Could | S | ⏳ | AAN-3 | Voorkeur per lid; gekozen optie + onderbouwing. Plan [`03`](docs/plans/03-grote-aankopen.md). |
| AAN-5 | Grote aankopen | Prijswijziging-signalering | Later | Could | L | ⏳ | AAN-2 | Vereist externe prijsbron/scraping per optie. |
| AGE-2 | Agenda | Sync met telefoon-agenda | Later | Could | L | ⏳ | AGE-1 | `expo-calendar`; rechten per platform. |
| AUT-3 | Autodelen | Tussen bevriende huishoudens | Later | Could | L | ⏳ | AUT-2 | Gedeelde subgroep over huishoudens; vertrouwens-/uitnodigingsmodel. |
| MLT-4 | Maaltijden | Keuken-herontwerp: recepten-catalogus, ingrediënt-invoer & "wie eet mee" | Now | Should | L | 🔧 | MLT-1, MLT-2, MLT-3 | **Toestelfeedback 2026-06-26 → 3 losse PR's.** **(A, PR #67):** numerieke ingrediënt-invoer (`lib/quantity.js` `parseAmount`, ratchet 94,6%) + catalogus-stijl picker met productbeeld in de recept-editor. **(B, PR #68):** migr. `0059` (`recipes.meal_moment`+`dish_type`, vrije-tekst-assen, **live**); `lib/recipeCatalog.js` (`MEAL_MOMENTS`/`DISH_TYPES`/`filterRecipes`, ratchet **98,6%**); recepten-tab als doorzoekbare catalogus (zoekbalk + filter-chips + cover/badge); receptpagina (lezen) los van de editor via één route met `?edit=1`/`new`, met Bewerken/Inplannen. **(C, PR #69):** migr. `0060` (`meal_plan_entries.eater_ids[]`+`extra_eaters`, **live**); `lib/mealPlan.js` `eaterCount`/`defaultServings` (unit-getest); inplan-sheet met catalogus-stijl recept-picker + "Wie eet mee?" (leden aanvinken, default heel huishouden, + gasten-teller; porties auto = eters, overschrijfbaar) + eters-avatars op de dagkaart. **✅ Device-rooktest 2026-06-26 (moto, live dev-client) — hele loop bevestigd:** Recepten-catalogus mét zoekveld + cover-thumbnails; receptpagina (lezen) los van de editor met Bewerken/Inplannen; eet-moment- + soort-gerecht-chips en numerieke ingrediënt-invoer ("Aardappelen 250 g") in de editor; inplan-sheet met recept-picker + "Wie eet mee?" — lid afvinken → "Samen 1 eter(s)" + porties auto 1, +1 gast → "Samen 2 eter(s)" + porties auto 2; opslaan schreef `meal_plan_entries` weg (`eater_ids`=[Erik,Erik2], `extra_eaters`=0, `servings`=2, recipe gekoppeld — geverifieerd in de DB) en de dagkaart toont recept + "Diner"-badge + "2 pers." + eters-avatars; verwijderen wist de rij (toast + DB count 0). **Rest:** PR's A→B→C naar `main` mergen. Volgt op UXR-5. |
| VOO-2 | Voorraad | Voorraad vullen via barcode | Later | Could | S | ⏳ | BOO-9, VOO-1 | Scan-resultaat van BOO-9 ook als voorraad-item. Deelt de scan-flow; extra bestemming. |
| TML-3 | Tijdlijn | Emoji-reacties (op berichten én systeem-events) | Later | Should | M | ⏳ | TML-1 | `timeline_reactions` polymorf (`target_type`/`target_id`), togglebaar; events mét reactie vouwen niet samen. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). Migratie. |
| TML-4 | Tijdlijn | Tekstreacties/comments (alléén op berichten) | Later | Should | M | ⏳ | TML-1 | `timeline_comments` (kind-tabel, erft post-zichtbaarheid); thread onder de post. Systeem-events: geen comment. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). Migratie. |
| TML-6 | Tijdlijn | Filterinstellingen (per module + event-type, twee lagen) | Later | Should | M | ⏳ | TML-5 | `lib/timelineFilter.js` (default-on, huishouden-uitzetting wint, vgl. `effectiveModules`) + `household_timeline_prefs`/`user_timeline_prefs` (spiegelen migr. `0004`). Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). Migratie. |
| TML-7 | Tijdlijn | Filter per persoon/lid | Later | Could | S | ⏳ | TML-6 | `axis='member'` erbij in `timelineFilter` + ledenlijst-toggles. Geen extra migratie. Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). |
| TML-8 | Tijdlijn | Filter per zichtbaarheid/subgroep | Later | Could | M | ⏳ | TML-6 | `axis='subgroup'` — **weergave**-filter bovenop de RLS. FND-1 (subgroepen) is af; hangt nu enkel op TML-6 (filter-fundament). Plan [`19`](docs/plans/19-tijdlijn-prikbord.md). |
| PLT-1 | Platform | Notificaties & herinneringen | Next | Should | M | 🔧 | — | **Plan [`05`](docs/plans/05-notificaties.md).** Trap 1 lokaal werkt; trap 2 remote `notify` productie-klaar (migr. `0018`/`0023` live). **Rest = flip-on** (secret, deploy, webhook, 2-account) — [`docs/notify-setup.md`](docs/notify-setup.md). **Gate: SEC-5.** |
| PLT-6 | Platform | Activiteiten-/wijzigingenfeed | Next | Could | M | 🔧 | — | **Gebouwd** (`lib/activity.js`+`activiteit.js`, geen migratie). **Rest:** realtime bevestigen. **Bekend:** hernoeming ververst feed-titel niet realtime. **Wordt uitgebouwd tot de Tijdlijn/Prikbord-module (TML-1…8, [plan 19](docs/plans/19-tijdlijn-prikbord.md));** de event-engine `lib/activity.js` blijft de events-laag (TML-5). |
| PLT-7 | Platform | Beter uitnodigingssysteem (persoonlijke 24u-link) | Next | Should | M | 🔧 | — | **Gebouwd:** migr. [`0053`](supabase/migrations/0053_household_invites.sql) (`household_invites` + DEFINER-RPC's `create_invite`/`peek_invite`(anon)/`accept_invite`/`revoke_invite`); `lib/invites.js` (units, ratchet **93%**); web-first join-scherm [`app/join/[token].js`](app/join/[token].js) (preview→auth→accept→download-placeholders) + pending-melding [`PendingInviteBanner`](lib/PendingInviteBanner.js) op onboarding/vandaag; invite-UI in [`huishouden.js`](app/(tabs)/huishouden.js) (rol vooraf lid/beheerder, delen via sharesheet, intrekken). Web-first & account-gebonden (geen deferred deep linking). **Migr. `0053` is live** (geverifieerd 2026-06-26); de RLS-isolatie `household_invites` + `accept/peek/revoke` is groen in de live-integratiesuite (onderdeel van de **775 pass**-meting van 2026-06-26; het eerdere getal 729 was een oudere run). **Rest:** web-build hosten — nu **Cloudflare Pages** i.p.v. EAS Hosting (CF-auth/deploy nog open) zodat `/join` op web werkt; **echte store-links** i.p.v. placeholders; device/web-rooktest. Kind-rol → FND-3; wachtwoordloos → PLT-8. |
| PLT-10 | Platform | Web-mobile: swipen + camera werkend krijgen (crasht nu) | Next | Should | M | ◐ | — | **Camera-deel gebouwd (2026-06-28):** [`offerImagePicker`](lib/photoPicker.js) laat op web de camera-rij weg (de systeem-camera via `expo-image-picker` is op web-mobile onbetrouwbaar/gooit) en stuurt nu op `kind` i.p.v. een vaste index → alleen "uit bibliotheek/bestand". **Bevinding swipe:** `SwipeRow` ([`lib/ui.js`](lib/ui.js)) is al web-geguard (geeft de kale rij terug op web), dus de crash zit waarschijnlijk **niet** daar maar in de gedeelde [`BottomSheet`](lib/ui.js#L892): geneste `GestureHandlerRootView` + een Reanimated-`Pan`-worklet die op web kan omvallen (geen reanimated-babel-plugin expliciet). **Rest (web-run nodig):** reproduceren op web, de `BottomSheet`-gesture op web guarden (backdrop/kruisje blijven; swipe-to-dismiss uit) — bewust niet blind gewijzigd want `BottomSheet` is app-breed en hier niet op web te verifiëren. **Derde web-crash gevonden + gefixt via Sentry (2026-06-30, HUISHOEK-1):** de gedeelde `DialogHost` ([`lib/dialog.js`](lib/dialog.js#L129)) riep bij het openen `findNodeHandle()` aan voor screenreader-focus — react-native-web ondersteunt dat niet (gooit), dus élke `dialog.alert/confirm/menu` op web-mobile crashte (gezien op `huishoek.app/welcome`, na signup). Nu geguard op `Platform.OS === 'web'` (op web doet `setAccessibilityFocus` toch niets). Native ongewijzigd. |
| UX-7 | Platform/UX | In-app camera in eigen stijl (kader, overlay, feedback) | Later | Could | L | ⏳ | BOO-9, STR-4, MLT-3 | **Doel:** eigen camerascherm (`expo-camera`) + generiek `CaptureSession`-primitief (deelt met BOO-9, batch PLA-9). Dev build. |
| INF-3 | Platform | E2E-tests (Maestro) | Next | Should | M | 🔧 | — | **Error-bewuste rooktest** ([`docs/rooktest.md`](docs/rooktest.md)): `npm run rooktest` = Maestro-flows + logcat-oordeel + exit-code. 5 flows in `.maestro/` (crash-sweep + 4 behavior), selectors op `t-*`-id's (`lib/ui.js` + tabs). **Rest:** flows `00`–`03` op toestel kalibreren (`04` al geverifieerd). |
| INF-4 | Platform | Foutrapportage/monitoring (Sentry) | Next | Should | S | 🔧 | — | **Gewired** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `lib/monitoring.js` env-gated + `ErrorBoundary`. **Sentry-project aangemaakt** (`evdn/huishoek`, EU-region `de.sentry.io`, 2026-06-26); DSN **live als EAS-env** (`EXPO_PUBLIC_SENTRY_DSN` op `@evdns-team/huishoek`, prod/preview/dev, 2026-06-26) + lokaal in `.env`; `metro.config.js` via `getSentryExpoConfig` genereert de source maps + debug-ID's. **Source-map-upload via de EAS↔Sentry-dashboard-integratie** (Expo-UI gekoppeld → EAS uploadt zelf, `SENTRY_DISABLE_AUTO_UPLOAD=true` gezet; geen handmatige `SENTRY_AUTH_TOKEN` nodig). Setup-runbook in [`docs/eas-setup.md`](docs/eas-setup.md). **Sentry bevestigd live in productie (2026-06-30):** ving zijn eerste echte fout (HUISHOEK-1, `release Huishoek@1.0.0`, env `production`) mét onze `context: render`-tag uit de `ErrorBoundary` → leidde direct tot de dialog-web-fix (zie **PLT-10**). Web-ruisfilter toegevoegd in [`lib/monitoring.js`](lib/monitoring.js) (`ignoreErrors: /\.at is not a function/` — scanbots/pre-ES2022-engines). **Rest:** de web-build-frames kwamen nog **geminified** binnen (gs/hs) — web-source-map-upload nog te verifiëren; en een crash uit een **native** cloud-build gesymboliceerd terugzien (EAS↔Sentry-integratie). |
| INF-5 | Platform | Release-pijplijn (EAS) | Next | Should | M | 🔧 | — | **Config gestaged** (plan [`08`](docs/plans/08-professioneel-hardening.md)): `eas.json` + `docs/eas-setup.md`. **Rest:** `eas init`, secrets, eerste build (wacht op Play-account). |
| INF-8 | Platform | Realtime-primitief & scoping | Next | Should | M | 🔧 | — | **Af (C1–C4):** `useRealtimeReload`+household-filter (migr. `0025`)+`realtimePatch`+`realtimeHub`. **Rest:** patch+gebundelde subscriptie op toestel. |
| INF-9 | Platform | Edge-hardening `scan-receipt` | Next | Should | S | 🔧 | — | **Gebouwd+gedeployed:** per-gebruiker rate-limit (migr. `0026`)+MIME-whitelist. **Open (L1, [plan 17](docs/plans/17-security-remediatie.md)):** rate-limit fail-open → fail-closed + Orq-kostencap. **Rest:** happy-path op toestel. |
| INF-10 | Platform | DB-advisor-hardening | Next | Could | S | 🔧 | — | B4 af (migr. `0024`); **M1 GEBOUWD+LIVE** (migr. `0042`–`0044`: anon/PUBLIC-EXECUTE ingetrokken op user-facing DEFINER-RPC's, `authenticated` + RLS-helpers behouden). **Migr. `0058` LIVE (2026-06-26, advisor-geverifieerd):** anon/PUBLIC-EXECUTE ingetrokken op de RLS-helpers (`is_member`/`is_owner`/`in_subgroup`/`can_view` — `authenticated` bewust behouden voor policy-evaluatie) + de trigger-fns (`handle_new_user`/`check_subgroup_household`/`cleanup_vehicle_resource`, uit alle rollen). Advisors bevestigen: anon-WARN op de helpers weg en trigger-fns niet meer geflagd; geen ERROR. **B5 LIVE (2026-06-27):** `pg_trgm` verplaatst van `public` → `extensions`-schema (migr. `0064`); de gin_trgm_ops-opclass + de catalogus-index verhuisden mee, `search_catalog` kreeg `extensions` in z'n search_path. Geverifieerd: pg_trgm in `extensions`, index intact, zoeken geeft nog treffers. **Open:** B6 leaked-password (dashboard-toggle, jouw account). [plan 17](docs/plans/17-security-remediatie.md). |
| SEC-5 | Security | `notify`-payload valideren vóór deploy | Next | Should | S | 🔧 | PLT-1 | **GEBOUWD (code+units, ratchet 80,2%):** `notify/core.js` recipientId-guard + `clampBody`; titel al server-side getemplatet. **Gate op PLT-1-deploy.** M4, [plan 17](docs/plans/17-security-remediatie.md). |
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
| UX-22 | Platform/UX | Drawers/sheets: nooit onder het toetsenbord + drie sluit-routes | Next | Should | M | 🔧 | UX-5 | **Contract (avoidKeyboard + veeg/backdrop/kruisje) gedekt:** álle invoer-dragende sheets gebruiken de gedeelde [`BottomSheet`](lib/ui.js) mét `avoidKeyboard` (delen/voorraad/maaltijden/plant/huisdier/resource/foto). **2026-06-27:** de laatste niet-conforme overlay (kosten "terugkerend") omgezet van een losse `Modal` naar `BottomSheet`. Resterende losse `Modal`s (huishouden subgroep/uitnodigen) zijn bewust full-screen/pageSheet-presentaties (eigen KAV), geen bottom-sheets. **Device-rooktest 2026-07-01 ✅:** voorraad-toevoegsheet — `avoidKeyboard` houdt alle velden boven het toetsenbord; alle **3 sluit-routes** (backdrop-tik, veeg-omlaag, Annuleren) werken. Eén gedeelde `BottomSheet` → dekt het contract. |
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
  boodschappen uit?", "welke plant heeft water nodig?") bovenop de bestaande tabellen. Geparkeerd.

> De volledige uitwerking van de afgeronde epics **Vandaag-widgetgrid** (VDG) en
> **Taken-redesign** (TKN) staat in [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).
