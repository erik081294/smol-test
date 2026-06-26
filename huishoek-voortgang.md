# Huishoek — Voortgangslog

Chronologisch logboek van *wat wanneer is gebouwd* (de oude status-update-
blokken uit de backlog-intro). Het **waarom/overzicht** staat in
[`huishoek-backlog.md`](huishoek-backlog.md), het **hoe** in
[`huishoek-specs-fase1.md`](huishoek-specs-fase1.md) en [`docs/plans/`](docs/plans/00-overzicht.md).
Afgeronde backlog-items met hun volledige notities staan in
[`huishoek-backlog-archief.md`](huishoek-backlog-archief.md).

> Volgorde: oudste boven, nieuwste onder. Voeg nieuwe voortgang onderaan toe.

---

**Status-update (laatst herzien: 2026-06-23).** Fase 0 **én** Fase 1 zijn **af in de
code** (werkboom); Fase 1.6 quick wins (UX-15 t/m UX-20) af — zie de nieuwste entry onderaan.
Gebouwd en aanwezig:
- **Fase 0** — **FND-1** (subgroepen + zichtbaarheid: `subgroups`/`subgroup_members`,
  RLS-helpers `can_view`/`in_subgroup`, `lib/visibility.js`, `VisibilityPicker`,
  subgroep-beheer in `huishouden.js`) en **FND-2** (module-framework: `lib/modules.js`,
  `enable_module_rls()`, migratie `0003`). Daar bovenop **module-toggles** (aan/uit per
  huishouden én gebruiker, migratie `0004`, `effectiveModules()`) — staat hieronder als
  nieuw item **FND-4**.
- **Fase 1** — alle vier de modules geïmplementeerd (migraties `0005`–`0009`, pure logica
  + units, hooks en schermen): **Agenda** (AGE-1), **Schoonmaak** (SCH-1 + SCH-2),
  **Kosten/WieBetaaltWat** (KOS-1 + KOS-2), **Planten** (PLA-1 t/m PLA-4). Zie
  `huishoek-specs-fase1.md` voor de spec + genomen keuzes.
- **Boven de spec uit** — plantfoto-opslag en **plantendagboek** (PLA-5, migraties
  `0010`+`0011`, `lib/plantPhoto.js`); een **Phosphor icon-/design-systeem** (`DESIGN.md`,
  `lib/icons.js`, `lib/theme.js`, `lib/ui.js`) → item **UX-1**; een **"Meer"-overflow-tab**
  in de navigatie → item **UX-2**; en een **CI-pipeline** + testkader
  (`.github/workflows/ci.yml`, `tests/*`) → item **INF-2**.
- **Fase 2 — eerste no-migratie-stappen (2026-06-17)** — **KLU-2** klus-bibliotheek +
  **KLU-3** seizoenssuggesties (`lib/choreLibrary.js`, `lib/ChoreLibrarySheet.js`, één-tik-
  toevoegen vanaf het Taken-scherm) en **PLA-7** (plantfoto-cover — bleek al gebouwd).
  Alles op de live schema (`0011`), géén nieuwe migratie, met units.

- **Fase 2 — voltooiingen-log (2026-06-18, plan 01)** — **SCH-3** eerlijkheidsoverzicht +
  **KLU-4** beurtrotatie, beide op een nieuwe voltooiingen-log `task_completions`
  (migratie `0012` + kolom `tasks.rotation`). Pure logica `lib/fairness.js`/`lib/rotation.js`
  met units, hook `useTaskCompletions`, component `FairnessBars`, UI op Schoonmaak +
  taak-editor. Migratie `0012` is **live gepusht** en de RLS-integratietests zijn
  **groen** tegen de live DB (118 tests, 0 skipped) — zie INF-1.

**Fase 1 live geverifieerd (2026-06-18):** de migraties `0004`–`0012` staan op het
live Supabase-project (DB op `0012`) en de RLS-integratietests draaien groen tegen
de live DB (118 tests, 0 skipped) → item **INF-1** ✅. Resteert alleen de handmatige
2-account-rooktest (`VERIFICATIE.md` Stap 3).

- **Volgende ronde = Fase 1.5 "Strak & af" (2026-06-18)** — vóór de ambitieuze
  Fase 2-data-features eerst de bestaande app echt strak maken. De app heeft een
  sterk design-systeem (`lib/theme.js`, `lib/ui.js`, `DESIGN.md`) maar voelt op
  mid-tier schermen kaal: zelfgebouwde UI i.p.v. de bibliotheek, geen optimistic
  UI/haptics/undo, en taken die op vier schermen (Vandaag/Taken/Agenda/Schoonmaak)
  opduiken zonder heldere rolverdeling. Uitgewerkt als items **STR-1 t/m STR-11**
  in §6 en build-ready in [`docs/plans/07-strakke-app.md`](docs/plans/07-strakke-app.md).
  Geen migratie — dit is "toepassen wat al bestaat".

- **Fase 1.5 grotendeels af (2026-06-18)** — STR-1/2/3/5/6/8/11 ✅ in de code;
  STR-4/7/9/10 🔧 (gebouwd, nog visueel/web te valideren). Laatste twee gaten dicht:
  **STR-8 haptics** (`expo-haptics` toegevoegd + `lib/haptics.js`, ingehaakt op
  afvinken/opslaan/fout) en **STR-5 zichtbare acties** (geen verborgen long-press meer;
  Schoonmaak-actieknop in-flow i.p.v. zwevend). Resteert: de 🔧-items op web narlopen.

