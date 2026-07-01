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

---

**2026-06-26 — Device-verificatiebatch (verse lokale dev-client) + backlog-hygiëne.**
De op het toestel geïnstalleerde standalone APK (handmatige Expo-install) bleek een **ingebakken,
verouderde** JS-bundle te serveren — niet de branch. Daarom een verse **lokale dev-client** gebouwd
(`npx expo run:android`, JDK17/SDK-env, `BUILD SUCCESSFUL in 10m`) en via `npm run device`
(`scripts/dev-device.sh`, metro `--localhost` + `adb reverse`) live cold-geladen op de moto, ingelogd
met het testaccount. Daarop smoke-getest tegen de live DB (`nayqbzekpdyigvfcroxd`):
- **MLT-4 (keuken-loop) — volledig bevestigd.** Recepten-catalogus mét zoekveld + cover-thumbnails;
  receptpagina (lezen) los van de editor (Bewerken/Inplannen); eet-moment- + soort-gerecht-chips en
  numerieke ingrediënt-invoer in de editor; inplan-sheet met recept-picker + "Wie eet mee?" — lid
  afvinken en een gast toevoegen bewegen "Samen N eter(s)" + de auto-porties correct mee; opslaan
  schreef `meal_plan_entries` weg (`eater_ids`/`extra_eaters`/`servings`, in de DB geverifieerd), de
  dagkaart toont recept + moment-badge + porties + eters-avatars, en verwijderen wist de rij (DB count 0).
- **TML-1 (tijdlijn) — bevestigd.** Compose → tekst-post → direct in de feed (avatar + "Erik · zojuist"
  + body, `timeline_posts`-rij in de DB) → detail → "Bericht verwijderen" (toast + DB count 0). Alleen
  de foto-upload-subtap resteert.
- **Render-confirms:** HUI-1 lege staat ("Nog geen huisdieren"); VTG-1 voertuig-detail rendert rijk
  (RDW-velden, km-stand, kosten "€110,11/maand" + prijs per km, "Delen via Samen") — de VTG-2/3/4-UI is
  dus al aanwezig terwijl §6 die nog op ⏳ zet (statusreconciliatie genoteerd in de VTG-1-rij).
- **Backlog-hygiëne:** SEC-3 (✅) naar het archief (nieuwe SEC-sectie); stale FND-1-afhankelijkheden
  gecorrigeerd (§1, TML-8, AAN-1 — subgroepen zijn af); §7-duplicaten (PLT-5/PLT-7) opgeruimd.
Testartefacten (een ingeplande maaltijd en een prikbord-bericht) zijn na verificatie weer verwijderd,
zodat het testaccount schoon blijft.

**Tweede batch (zelfde sessie):**
- **Live RLS-/unit-suite: 775 pass / 0 skip / 0 fail** tegen de live DB. Dat verifieert SEC-1
  (tenant-isolatie/owner-escalatie), SEC-2 (anon-revoke `run_recurring_expenses`), SEC-4
  (`households_update` owner-only), INF-1 (live-RLS) en de timeline-/invite-isolatie in één run —
  de suite maakt meerdere temp-users en assert cross-tenant-weigering (dekt de "2-account-rooktest").
- **BOO-11 (vaste boodschappen):** Catalogus rendert (zoekveld + filter-chips + per-product stepper);
  één-tik toevoegen zet een product op de lijst en `−` haalt het er weer af (schrijf-pad werkt).
- **Foto-upload (MLT-3 + TML-1-foto):** de gedeelde `photoPicker`/`offerImagePicker` opent de
  Android-systeem-foto-picker (scoped), selectie keert terug als preview, plaatsen uploadt naar de
  `timeline`-bucket + maakt een `timeline_photos`-rij (foto rendert in de feed); verwijderen
  cascadeert (post + foto uit de DB). Geen Activity-recreation-crash op een verse launch.
- **BOO-9 (barcode):** bevinding — de scan-trigger zit in de bon-flow (`purchase/[id].js`,
  foto-gebaseerd), niet als losse live-camera-scanner, en die bon-editor heeft zelf nog geen
  UI-entry-point (BOO-10). Niet schoon los te testen; genoteerd in de BOO-9-rij.
- **Backlog:** MLT-4, TML-1, BOO-11, MLT-3, SEC-1/2/4 en INF-1 → ✅ naar het archief (§6 van 72 → 65
  actieve rijen); VTG-2/3/4 gemarkeerd voor statusreconciliatie (UI al op toestel aanwezig).

**Resterende 🔧** vragen externe resources (geen losse device-tik): PLT-1/SEC-5 (notify-deploy),
BOO-7/INF-9 (Orq), INF-4 (Sentry-build + crash), INF-5 (EAS/Play-account), INF-3 (Maestro-kalibratie),
SEC-6/7 (sleutelhygiëne/CI), INF-11 (commit).

---

