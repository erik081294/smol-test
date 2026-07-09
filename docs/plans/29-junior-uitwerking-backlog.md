# Plan 29 — Werkboek: alles wat we willen bereiken, uitgewerkt voor instap zonder context

> **Wat dit is.** Het volledige openstaande ambitieniveau van Huishoek — stabiliteit &
> launch, UX-afwerking, features per module én de AI-laag — uitgewerkt tot zelfstandige
> klussen die een developer **zonder projectcontext** kan oppakken. Per klus: het waarom,
> de exacte bestanden (tegen de code geverifieerd op 2026-07-07), een stappenplan,
> acceptatiecriteria en valkuilen. Plus een **beslis-agenda** (§7) met alle open
> ontwerpvragen die alleen de eigenaar kan beantwoorden, en een lijst **eigenaar-acties**
> (§8) die geen dev-werk zijn.
>
> **Wat dit niet is.** Geen status-doc: status leeft uitsluitend in
> [backlog §6](../../huishoek-backlog.md). Geen vervanging van de build-ready plannen
> (01–28): waar een plan bestaat linkt dit werkboek ernaar en vult het alleen aan met wat
> er sindsdien veranderd is. De AI-golven van deze maand staan in
> [plan 27](27-ontwikkelprogramma-juli.md)/[28](28-werksessies-juli.md); dit werkboek
> dekt alles daaromheen én de AI-klussen die je zonder de golf-context kunt doen.

---

## 0. Lees dit eerst (oriëntatie, ~30 minuten)

### Wat is Huishoek?
Een Expo/React-Native app voor huishoudens: taken, boodschappen, kosten (WieBetaaltWat),
planten/huisdieren/voertuigen, keuken-loop (maaltijden/voorraad), delen/reserveren, een
tijdlijn/prikbord en een AI-assistent. Backend = hosted Supabase (Postgres + RLS + edge
functions); web-build live op huishoek.app (Cloudflare Pages).

### De drie lagen (het belangrijkste architectuurfeit)
1. **Pure logica** in `lib/*.js` — geen React, geen Supabase-import. Unit-getest met
   `node:test`, bewaakt door een **mutatie-ratchet**.
2. **React-schil** — hooks (`lib/use*.js`) en schermen (`app/…`), zo dun mogelijk;
   UI uitsluitend uit `lib/ui.js` + tokens uit `lib/theme.js` + iconen via `lib/icons.js`.
3. **RLS in de database** — zichtbaarheid/beveiliging wordt in Postgres afgedwongen
   (`enable_module_rls`, `can_view`), nooit alleen client-side.

Volledig contract: [`docs/architectuur.md`](../architectuur.md) + de cheat-sheet onderin
[`00-overzicht.md`](00-overzicht.md) (migratie-patronen, `useCollection`, kind-tabellen).

### Design-systeem: de regels die élk UI-klusje raken
[`DESIGN.md`](../../DESIGN.md) is normatief. De kern:
- **Tokens, nooit rauwe waarden**: `colors.*`, `type.*`, `space.*` — nooit een losse hex
  of fontSize; dan erft je scherm dark mode gratis.
- **Alles aanraakbaar ≥ 48dp** (`touchTarget`, `hitSlopFor()`); tekst schaalt mee
  (`allowFontScaling` nooit uit); betekenis nooit via kleur alleen.
- **Eén primaire actie per scherm**: één gevulde `Button`/`FAB`, de rest `soft`/`ghost`.
- **Kop-contract (UX-42)**: kop-rechts draagt uitsluitend de `ModuleHelpButton`;
  module-navigatie hangt als gelabelde `actions` in de help-drawer.
- **Editors**: `ModalHeader` (Annuleer · titel · Bewaar), vaste veldvolgorde
  Wat → Wie → Wanneer → Details → Delen met (`VisibilityPicker`) → Verwijderen onderaan;
  `dirty` → discard-guard. Bouw op `useEntityForm` full-mode
  ([plan 22](22-formulier-fundament.md)).
- **Veeg-acties** via `SwipeRow`: links = verwijderen (rood), rechts = secundair (groen),
  altijd met undo-toast.
- **`BottomSheet`**: drie sluit-routes (veeg, achtergrond-tik, kruisje) moeten alle drie
  werken; nooit onder het toetsenbord.

### Leeswijzer backlog §6
- **⏳ Open** = nog te bouwen. **🔧 Te verifiëren** = gebouwd, er rest alleen verificatie
  (toestel/live DB/extern account) — **meestal géén bouwwerk**. **◐ Deels** = datalaag af,
  rest gated. **Baan** = Now/Next/Later. Afgerond → archief.

### Dev-omgeving & vaste commando's
```bash
npm ci                          # eenmalig (bevat ook de mutatietest-tooling)
npm test                        # volledige suite; RLS-tests skippen zichzelf zonder secrets
npm run typecheck               # @ts-check-scope (tsconfig.check.json)
npx eslint .                    # exact wat CI draait (níét `expo lint`)
node scripts/mutation-check.mjs --since=origin/main   # ratchet over je gewijzigde modules
npm run rooktest                # device-rooktest (USB-toestel + Metro; docs/rooktest.md)
```

### Werkwijze
- `main` is branch-protected → **altijd branch + PR**; CI-job `test` (lint + typecheck +
  suite) moet groen vóór merge.
- **Definition of done** (volledig in [`CLAUDE.md`](../../CLAUDE.md)): (1) ratchet groen op
  gemuteerde modules, (2) elke nieuwe `export function` in `lib/*.js` krijgt een unit-test
  in dezelfde PR, (3) typecheck groen (nieuwe pure module → `// @ts-check` + opnemen in
  `tsconfig.check.json`), (4) `npm test` groen, (5) docs die een feit claimen dat jij
  verschuift in dezelfde PR bijwerken (status alléén in §6).

### Vier harde spelregels (kosten anders een dag)
1. **Migraties:** `supabase db push` is in dit project **kapot** (history diverged).
   Nieuwe migraties gaan live via MCP `apply_migration`; het eerstvolgende vrije nummer
   lees je uit `supabase migration list` / MCP `list_migrations`, **nooit** uit een doc
   (meerdere plannen bevatten inmiddels achterhaalde nummers). Runbook:
   [`VERIFICATIE.md`](../../VERIFICATIE.md).