- **Fase 2 — Boodschappen-intelligentie + AI-scan (2026-06-19, plan 02)** — **BOO-5**
  productcatalogus/matching, **BOO-2** handmatige bon (trap 1) en **BOO-3** prijstracker
  gebouwd (datalaag + hooks + schermen); migratie `0013` **live** (DB op `0013`), RLS-tests
  groen (**155 tests**). Daarbovenop **BOO-7** AI-bonscan via een `scan-receipt` Edge Function
  naar de **Orq.ai**-gateway (foto → JSON → bewerkbare editor als vangnet). Alle code
  **gecommit + gepusht**; resteert de **web-rooktest** (→ 🔧) en, account-afhankelijk, het
  activeren van de Orq-deployment + secrets voor de scan.

- **i18n-locale-detectie af (2026-06-19)** — `lib/i18nRuntime.js` (commit c68592a):
  apparaat-taaldetectie (`expo-localization`) + taalwissel + persistentie, gewired in
  `app/_layout.js`. Het laatste open stuk van **INF-6** is daarmee dicht.

- **Fase B — dev-build klaar + toestel-rooktest gedaan (2026-06-19)** — de EAS Android
  `development`-build is **finished** (APK, build `76fd754c…`) en geïnstalleerd op een
  **moto g72 (Android 13)**. Gestart via **USB + `adb reverse`** met een dev-client-deeplink
  naar `localhost:8081` (omzeilt de firewall-LAN-val — `--localhost` niet eens nodig).
  **Rooktest groen op toestel** (screenshots + UI-dumps): login, navigatie + álle tabs
  renderen; taken afvinken (doorrol bevestigd: 25 jul→1 aug→8 aug); boodschap
  toevoegen/verwijderen + **undo-toast** (`'Melk' gewist` + Ongedaan maken); productcatalogus
  (BOO-5), prijstracker-detail + empty state (BOO-3), bon-editor (BOO-2, incl. "Scan bon"-knop
  + lopende totaalcontrole) en kosten/saldo ("Je staat gelijk") — **geen redbox/JS-fouten**,
  sterke a11y-labels. Daarmee **INF-7 ✅** en de boodschappen-🔧 **BOO-2/3/5 op toestel
  bevestigd**. **Rest:** bon écht end-to-end opslaan (`create_purchase`), BOO-7-scan
  (Orq-secrets), INF-3 Maestro-kalibratie + INF-4 Sentry-DSN, en de 2-account-rooktest
  (`VERIFICATIE.md` Stap 3). Mini-bug gezien: spatie mist in kosten-metaregel
  ("1 deelnemer· 18 jun.").

- **Volgende ronde gepland (2026-06-20): drie features met max. gebruikerswaarde** —
  build-ready uitgewerkt in `docs/plans/`: **09 Slimme keuken-loop** (Maaltijden MLT-1/MLT-2
  + Voorraad VOO-1, bovenop de catalogus), **05 Notificaties** (PLT-1, geactualiseerd:
  lokaal + remote, incl. maaltijd-/voorraad-herinneringen) en **04 Kosten & autodelen**
  (KOS-3/4, AUT-1/2, geactualiseerd: bon→uitgave nu echt via `purchases`). Samenhang:
  menu → lijst → voorraad → herinneringen → kosten. Nieuwe migraties (vanaf `0016`); nog te bouwen.

- **Volgende ronde GEBOUWD (2026-06-20, branch `claude/keuken-notif-kosten`)** — alle drie
  de features staan in code, getest (units groen, lint 0 errors) met RLS-integratietests
  erbij: **MLT-1/MLT-2/VOO-1** (keuken-loop, migratie `0016`), **PLT-1** (notificaties
  lokaal+remote, `0018`), **KOS-3/4 + AUT-1/2** (kosten & autodelen, `0017`). Status 🔧:
  migraties `0016`–`0018` nog **live pushen** + RLS-tests met secrets + web-/toestel-rooktest
  (zie `VERIFICATIE.md`), dan → ✅. Pure logica: `lib/mealPlan.js`, `lib/pantry.js`,
  `lib/notifications.js` (uitgebreid), `lib/reservations.js`, `lib/recurringExpense.js`.

- **Kleine UX-ronde GEBOUWD (2026-06-22, branch `claude/backlog-review-plan-6mhws5`)** —
  drie no-migratie-items, units groen + lint 0 errors: **UX-8** opstart-/wachtscherm
  (geen onboarding-flits meer; pure gate `lib/appRoute.js` + `SplashWait`) → ✅,
  **UX-11** kleinere FAB met label → ✅, en **UX-12** back-naar-Meer via
  `backBehavior="history"` → 🔧 (nog een Android-toestelcheck).