**2026-06-26 — Consolidatie-sweep (hergebruik) + device-smoketest.** Een sweep langs de codebase
legde de rode draad bloot: de gedeelde abstracties bestónden al, maar de adoptie was half af (telkens
gebruikte één vlaggenschip de gedeelde laag en hadden de andere domeinen een copy-paste-variant ernaast).
In vier assen opgetrokken naar één gedeelde laag, elk los gemerged met groene CI:
- **As 1 — foto-laag (#70).** plant/huisdier/voertuig leunen nu op de gedeelde, gecachte
  `useSignedUrl`/`signedUrl`/`uploadPhoto` ([`lib/photoStorage.js`](lib/photoStorage.js)) i.p.v. eigen
  kopieën. Bugfix: `useVehiclePhotoUrl` kreeg de ontbrekende `refreshKey`. `diaryPhotoPath`/`storagePath`
  ontdubbeld (petPhoto re-exporteert uit plantPhoto). Nieuw `deletePhotoObjects` + pure `collectPhotoPaths`
  ruimen recept-cover/voertuig-boekjefoto's op bij verwijderen (waren storage-wezen).
- **As 2 — entity-editors (#71/#72/#73).** Alle 8 editors (uitgave + recept/voertuig/vaste-last/
  plant/huisdier/taak) draaien nu op `useEntityForm` + de pure `formValidation`-regels i.p.v. een
  per-scherm gekopieerd errors/validate-blok. **ARCH-1 daarmee afgerond.** Eén bewuste verbetering:
  de voertuig-editor geeft nu óók de haptische foutpuls bij een lege naam (was niet zo).
- **As 4 — gedeelde UI (#74/#75).** [`lib/PhotoDetailSheet.js`](lib/PhotoDetailSheet.js) (plant/huisdier
  tijdlijn-detail) en [`lib/SearchField.js`](lib/SearchField.js) (catalogus + recepten) vervangen de
  gedupliceerde markup; domein-verschillen blijven via props (gedragsneutraal).
- **As 3 — datalaag, gescoped (#76).** [`lib/useCachedCollection.js`](lib/useCachedCollection.js) deelt
  het stale-while-revalidate-seed + sleutelwissel-blok van useExpenses/usePurchases/useMealPlan. Bewust
  níet de volledige rewrite op useCollection: hun venster-limiet/dubbele-tabel-realtime/RPC-CRUD en (bij
  het weekmenu) venster-gekeyde cache verschillen te veel — dat zou net-negatief zijn.

**Device-smoketest (moto, verse smoke-build van de PR's geïntegreerd op live main) — alles bevestigd:**
- **SearchField:** catalogus ("kaas" → Geraspte/Jonge/Pinda/Smeerkaas) én recepten ("pasta" → Pasta
  pesto) filteren correct; placeholder = toegankelijkheidslabel.
- **PhotoDetailSheet:** plant — sheet opent, foto laadt (bevestigt meteen de foto-laag-signed-URL),
  notitieveld, en Verwijderen toont de bevestig-dialog (plant-specifiek). **Huisdier — bevestigd**
  (zelfde component; huisdier verwijdert zonder dialog, eigen pad).
- **cached-collection:** Kosten laadt met saldo (`useExpenses`, household-keyed); Weekmenu laadt + de
  week-wissel werkt (`useMealPlan`, venster-keyed). `usePurchases` = identiek patroon.
Geen crashes/red-boxes; **geen fixes nodig.** Daarna #74–#77 gemerged → `main` in balans (0 open PR's,
alle branches volledig in main).

**Design-politoer o.b.v. screenshot-review (2026-06-26).** Per-scherm doorlichting van de rooktest-
screenshots → één getierd verbeterplan, uitgevoerd binnen het design-systeem (analyse +
uitvoeringsstatus in [`docs/design-review-2026-06-26.md`](docs/design-review-2026-06-26.md)). Gebouwd:
- **Module-explainer (cross-module).** Nieuwe `ModuleHelpButton` (`lib/ui.js`) + content in
  [`lib/moduleHelp.js`](lib/moduleHelp.js); in alle 12 module-headers. Vervangt de losse, cryptische
  kop-icoonknoppen; Kosten (Inzichten/Terugkerend), Planten/Huisdieren (tijdlijn) en Taken
  (klusbibliotheek) landen nu als gelabelde acties ín de uitleg-drawer.
- **Plant-tijdlijn.** Geen "Geen notitie"-tekst meer; "door wie" toegevoegd; **Lijst/Groot**-
  weergavetoggle (Reddit-stijl); notitie-only in Groot = leesbare tekstkaart i.p.v. beeld-placeholder;
  wit notitie-icoon op de groene vlek (`app/plant/[id].js`).
- **Tier 1/2.** Login-link wit+onderstreept (AA in beide thema's); middot-spatiëring Kosten; eigen
  `pinboard`-icoon voor Tijdlijn (los van de voeding-leaf); compacte lege weekmenu-dagen + sterkere
  vandaag-indicator (hele week in één blik); lege-staat dedupe (FAB verborgen bij lege lijst) op
  Huisdieren/Tijdlijn/Kosten/Voertuigen; geel kenteken-plaatje (`Badge` tone `plate`) + contrast-test;
  Verzorgingskaart in `Collapsible`; Kosten-widgettint van koel violet → warme bes.
- **Herontwerpen.** Recepten-toevoegen → ocher FAB (uniform); Catalogus "Eerder gekozen"-× →
  swipe-links (`SwipeRow`, a11y-actie behouden).
- **Verificatie.** `typecheck` + **780 unit-tests** + volledige ESLint groen; geen mutatie-geteste
  module geraakt. **Live op moto g72** bevestigd: explainer (Keuken+Kosten), weekmenu-compactie,
  widget-tint, middot, plant-tijdlijn (Groot/notitiekaart/door-wie), Verzorgingskaart-Collapsible.

**Catalogus: toevoegen-knop boven het toetsenbord (2026-06-27).** Bij een zoekterm zónder
resultaten duwde de grote lege-staat-illustratie de "voeg '<term>' toe"-knop achter het
toetsenbord. De knop is nu dé actie van die lege staat en staat bovenaan (direct onder de
zoekbalk), met de illustratie eronder; de footer-knop blijft alleen als er wél resultaten zijn.
Plus `keyboardDismissMode="on-drag"`. ([`app/catalog.js`](app/catalog.js); PR #80.)

**Jaar-heatmap scrollt naar vandaag (2026-06-27).** De jaar-heatmap in de Inzichten-module
(`YearActivity` → [`YearHeatmapView`](lib/YearHeatmapView.js)) opende altijd helemaal links op
1 januari, waardoor "vandaag" buiten beeld viel. Nu scrollt de horizontale `ScrollView` na de
eerste meting (`onLayout`) naar de week van vandaag, rechts uitgelijnd met wat aanloop ervóór.
Voor een afgelopen/toekomstig jaar (geen today-cel) blijft 'ie links staan. De rekenlaag zit als
pure, geteste helpers in [`lib/yearHeatmap.js`](lib/yearHeatmap.js) (`todayColumn` + `heatmapScrollX`,
geklemd op het geldige scroll-bereik) zodat de view dun blijft; +8 unit-tests (grenswaarden
col 0/−1, smalle viewport, rechts-uitlijning, eind-clamp). **Verificatie:** `npm test` 766 pass /
0 fail (23 skip), `typecheck` groen, mutatie-ratchet `yearHeatmap` **88,7 %** (≥ floor 87,8 %).

**Vandaag-widgetgrid scrollt weer op mobiel web (2026-06-27).** Op mobiel web kon je de
Vandaag-pagina niet scrollen zodra je vinger op een widget startte (op native werkte dit
wel). Oorzaak: elke widget zit in een RNGH-`GestureDetector` (long-press → vinger-drag, UX-25,
in béíde modi); op web zet `react-native-gesture-handler` `touch-action: none` op dat element
om pointer-events te ontvangen, waardoor de browser de pagina niet meer scrollt vanaf die
widget. Fix in [`lib/widgets/WidgetGrid.js`](lib/widgets/WidgetGrid.js): de vinger-drag is nu
`Platform`-gated op native (`DRAG_ENABLED`); op web rendert de cel zónder `GestureDetector`
(geen touch-action-blokkade → scroll + tik onaangetast) en loopt herschikken via de al-
bestaande toegankelijke controlebalk (vooruit/terug-pijlen in bewerkmodus). Eén gate, geldt
automatisch voor elke (ook toekomstige) widget; native gedrag ongewijzigd. **Trade-off:** ook
desktop-web verliest het muis-slepen (bewust, t.b.v. robuustheid; reorderen kan daar via de
pijlen). `WidgetGrid.js` is een React-component → buiten de mutatie-groepen. **Verificatie:**
`npm test` 766 pass / 0 fail, `typecheck` + ESLint groen. **Rest:** rooktest op mobiel web.

**ARCH-3 — module-gating in de datalaag (2026-06-27).** Data-hooks laden niet langer data van
een uitgezette module. Aanpak bewust schuldenvrij gehouden (n.a.v. de vraag "hoe houden we hier
geen tech debt aan over"): (1) **één bron van waarheid** — pure [`isModuleEnabled`](lib/modules.js)
(waar `effectiveModules` nu zelf op leunt) + één gedeelde React-primitive
[`useGatedHouseholdId`](lib/household.js) die de actieve household-id tot null afknijpt als de
module uit staat, waardoor élk laad-/realtime-pad vanzelf no-op't. Gebruikt door
[`useCollection`](lib/useCollection.js) (nieuwe `module`-optie, doorgewired naar groceries/
plants/pets/vehicles/pantry/recipes/shared_resources/recurring_expenses + de plant/pet-sub-
tabellen) én de custom hooks `useMealPlan`('maaltijden') en `useExpenses`('kosten') — géén
gekopieerde gate-logica. (2) **Bewuste uitzonderingen** voor cross-cutting tabellen
(tasks/products/tags/zones) i.p.v. stille omissie. (3) **Meta-test-wachter**
[`tests/moduleGating.test.js`](tests/moduleGating.test.js): faalt als een nieuwe `useCollection`-
tabel niet gegate is én niet op de uitzonderingslijst staat, en checkt dat elke gate naar een
bestaande toggle-bare module wijst. Default-pad (alles aan) is gedragsneutraal. **Verificatie:**
`npm test` 776 pass / 0 fail (+10: 7 units op `isModuleEnabled` + 3 meta-test), `typecheck` groen,
mutatie-ratchet `modules` **89,1 %** (≥ baseline 88,5 %). Backlog §6 → archief; architectuurcontract
([`docs/architectuur.md`](docs/architectuur.md)) bijgewerkt. **Rest:** rooktest op toestel (module
uitzetten → data/overzichten stoppen met laden).

**ARCH-2 — capability-interface voor overzichten (2026-06-27).** De laatste hook-naar-hook-
koppeling weg: [`useNotifications`](lib/useNotifications.js) importeerde `useTasks`/`useMealPlan`/
`usePantry` direct. Nieuw: capability-laag [`useReminderSources`](lib/useReminderSources.js) die de
bron-data ({tasks,meals,pantry}) voor de pure [`allReminders`](lib/notifications.js) samenbrengt;
useNotifications consumeert die capability i.p.v. de modules zelf te kennen. Spiegelt het
widget-registry-patroon ([`lib/widgets/registry.js`](lib/widgets/registry.js)), waar elke widget
zelf z'n module-data ophaalt. **Gedragsbehoudend** (zelfde data → identieke `allReminders`-input
en effect-deps) en leunt op de ARCH-3-gating, zodat een uitgezette module vanzelf niets bijdraagt.
Een nieuwe herinnering-bron toevoegen = een hook bijzetten in de capability + pure logica in
`notifications.js`, niet useNotifications aanpassen. Architectuurcontract guardrail #3 bijgewerkt
(intra-domein-compositie zoals `useRecurringExpenses`→`useExpenses` blijft toegestaan).
**Verificatie:** `npm test` 776 pass / 0 fail, `typecheck` + ESLint groen (rules-of-hooks oké).
Hiermee is de ARCH-fundament-reeks op ARCH-4 (i18n/ui-splitsing) na rond. **Rest:** rooktest op
toestel (notificaties blijven plannen zoals voorheen).

**BOO-13 — producteditor + "opslaan in catalogus?"-prompt (2026-06-27).** Eriks eigen wens
gebouwd. Migratie `0061` (`products.emoji`, nullable) **live aangebracht via MCP apply_migration**
(db push is kapot in dit project) + als repo-bestand vastgelegd; additief, is_member-RLS dekt 'm.
Producteditor [`app/product/edit.js`](app/product/edit.js) op de gedeelde entity-editor
([`useEntityForm`](lib/useEntityForm.js) + [`Editor`](lib/ui.js)-wrapper): naam, schap
([`CATEGORIES`](lib/groceryCatalog.js)), standaard-eenheid en **emoji** ([`EmojiPicker`](lib/ui.js),
opnieuw tikken = wissen → terugval op schap-emoji). [`useProducts`](lib/useProducts.js) kreeg
`updateProduct` (+ emoji-passthrough in `addProduct`/`ensureProduct`) dat naar de gedeelde
`products`-rij schrijft → **huishouden-breed**. Twee entry-points in de Catalogus: (1) tik op een
product → editor (een bundel-/zoek-item wordt eerst aangemaakt = "opslaan", dán bewerken, dus
de editor geldt voor álle catalogusproducten); (2) na een nieuw item toevoegen een niet-
opdringerige "even aankleden?"-prompt → editor. Een bewerkte emoji verschijnt in "Eerder gekozen"
([`resolveProductImage`](lib/productImage.js) leest `products.emoji`). **Verificatie:** `npm test`
776 pass / 0 fail, `typecheck` + ESLint groen; geen pure-logica-module geraakt (mutatie n.v.t.).
**Rest:** device-rooktest; **foto-upload** als afbeelding (bucket + `photoPicker`) bewust als
vervolg-increment — nu is het visueel een emoji.

**BOO-13 vervolg — productfoto's (2026-06-27).** De foto-upload uit "rest" afgemaakt, door het
bewezen foto-patroon te spiegelen i.p.v. een nieuw mechanisme te bouwen (volwassen/stabiel).
Migr. `0062` (`products.photo_path` + private bucket `product-images` met household-gescopete
RLS — exact het recepten/`0034`-patroon, `is_member` op het eerste pad-segment), **live via MCP**
+ repo-bestand. Hergebruikt de bestaande infra volledig: [`offerImagePicker`](lib/photoPicker.js)
(resizet al, PERF-7), [`uploadPhoto`](lib/photoStorage.js) en [`useSignedUrl`](lib/photoStorage.js)
(mét in-memory URL-cache → geen N+1 in lijsten). [`useProducts`](lib/useProducts.js) kreeg
`setProductPhoto` (uniek pad per upload → cache-bust, oude foto best-effort opgeruimd) en
`clearProductPhoto`. [`ProductImageView`](lib/ProductImageView.js) toont nu foto → asset → emoji →
schap-emoji (signed URL, alleen voor producten mét `photo_path`, dus geen onnodige calls). Editor
kreeg een foto-kiezer met preview + verwijderen; "Eerder gekozen" in de Catalogus toont de foto.
**Verificatie:** `npm test` 776 pass / 0 fail, `typecheck` + ESLint groen; geen pure-logica-module
geraakt. **Rest:** device-rooktest (upload + signed-URL-render op toestel) — security-RLS spiegelt
de live-geverifieerde recepten-bucket.

**Recepteneditor — ingrediënt-invoer herontworpen (2026-06-27).** Device-feedback (Erik) op de
MLT-4-editor: de hoeveelheid-`+` stond pal boven "+ Ingrediënt toevoegen" (twee concurrerende
`+`'jes → je drukt de verkeerde), de eenheden zaten in een krappe horizontale scroll (alleen
"stuk" + half "g" zichtbaar), en de toevoeg-actie was een fletse `soft`-knop terwijl de groene
unit-chip de aandacht trok. Herontworpen in [`app/recipe/[id].js`](app/recipe/%5Bid%5D.js) naar
een top-recepten-app-patroon: **progressieve onthulling** — hoeveelheid + eenheid + toevoegen
verschijnen pas zodra er een ingrediënt-naam staat (de stepper concurreert dus niet meer met de
toevoeg-knop); de **eenheden krijgen de volle breedte** als wrappende chips (allemaal zichtbaar)
met een eigen "Eenheid"-label; de **hoeveelheid** een eigen "Hoeveelheid"-label; en **Toevoegen**
is nu de duidelijke primary-CTA onderaan een composer-kaartje. **Verificatie:** `npm test` 776
pass / 0 fail, `typecheck` + ESLint groen. **Rest:** device-rooktest van de nieuwe flow. Hoort bij
de Keuken-UX (vgl. UXR-5).

**Grote werksessie — groep A (geen migratie) (2026-06-27).** Vier backlog-items in één PR:
- **TML-2 (berichten pinnen):** `orderTimeline` pinde al (getest); toegevoegd `useTimeline.setPinned`
  (`pinned_at`=nu/null) + pin/ontpin-knop op het detail + "Gepind"-indicator in feed/detail.
- **TML-5 (systeem-events-laag):** [`lib/activity.js`](lib/activity.js)-FORMATTERS verbreed
  (`expense_added`/`grocery_added`, generieke `subject`-grouping, back-compat `taskTitle`);
  [`useActivity`](lib/useActivity.js) → multi-bron fan-out (taken+uitgaven+boodschappen, RLS +
  realtime); toggle-bare "Activiteit"-`Collapsible` onder de tijdlijn-berichten. Mutatie-ratchet
  `activity` 87,5% (≥ baseline 86,5%).
- **UX-22 (sheets):** de avoidKeyboard+veeg/backdrop/kruisje-contract bleek al gedekt op álle
  invoer-sheets (gedeelde `BottomSheet`); de laatste losse overlay (kosten "terugkerend") omgezet
  naar `BottomSheet`. Resterende `Modal`s zijn bewuste full-screen presentaties.
- **BOO-10 (bon-entry-point):** nieuwe bonnenlijst [`app/purchases.js`](app/purchases.js) (winkel ·
  datum · #producten · totaal) → tik = `/purchase/<id>` (de tot nu onbereikbare Bewerken-tak);
  bereikbaar via de "Bonnen"-link op Boodschappen.

**Verificatie:** `npm test` 785 pass / 0 fail, `typecheck` + ESLint groen. TML-2/TML-5 → archief;
UX-22/BOO-10 → 🔧 (device-rooktest rest). **Rest:** device-rooktest van de vier flows.

**Grote werksessie — groep B (additieve migraties) (2026-06-27).**
- **VTG-3 (kenteken → RDW, mét verversen bij wijziging):** de RDW-lookup bestond al maar vulde
  alléén lege velden, dus een kenteken-wijziging liet de oude auto staan. Nu: bij een gewijzigd
  kenteken worden merk/model/type/**bouwjaar** (uit `firstRegistration`) + de verrijking (incl.
  **APK**) overschreven; op het openen van een bestaand voertuig (kenteken ongewijzigd) alleen
  lege velden — via een `appliedPlate`-baseline ([`app/vehicle/[id].js`](app/vehicle/%5Bid%5D.js)).
- **HUI-2 (eigen diersoort):** migr. `0063` (`pets.species_label`, additief, **live** via MCP);
  bij soort "Anders" een vrij "Anders, namelijk…"-veld; [`usePets.addPet`](lib/usePets.js) schrijft
  het label (alleen bij `type:'anders'`); pure [`speciesLabel(pet)`](lib/petCare.js) (eigen label
  wint) — unit-getest. Mutatie-ratchet `petCare` van 63,9%-baseline naar **68,0%** getild (een
  pre-existing dekkingsgat op `PET_TYPES` mee dichtgemaakt met een `deepEqual`-test).

**Verificatie:** `npm test` 787 pass / 0 fail, `typecheck` + ESLint groen, mutatie `petCare` 68%.
VTG-3/HUI-2 → 🔧. **Rest:** device-rooktest (kenteken wijzigen → velden verversen; "Anders"-soort).

**Grote werksessie — groep C (perf/security/fundament) (2026-06-27).**
- **INF-10 B5 (security):** `pg_trgm` uit het `public`-schema → `extensions` (migr. `0064`). De
  gin_trgm_ops-opclass + de catalogus-trgm-index verhuisden mee; `search_catalog` kreeg
  `extensions` in z'n `search_path` zodat de `%`-operator + `similarity()` resolven. **Live +
  geverifieerd:** pg_trgm in `extensions`, index intact, `search_catalog('melk')` → 5 treffers.
- **PERF-8 (perf):** de index (`0045`), het `usePurchases`-venster en de reminder-debounce
  bestonden al; toegevoegd: server-side koopfrequentie-RPC `product_purchase_dates` (migr.
  `0065`, SECURITY INVOKER, **live**+geverifieerd) → [`useProductFrequencies`](lib/useProducts.js)
  groepeert niet meer alle bonregels client-side.
- **ARCH-4 (fundament):** **bewust uitgesteld.** Een gedragsneutrale split van i18n.js (~600 keys)
  + ui.js (componenten), samen 1200+ regels, is niet hier runtime te verifiëren (een gemiste
  key/export breekt pas op toestel/web). Past niet bij de stabiliteits-prioriteit zonder
  draaiende app; hoort in een dedicated sessie mét rooktest + key-set-guard-test (de
  `registerDict()`-naad staat klaar).

**Verificatie:** `npm test` 787 pass / 0 fail, `typecheck` + ESLint groen; beide migraties live
geverifieerd via SQL. INF-10 B5 → ✅ (in INF-10-rij); PERF-8 → 🔧. **Rest:** device-rooktest van de
"misschien weer nodig"-suggesties; ARCH-4 in een aparte sessie.

**Losse eindjes uit de werksessie afgewerkt (2026-06-27).** Systematisch langs de restlijst
(device-rooktests bewust overgeslagen):
- **TML-5 uitgebreid** van 3 → 6 bronnen: plant/huisdier/voertuig-"toegevoegd"-events erbij
  ([`activity.js`](lib/activity.js) `addedFormatter` + [`useActivity`](lib/useActivity.js)). Perf-veilig:
  één `useRealtimeReload` die de realtime-hub bundelt (INF-8). Mutatie `activity` 87,2%.
- **VTG-2 + VTG-4 statusreconciliatie:** code bevestigt dat kosten/historie (`vehicleCosts`/
  `vehicle_log`) en delen (`resource_id` + prijs/km) gebouwd zijn → §6-rijen van ⏳ naar 🔧.
- **PERF-8 `useTasksForReminders`:** bewust niet gebouwd — de debounce + gedeelde `useCollection`-
  cache dekken de hookstorm al; een aparte hook zou logica dupliceren.
- **petCare-dekking:** boven baseline (68% ≥ 63,9%) → geaccepteerd; resterende survivors zijn
  pre-existing template-data, geen blokker.
- **Niet door mij oplosbaar (genoteerd):** INF-10 B6 (leaked-password = dashboard-toggle, jouw
  account); de stop-hook-fix overleeft de per-turn `~/.claude`-reset niet (permanent = buiten de
  sessie); `supabase db push` blijft kapot (migraties via MCP + repo-spiegel).

**Verificatie:** `npm test` 788 pass / 0 fail, `typecheck` + ESLint groen. **Enig resterend
bouwwerk:** ARCH-4 (bewust uitgesteld). De rest is af of bewust afgesloten; alleen device-
rooktests blijven (jouw kant).

**Multi-agent code review + opvolging (2026-06-27).** Zeven parallelle review-agents over de hele
codebase ([`docs/reviews/2026-06-27-multi-agent-review.md`](docs/reviews/2026-06-27-multi-agent-review.md));
de kernbevindingen meteen verwerkt en gemerged (PR #94/#95):
- **Security — RLS `0066` live** (`module_insert_creator_check`): de module-insert-policy dwingt nu
  `creator = auth.uid()` af (tasks/groceries/plants/pets/vehicles/shared_resources/timeline_posts),
  `enable_module_rls` bijgewerkt voor nieuwe tabellen, + `default auth.uid()` op de creator-kolommen als
  vangnet. Dicht attributie-spoofing (een gespoofte `created_by` voedde `can_view`). Alle 7 client-
  insertpaden zetten de creator al op self → geen create-flow breekt. Live geverifieerd (`pg_policies`).
- **Type-laag echt strikt:** `strictNullChecks` stond door `strict:false` feitelijk uit in
  `tsconfig.check.json` — nu expliciet aan; ~26 opgedoken null-signalen type-only gedicht (JSDoc/`@type`) in
  8 modules (buyFrequency/decisions/offDelta/groceryCatalog/plantTimeline/vehicleTimeline/yearHeatmap/notify).
- **Realtime-hygiëne:** `realtimeHub.teardownAll()` + aangeroepen in `auth.signOut()` (geen events van het
  vorige account na re-login op één toestel); `useCollection.create`-guard tegen een `user.id`-deref in een
  auth-race; `useExpenses.deleteExpense` optimistisch + rollback (geen herverschijning na de pending-undo).
- **ARCH-1 8/9:** `app/purchase/[id].js` incrementeel naar `useEntityForm`; `app/resource/[id].js` blijft
  bewust eigen (kalender/reserverings-scherm, geen field-form).
- **Test-versterking (alleen tests):** activity deterministische id-tie-break, groceryCount telt álle open
  regels, contrast/vehicleCosts/recurringExpense/petCare exacte grenzen; een latente ratchet-daling in
  **vehicleSharing** (timeout-geïnflateerde baseline 41/52) echt gedicht met NaN-pad-tests → 84,6% (44/52).
- **Docs:** VERIFICATIE.md (DB 0036→0066, `apply_migration` i.p.v. kapotte `db push`), architectuur.md
  (ARCH-1 + GROUPS-pad), CLAUDE.md (GROUPS-pad), §6 729↔775 geharmoniseerd.

**Verificatie:** `npm test` 793 pass / 0 fail / 23 skip, `typecheck` + ESLint groen, mutatie-ratchet groen,
RLS `0066` live-geverifieerd (`list_migrations` + `pg_policies`). **Bewust open (jouw kant):** CORS-allowlist
op scan-receipt, leaked-password-toggle, en de uitgestelde feature-hook P2's (useNotifications-herplan,
useActivity-gating, useCollection-rollback).

---

**Toestelfeedback-ronde Boodschappen + losse wensen (2026-06-28).** Naar aanleiding van
gebruik op toestel een batch UX-fixes en backlog-uitbreidingen; branch
`claude/boodschappen-module-feedback-tysgq4`.

- **Boodschappen (BOO-14/15/16/17)** — `app/(tabs)/boodschappen.js`:
  - **BOO-15:** tik op een zoekresultaat (`pickCatalog`) voegt +1 toe en `clearAndRefocus()`
    leegt het veld + geeft de focus terug aan de balk (sluit de dropdown, balk had al
    `blurOnSubmit={false}`); submit/`addCustom` idem. De rij-`Stepper` blijft voor aantallen.
  - **BOO-16:** wis-knop (`close`-icoon) in de zoekbalk, zichtbaar zodra er tekst staat → één
    tik leegt en houdt focus. Nieuwe i18n-key `common.clear`.
  - **BOO-17:** afvinken geeft `haptics.success()` + korte bevestigingstoast
    (`groceries.checkedFeedback`, alleen bij áfvinken); verwijderen `haptics.tapLight()` náást
    de undo-toast — afvinken ≠ verwijderen.
  - **BOO-14 (eerste stap):** "Catalogus openen"-knop + losse bonnen-link samengevoegd tot één
    compacte rij; rest van de herindeling staat klaar voor UXR-9.
- **INF-13** — `lib/auth.js` `signUp` geeft nu `emailRedirectTo: WEB_BASE_URL` (`huishoek.app`,
  single-source uit `invites.js`) mee. **Open (jouw Supabase-dashboard):** Site URL +
  redirect-allowlist op `https://huishoek.app`.
- **FND-5** — statuscorrectie: multi-huishouden was al gebouwd (`household_members` many-to-many,
  `useHousehold` laadt alle huishoudens + switcher in `huishouden.js`). Toegevoegd: feedback-toast
  bij wisselen (`household.switched`) + no-op-guard op het actieve huishouden.
- **PLT-10 (camera-deel)** — `lib/photoPicker.js` `offerImagePicker` laat de camera-rij weg op web
  (onbetrouwbaar via `expo-image-picker`) en stuurt op `kind` i.p.v. een vaste index. `SwipeRow`
  was al web-geguard; de swipe-crash zit vermoedelijk in `BottomSheet`'s gesture-laag — bewust niet
  blind gewijzigd (app-breed, web-run nodig).
- **UXR-9 / SCH-4** — teardown Schoonmaak klaargezet: `docs/plans/20-schoonmaak-teardown.md`
  (huidige stand code-geverifieerd, SCH-4-wensen, open beslissingen) + geregistreerd in de plan-index.
- **PLA-10** — verkend: care-taken zijn al bewerkbaar via de taak-editor; per-plant grip op één plek
  + pauzeren is ontwerp-werk → UXR-6.
- **Backlog §6** bijgewerkt: BOO-15/16/17 + FND-5 → 🔧, BOO-14/INF-13/PLT-10 → ◐, plus nieuwe rijen
  FND-5/SCH-4/PLA-10/PLT-10/INF-13/UXR-9 en de eerdere BOO-14..17 (deze branch voegde §6-rijen toe).

**Verificatie:** `npm test` 793 pass / 0 fail / 23 skip, `typecheck` groen, mutatie-ratchet groen
(alleen `i18n` gewijzigd: 73,5%, geen daling). UI-wijzigingen zijn **niet op toestel/web** geverifieerd
(geen device/web in deze omgeving) → de gebouwde items staan op 🔧/◐ met "device-rooktest" als rest.

---

**Drie-sporen-werksessie (2026-06-29).** Schoonmaak (UXR-9/SCH-4), Boodschappen-UI (BOO-14/UX-42)
en Zorg (PLA-10/UXR-6) in één sessie, met de definition-of-done bewaakt.

- **SCH-4 (Schoonmaak) — gebouwd.** Pure [`buildCustomSchedule`](lib/cleaningTemplates.js) (deelt de
  kern `buildSchedule` met `planTemplate`) → een **zelf samengesteld rooster** (zones + cadans) naast
  de vaste sjablonen, in de opstel-sheet van [`schoonmaak.js`](app/(tabs)/schoonmaak.js) met een
  modus-toggle. Twee duidelijke ingangen: per-zone "Taak toevoegen" (losse taak) vs. "Rooster
  opstellen" (heel schema), plus "Rooster bekijken" → **deeplink** `/(tabs)/taken?cleaning=1&scope=week`.
  Nieuwe zone-as in [`applyTaskFilters`](lib/agenda.js) (`cleaningOnly`/`zoneId`) + `activeFilterCount`,
  route-param-parsing en een "Schoonmaak"-filtersectie in [`taken.js`](app/(tabs)/taken.js).
- **BOO-14 (Boodschappen) — stap 2.** "Misschien weer nodig" is nu **inklapbaar** (standaard
  ingeklapt, kop toont het aantal, edge-to-edge kaarten-rail blijft) → minder chrome boven de lijst.
- **UX-42 (kop opschonen) — gecodificeerd.** Inventarisatie bevestigt dat álle tab-kop-`right`-slots
  nu alleen de `ModuleHelpButton` dragen (secundaire navigatie als gelabelde `actions` in de drawer);
  het kop-contract staat nu expliciet in [`DESIGN.md`](DESIGN.md). Open ontwerpvraag (drawer-
  ontdekbaarheid) blijft device/UXR-werk.
- **PLA-10 (Zorg) — eerste stap + statuscorrectie.** Verzorgingstaken waren vanaf het detail **niet
  te openen** (geen `onPress` → `taskHref` routeerde terug naar ditzélfde detail = dode tik). Nu openen
  de taakrijen de taak-editor op [`app/plant/[id].js`](app/plant/%5Bid%5D.js) én
  [`app/pet/[id].js`](app/pet/%5Bid%5D.js) (parity); de plant kreeg "Taak toevoegen" → `/task/new?plant=<id>`
  met een `plant`-passthrough in de [taak-editor](app/task/%5Bid%5D.js) (`plant_id` in de payload).
- **Teardowns klaargezet:** [plan 21](docs/plans/21-zorg-teardown.md) (UXR-6, Zorg) toegevoegd en in de
  plan-index opgenomen; plan 20 (UXR-9) is met deze sessie uitgevoerd.

**Verificatie:** `npm test` **802 pass / 0 fail / 23 skip**; `typecheck` groen; mutatie-ratchet **boven
baseline** — `agenda` 92,5% (baseline 89,8%), `cleaningTemplates` 76,0% (baseline 73,3%). Nieuwe units in
`tests/agenda.test.js` (zone/cleaning-as) en `tests/cleaningTemplates.test.js` (`buildCustomSchedule`).
UI niet op toestel/web geverifieerd (geen device in deze omgeving) → gebouwde items op 🔧 met
"device-rooktest" als rest.

**Device-rooktest drie sporen + onafhankelijke UX-review (2026-06-30).** De vorige sessie liet de drie
sporen op 🔧/◐ met "device-rooktest" als rest. Op de moto (live dev-client, branch `main`, scheme-deeplinks
+ uiautomator-driving) de hele batch doorlopen:

- **SCH-4 (Schoonmaak) ✅ → archief.** "Rooster opstellen" → modus **Zelf samenstellen**: zone Toilet +
  cadans → live preview update (Elke week → Elke maand); "Opzetten" → de taak verschijnt in de Toilet-zone
  ("Vandaag · Elke maand"). "Rooster bekijken" → deeplink opent **Taken** met Week-scope + actief
  "Schoonmaak ×"-filter, toont enkel schoonmaaktaken. Testdata teruggedraaid (swipe-delete + undo-toast).
- **PLA-10 (Planten) — plant-zijde bevestigd (blijft 🔧).** Een verzorgingstaak op het plant-detail opent nu
  de taak-editor (de dode tik is weg); "+ Taak toevoegen" → opgeslagen taak verschijnt mét plant-koppeling
  onder Verzorgingstaken. Huisdier-parity ongetest (geen huisdier in testhuishouden). Plan-21-beslissingen
  blijven open. Testtaak verwijderd.
- **BOO-15/16/17 (Boodschappen) ✅ → archief.** Zoekresultaat kiezen → +1 + veld leeg + focus behouden
  (BOO-15); wis-knop (×) idem (BOO-16); afvinken = groene banner "Alles afgevinkt! 🎉" vs. verwijderen =
  donkere undo-toast — visueel distinct (BOO-17). Testitem opgeruimd.
- **BOO-14 — stap 1 bevestigd (blijft ◐).** Compacte "Catalogus \| Bonnen"-rij staat; stap 2 (inklapbare
  "Misschien weer nodig") is code-bevestigd maar niet op toestel reproduceerbaar — de sectie is data-gated
  op aankoopfrequentie (`dueScore ≥ 1`), die het testhuishouden niet heeft. Bewust géén aankoophistorie op
  de live gedeelde DB gefabriceerd.

**Onafhankelijke UX-review.** Een UX Design Review-subagent (los van de rooktest-sessie) beoordeelde de
screenshots tegen `DESIGN.md` + de eerdere design-review → [`docs/ux-review-rooktest-2026-06-30.md`](docs/ux-review-rooktest-2026-06-30.md)
(14 punten, geprioriteerd). Drie "hoog": taak-editor nieuw-modus heeft twee bevestigplekken (kop-`Bewaar`
+ onderknop — DESIGN.md-schending), labelloze rode bulk-prullenbak in de Afgevinkt-sectie (destructief, geen
undo/label), en de catalogus-dropdown-stepper-op-0 (toevoeg-actie niet ontdekbaar). Opvolging als **UXR-10**
in §6; SCH-4/BOO-15/16/17 → ✅/archief, PLA-10/BOO-14-noten bijgewerkt. Geen code gewijzigd deze sessie
(verificatie/doc-reconciliatie).

**UXR-10-opvolging — de drie "hoog" geverifieerd + midden-punten gebouwd (2026-06-30, vervolg).** Op
verzoek de review-punten opgepakt. **De drie "hoog" bleken grotendeels screenshot-artefacten** (tegen de
code gelegd): (1) "twee bevestigplekken" = het bewuste **UX-39**-patroon (onderknop in álle editors/beide
modi). **Erik wil de onderknop houden (fijne UX)** → `DESIGN.md` verzoend met UX-39 i.p.v. de code te
slopen. (2) bulk-prullenbak heeft al `accessibilityLabel` + undo-toast (`onClearChecked`). (3) catalogus-
dropdown-rij is al tap-to-add (`pickCatalog`). **Midden-punten wél gebouwd + device-bevestigd (moto):**
schoonmaak-footer "Rooster opstellen" ocher→**forest** (gelijk aan de sheet-"Opzetten"); "Rooster bekijken"
→ **"In takenlijst tonen"**; herhaal-blok jargon "(dan vervalt het wekeninterval)" → **"Op vaste dagen?"**
+ een **plain-language summary-kaart** ("Elke week" / live "Wekelijks: za", auto-doorrol als stille helper
eronder) — geïnspireerd op Google/Apple Calendar (plain-language bevestiging + progressive disclosure). Het
either/or-model blijft bewust (de recurrence-engine negeert het interval bij weekdagen, dus interval+dagen
combineren kan de engine niet — de editor klopt dus). De review-punten #6 (weekdag/interval conditioneel) en
#7 ("Voor wie" per modus) bleken al correct geïmplementeerd (`showInterval`, value-dependent
`VisibilityPicker`). **Verificatie:** typecheck + lint (0 errors) + `npm test` **802 pass / 0 fail / 23
skip**; geen pure-logica geraakt (i18n string-only, `StringLiteral` uit de ratchet) → geen ratchet-run
nodig. **Rest in UXR-10:** dubbele taaknamen (#8) + lage punten.

**UXR-10 volledig afgerond — resterende punten gebouwd (2026-06-30, vervolg).** Op verzoek alle 14
review-punten dichtgezet → **UXR-10 ✅ → archief**. Nieuw gebouwd + device-bevestigd (moto):
- **#8 dubbele taaknamen (de échte flow-bug).** `buildSchedule` ([`cleaningTemplates.js`](lib/cleaningTemplates.js))
  dedupte alleen zónes, maar maakte een taak voor élke room → een rooster bovenop bestaande taken gaf
  dúbbele ("Badkamer schoonmaken" ×2). Nu een `existingTasks`-optie: taken worden gededupt op (zone+titel,
  genormaliseerd) tegen de bestaande open taken; [`schoonmaak.js`](app/(tabs)/schoonmaak.js) voedt die uit
  `tasks`+`zones`. +3 units, ratchet `cleaningTemplates` **76,3%** (≥ baseline 76,0%). Sluit-de-lus: als
  álles al bestaat → "Deze taken staan er al"-melding + "Opzetten" disabled (geen stille no-op).
- **#9 dropdown-scrim** — de zoek-dropdown op Boodschappen ligt nu op een subtiele scrim i.p.v. de
  lege-staat-illustratie er onscherp doorheen.
- **#10 leaderboard 0** — `FairnessBars` toont **"nog niets"** i.p.v. een kale "0" naast een lege balk
  (die als laad-skeleton las).
- **Non-issues (code-geverifieerd):** #6 (`showInterval` verbergt het interval al bij vaste dagen), #7
  (value-dependent `VisibilityPicker`), #11 (touch-targets al 48dp via `touchTarget`/hitSlop).
- **Bewust gelaten (laag, met rationale):** #12 "Bonnen" (de `receipt`-icon disambigueert; "Kassabonnen"
  kapt af in de halve-breedte-knop), #13 sectie-emoji-grootte (bewuste DESIGN.md-keuze: emoji als talvrij
  icoon).
**Verificatie:** typecheck + lint (0 errors) + `npm test` **805 pass / 0 fail / 23 skip**; ratchet
`cleaningTemplates` 76,3%. Gewijzigd: `cleaningTemplates.js`, `FairnessBars.js`, `schoonmaak.js`,
`boodschappen.js`, `i18n.js`, `DESIGN.md` + `tests/cleaningTemplates.test.js`.

---

**2026-06-30 — Sentry-triage: eerste echte productiecrash gevonden + gefixt (INF-4 / PLT-10).**
Sentry (INF-4) bleek **live in productie** en had zijn eerste echte fout gevangen — **HUISHOEK-1**:
`findNodeHandle is not supported on web`, op `huishoek.app/welcome` (Chrome iOS), `release Huishoek@1.0.0`,
env `production`, mét onze `context: render`-tag uit de `ErrorBoundary`. Oorzaak = onze eigen code: de
gedeelde `DialogHost` ([`lib/dialog.js`](lib/dialog.js)) zette bij het openen de screenreader-focus via
`findNodeHandle(primaryRef.current)` — react-native-web ondersteunt dat niet (gooit), dus **élke**
`dialog.alert/confirm/menu` crashte op web-mobile (de welcome-signup-alert was de trigger). **Fix:** de
focus-`useEffect` slaat web over (`Platform.OS === 'web'`); `setAccessibilityFocus` doet daar toch niets,
native gedrag ongewijzigd. Dit is de **derde** web-mobile-crash onder PLT-10 (na camera-guard + de nog open
`BottomSheet`-gesture). Tevens de dangling **ruisfilter** in [`lib/monitoring.js`](lib/monitoring.js) geland
(`ignoreErrors: /\.at is not a function/` — scanbots/pre-ES2022-engines op de web-build). Docs:
`notify-setup.md` stap 1 gecorrigeerd (`supabase db push` is kapot; migraties al live). **Verificatie:**
`npm test` **805 pass / 0 fail / 23 skip** + `npx eslint .` **0 errors**. `dialog.js`/`monitoring.js` vallen
niet onder de mutatie-/type-ratchet (React-schil). Commit-ref `Fixes HUISHOEK-1` (auto-close bij merge).