2. **Assistent-oppervlak = eval-gate:** alles wat het model *ziet* (tool-descriptions,
   args-schema's, systemprompt) mag alleen wijzigen mét een groene golden-set-run
   (`scripts/assistant-eval.mjs`). Lees eerst
   [`docs/assistent-architectuur.md`](../assistent-architectuur.md). Klussen die dit
   raken zijn hieronder gemarkeerd met **[eval-gate]**.
3. **Verifieer status tegen de bron, niet tegen een doc** — migratiestand via
   `list_migrations`, RLS via de live-suite, gedrag via de code. (Bij het opstellen van
   dit werkboek bleken twee §6-notities stale — zie S4 en F5.)
4. **Destructief of extern-zichtbaar werk** (data wissen, deploys, store/dashboards)
   altijd eerst afstemmen met de eigenaar.

---

## 1. Doelenkaart & klusmatrix

Wat we willen bereiken, in vier sporen:

- **S — Stabiel & launch-klaar.** De app kan de stores in en blijft overeind: geen
  AVG-/store-blokkades, kosten begrensd, monitoring rond, testdekking op web én device,
  onderhoudbare codebase.
- **U — Strak & af (UX).** De bestaande modules van "werkt" naar "voelt af": de
  audit-staarten (a11y, quick wins), de module-verbeterpunten uit de device-reviews en
  de resterende teardowns.
- **F — Features & modules.** De roadmap-features die nog open staan: tijdlijn-afronding,
  barcode-loop, grote aankopen, documentenkluis, en de verkennende ideeën (§7-backlog).
- **A — AI-assistent.** De assistent volwassen maken: testdekking, catalogus-intelligentie,
  chat-poets, geheugen.

| Klus | Backlog | Wat | Maat | Baan | Device? | Let op |
|------|---------|-----|------|------|---------|--------|
| S1 | PLT-11 | Account- & dataverwijdering | M | Next | nee | migratie, eigenaar-review |
| S2 | INF-14 | Seed-script demo-huishouden | S | Next | nee | service-role |
| S3 | INF-15 | Web-crash-sweep (Playwright) | S | Next | nee | — |
| S4 | INF-9 | scan-receipt: rest + §6-correctie | S | Next | licht | notitie was stale |
| S5 | PERF-1 | Bulk-RPC bon→voorraad (P-H4) | M | Next | nee | migratie |
| S6 | REV-2 P9 | Push-poets (pre-prompt, kanaal) | S | geparkeerd | ja | vrijgave eigenaar |
| S7 | INF-3 | Rooktest in CI/EAS | M | Next | — | infra-keuze |
| S8 | ARCH-4 | i18n/ui-namespace-split | M | Later | **ja** | dedicated sessie |
| S9 | SEC-6/7 | Sleutelhygiëne + audit-staart | S | Next | nee | deels procedureel |
| S10 | INF-4 | Web-source-maps verifiëren | S | Next | nee | token = eigenaar |
| U1 | UX-44 | Usability quick wins B3–B8 | S | Next | licht | — |
| U2 | A11Y-2 | Toegankelijkheid A5–A9 + 44pt | S/M | Next | licht | — |
| U3 | UXR-11 | Module-verbeterpunten C1–C6 | M/L | Next | licht | B1–B3 = beslis-agenda |
| U4 | BOO-14 | Boodschappen-kop: meer lijstruimte | S | Next | licht | keuze = beslis-agenda |
| U5 | PLA-10/UXR-6 | Zorg-modules: plan-21-vervolg | M | Next | licht | A–D = beslis-agenda |
| U6 | UXR-4/5/7/8 | Teardown-sessies voorbereiden | S p/s | Later | ja | sessie mét eigenaar |
| U7 | UX-13 | Avatars: foto + builder | M | Later | ja | migratie + bucket |
| U8 | UX-9 | Eigen lettertype verkennen | S | Later | licht | — |
| U9 | PLT-10 | BottomSheet-web-hardening | S | gated | nee | pas bij Sentry-signaal |
| F1 | DOC-1 | Documenten- & garantiekluis | L | Later | ja | migratie; leerklus |
| F2 | TML-7 | Tijdlijnfilter per lid | S | Later | licht | — |
| F3 | TML-8 | Tijdlijnfilter per subgroep | M | Later | licht | — |
| F4 | TML-3 | Reacties op systeem-events | M | Later | licht | ontwerp ligt klaar |
| F5 | BOO-9 | Live barcode-scanner | M | Next | **ja** | dep `expo-camera` |
| F6 | VOO-2 | Scan → voorraad | S | Later | ja | na F5 |
| F7 | AAN-1..4 | Grote-aankopen-module | L | Later | ja | plan 03 + moderniseren |
| F8 | WEN-1 | Wensen-/cadeaulijst | M | idee (§7) | ja | promotie naar §6 eerst |
| F9 | PLT-4 | Export als tekst/CSV | S | idee (§7) | licht | — |
| F10–F17 | div. | Lange staart (zie §5.10) | — | Later | — | per item |
| A1 | AI-19-C | Pack-ratchets → ≥85% | S | Now | nee | ideale eerste klus |
| A2 | AI-19 | Edge-deploy + eval-run | S | Now | nee | CLI + ORQ-key |
| A3 | AI-11 | Spoor 2: async categoriseren | M | Next | nee | **[eval-gate]**, Orq |
| A4 | AI-11/16 | Choice-kaart ambigue matches | M | Next | nee | **[eval-gate]** |
| A5 | AI-6 | Chat-poets (collapse/actions/anchor) | M | Next | ja | — |
| A6 | AI-9 | Geheugen v1 (pgvector + RRF) | L | Later | nee | migratie, begeleiding |
| A7–A9 | div. | AI-staart (zie §6.7) | — | div. | — | per item |

**Aanbevolen instappad:** A1 → U1/U2 → F2 → S2/S3 → daarna naar smaak. Die volgorde
leert achtereenvolgens de testfilosofie, het design-systeem, een pure module + schil, en
het datamodel — zonder migraties of eval-gates.

---

## 2. Spoor S — Stabiel & launch-klaar

### S1 — Account- & dataverwijdering in-app (PLT-11)

**Wat & waarom.** Google Play en de App Store **eisen** in-app accountverwijdering; de
AVG eist het wissen van persoonsgegevens. De flow bestaat niet — en de app-review
(2026-07-02, bevinding **Data-1**) stelde vast dat het wissen van een `auth.users`-rij nu
**stukloopt**: alleen migratie `0002` zette FK's op `ON DELETE SET NULL`
(`supabase/migrations/0002_rls_fixes.sql:43-46`); vrijwel elke module daarna
introduceerde FK's zonder delete-gedrag. Met de iOS-submit-config compleet (IOS-1) is
dit het laatste launch-blokkerende gat in deze hoek.

**Stappenplan.**
1. **Inventariseer** alle FK's naar `auth.users`/`profiles` en hun huidige delete-gedrag
   (read-only query op `information_schema` tegen de live DB).
2. **Sweep-migratie** (nummer via `list_migrations`): per tabel een bewuste keuze —
   creator-kolommen `SET NULL` (gedeelde data blijft van het huishouden), puur
   persoonlijke rijen `CASCADE` (`user_module_prefs`, `user_timeline_prefs`,
   `push_tokens`, `user_ai_capabilities`, assistent-gesprekken, `user_timeline_prefs`).
   Leg de keuze per tabel vast in een comment in de migratie.
3. **DEFINER-RPC `delete_account()`**: ruimt de storage-objecten van de gebruiker op
   (persoonlijk; huishoud-foto's blijven), draagt owner-schap over of blokkeert met een
   nette fout als de gebruiker de énige owner van een huishouden met andere leden is,
   wist dan de auth-user. `EXECUTE` alleen voor `authenticated` (patroon `0042`–`0044`).
4. **UI**: gevarenzone onderin `app/(tabs)/instellingen.js` — bevestiging door
   "verwijderen" te typen, dan RPC + lokale sign-out.
5. **Tests**: scenario's in `tests/rls.integration.test.js` (lid weg → gedeelde data
   blijft; persoonlijke rijen weg; enige-owner-blokkade).

**Klaar wanneer.** End-to-end getest met een wegwerp-account op de live DB; RLS-suite
groen; §6-rij bijgewerkt.

**Valkuilen.** Destructief gereedschap: migratie + RPC eerst laten reviewen door de
eigenaar; nooit testen met het echte testhuishouden. De completions-historie-vraag
(Data-4) is een ontwerpkeuze → beslis-agenda §7.

### S2 — Seed-script demo-huishouden (INF-14)

**Wat & waarom.** Terugkerend patroon in §6: gebouwde features blijven op 🔧 hangen omdat
het testhuishouden de benodigde *data* mist — huisdier-parity (PLA-10/HUI-1: "geen
huisdier in testhuishouden"), BOO-14 stap 2 (gated op `dueScore ≥ 1`), PERF-5 (lege
voorraad). Eén idempotent seed-script ontgrendelt die hele klasse verificaties.

**Stappenplan.**
1. Nieuw `scripts/seed-demo.mjs` naar het voorbeeld van `scripts/rooktest-cleanup.mjs`:
   service-role-key **uit de shell-omgeving** (niet uit `.env` — zie S9), tegen het
   bestaande testhuishouden.
2. Prefix álle rijen met een marker (de rooktest gebruikt `E2E`; kies bv. `DEMO `) zodat
   `--cleanup` exact kan wissen.
3. Vul minimaal: 1 huisdier + logboekrijen, voorraad-items mét bewaarplaats,
   aankoophistorie die `dueScore ≥ 1` oplevert voor 2 producten (kijk in
   `lib/useProducts.js`/RPC `product_purchase_dates` welke datums nodig zijn), 1 plant
   met verzorgingstaken, enkele tijdlijnposts met foto.
4. Documenteer in [`docs/rooktest.md`](../rooktest.md) + verwijs in `VERIFICATIE.md`.

**Klaar wanneer.** Seed → cleanup laat de DB byte-gelijk achter (count-check vóór/na);
tweemaal seeden dupliceert niets; de gated §6-verificaties zijn ermee uitvoerbaar.

**Valkuilen.** Alleen het testhuishouden raken; geen key in bestand of commit;
CHECK-constraints respecteren (centen ≥ 0, quantity > 0 — migratie `0071`).

### S3 — Web-crash-sweep voor huishoek.app (INF-15)

**Wat & waarom.** Alle web-crashes tot nu toe zijn pas **in productie via Sentry**
gevonden (de `findNodeHandle`-crash in `DialogHost` brak élke dialog op web-mobile — zie
PLT-10). Android heeft een deeplink-crash-sweep (`scripts/rooktest.sh`); web heeft niets.

**Stappenplan.**
1. Nieuw `scripts/webtest.mjs`: `npx expo export --platform web`, serveer `dist`
   statisch, laad met Playwright dezelfde routes als de Android-sweep (routelijst
   overnemen uit `scripts/rooktest.sh`).
2. Faal op console-errors, uncaught exceptions of de `t-error-boundary`-testID. Login
   voor gated routes: zelfde testaccount als de rooktest (`docs/rooktest.md`), nooit
   hardcoden.
3. `package.json`-script `webtest`; Playwright (chromium) als devDependency.
4. Vervolg-PR: in CI hangen.

**Klaar wanneer.** `npm run webtest` geeft één pass/fail; een bewust geherintroduceerde
web-crash (bv. de oude `findNodeHandle`-regel) wordt gevangen.

### S4 — scan-receipt: rest afronden + stale notitie (INF-9)

**Statuscorrectie (2026-07-07, code-geverifieerd).** De §6-notitie zei "rate-limit
fail-open → fail-closed" als open werk, maar de code is **al fail-closed**:
`supabase/functions/scan-receipt/index.ts:82-126` weigert bij élk niet-happy-pad van de
rate-limit-RPC (config/auth ontbreekt → 503; RPC-fout → 503; over limiet → 429), vóór de
betaalde Orq-call. De getrapte volume-remmen staan in migraties `0056`/`0057`
(burst 30/uur · 50/dag per gebruiker · 10.000/dag globaal — de constanten in de function
winnen van de migratie-defaults) plus 8MB-maat en MIME-whitelist. De §6-rij is hierop
gecorrigeerd.

**Wat rest er dan echt.**
1. **Happy-path op toestel**: bon scannen → editor gevuld (hoort in de verificatiebatch, §9).
2. **Optioneel — echte kostencap**: de drie volume-remmen zijn een kosten*proxy*; een
   harde euro-/tokencap per dag zou een extra kolom + check in `record_receipt_scan`
   zijn. Klein, maar pas doen als het volume dat rechtvaardigt — eerst voorleggen.

### S5 — Bulk-RPC bon→voorraad (PERF-1 / P-H4)

**Wat & waarom.** "Naar voorraad" op een bon doet nu **N losse writes**:
`restockFromPurchase` (`lib/usePantry.js:40-58`, aangeroepen vanuit
`app/purchase/[id].js:231`) mapt elke geaggregeerde bonregel naar een eigen
`adjustQuantity`/`add` — tot ~30 round-trips + realtime-echo's per bon
([plan 16](16-performance-audit.md), P-H4).

**Stappenplan.**
1. **RPC** `restock_from_purchase(p_purchase_id)` (SECURITY DEFINER, patroon
   `create_expense`): aggregeert server-side (zelfde regels als de pure
   `aggregatePurchaseItems`, `lib/pantry.js:73`) en doet een upsert-met-optellen op
   `pantry_items` in één transactie. `EXECUTE` alleen `authenticated`; scoping via
   `is_member`.
2. `restockFromPurchase` wordt één `supabase.rpc(...)`-call; houd de pure aggregatie als
   bron van de verwachte uitkomst in de unit-test (client en server moeten hetzelfde
   aggregeren — test dat expliciet).
3. RLS-scenario: een niet-lid kan de RPC niet op andermans bon aanroepen.

**Klaar wanneer.** Eén round-trip per bon; uitkomst identiek aan de oude flow (test die
gelijkheid); migratie live via MCP; ratchet `pantry` niet gezakt.

### S6 — Push-poets (REV-2 P9) — *geparkeerd, oppakken na vrijgave*

**Wat er ligt.** Push werkt end-to-end (token → `push_tokens` → `notify`-edge →
FCM; PLT-1 gearchiveerd). De poets-punten uit de review:
- **Permissie-pre-prompt ontbreekt**: `lib/useNotifications.js:42-44` vraagt direct de
  OS-dialoog. Bouw een eigen uitleg-moment vóór `requestPermissionsAsync` (één kans op
  de OS-prompt — verspil hem niet).
- **Android-kanaal**: `lib/useNotifications.js:47-51` zet kanaal `default` op
  `IMPORTANCE.DEFAULT`; overweeg HIGH voor taak-toewijzingen (heads-up) en een apart
  kanaal per soort melding.
- **Receipts**: de `notify`-edge (`supabase/functions/notify/index.ts`) verwerkt
  Expo-push-*tickets* en ruimt `DeviceNotRegistered`-tokens op (`:100-112`); een
  vervolgcheck op de *receipts*-API (delayed failures) ontbreekt nog.

**Let op.** REV-2 is bewust geparkeerd (eigenaar, 2026-07-06) — eerst vrijgave vragen.

### S7 — Rooktest in CI/EAS (INF-3-rest)

**Wat & waarom.** `npm run rooktest` (deeplink-crash-sweep + 5 Maestro-flows +
logcat-oordeel) draait nu alleen lokaal tegen het USB-toestel. CI
(`.github/workflows/ci.yml`, één job `test`: audit niet-blokkerend → eslint → typecheck
→ `npm test`) heeft geen device-laag; `docs/rooktest.md` noemt de runner "geschikt voor
CI later" maar expliciet Android-only.

**Stappenplan.** Dit is een infra-verkenning met een beslispunt, geen rechttoe-rechtaan
bouwklus: (1) inventariseer de twee routes — GitHub Actions met een Android-emulator
(gratis, maar de emulator is hier notoir instabiel; zie de projectervaring) versus een
EAS-workflow/Maestro-cloud-dienst (stabieler, kost geld); (2) prototype de goedkoopste
route op een aparte workflow die alléén de crash-sweep draait (geen flows — die zijn
data-afhankelijk); (3) leg de afweging + kosten voor aan de eigenaar vóór je iets
vastzet. Combineert goed met S2 (seed) om de flows ooit CI-waardig te maken.

### S8 — i18n/ui per domein-namespace splitsen (ARCH-4)

**Wat & waarom.** `lib/i18n.js` (~1441 regels) en `lib/ui.js` (~1398 regels) zijn de twee
merge-conflict-magneten. Puur opruimen, gedragsneutraal — maar **bewust een dedicated
sessie mét draaiende app**: een gemiste key/export breekt pas runtime.

**Stappenplan.**
1. **Guard-test eerst**: snapshot de volledige key-set van `DICT` en de export-lijst van
   `lib/ui.js`; die moet na élke verplaatsingsstap identiek zijn. Zonder dit vangnet niet
   beginnen.
2. Splits i18n per domein (`lib/i18n/<module>.js`) via de bestaande seam
   `registerDict(l, dict)` (`lib/i18n.js:1372`); één domein per commit, suite + guard na
   elke stap.
3. Splits `ui.js` daarna met een barrel-export (bestaande imports blijven werken; géén
   app-brede import-sweep in dezelfde PR).
4. Sluit af met `npm run rooktest` (de crash-sweep vangt een gemiste export direct).

**Klaar wanneer.** Key-set + export-set byte-gelijk; suite + typecheck + ratchet +
rooktest groen; nul gedragsverschil.

### S9 — Sleutelhygiëne & audit-staart (SEC-6 + SEC-7-rest)

- **SEC-6 (S, deels procedureel):** de service-role-key hoort niet in de app-`.env`.
  Haal 'm eruit, injecteer ad-hoc in de shell voor live RLS-runs
  (`SUPABASE_SERVICE_ROLE_KEY=… npm test` — de suite skipt zonder), documenteer rotatie
  in `SECURITY.md`. Rotatie zelf = eigenaar (§8).
- **SEC-7/L2:** de 14 moderate `npm audit`-findings zitten in de Expo-build-toolketen
  (`qs`, `uuid` — geen untrusted-input-pad) en worden **bewust bij de volgende
  SDK-bump** meegenomen ([plan 17](17-security-remediatie.md):151-152). Niet los fixen:
  dat vecht tegen de Expo-lockstep.

### S10 — Web-source-maps in Sentry verifiëren (INF-4-rest)

**Wat er ligt.** `scripts/deploy-web.mjs` doet export → Sentry-source-map-upload
(**env-gated op `SENTRY_AUTH_TOKEN`**, zonder token alleen een warn) → `.map`-strip →
`wrangler pages deploy`. De web-frames kwamen tot nu toe geminified binnen omdat er nog
nooit mét token gedeployed is.

**Stappenplan.** (1) Token met scope `project:releases` van de eigenaar
(`docs/eas-setup.md:57-60`); (2) één `npm run deploy:web` mét token; (3) forceer een
web-testfout en controleer in Sentry (org `evdn`, project `huishoek`, EU) dat de stack
gesymboliceerd is; (4) §6-rij bijwerken. De native kant (EAS↔Sentry-integratie) checkt
mee bij de eerstvolgende cloud-build.

---

## 3. Spoor U — Strak & af (UX)

### U1 — Usability quick wins B3–B8 (UX-44)

Restpunten uit de UX-audit ([plan 18](18-ux-verbeterplan.md) §B); elk punt een eigen commit.

- **B3** `app/(tabs)/vandaag.js` — *deels al gedekt:* er staat inmiddels een gecentreerde
  "Aanpassen"-link onder de grid (r344-352) en slepen schakelt bewerkmodus automatisch in
  (r326). Beoordeel op toestel of dat volstaat; zo niet, promoveer naar een
  potlood-`IconButton` — maar let op het kop-contract (kop-rechts is van de
  `ModuleHelpButton`), dus dan als actie ín de drawer of zichtbaar bij de grid.
- **B4** `app/catalog.js:131-141` — de ×-knop bij "Eerder gekozen" verbergt een product
  app-breed terwijl het label anders suggereert; microcopy óf scope corrigeren.
- **B5** `app/(tabs)/boodschappen.js` — "klaar"-moment: toon `Celebrate` (bestaat in
  `lib/ui.js`, voorbeeld in `taken.js`) bij `open==0 && done>0`.
- **B6** feedback-timing gelijktrekken (catalog toast vóór de netwerkcall, boodschappen
  erná) — kies succes-ná-bevestigde-mutatie.
- **B7** `Stepper`-eenheid via de `formatValue`-prop (`boodschappen.js:47-50`).
- **B8** kleintjes: suggesties wegklikbaar, `RefreshControl`-koppeling, dropdown-dim,
  bon-link-zichtbaarheid.

**Klaar wanneer.** Per punt een screenshot in de PR; suite + lint groen.

### U2 — Toegankelijkheid A5–A9 + 44pt nameten (A11Y-2)

De staart van de a11y-audit ([plan 18](18-ux-verbeterplan.md) §A):
- **A5** sub-44pt-tikdoelen (prune-knop 28×36, exact-bedrag-input, `Chip`/
  `SegmentedControl` minHeight 38) → ≥44pt of `hitSlopFor()`.
- **A6** `app/expense/[id].js:232` exact-split-input heeft alleen een placeholder →
  `Field`-wrap of `accessibilityLabel`.
- **A7** `app/(tabs)/voorraad.js:121` status kleur-only (SOON/LOW zelfde kleur) →
  tekst-badge + a11y-label.
- **A8** `lib/VisibilityPicker.js:74-83` rauwe `TouchableOpacity` zonder role/label/state
  → vervang door `AvatarSelect`-patroon.
- **A9** `lib/TagPicker.js:38-40` long-press-verwijderen onvindbaar →
  `accessibilityActions` of menu-alternatief.
- **Nameten** op toestel: 44pt-targets + tabbar-fontschaling met vergrote fonts +
  TalkBack-ronde.

### U3 — Module-verbeterpunten C1–C6 (UXR-11-rest)

Uit het geverifieerde verbeterplan
([`docs/verbeterplan-modules-2026-06-30.md`](../verbeterplan-modules-2026-06-30.md) §C).
De B-beslissingen (B1 "Opslaan/Bewaar", B2 splitsen-knop-kleur, B3 "Delen met"-labels)
staan in de beslis-agenda (§7) — niet zelf beslissen.

- **C1 (L, grootste)** — een voertuig opent direct de **editor**
  (`app/(tabs)/voertuigen.js:67` → `/vehicle/[id]` = editor met `ModalHeader`), terwijl
  plant/huisdier/recept/bon een **lees-detail** hebben; dit breekt het
  detail/editor-contract van DESIGN.md. Bouw een lees-detail (read-only kosten/historie/
  reserveringen, "Aanpassen" → editor). Combineer met **C3**: de editor
  `SectionHeader`-groepering geven (Wat · Delen · Kosten · Historie).
- **C2 (M)** — catalogus-rij heeft twee tikdoelen zonder affordance
  (`app/catalog.js:41` naam → editor, `:50` aparte `Stepper`); geef het naam-deel een
  chevron/potlood.
- **C4 (M)** — het 18-tegels schap-grid in de producteditor altijd uitgeklapt; maak
  `Collapsible` met de huidige keuze als samenvatting (VisibilityPicker-patroon).
- **C5 (S)** — kosten-kaart: divider/ruimte tussen kop-bedrag en uitsplitsing.
- **C6 (S)** — "Foto toevoegen" heeft twee vormen (brede knop vs. tegel); één gedeelde
  foto-affordance-component (sluit aan op `useEntityPhoto`).

**Volgorde.** C5/C6 (S, opwarmen) → C2/C4 → C1+C3 (het echte werk). Per punt
device-screenshot.

### U4 — Boodschappen-kop: meer lijstruimte (BOO-14-rest)

Stap 1 (compacte "Catalogus | Bonnen"-rij, `app/(tabs)/boodschappen.js:266-278`) en
stap 2 (inklapbare "Misschien weer nodig", `:280-319`, default ingeklapt) zijn gebouwd.
De twee resterende opties zijn een **ontwerpkeuze** (beslis-agenda §7):
1. kop laten inklappen bij scroll — raakt `ScreenHeader` (`:232-233`) + de blok-zone die
   nu vóór de lijst staat en niet meescrollt;
2. catalogus/bonnen naar de help-drawer als gelabelde `actions` (conform het
   UX-42-contract) — dan vervalt de rij op `:266-277` helemaal.
Na de keuze is de bouw S. Stap-2-verificatie op toestel vergt seed-data (S2).

### U5 — Zorg-modules: plan-21-vervolg (PLA-10/UXR-6-rest)

De "dode tik" is verholpen en "Taak toevoegen" op de plant bestaat
([plan 21](21-zorg-teardown.md) §3). Wat rest zijn de **vier beslissingen** uit plan 21
§4 (→ beslis-agenda §7): **A** pauzeren/hervatten (zonder migratie via herhaal-einde vs.
expliciete `paused`-staat mét migratie), **B** plant-visibility overnemen bij een
handmatige taak (`/task/new?plant=<id>` erft nu níét de plant-zichtbaarheid), **C**
per-plant care-overzicht (huisdier-`openCareSheet`-parity) en **D** lege-staat-kaarten
een handeling geven. Na besluit is elk deel S/M en goed los te bouwen; huisdier-parity
testen vergt seed-data (S2). Bouwvolgorde uit het plan: A → C → D.

### U6 — Teardown-sessies voorbereiden (UXR-4/5/7/8)

Een teardown is een **sessie mét de eigenaar**, geen solo-klus — maar de voorbereiding
is er één. Werkwijze ([plan 14](14-ux-module-teardown.md), met UXR-1/2-notities als
voorbeeld): loop de module in drie passes —
1. **Scherm voor scherm**: 5-seconden-test; de vier states (loading/leeg/fout/offline);
   informatiehiërarchie; precies één primaire actie; affordances (geen verborgen
   long-press als enige toegang).
2. **Beslissing voor beslissing**: klopt de default; kan de keuze weg; snapt de
   gebruiker 'm; is hij omkeerbaar.
3. **Flow voor flow**: loop de end-to-end reis, noteer waar het haakt, check deeplinks/
   terugkeer en cross-module-consistentie.

Scopes: **UXR-4** `kosten.js`/`expense/[id].js`/`kosten-inzichten.js`/`delen.js`/
`resource/[id].js` · **UXR-5** `maaltijden.js`/`recipe/[id].js`/`voorraad.js`
(menu→lijst→voorraad-reis) · **UXR-7** `huishouden.js`/`onboarding.js`/`instellingen.js`
· **UXR-8** `activiteit.js`+deeplink-weefsel. Output: korte notitie + kleine, los
bouwbare §6-rijen (S/M, ⏳) — de UXR-rij is de sessie, niet de oplossing.

### U7 — Flexibele avatars (UX-13, Later)

**Huidige staat.** Een lid is uitsluitend een emoji: `profiles.avatar_emoji`
(`0001_init.sql:15`); `Avatar` (`lib/ui.js:650-663`) rendert emoji/initiaal. Er is
**geen** avatars-bucket en geen fotokolom (bestaande buckets: plants/recipes/pets/
timeline/vehicles).

**Aanpak.** (1) Migratie: `avatars`-bucket + de vier `storage.objects`-policies
(spiegel `0010_plant_photos.sql`, pad `<household_id>/…` of `<profile_id>/…` — kies en
documenteer), kolommen `avatar_kind ('emoji'|'photo'|'builder')` + `avatar_path`/
`avatar_config` op `profiles` (en later huishouden). (2) `Avatar` wordt een switch op
`kind`; foto via `useSignedUrl`. (3) Builder (react-native-svg) is een eigen vervolgklus
— lever eerst emoji+foto. Raakt álle `Avatar`-verbruikers (`TaskRow`, `AvatarSelect`,
`VisibilityPicker`) — puur render, geen logica.

### U8 — Eigen lettertype verkennen (UX-9, Later)

`lib/theme.js` is er al op voorbereid: de `font`-tabel (r104-110) staat op `undefined`
(= systeemfont) met de expliciete aanwijzing dat een display-face los ingeplugd kan
worden; de `TYPE_BASE`-schalen (r119-129) dragen geen `fontFamily`. `expo-font` is al
een dependency maar wordt nergens gebruikt. Verkenning: kies een variable font
(Latin-Extended, OFL-licentie, géén Inter), laad via `useFonts` in `app/_layout.js`,
zet alleen `font.display` en beoordeel op toestel (beide thema's, grote fonts). Keuze
vastleggen in `DESIGN.md`.

### U9 — BottomSheet-web-hardening (PLT-10-rest) — *gated op Sentry-signaal*

**Bewuste keuze in §6:** 90 dagen productie-web gaf nul gesture-crashes; niet blind
wijzigen. Als Sentry ooit wél een BottomSheet/worklet-crash op web toont, is dit het
recept: in `lib/ui.js` `BottomSheet` (r1030-1097) de `Pan`-gesture op
`Platform.OS === 'web'` overslaan (panel zonder `GestureDetector` renderen) — backdrop-tik
(`:1059`) en `onRequestClose` blijven de sluit-routes, zoals de rij-`Swipeable` al doet
(`:430` geeft op web de kale rij terug). Tot dat signaal: niets doen.

---

## 4. Spoor F — Features & modules

### F1 — Documenten- & garantiekluis (DOC-1, nieuwe module)

**Wat & waarom.** Gekozen §7-idee ([plan 27](27-ontwikkelprogramma-juli.md) slot-golf):
handleidingen, garantiebewijzen en bonnen op één plek, met een herinnering vóór de
garantie verloopt. De beste "leer de hele stack"-klus: elke laag komt één keer voorbij
en voor elke laag bestaat een beproefd voorbeeld.

**Bouwvolgorde (per stap het voorbeeld dat je spiegelt).**
1. **Migratie** (nummer via `list_migrations`): tabel `documents` (`household_id`,
   `created_by`, titel, categorie, `file_path`, optioneel `warranty_until`, + het
   zichtbaarheidscontract met consistentie-CHECK) en één aanroep
   `enable_module_rls('documents','created_by')`. Private bucket `documents` met de vier
   `storage.objects`-policies gescoped op `is_member(((storage.foldername(name))[1])::uuid)`
   — spiegel [`0010_plant_photos.sql`](../../supabase/migrations/0010_plant_photos.sql).
   Live via MCP `apply_migration`.
2. **Pure logica** `lib/documents.js` (`// @ts-check`, in `tsconfig.check.json`):
   categorieën, `warrantyStatus(doc, today)` (actief/verloopt-binnenkort/verlopen — let
   op de grenswaarde-mutant), sortering. Units in dezelfde commit; ratchet-groep in
   `scripts/mutation-groups.mjs`.
3. **Hook**: `useCollection('documents', { creatorColumn:'created_by', … })`.
4. **Schermen**: lijst `app/(tabs)/documenten.js` (`Empty` met illustratie — zie de
   `svg-illustraties`-skill), editor `app/document/[id].js` op `useEntityForm` full-mode
   met `VisibilityPicker`; bestand/foto via `useEntityPhoto` → `photoStorage`
   (`uploadPhoto`/`useSignedUrl`).
5. **Registratie**: descriptor in `lib/modules.js` (`primary:false` → "Meer"-tab),
   i18n-keys, icoon in de `lib/icons.js`-`MAP`, helptekst in `lib/moduleHelp.js`.
6. **Garantie-herinnering**: via de bestaande reminder-laag (`lib/useNotifications.js`)
   — géén eigen scheduler.
7. **RLS-scenario** in `tests/rls.integration.test.js` (subgroep-zichtbaarheid + niet-lid
   kan het storage-pad niet lezen).
8. **Later, aparte PR [eval-gate]:** AI-read-tool `documenten_zoeken` via het
   manifest-patroon in `supabase/functions/_shared/tools/`.

**Klaar wanneer.** Module toggle-baar; document met foto + garantiedatum
aanmaken/bekijken/verwijderen op toestel; herinnering verschijnt; volledige DoD.

### F2 — Tijdlijnfilter per lid (TML-7)

**Wat & waarom.** Het filterfundament (TML-6) heeft twee werkende assen
(`module`/`event_type`); de as `member` is voorbereid maar leeg. Geen migratie: de CHECK
in `0076` dekt `'member'` al.

**Waar staat het nu.** `lib/timelineFilter.js` — `TIMELINE_FILTER_AXES` bevat `member`
(r16); `visibleOnTimeline(item, config)` (r86) verwerkt alleen module/event_type.
Prefs-hook `lib/useTimelineFilters.js`; scherm `app/tijdlijn/filters.js` (per as
`FilterRow`+`Switch`; huishouden-uit wint via `locked`).

**Stappenplan.**
1. Bepaal het actor-veld op een tijdlijn-item (zie `lib/timeline.js`/`lib/activity.js`)
   en breid `visibleOnTimeline` uit. **Tests eerst**: lid uit → items weg;
   huishouden-laag wint; onbekend lid → zichtbaar (DEFAULT-ON); aanroep zonder config →
   alles zichtbaar (default-param-mutant).
2. Sectie "Leden" in `filters.js` (ledenlijst-patroon uit `huishouden.js`, `Avatar` +
   naam), zelfde twee-lagen-gedrag.
3. Ratchet: `node scripts/mutation.mjs timelineFilter` (baseline ~93,8% — niet zakken).

**Valkuil.** Dit is een **weergave**-filter; zichtbaarheid/RLS bepaalt wat je *mag* zien,
dit alleen wat je *wilt* zien.

### F3 — Tijdlijnfilter per subgroep (TML-8)

Als F2, vierde as, met twee verschillen: (1) de as-waarde is `share_subgroup_id`;
items met `visibility='household'` hebben er geen en blijven **altijd** zichtbaar
(expliciete unit!); (2) de subgroepenlijst laad je zoals de beheer-UI in
`app/(tabs)/huishouden.js`. Vraag vooraf (beslis-agenda): alleen "subgroep verbergen",
of ook een "alleen-subgroep-X"-weergave.

### F4 — Emoji-reacties op systeem-events (TML-3-rest)

**Wat & waarom.** Reacties op posts zijn live; het 👏 onder "Tim vinkte de afwas af"
(het motiverende deel van het prikbord-concept) ontbreekt nog. Het ontwerp ligt klaar in
[plan 19](19-tijdlijn-prikbord.md) (r167-172) en het datamodel is er al op gebouwd:
`timeline_reactions.target_type` heeft `check (… in ('post','event'))`.

**Stappenplan.**
1. **Stabiel target**: een event krijgt `reactionTarget = '<bron_tabel>:<bron_id>'`
   (deterministisch uit de bron, plan 19). Voeg dat toe in de event-opbouw
   (`lib/activity.js`) — puur, unit-getest.
2. **Fold-uitzondering**: een event mét reacties vouwt **niet** mee in de
   Collapsible-laag (`buildFeed` in `lib/activity.js:96-120` krijgt de reactie-targets
   als input; units: event-met-reactie blijft los staan, zonder reactie vouwt).
3. **UI**: `ActivityRow` in `app/(tabs)/tijdlijn.js:96-106` krijgt de `ReactionBar`
   (nu alleen op posts, `:165` `reactionsFor('post', …)`); zelfde `useReactions`-hook
   met `target_type='event'`.
4. **RLS**: de bestaande live-tests dekken posts; voeg het event-scenario toe
   (kan-ik-niet-reageren-op-wat-ik-niet-mag-zien).

**Klaar wanneer.** Reageren op een event werkt op toestel; gefolde laag klopt; RLS-suite
groen; TML-3 → ✅.

### F5 — Live barcode-scanner (BOO-9-rest)

**Statuscorrectie (2026-07-07, code-geverifieerd).** De §6-notitie suggereerde dat de
bon-flow al "barcode uit de foto" haalt, maar `onScanPress` in `app/purchase/[id].js:133`
is de **bon-OCR** (BOO-7, `scan-receipt`). De barcode-laag is compleet — pure helpers
`lib/barcode.js` (`normalizeBarcode`/`isValidBarcode`/`toEan13`),
`lib/barcodeLookup.js` (`lookupBarcode`: catalogus-hit → OpenFoodFacts → RPC
`insert_catalog_product`; statussen `invalid/found/added/unknown`) — maar heeft **géén
enkele aanroeper**, en `expo-camera` is geen dependency. De §6-rij is gecorrigeerd.

**Stappenplan.**
1. `npx expo install expo-camera` (vergt een nieuwe dev-build — plan met de eigenaar;
   zelfde dependency ontsluit later UX-7/PLA-9).
2. Scanner-scherm `app/scan.js`: `CameraView` met `barcodeScannerSettings`
   (EAN-13/EAN-8), overlay-kader uit tokens, torch-knop, en debounce op herhaalde reads.
   Web: niet aanbieden (zelfde guard-stijl als `offerImagePicker`).
3. Resultaat → `lookupBarcode(code)`:
   - `found`/`added` → toevoeg-sheet met naam/schap vooringevuld → `groceries.add`;
   - `unknown` → producteditor-flow (BOO-13-patroon) met de code vooringevuld;
   - `invalid` → nette melding, scanner blijft open.
4. Ingang: scan-`IconButton` naast de toevoegbalk op boodschappen (`boodschappen.js`,
   r236-264) — de catalogus-route kan volgen.
5. Units voor de nieuwe pure randjes (debounce-logica, status→flow-mapping);
   `lookupBarcode` is al getest.

**Klaar wanneer.** Echte EAN scannen op toestel → item op de lijst mét
catalogus-koppeling; onbekende code → editor; geen dubbele adds bij lang in beeld
houden.

### F6 — Scan-resultaat ook naar voorraad (VOO-2, na F5)

`usePantry.add` accepteert al `catalogProductId` (`lib/usePantry.js:15-49`). Klus:
dezelfde scanner-uitkomst een tweede bestemming geven — een "Naar voorraad"-keuze in de
toevoeg-sheet van F5, die `add({ name, catalogProductId, quantity, location, … })`
aanroept en de editor-sheet van `voorraad.js` (`setEditor`, r226) vooringevuld opent
voor houdbaarheid/bewaarplaats. Klein, geen migratie.

### F7 — Grote-aankopen-module (AAN-1 t/m AAN-4)

**Wat & waarom.** Het gezamenlijk-beslissen-scenario (wasmachine/auto/bank): dossier →
opties → vergelijktabel → stemmen/besluit. Het build-ready ontwerp staat in
[plan 03](03-grote-aankopen.md); dit is een volwaardige nieuwe module (L) en na F1 de
logische tweede module-klus.

**Wat er al ligt / wat je aan het plan moet aanpassen (het plan is ouder dan het
formulier-fundament):**
- `lib/decisions.js` **bestaat al** (`tallyVotes`/`leadingOption`/`budgetLabel`/
  `withinBudget`) — begin niet opnieuw; breid uit met tests waar het plan om vraagt.
- De FND-1-gate uit het plan is **weg** (subgroepen zijn af): subgroep-scoping werkt
  out-of-the-box via het zichtbaarheidscontract.
- Editors op **`useEntityForm` full-mode** bouwen (het plan zegt daar niets over);
  lijsten via `useCollection`.
- Migratienummer via `list_migrations` (het plan zegt `NNNN`).

**Fasering** (elke fase een eigen PR): AAN-1 dossier (tabel `purchase_decisions` via
`enable_module_rls` + lijst/editor) → AAN-2 opties + overwegingen (kind-tabellen
`decision_options`/`decision_remarks`, RLS-patroon `expense_shares`) → AAN-3
vergelijktabel (`decision_criteria`/`option_criteria_values`, horizontaal scrollbaar) →
AAN-4 stemmen + besluit (`decision_votes`, één stem per lid). Per kind-tabel een
RLS-scenario (erft dossier-zichtbaarheid).

### F8 — Wensen-/cadeaulijst (WEN-1, §7-idee — eerst promoveren)

**Waarom dit het paradepaardje van subgroepen is:** de ontvanger mag zijn eigen cadeau
niet zien — exact het `visibility`/`share_subgroup_id`-contract (§1 van de backlog). De
eigenaar heeft WEN-1 bij de juli-scope bewust **niet** gekozen; oppakken = eerst laten
promoveren naar §6.

**Schets.** Contractueel het meest verwant aan F7 (items met notities, per-lid-scoping):
tabel `wishes` (`for_profile_id`, titel, link, prijs-indicatie, geclaimd-door) via
`enable_module_rls`; de kern-kniff: de standaard-zichtbaarheid van een wens voor persoon
X is "huishouden mínus X" — dat is een **subgroep** ("Iedereen behalve X") die de module
bij eerste gebruik aanmaakt. Claim-knop ("ik koop dit") zichtbaar voor iedereen behalve
de ontvanger. Pure logica: claim-status, dubbel-claim-preventie, sortering.

### F9 — Export als tekst/CSV (PLT-4, §7-idee — eerst promoveren)

**Schets.** Twee pure formatters in een nieuw `lib/export.js` (unit-getest, ratchet):
`groceriesAsText(items)` (deelbare boodschappenlijst) en `balancesAsCsv(balances)`
(saldo-export). De share-kant bestaat al als patroon: `Share.share` zoals in
`app/(tabs)/huishouden.js:128` (invite-link) en `app/vehicle/timeline.js:71`. Ingangen:
gelabelde actie in de help-drawer van boodschappen/kosten (UX-42-contract). Geen
migratie; mooie S-klus na promotie.

### F10 — Lange staart (Later/verkennend, compact)

- **AGE-3 — lichte agenda-events (§7).** Een afspraak is nu een volle `tasks`-rij
  (afvink-/herhaal-overhead, geen eindtijd; de agenda is een weergavelaag over `tasks`
  met `category='afspraak'`, `lib/agenda.js`). Verken: extra kolommen (`end_time`,
  `is_event`) vs. eigen tabel. Begin met het gebruikersprobleem scherp krijgen
  (beslis-agenda).
- **AGE-2 — sync met telefoon-agenda.** `expo-calendar` is geen dependency; vergt
  dev-build + rechten per platform. Eerst read-only export (Huishoek → toestel-agenda),
  géén tweerichtings-sync (conflict-hel).
- **BOO-6 — per-keten bon-parsers (trap 2).** Verbetert alleen de extractie; datamodel
  en confirm-stap blijven ([plan 02](02-boodschappen-intelligentie.md):190). Bouw als
  pure `lib/receiptParse.js` met per-keten-parsers op de OCR-tekst + fixtures van echte
  bonnen (AH/Jumbo/Lidl/Plus), vóór de bestaande editor.
- **BOO-4 — supermarktvergelijking.** Leunt op de eigen prijshistorie (BOO-3, af) +
  betrouwbare matching; pas waardevol met flink wat scans. Ontwerp: pure
  `basketEstimate(products, priceHistory, perStore)`.
- **PLA-6 — AI-soortherkenning** (plant-ID-API of Orq-vision; handmatige keuze blijft
  terugval) en **PLA-9 — bulk-plantrondje**: beide gated op **UX-7 — in-app camera**
  (`CaptureSession`-primitief; bestaat nog nergens in code, `expo-camera` komt met F5).
  Bouw UX-7 eerst als gedeeld primitief, dan is PLA-9 een dunne flow erop.
- **PLT-9 — losse items via web delen (§7).** Groeimotor: een lijst deelbaar via
  web-link zonder app. Het join-token-mechanisme is het sjabloon (`lib/invites.js`
  `inviteUrl`/`tokenFromInput`, DEFINER-RPC's in `0053`, scherm `app/join/[token].js`).
  Vergt een eigen token-tabel + anon-`peek`-RPC per deelbaar ding — security-review
  verplicht.
- **PLT-2 — offline-modus (§7).** Groot en riskant; optimistic UI (STR-7) dekt het
  dagelijkse gevoel al. Niet starten zonder expliciete eigenaars-keuze en een eigen
  ontwerp-plan.
- **FND-3 — kinderprofielen.** Kernvraag eerst (beslis-agenda §7): eigen login vs.
  profiel-zonder-account. Technische aanhaakpunten liggen klaar: rol-CHECKs op
  `household_members.role` (`0001:55`) en `household_invites.role` (`0053:32`),
  `create_invite`-validatie, en een derde rechtenniveau door de RLS-policies heen (nu
  binair owner/member). Niet beginnen vóór de kernvraag beantwoord is.
- **AUT-3 — autodelen tussen huishoudens** en **AAN-5 — prijssignalering**: beide
  wachten op een fundamentele keuze resp. externe bron; alleen verkennen op verzoek.

---

## 5. Spoor A — AI-assistent

> **Voor élke A-klus:** lees eerst
> [`docs/assistent-architectuur.md`](../assistent-architectuur.md) (tool-pack-contract,
> eval-gate, tool-budget ~21/25) en [plan 27](27-ontwikkelprogramma-juli.md). Alles wat
> het model ziet is **[eval-gate]**; de edge-deploy gaat via de Supabase-CLI omdat de
> assistant-bundel (22 bestanden) te groot is voor de MCP-inline-route.

### A1 — Pack-ratchets 76–82% → ≥85% (AI-19 fase C) — *ideale eerste klus*

**Wat & waarom.** De vijf AI-19-tool-packs zijn duidelijk lichter getest dan de oudere
packs (~10-14 tests per bestand vs. 20-30): planten **80,1** · huisdieren **79,3** ·
voertuigen **77,2** · tijdlijn **82,4** · delen **76,2** (`mutation-baseline.json`).
Projectnorm ~85%.

**Stappenplan.**
1. `node scripts/mutation.mjs assistantToolsDelen` (laagste eerst) — survivors in
   `reports/mutation/mutation.json`; tests in `tests/assistantTools<Pack>.test.js`.
2. Patroonlijst uit CLAUDE.md ("Mutanten snel doden"): grenswaarde, volgorde+tie-break,
   null/fallback, default-param.
3. Veel survivors zijn fouttekst-StringLiterals (zelfde klasse als maaltijden): assert
   de exacte melding waar gedragsdragend; echt equivalente mutanten →
   `// Stryker disable next-line all` of het `exclude`-veld in
   `scripts/mutation-groups.mjs` (kijk hoe bestaande groepen dat doen).
4. Baseline herijken tegen je **finale** code ([`docs/mutatietesten.md`](../mutatietesten.md)).

**Klaar wanneer.** Vijf packs ≥85%; ratchet-check groen; bronbestanden ongewijzigd op
eventuele Stryker-comments na (descriptions **byte-identiek** — spelregel 2).

### A2 — AI-19 afronden: edge-deploy + eval-run

De tool-packs staan lokaal maar de gedeployede assistant-edge is nog **v19-pending**
(de laatste deploy-poging strandde op de bundelgrootte via MCP). Klus: (1)
`supabase functions deploy assistant` via de CLI (werkwijze in plan 27, r131;
CLI-login = eigenaar-actie als die ontbreekt), (2) byte-verificatie zoals eerdere
deploys, (3) eval-gate-run (`ORQ_API_KEY` nodig — §8) + `--update-baseline` als de
baseline nog "43 cases" zegt, (4) §6-rijen AI-19/AI-20 bijwerken. Daarna is de rest van
AI-19/AI-16/AI-18 puur device-verificatie (§9).

### A3 — Async categoriseren van catalogus-lozen (AI-11 spoor 2) **[eval-gate]**

**Wat & waarom.** Spoor 1 (deterministische catalogus-match in het voorstel) is
gebouwd. Wat een toegevoegd product zónder match nog mist is een schap: het valt terug
op 'overig'. Spoor 2 categoriseert die async met een goedkoop model.

**De seams liggen klaar** (`supabase/functions/_shared/tools/boodschappen.js`):
`uncategorizedAfterExecute(items, matches)` (r68, TODO's op r60 en r242) levert de
gededupliceerde werklijst; de taxonomie is `catalog_categories`
(`0014_catalog_openfoodfacts.sql:30`, client-spiegel `lib/groceryCatalog.js:19`).

**Stappenplan.**
1. **Nooit in de agent-loop**: aparte, lichte edge-functie (of na-execute fire-and-forget)
   naar een eigen kleine Orq-deployment — spiegel het `deployments/invoke`-patroon van
   `scan-receipt` (`index.ts:31,63,134-155`), incl. fail-silent + timeout.
2. Prompt: naam → één categorie uit de vaste taxonomie (enum-uitvoer, geen vrije tekst);
   resultaat → `category`-update op het huishoud-product.
3. Kostenrem: batch per beurt, cap per dag (patroon `record_receipt_scan`).
4. Modelkeuze + deployment = eigenaar (Orq-config, §8); golden-cases voor de matching
   bestaan — voeg cases toe als tool-gedrag wijzigt (hier niet de bedoeling: descriptions
   blijven byte-identiek).

### A4 — Choice-kaart bij ambigue catalogus-matches (AI-11/AI-16-rest) **[eval-gate]**

Bij een ambigue match ("melk" → 3 catalogusproducten) moet het voorstel een
**choice-kaart** tonen i.p.v. gokken. De bouwsteen bestaat: `choiceNode`
(`supabase/functions/_shared/tools/render.js:94`, AskUserQuestion-patroon met
tekst-fallback) + `ChoiceCard` (`lib/AssistantMessageView.js:116`). Klus: in
`boodschappen_toevoegen`-propose de ambiguïteits-detectie (meerdere prefix-hits in
`matchCatalogGrocery`) → choice-preview; tik = gewone gebruikersbeurt die de keuze
doorgeeft. **Raakt tool-gedrag** → nieuwe golden-cases + volledige eval-run verplicht;
stem de triggering af (Sonnet-5 onder-triggert snel — zie de AI-12-ervaring).

### A5 — Chat-poets: collapse, actions, anchoring, reduced-motion (AI-6-rest)

Vier losse, goed afgebakende UI-klussen in `lib/AssistantChat.js` (+
`AssistantMessageView.js`); stop/retry/haptics bestaan al (r198-201, r181):
1. **Collapsible tool-calls** — de statusregel bestaat (`assistantStream.js:71` →
   `stream?.status`, `AssistantChat.js:168`); maak de afgeronde tool-stappen per beurt
   uitklapbaar (Collapsible-patroon) i.p.v. alleen de live-regel.
2. **Message-actions** — long-press op een assistent-bericht → kopiëren (Clipboard) en
   evt. "opnieuw"; landt op `Bubble` (r15-43); gebruik `dialog.menu`.
3. **Scroll-anchoring** — de lijst is `inverted` (r152) maar streamt zonder
   `maintainVisibleContentPosition`; voeg die toe zodat lezen tijdens streamen niet
   wegspringt.
4. **Reduced-motion** — de chat respecteert het systeem-signaal nog niet; hergebruik het
   bestaande patroon (`lib/motion.js`, zoals `vandaag.js`/`dialog.js`).
Elk punt device-checken (streamen + donker thema). Geen eval-gate (raakt het model niet).

### A6 — Geheugen v1 (AI-9) — *L, met begeleiding*

Ontwerp in [plan 24](24-assistent-volwassen.md) ronde H: tabel `assistant_memories`
(pgvector + `'dutch'` tsvector, user/household-scope-RLS), één hybrid-search-RPC met
**Reciprocal Rank Fusion**, een expliciete `remember_fact`-tool (HITL) + async extractie
ná de beurt via een aparte Orq-deployment (dedupe!), beheer-scherm en
memory-zichtbaarheid in de chat. **Waarschuwing:** plan 24 noemt migratienummer "0074"
— dat is inmiddels bezet (`assistant_capabilities`); neem het volgende vrije nummer via
`list_migrations`. Raakt prompt + tools → **[eval-gate]**, en de extractor raakt
kosten → caps zoals A3. Verificatie-focus: RLS-memory-isolatie (lid A ziet nooit
memories van lid B).

### A7–A9 — AI-staart (compact)

- **A7 / AI-7** — A2UI-wire-protocol (surface/patch): bewust `Later`; de platte tree is
  de compat-vorm en blokkeert niets (beslissing 2026-07-06). Niet oppakken zonder
  aanleiding.
- **A8 / AI-20-rest** — eval-run + baseline-update (ORQ-key), toon-kalibratie via
  `--tone` (10 hand-gelabelde voorbeelden vóór de rubric vastligt), Maestro-flow
  `06-assistent` op toestel. Grotendeels eigenaar/device-gated; zie §8/§9.
- **A9 / AI-10-rest** — AI-first FAB uitrollen naar de overige modules **zodra die
  write-tools hebben** (na AI-19-deploy): kleine, mechanische uitbreiding van het
  bestaande FAB-patroon (`lib/assistantProvider.js`), incl. "Zelf invoeren"-terugval.
  Plus het bekende edge-geval: hardware-back in de edit-sheet klapt de hele overlay
  dicht (AI-10-observatie a) — reproduceer eerst, klein UI-fixje daarna.

---

## 6. Beslis-agenda (alleen de eigenaar)

Vragen die klussen blokkeren of sturen — niet zelf beslissen, wel voorbereiden:

| # | Vraag | Blokkeert | Context |
|---|-------|-----------|---------|
| D1 | "Opslaan" vs "Bewaar" app-breed (B1) | U3-staartje | 5 schermen overriden de default; aanbeveling verbeterplan: default "Bewaar" houden |
| D2 | Welke bon-actie is primair: splitsen of naar voorraad? (B2) | U3 | bepaalt knop-kleur op het bon-detail |
| D3 | Labels "Delen met" vs "Delen via Samen" (B3) | U3 | voorstel: Samen-toggle hernoemen ("Reserveerbaar via Samen") |
| D4 | Help-drawer-actie ontdekbaar genoeg, of `Button` in de inhoud? | UX-42-rest | per scherm wegen (Kosten→Inzichten als testcase) |
| D5 | BOO-14: kop inklappen bij scroll en/of catalogus/bonnen naar de drawer? | U4 | optie 2 volgt het UX-42-contract |
| D6 | Zorg: pauzeren zonder of mét `paused`-staat (migratie)? + visibility-erven + care-overzicht + lege-staat (plan 21 A–D) | U5 | bouwvolgorde A→C→D ligt klaar |
| D7 | PLT-11: completions-historie bij account-delete — "onbekend lid" of cascade (Data-4)? | S1 | AVG vs. eerlijkheid-historie |
| D8 | FND-3: kinderen eigen login of profiel-zonder-account? | F10/FND-3 | raakt privacy + RLS-rechtenniveau |
| D9 | TML-8: alleen "subgroep verbergen" of ook "alleen deze subgroep"? | F3 | klein, stuurt de UI |
| D10 | Tool-budget bij ~21 tools: tool-search/deferred loading of accepteren? | A-spoor | expliciet beslispunt uit plan 27 golf 2 |
| D11 | WEN-1 en PLT-4 promoveren naar §6? | F8/F9 | bewust buiten juli-scope gehouden |
| D12 | S6 (push-poets) en REV-2-rest vrijgeven? | S6 | geparkeerd 2026-07-06 |
| D13 | Bonnetjes-bron: alleen fotoscan of ook digitale bonnen (e-mail/AH)? (§5 backlog) | BOO-6/7-vervolg | digitaal is betrouwbaarder dan OCR |

**Besluiten (besluitenronde 2026-07-09):**
- **D1** "Bewaar" app-breed (5 overrides schrappen) · **D2** Splitsen primair (forest; "Naar
  voorraad" soft) · **D3** Samen-toggle → "Reserveerbaar via Samen" · **D4** drawer volstaat
  (UX-42 → ✅/archief).
- **D5** verving de BOO-14-opties door een nieuw idee: **BOO-18 — boodschappen-modus**
  (full-screen afvinkmodus in-app + deelbare gast-URL buiten het huishouden met
  lijst-schrijfrechten maar zonder catalogus-schrijfrechten, incl. ben-je-al-lid-check;
  leunt op het invite-token-patroon; security-review verplicht). U4 is daarmee vervallen.
- **D6** aanbevolen zorg-lijn (pauzeren eerst zonder migratie, visibility erven,
  care-overzicht, lege-staat-CTA's; volgorde A→C→D) · **D7** anonimiseren ("onbekend lid",
  SET NULL) — **S1 is ontgrendeld** · **D8** kinderprofielen: nog niet beslissen ·
  **D9** TML-8 geparkeerd (vorm bij bouwen: alleen verbergen).
- **D10** tool-search vóórbereiden → nieuwe rij **AI-21** · **D11** PLT-4 gepromoveerd
  (F9) + BOO-18 nieuw; WEN-1 blijft §7 · **D12** REV-2-rest + S6 **vrijgegeven** ·
  **D13** (advies, geen formeel besluit): alleen fotoscan.

---

## 7. Eigenaar-acties (extern; geen dev-werk)

Verzameld uit §6 — dit zijn dashboard-/account-stappen die klussen ontgrendelen:

- **Supabase-dashboard:** e-mail-OTP aanzetten + `{{ .Token }}` in de Magic-Link-template
  (→ PLT-8-e2e); leaked-password-toggle (INF-10/B6); `SENTRY_DSN`-secret voor de
  edge-functies (INF-4); redirect-allowlist `…/herstel` (native wachtwoord-herstel).
- **Sentry:** `SENTRY_AUTH_TOKEN` (scope `project:releases`) voor `deploy:web` (→ S10).
- **Orq:** `ORQ_API_KEY` beschikbaar voor eval-runs (A2/A8); `receipt-scan`-deployment
  voor BOO-7; deployment + modelkeuze voor A3; dashboard-opruiming + zai-key
  (AI-2-rest); Orq-MCP koppelen.
- **Stores/EAS:** Play-account (INF-5 submit); echte store-URL's in
  `lib/constants.js` `STORE_LINKS` (:50-53) zodra listings live zijn (PLT-7);
  app-icoon + splash-assets (er is nu géén image — `app.config.js` zet alleen
  achtergrondkleuren); iOS: TestFlight-/device-oppervlak voor de visuele smoke (IOS-1).
- **Deploys:** eerstvolgende `npm run deploy:web` publiceert meteen de gefixte AASA
  (de repo-versie draagt de echte Team ID, live staat nog de placeholder — REV-2 §P8);
  Android `assetlinks.json` wacht op de keystore-SHA. `supabase functions deploy
  assistant` (CLI-login) voor de v19-bundel (A2).
- **Sleutels:** service-role-key roteren na SEC-6-opschoning.

---

## 8. Verificatiebatch (🔧 leegmaken)

Veel §6-rijen wachten alleen op één toestelavond, geen bouwwerk. Draaiboek:
[`VERIFICATIE.md`](../../VERIFICATIE.md) ("Te-verifiëren-batch") + `npm run rooktest` +
handmatige checks; seed eerst S2 zodat de data-gated punten kunnen. De actuele lijst
staat in §6 (zoek op 🔧/◐); terugkerende kandidaten: TML-4/6 (comments/filters +
realtime), AI-16/18 (gen-UI r1–r3, confirm→vervolg-beurt, beide thema's), AI-15-afvinken,
AI-17-beheer-UI, HUI-1-gevuld-detail + PLA-10-huisdier-parity (ná seed), PERF-4/5/7/8/9
(render/scroll/foto-metingen), INF-8 (realtime-patch + gebundelde subscriptie), PLT-7
join-e2e, PLT-8 OTP-e2e (ná dashboard-stap), REV-2 realtime-DELETE-check, S4 happy-path.
Elke bevestiging: 🔧 → ✅ → archief, mét notitie.

---

## 9. Correcties die dit werkboek in §6 doorvoerde

1. **INF-9**: "rate-limit fail-open → fail-closed" stond als open werk, maar de code is
   al fail-closed (zie S4) — notitie gecorrigeerd.
2. **BOO-9**: de "scan-trigger in de bon-flow" is de bon-OCR, niet een barcode-pad; de
   barcode-laag heeft geen aanroepers (zie F5) — correctie aan de notitie toegevoegd.

Status van alles hierboven leeft — zoals altijd — uitsluitend in
[backlog §6](../../huishoek-backlog.md).