- **Plannen 10–13 GEBOUWD + GEMERGED (2026-06-22, PR #23 + #24 → `main`)** — Grote-aankopen
  (plan 03) bewust **uitgesteld**; in plaats daarvan zijn de vier build-ready plannen uit
  [`docs/plans/`](docs/plans/00-overzicht.md) nu **gebouwd, gecommit én gemerged** (units
  groen, 278 pass / 0 fail / 18 skip; lint 0 errors): **13** PLA-8 cross-plant tijdlijn +
  BOO-8 aankoopfrequentie → ✅; **11** UX-6 eigen dialoog-/actiesheet-systeem (native `Alert`
  vervangen) + UX-10 "vorige"-lintje → ✅; **10** Taken-redesign TKN-1 tijdscope-switcher
  (Dag/Week/Maand + gedeelde `MonthView`) + TKN-3 filter-bottom-sheet → ✅ (TKN-2 jaar blijft
  ⏳ onderzoek); **12** Vandaag-widget-grid-epic VDG-1..8 → ✅ (registry + grid-engine +
  kleur/stijl + bewerkmodus + gesynkte layout via migratie **0036** + **Reanimated vinger-drag**
  met realtime herschikken, `lib/widgets/WidgetGrid.js` + `GestureHandlerRootView`; elke widget
  resizebaar 1×1/2×1). Alles op de emulator geverifieerd (incl. DB-round-trip van de layout).
  **Rest van de ronde = device-checks:** UX-12 (Android-back), de 🔧-items en de 2-account-
  rooktest (`VERIFICATIE.md`).

- **Performance-pakket GEBOUWD (2026-06-22, branch `claude/plannen-10-13`)** — "waargenomen
  snelheid": **PERF-2** (instant tab-wissel via een in-memory SWR-cache `lib/dataCache.js` +
  `freezeOnBlur` op de Tabs), **INF-8 C3** (incrementeel realtime-patchen `lib/realtimePatch.js`
  i.p.v. full refetch, alleen platte `select '*'`-collecties) en de veilige helft van **PERF-1**
  (ruime `.limit(2000)` op de voltooiingen-log + uitgaven). Géén migratie. Units **316 (298 pass /
  0 fail / 18 skip)**, lint 0 errors. Alle `useCollection`- én de vier join-loader-hooks seeden uit
  de cache + schrijven terug; cache household-gescopet + `clearCache()` op sign-out. **Rest:**
  soepelheid + realtime-patch op web/Android-emulator/toestel bevestigen (→ 🔧).


- **Fase 2 — PERF-1 aggregaat-RPC's + HUI-1 Huisdieren-module (2026-06-23)** — twee blokken,
  beide met groene units en lint 0 errors; migraties `0037`/`0038` **live gepusht** (geverifieerd
  via `list_migrations` + RPC-rooktest; `get_advisors` ongewijzigd t.o.v. de INF-10-basislijn).
  - **PERF-1 (rest):** `0037` voegt `household_expense_totals` + `household_completion_totals`
    toe (SECURITY INVOKER → de bestaande RLS scopet de payload, `search_path=public`). De
    data-hooks (`useExpenses`/`useTaskCompletions`) halen exacte all-time-totalen *lazy* op zodra
    hun `.limit(2000)`-venster vol is; `lib/expenses.js#balancesFromTotals` voedt het kosten-saldo
    en `lib/fairness.js#tallyFromCounts` het schoonmaak-eerlijkheidsoverzicht (all-time). Onder de
    drempel verandert er niets (geen extra query). Units: `tests/perfAggregates.test.js`.
  - **HUI-1:** nieuwe **Huisdieren-module**. `0038` = `pets`/`pet_log` (tijdlijn met foto/notitie/
    **gewicht**) + private bucket `pets` + `tasks.pet_id` + categorie `huisdier`. De
    verzorgingsroutines per diersoort leven in code (`lib/petCare.js`, 8 diertypen) en worden als
    **voor-aangevinkte checklist** aangeboden: de gebruiker kiest soort → bevestigt/schaaft bij →
    de gekozen taken landen meteen als `tasks` (category `huisdier`) in Vandaag/Taken. Hooks
    `lib/usePets.js`/`petPhoto.js` (hergebruiken plant-foto-/tijdlijn-helpers), schermen
    `app/(tabs)/huisdieren.js` + `app/pet/[id].js` (detail + add-flow met checklist) + `app/pet/timeline.js`.
    Registry/wiring: `lib/modules.js`, `lib/icons.js` (`pets`/`huisdier` + weight/birthday/vet/chip),
    `lib/illustrations.js` (`pets`-pootafdruk), `lib/theme.js` (categorie `huisdier`), `lib/constants.js`
    (CATEGORIES + de 0001-CHECK bijgewerkt voor constants-sync). Units: `tests/petCare.test.js`.
    Totaal **439 (421 pass / 0 fail / 18 skip)**. **Rest (toestel):** foto kiezen/uploaden,
    checklist-flow, tijdlijn + gewicht-log + realtime bevestigen (→ 🔧).


- **Fase 1.6 — UX quick wins UX-15 t/m UX-20 + SwipeRow-primitief (2026-06-23)** — geen migratie,
  volledig op het bestaande design-systeem; alle units groen, lint 0 errors, mutatie-ratchet groen
  (`insights` 88,4% · `recurrence` 90,7% · `i18n`). PR #37, op de Motorola (moto_g72) E2E geverifieerd.
  - **UX-15/16:** `ListSkeleton` uitgerold op Taken/Kosten/Activiteit/Planten/Huisdieren/Schoonmaak/
    Kosten-inzichten/Plant-timeline (waren blanco bij laden); kale lege staten kregen een next-step-
    actie + illustratie via `Empty` (Taken/Kosten/Planten een knop, Activiteit een illustratie).
  - **UX-17:** nieuw herbruikbaar **`SwipeRow`** (`lib/ui.js`, op `ReanimatedSwipeable`) met
    declaratieve actie-descriptors — **links = verwijderen**, **rechts = uitstellen** (`snoozeDate`
    in `lib/recurrence.js`, units). Zichtbare knop + web-fallback blijven. Uitgerold op Taken,
    Boodschappen, Voorraad en Maaltijden (laatste was delete zónder undo → nu mét). E2E ving een
    **richting-inversie** (gesture-handler rapporteert de veegrichting) → gecorrigeerd; Maestro-flow
    `.maestro/04-swipe.yaml`. **Leerpunt:** `adb input swipe` moet traag (~1200ms) om een
    gesture-handler-gesture te triggeren; een snelle fling komt niet aan.
  - **UX-18:** zichtbare `chevron`-bewerk-affordance op recept-ingrediënten; huisdier-verzorging had
    al een knop. Plant-verzorging bleek niet bewerkbaar → follow-up **UX-21** (geen `updatePlant`-flow).
  - **UX-19:** bulk "voltooide/verlopen wissen" (Taken/Voorraad, undo-toast + `removeMany`/`deleteTasks`)
    + nieuw `Celebrate`-component ("alles af vandaag", respecteert verminder beweging).
  - **UX-20:** periode-telling — "{n} voltooiingen in deze periode" (schoonmaak) en "{n} uitgaven
    deze maand" (kosten-inzichten); nieuwe pure `insights.monthCount` + unit.


- **UX-14 — Dark-mode titels & pill-teksten leesbaar (2026-06-23)** — op de Motorola geverifieerd.
  **Kernbug:** de New Architecture (Fabric) cachet de geflatte stijl **per object-identiteit** bij
  de eerste render. De `type`/`categoryMeta`-tokens droegen hun kleur via een live `get color()`
  op gedeelde style-objecten → één keer uitgelezen (licht, want dev-client `Appearance`='light')
  en daarna vast. Gevolg: `ScreenHeader`-titels (`type.h1`, bv. "Taken") donkergroen-op-donker,
  terwijl een ná-de-switch-gemounte `type.h2` ("Niets in beeld") wél wit was. **Fix:**
  `rebuildTokens()` geeft `type`/`categoryMeta` bij elke `applyTheme()` een verse identiteit met
  platte kleurwaarde (`lib/theme.js`) → cache herrekent. Plus brand-`Badge` naar een nieuw
  `brandText`-token (AA op donker, was ~2:1). Geen migratie. Leerpunt vastgelegd: nooit een live
  getter op een gedeeld style-object op Fabric.


- **UX-batch — STR-4-rest, UX-21, PLT-5, UXR-1/3 (2026-06-23)** — vier werkstromen in één PR.
  - **STR-4 (af):** plant- & bon-picker naar de gedeelde `offerImagePicker` (`lib/photoPicker.js`);
    ~70 regels duplicatie weg, alle foto-schermen één codepad.
  - **UX-21:** bestaande plant bewerkbaar — zichtbare "Aanpassen"-affordance + bewerk-sheet
    (naam/soort/locatie) via `usePlants.updatePlant`; verzorgingskaart volgt mee. Geen migratie.
  - **PLT-5 (a11y/contrast-audit):** font-scaling nergens uit, `IconButton` 48dp, labels grotendeels
    aanwezig. Nieuw: pure `lib/contrast.js` (WCAG) + `tests/contrast.test.js` als regressie-guard op
    de AA-drempels in béíde thema's; paletten losgetrokken naar `lib/palette.js` (RN-vrij, testbaar).
    Fixes: `inkFaint` (licht) AA op surface; categorie-label naar `inkSoft` (kleur in icoon); status-
    badges 3:1-vloer. De guard vangt o.a. de UX-14-titel- en brand-badge-regressie.
  - **UXR-1/UXR-3 teardown:** Vandaag + Boodschappen ontleed; beide strak. Quick win: `blurOnSubmit`
    op de boodschappen-toevoegbalk (toetsenbord blijft open). Bevindingen → rijen UX-23/UX-24.


- **Toestel-verificatie plan 15 (keuken/boodschappen-redesign) — 2026-06-25** — op de moto g72
  (USB + dev-server) alle niet-veeg-checks gedraaid; veeg-gebaren (swipe-week, swipe-afvinken)
  door Erik zelf bevestigd. Zie het verificatie-blok in [`docs/plans/15`](docs/plans/15-keuken-boodschappen-widgets.md).
  - **Geautomatiseerd groen:** `npm test` (587 tests, 569 pass / 18 RLS-skip, 0 fail);
    mutatie-ratchet `--since=origin/main` (14 groepen, geen daling); `expo lint` 0 errors (27
    pre-existing react-hooks-warnings).
  - **RLS tegen live Supabase (mét secrets):** 15/18 cases groen; de 3 falende vielen om op de
    Supabase **auth rate-limit** (free tier, ~30 testgebruikers achter elkaar), géén RLS-schending
    → **INF-1** nagenoeg afgerond (3 herdraaien zodra de limiet reset).
  - **Rooktest (niet-veeg):** categorie-schappen renderen; instant 0-based stepper werkt
    (Appels 1→2→1, optimistisch); inline zoek-dropdown opent ("koffie" → catalogus-overlay) en
    **sluit** via backdrop-tik; Keuken-omgeving (Weekmenu ⇄ Recepten, week-navigatie, geplande
    maaltijd) rendert **zonder de 7-dagen-strip-crash** (008c3f1 op toestel bevestigd); widget-grid
    rendert, tab-wissels instant (**PERF-2** toestel-bevestigd).
  - **Bevindingen vastgelegd:** **INF-11 opgelost** — de 5 modules chirurgisch aan
    `mutation-baseline.json` toegevoegd (geen `--update`, om niet over het parallelle SEC-werk
    heen te schrijven), `total` → 3040/3556 (85.5 %); en **A11Y-1/A4** (stepper is geen
    `adjustable` — device-dump). Geen nieuwe bugs; gedeelde live-lijst schoon achtergelaten.
  - **INF-1-rerun:** niet los herdraaid — de SEC-ronde breidt de RLS-suite uit en refactort de
    setup naar `create_household`; de rate-limit op de volledige run is door SEC apart vastgelegd
    als **INF-12** (batch/backoff). 18/18 loopt mee met de SEC-verificatie.

---

**2026-06-25 — Security-remediatie SEC-1 t/m SEC-7 ([plan 17](docs/plans/17-security-remediatie.md)) gebouwd + deels live.**
De drie-agent security-doorlichting omgezet in werk en op de live DB (`nayqbzekpdyigvfcroxd`) toegepast via MCP `apply_migration`:
- **Migraties `0041`–`0044`:** `create_household`-RPC + `revoke insert on household_members` (SEC-1, de kritieke owner-escalatie); `households_update` → owner-only (SEC-4); `run_recurring_expenses` van public/anon/authenticated gerevoke't (SEC-2); PUBLIC/anon-EXECUTE ingetrokken op de user-facing DEFINER-RPC's met behoud van `authenticated` (M1/INF-10). Vóór/na grant-checks + `get_advisors(security)` bevestigen de gaten dicht.
- **Client/edge:** `lib/household.js createHousehold` → `rpc('create_household')`; nieuw `lib/secureStorage.js` (SecureStore + byte-veilige chunking) + `lib/supabase.js`-wiring met eenmalige AsyncStorage→SecureStore-sessiemigratie (SEC-3); `notify/core.js` payload-hardening — recipientId-guard + `clampBody` (SEC-5, mutatie-ratchet 80,2 % ≥ baseline); SSRF-allowlist in `scripts/refresh-off-delta.mjs` (SEC-7/L3).
- **Tests:** `tests/rls.integration.test.js` omgebouwd naar de RPC + nieuwe SEC-1/SEC-4-cases (live groen); nieuw `tests/secureStorage.test.js` + uitgebreide `tests/notify.test.js`. `npm test` groen op de units; de RLS-tail valt om op de auth-rate-limit (zie **INF-12**).
- **Geleerd:** Supabase verleent EXECUTE op nieuwe functies **direct aan anon/authenticated** (default-privileges), niet alleen via PUBLIC → een revoke móét `anon` expliciet noemen (vandaar `0043`/`0044`).
- **Open:** SEC-3 device-verificatie, SEC-5 gate op PLT-1-deploy, SEC-6 (`.env`-hygiëne, handmatig), SEC-7/L2 (`npm audit fix` bij de SDK-bump). **Nog niet gecommit/PR** — werkboom-wijziging op `feat/boodschappen-redesign`.

---

**2026-06-25 — Drie doorlichtingen geconsolideerd + backlog-hygiëne.**
- **Audits → plannen 16–18 + §6.** Drie parallelle multi-agent-audits (2026-06-24/25) zijn
  build-ready gemaakt als [plan 16](docs/plans/16-performance-audit.md) (Performance, PERF-3…9),
  [plan 17](docs/plans/17-security-remediatie.md) (Security, SEC-1…7) en
  [plan 18](docs/plans/18-ux-verbeterplan.md) (UX/a11y/correctheid, A11Y-1/2, UX-43/44, PERF-9,
  INF-11, BOO-12), en geconsolideerd in de backlog §6. Overlap gede-dupliceerd: 18-Pijler-D =
  PERF-4/PERF-5 (D5 bewust níét), security-M1/L4/L5 onder INF-10, L1 onder INF-9. Do-now: SEC-1 +
  SEC-2 vóór nieuw feature-werk. *(Deze planningsnotitie stond eerder in `docs/plans/00-overzicht.md`;
  daar verplaatst zodat 00 een platte index blijft.)*
- **Backlog-hygiëne-pass.** §6: de `Fase`-kolom vervangen door **Baan** (`Now`/`Next`/`Later`),
  de notitie-kolom ingekort (audit-items → één regel + planlink; unieke specs naar §2 of compact),
  en een **verificatie-ratchet** ingevoerd — een cap op `🔧` met een gebundelde
  **"Te-verifiëren-batch"** in [`VERIFICATIE.md`](VERIFICATIE.md). Geen code; alleen documentatie.

---

**2026-06-26 — Launch-readiness-review (5 agents) + remediatie.** Volledige analyse +
doorgevoerde fixes in [`docs/launch-readiness-2026-06-26.md`](docs/launch-readiness-2026-06-26.md);
backlog-tracking als **LRN-1**. Kort:
- **DB live (productieproject):** migratie `0055` dropt de oude `join_household` + de
  `households.invite_code`-kolom (SEC-5: de statische 6-char join-code was nog
  `authenticated`-grantable → bruteforcebaar cross-household datalek; de client gebruikte
  enkel nog het token-systeem `0053`). **Scan-receipt getrapte rate-limit**: `0056`
  (globaal dag-vangnet) + `0057` (per-gebruiker dag-quota 30/24u — de hoofd-rem, schaalt
  de kosten mee met het aantal echte users) bovenop de burst van 20/uur; anon expliciet
  ge-revoked. De `scan-receipt` edge-function (fail-closed + error-leakage dicht) is
  **gedeployed via de CLI** (version 3, `verify_jwt` behouden). Alles geverifieerd.
- **Client/realtime:** `realtime.setAuth()` propageren in `lib/auth.js` (RLS-subscriptions
  vielen na ~1u token-refresh stil); reload-storm gedebounced in `lib/useRealtimeReload.js`;
  signed-URL-cache (`lib/photoStorage.js`) + 12-maands-venster op `useProductFrequencies`.
- **Tijdlijn:** paginering (groeiend venster + `onEndReached`), feed-query op het feed-index
  afgestemd, parallelle uploads + orphan-storage-cleanup (`lib/useTimeline.js`).
- **Overig:** per-segment `ErrorBoundary` (tab- + tijdlijn-groep), heatmap-memo + kleinere
  hitSlop, `vehicleCosts` maand-overflow (`subMonths`) + test, i18n nl-fallback +
  `SUPPORTED_LANGS=['nl']`, twee `t('common.close')`-labels.
- **Tests/ratchet:** nieuwe units (vehicleCosts/expenses/i18n); `npm test` groen
  (679 pass). Mutatie-ratchet `GROUPS` uitgebreid met de voertuig-/geld-/pet-/heatmap-/
  contrast-modules + baseline hergegenereerd. RLS-integratietest: helper gemigreerd naar
  `create_invite`/`accept_invite` + isolatietests voor `timeline_posts/photos` en `household_invites`.
- **Open (bewust):** captcha op signup (uitgesteld op verzoek), realtime-tier-check vs
  10k DAU (config), Orq-side budget-alert (dashboard), en device-/live-RLS-verificatie.
  **Nog niet gecommit/PR** — werkboom op `feat/tijdlijn-fundament`.

**2026-06-26 — Architectuur-review + module-ruggengraat vastgelegd (ARCH-1).** Review op
schaalbaarheid/modulariteit (zorg: "losse modules → spaghetti"). Bevinding: de `lib/`-laag
is al een plug-in-architectuur (`modules.js` → `useCollection` → `enable_module_rls`, breed
geadopteerd, geen circulaire imports); het echte risico zit in de gekopieerde entity-editors
en impliciete module-contracten. Doorgevoerd:
- **Gedeelde entity-editor-fundament:** pure [`lib/formValidation.js`](lib/formValidation.js)
  (`runRules`/`isValid` + regel-fabrieken `requiredText`/`positive`/`when`) — getest
  ([`tests/formValidation.test.js`](tests/formValidation.test.js)) en in `GROUPS` opgenomen
  (ratchet **92,1%**). Dunne React-schil [`lib/useEntityForm.js`](lib/useEntityForm.js)
  (`errors`/`busy`/`validate`/optioneel `values`). `visibilityRule` toegevoegd aan
  [`lib/visibility.js`](lib/visibility.js) (ratchet **88,9% → 92,5%**).
- **Referentie-conversie:** [`app/expense/[id].js`](app/expense/[id].js) gebruikt nu de hook
  + gedeelde regels i.p.v. een eigen `errors+clearErr+validate`-blok (incrementeel,
  gedragsneutraal). Daarbij een latente bug gevangen: de bedragfout moet op sleutel `amount`
  staan (die het veld uitleest), niet op `amountCents`.
- **Documentatie (meeliftend op de bestaande structuur):** nieuw levend naslag-document
  [`docs/architectuur.md`](docs/architectuur.md) (het module-contract, naast `zichtbaarheid.md`),
  opgenomen in [`docs/README.md`](docs/README.md) + een oriëntatie-verwijzing in
  [`CLAUDE.md`](CLAUDE.md). Guardrail-routekaart als **ARCH-1..4** in backlog §6.
- **Tests/ratchet:** `npm test` groen (704 pass / 23 skip), `eslint` zonder errors,
  baseline bijgewerkt (formValidation + visibility).
- **🔧 Smoke-test open:** de uitgave-editor-conversie is gedragsneutraal maar nog niet op
  toestel/web bevestigd → opgenomen in de device-batch §C van [`VERIFICATIE.md`](VERIFICATIE.md)
  en als 🔧 in de ARCH-1-rij (§6). Schermlaag valt buiten de unit-/mutatietests, dus dit is
  de laatste stap vóór ARCH-1 → ✅.
- **Open (ARCH-2..4):** capability-interface voor overzichten (lost de `useNotifications`→3-hooks
  koppeling op), module-gating op `effectiveModules()`, en `i18n.js`/`ui.js` per namespace splitsen.

**2026-06-26 — Testframework-review (multi-agent) + reliability-hardening (INF-3).**
Drie parallelle review-agents (autonomie / mutatie-infra / unit-suite+CI). Doorgevoerd:
- **Tijdzone-bug gefixt** in [`buyFrequency`](lib/buyFrequency.js)/[`vehicleTimeline`](lib/vehicleTimeline.js)/[`plantTimeline`](lib/plantTimeline.js):
  datum-only strings (`'2026-06-01'`) werden als UTC-instant geparsed → dagverschuiving in
  negatieve-offset-zones (5 falende tests onder LA; CI op UTC bleef blind). Volledige timestamps
  blijven correct lokaal. [`tests/register.mjs`](tests/register.mjs) pint nu de suite **én** de
  mutatie-runner op een vaste zone → deterministisch ongeacht machine-tijdzone.
- **Mutatie-GROUPS zelf-bewaakt:** `realtimeHub`+`secureStorage` (hadden een test maar ontsnapten
  aan de ratchet) toegevoegd; GROUPS-data losgeweekt naar Stryker-vrij
  [`scripts/mutation-groups.mjs`](scripts/mutation-groups.mjs); [`tests/groupsCoverage.test.js`](tests/groupsCoverage.test.js)
  faalt bij een geteste-maar-niet-gemuteerde module (allowlist `UNMUTATED_TESTS`).
- **Timeout-kills zichtbaar** in de mutatie-output (legde score-ruis op timeout-zware modules
  bloot: realtimeHub 10, vehicleTimeline 62, buyFrequency 16 timeout-kills). **`npm run lint` =
  `eslint .`** (spiegelt CI). Loader-`/index.js`-fallback in [`tests/loader.mjs`](tests/loader.mjs).
- **RLS-CI** als handmatige `workflow_dispatch`-job ([`rls-check.yml`](.github/workflows/rls-check.yml)) —
  per-PR is niet robuust binnen de free-tier (rate-limits, live data, geen aparte staging).
- **Docs:** [`mutatietesten.md`](docs/mutatietesten.md) bijgewerkt (self-check, mutation-groups-split,
  TZ-pin, timeout-zichtbaarheid, en de bewuste keuze géén anti-verlaging-poort op de baseline —
  optie 3 blijft mogelijk, controle = PR-diff); snapshot-notitie boven het effectiviteit-rapport.
- **Tests/ratchet:** `npm test` groen (704 pass / 23 skip), `eslint` zonder errors. Baseline
  aangevuld met **alleen** `realtimeHub`/`secureStorage` (overige entries ongemoeid). **Nog niet
  gecommit/PR.**

---

**Launch-readiness — verificatieronde (2026-06-26).** Status geverifieerd tegen de bron i.p.v.
de docs (zie [`docs/launch-readiness-2026-06-26.md`](docs/launch-readiness-2026-06-26.md)):
- **Live DB volledig gemigreerd t/m `0058`** (MCP `list_migrations`; `0058` security-revoke live 2026-06-26). Dit corrigeerde stale §6-
  claims: TML-1/PLT-7 zeiden "migr. `0053`/`0054` nog live zetten" terwijl beide al live waren;
  INF-1 zei "0001–0036". §6 + archief bijgewerkt (UXR-2 → archief).
- **Volledige live-RLS-suite groen — 729 pass / 0 skip / 0 fail.** De 21 RLS-integratietests
  draaiden écht (niet geskipt) tegen de live DB, incl. de nieuwe `timeline_posts`/`timeline_photos`-
  en `household_invites`-isolatiecases + de naar invite-tokens gemigreerde testhelper.
- **Security-advisors:** geen ERROR. WARNs zijn by-design (`authenticated` op user-facing DEFINER-
  RPC's; `peek_invite` anon) of al bekend (pg_trgm in `public`, leaked-password-toggle). **Eén
  losse eindje (opgelost):** anon kón nog de RLS-helpers (`is_member`/`is_owner`/`in_subgroup`/`can_view`/
  `check_subgroup_household`) + trigger-fns (`handle_new_user`/`cleanup_vehicle_resource`) via REST
  aanroepen — `0042`–`0044` raakten alleen de user-facing RPC's. **Gedicht door migr `0058`** (live
  2026-06-26; advisors bevestigen: anon-WARN op de helpers weg, trigger-fns niet meer geflagd).
- **Emulator-rooktest** (`Medium_Phone_API_36`, debug-APK op live Metro): app boot/bundelt schoon,
  géén crash/red-box. Geverifieerd: Thuis (echte data), Meer-modulelijst (incl. `tijdlijn`-rename),
  Tijdlijn-feed (echte lege staat tegen live `0054`), Inzichten/heatmap (102 voltooiingen). Niet
  sluitend op deze opstelling: ErrorBoundary-fallback, tijdlijn-paginering (>100 posts), onboarding.
- **CLAUDE.md:** DoD-gate #4 toegevoegd (doc bijwerken bij een verschoven feit; status tegen de
  bron verifiëren) om dit soort stale docs voortaan te voorkomen.

---

**Verificatie-oppervlak verbreed — type-laag + ratchet-verfijning (2026-06-26).**
- **Type-laag (PR #61).** Opt-in `// @ts-check` over alle pure logica-modules (`MUTATED_SOURCES`),
  gescoped via `tsconfig.check.json` (`strict` bewust uit: vangt verkeerde shapes/arg-fouten,
  niet elke null) en ingehaakt als CI-gate ná lint, vóór de tests. Meta-test
  [`tests/typecheckCoverage.test.js`](tests/typecheckCoverage.test.js) bewaakt dat `// @ts-check`
  + de tsconfig-scope synchroon blijven met de ratchet-set. ~10 modules kregen lichte
  JSDoc/`@type`-casts/`.getTime()` — allemaal **type-only**, dus de mutatie-score bleef gelijk.
  Pilot vond geen latente bug (de modules zijn goed getest); de winst is preventie van
  toekomstige shape-/arg-regressies + geformaliseerde shapes. DoD-punt typecheck toegevoegd.
- **Ratchet-verfijning (PR #63).** `changedGroups` slaat nu modules over waarin alléén
  comments/opmaak veranderden (gedrags-equivalentie via
  [`scripts/codeEquivalence.mjs`](scripts/codeEquivalence.mjs): Babel parse→print zónder comments).
  Voorkomt dat een brede comment-sweep (zoals de #61-`@ts-check`-uitrol) álle modules opnieuw
  muteert — dat veroorzaakte flaky timeout-ruis op de mutatie-job van #61. Geverifieerd met een
  unit-test (7 cases) + een echte git-smoke (comment-only `fairness` overgeslagen, echte wijziging
  `quantity` wél gemuteerd).
- **EAS (PR #62).** Build-profielen aan de production-environment gekoppeld (`eas.json`).

---

**Sentry gekoppeld — INF-4 DSN + source-map-upload (2026-06-26).**
- **Project aangemaakt** via de Sentry-MCP: `evdn/huishoek` (platform react-native, team `evdn`),
  EU-region `de.sentry.io`. DSN uitgelezen en als `EXPO_PUBLIC_SENTRY_DSN` in `.env` gezet
  (publieke client-waarde; `.env` is gitignored) + gedocumenteerd in `.env.example`.
- **Source-map-generatie bedraad.** `metro.config.js` draait nu via `getSentryExpoConfig`
  (genereert de maps + injecteert debug-ID's, met behoud van de OTEL-resolver-stub); de
  `@sentry/react-native`-config-plugin kreeg `{ organization, project, url }`.
- **DSN live als EAS-env.** `EXPO_PUBLIC_SENTRY_DSN` staat op `@evdns-team/huishoek`
  (production/preview/development) + lokaal in `.env` (gitignored) / `.env.example`.
- **Upload via de EAS↔Sentry-dashboard-integratie.** Sentry gekoppeld in de Expo-UI → EAS
  uploadt de maps zelf na de build en zette daarvoor `SENTRY_DISABLE_AUTO_UPLOAD=true` als
  EAS-env (de in-build plugin staat dus bewust stil; geen handmatige `SENTRY_AUTH_TOKEN` nodig).
  Het handmatige token-alternatief staat als fallback in de runbook.
- **Runbook** in [`docs/eas-setup.md`](docs/eas-setup.md) (Sentry-sectie: runtime-DSN +
  upload-route). De app-laag (`lib/monitoring.js` env-gated, `ErrorBoundary`) stond al uit
  plan 08. **Rest:** eerste cloud-build laten uploaden + een crash op toestel gesymboliceerd
  terugzien in Sentry.

---

**Keuken-herontwerp — recepten-catalogus, ingrediënt-invoer & "wie eet mee" (MLT-4, 2026-06-26).**
Toestelfeedback op de keuken-loop → drie losse PR's op volgorde.
- **PR A (#67) — ingrediënt-invoer.** `lib/quantity.js` kreeg `parseAmount` (strikte numerieke
  parser, NL-decimalen, `null` bij onzin/leeg/0; ratchet `quantity` 94,6%). De recept-editor
  ([`app/recipe/[id].js`](app/recipe/%5Bid%5D.js)) kreeg de boodschappen-catalogus-beeldtaal:
  `QtyControl` (−/+ mét typbaar decimaal-veld → grammen werkbaar), suggestierijen met productbeeld
  i.p.v. losse chips, en een labelknop "Toevoegen"/"Bijwerken" i.p.v. de onduidelijke "+".
- **PR B (#68) — catalogus + categorisering + receptpagina.** Migr. `0059` (`recipes.meal_moment`
  + `dish_type`, vrije-tekst-assen, géén CHECK — taxonomie leeft in JS; **live**, DB t/m `0059`).
  Nieuwe pure module [`lib/recipeCatalog.js`](lib/recipeCatalog.js) (`MEAL_MOMENTS`/`DISH_TYPES`/
  `filterRecipes`/`momentMeta`/`dishTypeMeta`; ratchet **98,6%**, in baseline/mutation-groups/
  tsconfig.check). De recepten-tab is nu een doorzoekbare catalogus (zoekbalk + filter-chips op
  eet-moment & gerecht + rijen met cover/categorie-badge). Eén route `/recipe/:id` met twee
  gezichten: **leespagina** (default — cover, badges, ingrediënten, bereiding, knoppen Bewerken/
  Inplannen) vs **editor** (`?edit=1` of het `new`-sentinel; editor kreeg categorie-chips). De
  scheiding aanmaken/inplannen/lezen die "openen = editor" miste. Iconen `edit`/`link` toegevoegd.
- **PR C (#69) — weekmenu "wie eet mee".** Migr. `0060` (`meal_plan_entries.eater_ids[]` +
  `extra_eaters`; **live**, DB t/m `0060`). Pure helpers `eaterCount`/`defaultServings` in
  [`lib/mealPlan.js`](lib/mealPlan.js) (unit-getest). De inplan-sheet kreeg een catalogus-stijl
  recept-picker (cover + categorie-badge i.p.v. platte chips) plus **"Wie eet mee?"**: leden
  aanvinken (default = heel huishouden) + een gasten-teller; porties vullen automatisch op het
  aantal eters maar ontkoppelen zodra je ze zelf bijstelt. De dagkaart toont mini-avatars van de
  eters + "+N gasten".
**Rest:** PR's A→B→C mergen (gestackt); device/web-rooktest van de hele loop.
