# Multidimensionale app-review — Huishoek

**Datum:** 2026-07-02 · **Scope:** hele app (lib/*.js pure logica + React-schil, schermen in
app/, RLS/migraties, edge functions, test/CI) · **Methode:** multi-agent workflow — 9 dimensie-
reviewers, elk met eigen onderwerp en bewijs-eis (bestand + regel + citaat), plus roadmap-context.
Bevindingen zouden daarna adversarieel geverifieerd worden (3-lens-panel bij high/critical).

> ✅ **Aangevuld op 2026-07-04:** de drie ontbrekende dimensies (Security, Datamodel &
> database, Platform & tooling) zijn alsnog gedraaid — zie het **addendum onderaan** dit
> rapport, inclusief de live Supabase-advisor-scan. Oorspronkelijke kanttekening:
>
> ⚠️ **Onvolledige run — sessielimiet geraakt.** Van de ~76 geplande agents kwamen er 8 klaar
> vóór de 5-uurs-limiet toesloeg. **Compleet:** 6 dimensies (Performance, Correctheid,
> Gebruiksvriendelijkheid, Design & toegankelijkheid, Teststrategie, Architectuur) + de
> roadmap-context. **Niet gedraaid:** Security, Datamodel & database, Platform & tooling
> (die drie review-agents faalden op de limiet). **Verificatie:** de adversariële panels draaiden
> grotendeels niet (1 van ~50 verdicts kwam terug). Ter compensatie zijn de zwaarste bevindingen
> hieronder **handmatig tegen de code geverifieerd** (aangemerkt met ✓); die verificatie
> corrigeerde er al één (Perf-2 van medium → low). Behandel niet-geverifieerde items als sterk
> onderbouwd maar nog niet dubbel-gecheckt.

**Severity:** `high` fout gedrag/groot risico in gangbaar pad · `medium` aantoonbaar probleem,
beperkte impact of zeldzamer pad · `low` polish met duidelijke waarde. **Effort:** S < ½ dag ·
M ½–2 dagen · L > 2 dagen.

---

## Samenvatting per dimensie

| Dimensie | Status | high | medium | low | Kernoordeel |
|---|---|:--:|:--:|:--:|---|
| Performance | ✅ | 1 | 5 | 2 | Volwassen basis; grootste lek = refetch-storm op realtime-events |
| Correctheid | ✅ | 1 | 4 | 3 | Pure kern solide; bugs zitten in de SWR-hooklaag (foutpaden + races) |
| Gebruiksvriendelijkheid | ✅ | 2 | 6 | 2 | Sterk fundament; gaten in foutpaden + ontbrekende wachtwoord-reset |
| Design & toegankelijkheid | ✅ | 2 | 3 | 2 | Echt design-systeem; dynamische/dark-mode kleurcontrasten zakken onder AA |
| Teststrategie | ✅ | 2 | 4 | 3 | Pure laag voorbeeldig; hele hook/UI-laag + halve RLS ongetest |
| Architectuur & simpliciteit | ✅ | 0 | 2 | 4 | Gezond, contract wordt nageleefd; pet/plant-duplicatie is de schuld |
| Security | ✅ 2026-07-04 | 0 | 1 | 2 | RLS-contract strak nageleefd; restschuld: 0066-attributie via UPDATE te omzeilen |
| Datamodel & database | ✅ 2026-07-04 | 1 | 6 | 4 | Gedisciplineerd schema; 3 half-doorgevoerde patronen (replica identity, ON DELETE, 0066) |
| Platform & tooling | ✅ 2026-07-04 | 0 | 5 | 7 | Tooling volwassen; gaten in push-lifecycle en de laatste meters van de release-keten |

**Rode draad:** de app staat er verrassend goed voor — een écht design-systeem, een bewaakte
drielagen-architectuur, 863 unit-tests met mutatie-ratchet, gedeelde realtime-hub en SWR-cache. De
zwaktes clusteren rond **foutpaden** (een mislukte load ziet eruit als "leeg"), **realtime-
efficiëntie** (elke hook-instantie refetcht apart), **dynamisch kleurcontrast** en de
**ongeteste React-laag**. Vrijwel elke fix is klein en het gereedschap ligt al in de repo.

---

## Geconsolideerd verbeterplan (prioriteit over dimensies heen)

### P0 — Foutpaden: een mislukte load mag nooit als "leeg" of "quitte" verschijnen ✓

Dit is de belangrijkste bevinding en komt in drie dimensies terug met dezelfde grondoorzaak.

- **Grondoorzaak (✓ geverifieerd):** `lib/db.js` `run()` geeft bij élke fout stil de `fallback`
  (meestal `[]`) terug met alleen een `console.warn` — een netwerkfout is niet te onderscheiden
  van "geen data". Vijf SWR-hooks schrijven die lege lijst vervolgens door naar state én de
  in-memory cache: `useExpenses.js:38`, `usePurchases.js:32`, `useMealPlan.js:38`,
  `useTaskCompletions.js:36`, `useTimeline.js:46`. `lib/useCollection.js:79-86` dóét het al goed
  (houdt de bestaande lijst vast, exposeert `error`) — maar de wrapper-hooks lussen die `error`
  niet door.
- **Zichtbaar gevolg:** Kosten offline openen → `computeBalances([])` toont onterecht
  "iedereen staat quitte" (foute financiële info, geen melding). Boodschappen/voorraad/tijdlijn
  tonen een vrolijke lege staat mét "voeg je eerste item toe"-knop terwijl de data er is. Omdat de
  lege lijst óók in de cache belandt, blijft elk herbezocht tabblad leeg tot een geslaagde fetch.
- **Fix (S–M):** laat `run()` een fout signaleren (`{ data, error }` of sentinel) óf spiegel het
  try/catch van `useCollection.load` in de vijf hooks; forward `error` uit álle wrapper-hooks
  (`useGroceries`, `usePlants`, `usePets`, `useVehicles`, `useResources`, `useExpenses`,
  `useTimeline`) en hergebruik het bestaande Banner+retry-patroon van `vandaag.js:246` in de
  gedeelde lijstrendering. Het patroon bestaat al — alleen breder uitrollen.
  *(Correctheid-high + UX-high, zelfde root.)*

### P1 — Realtime refetch-storm dempen

- **Perf-high (`useCollection.js:57`):** hooks met een join (`useTasks` select `'*, zone:zones(...)'`
  ✓) staan buiten het incrementele-patch-pad, dus elk realtime-event doet een volledige reload. De
  hub fant naar álle callbacks en `freezeOnBlur` houdt bezochte tabs gemount → **één taak afvinken
  = ~7 parallelle full-table refetches van `tasks` + completions/activity, samen 10–15 queries.**
  *Fix (M):* in-flight-dedupe per (tabel, huishouden) in `dataCache`, óf `tasks` plat maken en de
  zone client-side joinen uit de al-geladen `zones`-collectie zodat het patch-pad de refetch
  vervangt.
- **Perf-medium (`useActivity.js:48`):** herlaadt alle 6 bron-queries bij een event op één van 6
  tabellen. *Fix (S):* alleen de bron van `payload.table` herladen, of de debounce verhogen.
- **Perf-medium (`household.js:303`):** ongememoiseerde context-value + `effectiveModules` per
  render laten elke consumer app-breed her-renderen. *Fix (S):* `useMemo` op de echte deps.
- **Perf-medium (`useNotifications.js:97`):** `cancelAll` + herplan tot 60 notificaties bij elk
  data-event door array-identiteit in de deps. *Fix (M):* herplan alleen bij inhoudelijke wijziging
  (hash van `allReminders()`).

### P2 — Dark-mode & dynamisch kleurcontrast onder AA ✓

`lib/contrast.js` bestaat maar wordt **nergens op runtime** gebruikt — alleen in tests, die juist
de statische tokens dekken en niet de dynamische combinaties.

- **Design-high (`ui.js:95`, ✓ palet bevestigd):** FAB/accent-knop tekent `forest` op `ocher`; in
  dark mode is dat **2.94:1** — onder AA én onder de 3:1-UI-vloer. De FAB is de primaire aanmaak-
  actie op ~10 schermen. *Fix (S):* per-thema token `onAccent` (donker: `ink`/donkerder groen) +
  het paar toevoegen aan `contrast.test.js`.
- **Design-high (`ui.js:475`):** actieve Chip zet witte tekst op dynamische tag-/categoriekleuren
  (wit op `#F3A712` = 2.03:1; 6 van 7 categoriekleuren halen in dark mode geen 3:1). *Fix (M):*
  kies de chip-voorgrond op runtime met `contrastRatio` — exact wat `vehicleAppearance.isLightColor`
  al doet voor CarGlyph.
- **Design-medium (`welcome.js:61`, `PendingInviteBanner.js`):** `ocherSoft` als tekst op `forest`
  is in dark mode 2.24:1. *Fix (S):* `onDark` gebruiken.
- **Design-medium:** tabbar capt fontschaling (vaste hoogte 56 + `adjustsFontSizeToFit`) — precies
  de "oma op grootste tekst"-doelgroep uit DESIGN.md. + handvol tikdoelen < 44pt terwijl
  `hitSlopFor()` bestaat.

### P3 — Testdekking: dicht de gaten die CI groen laten terwijl er iets lekt

- **Tests-high (`rls.integration.test.js:96`):** RLS-tests dekken **niet** `pets`, `vehicles`,
  `groceries`, `pet_log`, `vehicle_log` — terwijl migratie 0066 juist de gedeelde RLS-helper wees.
  *Fix (M):* per tabel één huisgenoot/buitenstaander-scenario naar bestaand sjabloon (regels 346-388).
- **Tests-medium (`ci.yml:52`, ✓):** CI injecteert de live service-role-key in `npm test` op élke
  push/PR, zónder concurrency-groep — in directe tegenspraak met de rationale van `rls-check.yml`.
  *Fix (S):* secrets uit `ci.yml` halen; RLS hoort exclusief bij `rls-check.yml`.
- **Tests-medium (`rls-check.yml:14`):** RLS draait alleen `workflow_dispatch` → een policy-
  versoepelende migratie merged met groene CI. *Fix (S):* trigger op `push: paths: supabase/migrations/**`.
- **Tests-high (`useCollection.js:134`):** de complete hook/UI-laag (~15.000 regels), incl. de
  optimistic-rollback-ruggengraat, heeft nul geautomatiseerde tests. *Fix (L, of S per stap):*
  extraheer de reducer-kernen (rollback-beslissing, cache-seed) naar pure functies die onder de
  bestaande ratchet vallen.
- **Tests-medium:** `secureStorage.js`-adapter (token-chunking, baseline 52%) en `openFoodFacts.js`
  (pure parser, geen test/GROUPS-regel — DoD-regel 2 stil geschonden) ontbreken. *Fix (S elk).*

### P4 — Gerichte correctheid-fixes (kleine, aantoonbare bugs)

- **Race (`useGroceries.js:61`):** check-then-act op een niet-optimistische create → snel 2× "+"
  maakt dubbele regels i.p.v. samen te voegen. *Fix (M):* atomaire upsert-RPC (of client-side
  serialiseren per genormaliseerde naam).
- **Race (`usePantry.js:44`):** `restockFromPurchase` schrijft absolute waarden vanuit één snapshot
  via `Promise.all` → bon met 2× hetzelfde product verliest hoeveelheid (voorraad +3 i.p.v. +5).
  *Fix (S):* aggregeer per key vóór wegschrijven, of increment-RPC.
- **Stale-response (`useCollection.js:66`):** geen generatie-teller → trage fetch van huishouden A
  overschrijft lijst van B na wissel. `useCatalog` heeft het patroon al. *Fix (S):* gedeelde guard.
- **Datum-bugs (low):** `vehicleCosts.js:54` parseert date-only als UTC (venstergrens verschuift);
  `buyFrequency.sortedDays:48` dedupliceert niet (zelfde-dag-aankopen halveren mediaan);
  `notifications.js:80` `+86.400.000ms` schuift over DST. Alle drie: hergebruik `dayMs`/`date-fns`.

### P5 — UX-polish met hoge opbrengst/kosten-verhouding

- **UX-high (`welcome.js`):** **geen wachtwoord-vergeten-flow** — enige echte dead-end.
  *Fix (M):* `resetPasswordForEmail` + deep-link-scherm; vertaal Supabase-fouten naar NL.
- **UX-medium (✓ `dialog.js:189`):** voertuig-verwijderdialoog toont rode knop **"Opslaan"**
  (default `confirmLabel`) + geen undo. *Fix (S):* `confirmLabel: t('common.delete')`.
- **UX-medium:** taak afvinken/snoozen faalt stil (succes-toast bij mislukte snooze);
  "Huishouden verlaten"/"Groep verwijderen" falen met unhandled rejection; km-verrekening (geld!)
  wordt in een leeg catch weggeslikt; join-link zonder netwerk meldt "ongeldig" zonder retry.
  Allemaal S — het `.catch(dialog.alert)`-patroon staat er al naast.

### P6 — Architectuur: gerichte reparaties, geen herontwerp

- **Arch-medium (`usePets.js:133`):** pet/plant-dagboek is 52% regel-identiek in de ongeteste
  hooklaag (cover-terugval letterlijk gedupliceerd, 3e kopie in `useVehicles`). *Fix (M):*
  `makeDiary({bucket,table,fk})` in `lib/entityDiary.js` → hooks worden dunne wrappers (−150 regels,
  één cover-implementatie). Detail-schermen bewust als kopie laten (domein-verweven).
- **Arch-medium (`app/pet/[id].js:269`):** care-checklist-diff (titel-prefix-matching) leeft
  ongetest in het scherm — schendt afspraak 1 van architectuur.md. *Fix (S):* pure
  `diffCareSelection` + `isCareTaskFor` naast `buildCareTasks`.
- **Arch-low:** dode code `lib/useCatalog.js` (✓ nul importeurs) + 3 ongebruikte exports;
  `plantTimeline.js` bedient ook pets (hernoemen → `timelineDay.js`); ARCH-4 (`ui.js` 38
  componenten) mechanisch splitsen met her-exporterende barrel.

---

## Nog te draaien (sessielimiet) — bijgewerkt 2026-07-04

De drie ontbrekende dimensies zijn in de vervolgsessie (2026-07-04) alsnog gedraaid als losse
read-only dimensie-agents (niet via de workflow-resume, want die is sessie-gebonden). Uitkomst:

- **Security — ✅ gedraaid (2026-07-04), fixes bewust UITGESTELD naar een aparte sessie.**
  Geen high-bevindingen; tenant-isolatie + RLS-contract solide na de 0041–0058-remediatiegolven.
  Geverifieerd tegen de code + de live `get_advisors` security-scan. Openstaand (klein, voor de
  security-sessie):
  - **medium · `enable_module_rls` verloor z'n `search_path`-pin** — `0066_module_insert_creator_check.sql`
    doet `create or replace ... language plpgsql` zónder `set search_path = public`, wat de pin uit
    `0024` reset. Live-advisor bevestigt: `function_search_path_mutable` WARN op precies deze functie.
    Fix: pin terugzetten in een nieuwe migratie.
  - **medium · globale catalogus vervuilbaar** — `insert_catalog_product` (`0031`, DEFINER,
    `grant ... to authenticated`) slaat client-aangeleverde `p_image_url`/`p_name` ongefilterd op in de
    cross-tenant `catalog_products`; die thumbnail rendert bij álle huishoudens → hotlink-tracking van
    elke viewer. Fix: `image_url` allowlisten (OFF-CDN) of weren + naam normaliseren/cappen.
  - **low** · HIBP-lekwachtwoordbescherming uit (dashboard-toggle) + zwak wachtwoordbeleid (min 8, geen
    complexiteit); `peek_invite` geeft anoniem de voornaam van de uitnodiger prijs (bewust, 244-bit token
    dus geen orakel); RLS-helpers (`is_member` e.d.) blijven door `authenticated` direct aanroepbaar
    (advisor-WARN, `0058` bewust — mogelijk verder in te trekken, vergt live-RLS-test).
  - Sterke punten (bevestigd): foto-buckets alle `public=false` + `is_member(foldername[1])`-padscoping op
    alle 4 ops; invite-tokens 244-bit/single-use/24u/niet-gelogd; Sentry `sendDefaultPii:false` geen
    setUser/breadcrumbs; `notify` constant-time secret-vergelijking fail-closed; geen secrets in git.
- **Datamodel & database — ⏸ doorgeschoven.** De agent-run van 2026-07-04 werd halverwege
  afgebroken (interrupt); op verzoek niet herstart — meenemen in de geplande security-sessie
  (past daar goed bij: RLS-performance/policies raakt beide dimensies).
- **Platform & tooling — ⏸ doorgeschoven.** Idem; meenemen in dezelfde vervolgsessie.

> Naast de dimensie-agent leverde de **live `get_advisors` performance-scan** (2026-07-04): 19×
> `auth_rls_initplan` (kale `auth.uid()` per rij i.p.v. `(select auth.uid())`), 66× dubbele permissive
> policies, 42 ongeïndexeerde FK's, 16 ongebruikte indexen. Bundelen in één DB-hardening-migratie
> (samen met de twee security-mediums) in een vervolgsessie.

> **Overlap met bekende roadmap:** de roadmap-agent vond ~59 reeds bekende open items (backlog §6 +
> eerdere reviews). Nieuw t.o.v. die stapel zijn vooral: de SWR-foutpad-cascade (P0), de refetch-
> storm-kwantificering (P1), de dynamische-contrast-bevindingen (P2) en de RLS-testdekkingsgaten
> voor de nieuwere moduletabellen (P3). Bekende openstaanders die dit rapport bevestigt: ARCH-4
> (ui.js-split), A11Y-2 (touch-targets), de "Bewaar"/"Opslaan"-terminologie (B1 in het
> modules-verbeterplan).

---

## Sterke punten (behouden)

- **Pure kern is voorbeeldig geborgd:** geld in hele centen met bewezen som-invariant, tijdzone-
  discipline (suite vastgepind op negatieve-offset-zone), 863 tests + mutatie-ratchet, zelf-
  bewakende meta-tests (`groupsCoverage`, `typecheckCoverage`, `moduleGating`).
- **Drielagen-architectuur wordt écht nageleefd** — geen React/Supabase in de ratchet-modules;
  afwijkingen (useMealPlan) hergebruiken alsnog de gedeelde primitives.
- **Performance-fundament:** gedeelde realtime-hub (1 kanaal/huishouden), SWR + incrementeel
  patchen, gevensterde queries met exacte server-side aggregaat-fallback, nette lijst-virtualisatie.
- **UX-systemen:** verwijderen-met-undo over schermgrenzen, gedeeld Editor-contract met dirty-guard
  + scroll-naar-fout, toegankelijke dialog/toast met live regions.
- **Fabric-veilige theming** structureel opgelost (rebuildTokens + root-remount); "verminder
  beweging" consequent via `lib/motion.js`; 958 `t()`-aanroepen zonder hardcoded JSX-strings.

---

*Bronbestanden van de per-dimensie-agents (volledige evidence/aanbevelingen) staan in het
workflow-transcript: `.../subagents/workflows/wf_6c4a0932-323/journal.jsonl`.*

---

# Addendum 2026-07-04 — de drie ontbrekende dimensies

De reviews die op de sessielimiet strandden zijn alsnog gedraaid (drie onafhankelijke
dimensie-agents, zelfde bewijs-eis) + de live Supabase-advisor-scan. De zwaarste
bevindingen zijn handmatig tegen de code geverifieerd (✓). Items die direct in de
vervolg-PR zijn gefixt staan onderaan afgevinkt.

## Security — 0 high · 1 medium · 2 low

**Kernoordeel:** de securitybasis is volwassen en het gedeelde RLS-contract wordt
consequent nageleefd; de restschuld is klein maar reëel.

- **[Sec-1, medium, S] ✓ De 0066-attributie-fix is via een UPDATE te omzeilen.**
  `0066_module_insert_creator_check.sql:63-67`: de INSERT-policy eist `%I = auth.uid()`
  op de creator-kolom, maar de UPDATE-policy houdt `with check (is_member(household_id))`.
  Een lid kan dus ná een nette insert de rij updaten met `created_by = ander lid` (of
  `visibility`/`household_id` verschuiven). Binnen-huishouden, geen cross-tenant-lek, maar
  het ondermijnt een als "gedicht" gemarkeerde control. De review van 2026-06-27 flagde
  dit als aparte P2 die uit de opvolgtabel is gevallen. *Fix:* `enable_module_rls`-UPDATE-
  `with check` uitbreiden + de 7 tabellen herzetten (patroon 0066), mét live-RLS-test.
- **[Sec-2, low, S] `assistant` had geen expliciete `verify_jwt` in `config.toml`** —
  leunde op de impliciete default, terwijl scan-receipt/notify het expliciet vastleggen.
  **→ Gefixt in deze ronde.**
- **[Sec-3, low, S] `peek_invite` geeft huishoudnaam + uitnodiger óók voor ingetrokken/
  verlopen/gebruikte tokens** (`0053:104-124`, geen status-filter, geen throttle). Een ooit
  gelekte link blijft dus permanent die info onthullen. *Fix:* niet-`valid` → alleen status.
- **Sterk:** alle 9 module-tabellen via het contract; storage-buckets dicht (member-gated
  op padsegment); edge-functions fail-closed met drietraps rate-limits; DEFINER-RPC's
  netjes ingeperkt; geen gecommitte secrets; Sentry PII-arm (`sendDefaultPii:false`);
  CI SHA-gepind met least-privilege.

## Datamodel & database — 1 high · 6 medium · 4 low

**Kernoordeel:** opvallend gedisciplineerd schema (hele centen, overal `timestamptz`,
visibility-CHECK + integriteitstrigger, atomaire DEFINER-RPC's) — maar drie systematische
patronen zijn half doorgevoerd.

- **[Data-2, high, S] ✓ Realtime DELETE-events bereiken huisgenoten niet op ~22 van de
  ~25 gesubscribede tabellen.** `0032` legt het mechanisme zelf uit (DELETE-event bevat
  alleen de PK → het `household_id=eq.`-filter matcht nooit) en fixt alleen
  `expense_shares`+`purchase_items`; `0067` voegde `timeline_reactions` toe. Alle
  `useCollection`-tabellen (tasks/groceries/plants/pets/vehicles/…) + timeline/purchases/
  completions missen 'm: verwijdert huisgenoot A een taak of boodschap, dan blijft die bij
  B als spook-rij staan tot een reload. *Fix:* migratie `replica identity full` op de
  gesubscribede tabellen (WAL-afweging voor foto-/logtabellen documenteren) + device-test.
- **[Data-1, medium, M] Account-verwijdering loopt stuk:** elke module ná `0002`
  herintroduceert FK's naar `profiles` zonder `on delete` (12+ migraties) → één uitgave of
  plant blokkeert het wissen van `auth.users` (GDPR-pad). *Fix:* sweep-migratie
  `set null` naar het 0002-patroon.
- **[Data-3, medium, S] `expense_shares` hoeven niet op te tellen tot `amount_cents`**
  (en mogen negatief): `create/update_expense` (0025) inserten de client-shares letterlijk.
  Saldi — de financiële kern — zijn daarmee client-vertrouwend. *Fix:* som+`>=0`-guard in
  beide RPC's + CHECK.
- **[Data-4, medium, M] `task_completions` verliest de eerlijkheids-historie via cascade**
  (taak/plant/huisdier/voertuig verwijderen wist voltooiingen met terugwerkende kracht —
  strijdig met de eigen motivatie in 0012). Ontwerpkeuze: snapshotten of documenteren.
- **[Data-5, medium, S] Bonnen/voorraad zonder bereik-CHECKs** (negatieve prijzen,
  quantity ≤ 0 mogelijk; voertuig- en kosten-domein hebben ze wél).
- **[Data-7, medium, S] Twee household-brede paden zonder dekkende index:**
  `plant_photos`/`pet_log` op `(household_id, created_at)` en `household_members(profile_id)`
  (de boot-query). *Fix:* indexmigratie.
- **[Data-10, medium, S] 0066 mist `recurring_expenses`** (direct client-geschreven, oude
  policy) **en liet de directe insert-policy op `expenses` open** (spoofing via REST naast
  de RPC's om).
- **Low:** naakte `auth.uid()` i.p.v. `(select auth.uid())` in bijna alle policies
  (initplan; 0067 doet het al goed) · gedenormaliseerde `household_id` op kindtabellen
  zonder consistentie-waarborg · polymorfe/array-verwijzingen zonder opruiming
  (`timeline_reactions.target_id`, `tag_ids`, `eater_ids`) · backlogrijen liepen achter op
  de gemergde 0067–0069 (in deze ronde bijgewerkt).
- **Sterk:** geld consequent in hele centen; alle timestamps `timestamptz`; het
  visibility-contract is hard (CHECK + trigger); idempotente migraties; helpers `STABLE`
  + `security definer set search_path`.

## Platform & tooling — 0 high · 5 medium · 7 low

**Kernoordeel:** CI/ratchet/dependabot/secrets-discipline zijn voorbeeldig; de gaten
zitten in de randen van de push-pijplijn en de laatste meters van de release-keten.

- **[Plat-1, medium, S] Push-token werd niet opgeruimd bij uitloggen** → een gedeeld/
  afgedankt toestel bleef pushes (incl. taaktitels) van het oude account ontvangen.
  **→ Gefixt in deze ronde** (`lib/pushTokenRegistry.js` + opruiming in `signOut`).
- **[Plat-2, medium, S] OS-notificatiepermissie wordt "cold" gevraagd bij eerste mount**
  (`useNotifications.js:42`, default aan) — een weigering is sticky en legt de hele
  PLT-1-pijplijn plat. *Fix:* pre-prompt bij een notificatie-actie/onboarding.
- **[Plat-3, medium, S] Web-source-map-upload ontbreekt in `deploy:web`** (concrete
  invulling van de bekende INF-4-rest): export → `npx sentry-expo-upload-sourcemaps dist`
  → `.map`-bestanden strippen → dan pas `wrangler pages deploy`.
- **[Plat-4, medium, S] `/.well-known/assetlinks.json` + `apple-app-site-association`
  staan (vermoedelijk live) met `REPLACE_`-placeholders** terwijl `app.config.js` op
  `applinks:huishoek.app` leunt → de native handoff van `/join/<token>` is dood. Stond
  nergens in §6. *Fix:* keystore-SHA256 + Team ID invullen, herdeployen (Erik-actie:
  credentials).
- **[Plat-5, medium, S] `@opentelemetry/api` is prod-dependency én wordt door metro
  weggestubd** — comment en werkelijkheid spreken elkaar tegen. *Fix:* naar
  devDependencies + comment bijwerken.
- **Low (selectie):** CI draaide op Node 20 (EOL) vs. lokaal 22 (**→ gefixt: Node 22 +
  `engines`**) · `import:catalog` wees naar een verwijderd script (**→ gefixt**) · geen
  app-icoon/splash/notificatie-icoon geconfigureerd (blokkeert nette store-build, INF-5) ·
  dode-token-opruiming kijkt alleen naar tickets (niet receipts) + push-kanaal op
  importance DEFAULT · `Share.share` faalt stil op desktop-web (voertuig-logboek) ·
  `expo-image-picker`-plugin ontbreekt → Engelse permissieteksten · `tracesSampleRate:0.1`
  zonder navigatie-instrumentatie (betaalde no-op).
- **Sterk:** EXPO_PUBLIC-hygiëne schoon; `.gitignore` sluit credentials uit; CI
  SHA-gepind + least-privilege + doordachte RLS-serialisatie; defensieve native-loads;
  reanimated-babel-hypothese ontkracht (preset injecteert sinds SDK 50 zelf); versie-/
  OTA-beleid consistent.

## Live advisor-scan (Supabase, 2026-07-04)

- **Security:** WARNs beperkt tot bekende/bewuste zaken — `peek_invite` anon-callable
  (by design, zie Sec-3 voor de verscherping), DEFINER-RPC's voor `authenticated`
  (by design: RLS-helpers + gevalideerde RPC's), `enable_module_rls` mutable search_path
  (helper, alleen door migraties aangeroepen), en **leaked-password-protection staat nog
  uit** (bekend: INF-10 B6, dashboard-toggle). INFO: RLS-aan-zonder-policy op de zes
  tel-/systeemtabellen — bewust (alleen service-role/DEFINER).
- **Performance:** de scan bevestigt Data-6 (auth-initplan-wrapping) en de
  ontbrekende-index-klasse van Data-7; volledige lijst te herhalen via MCP
  `get_advisors(performance)` bij de fixronde.

## Direct gefixt in de vervolg-PR (2026-07-04)

- ✅ Sec-2 — `[functions.assistant] verify_jwt = true` in `supabase/config.toml`.
- ✅ Plat-1 — push-token-opruiming bij uitloggen (`lib/pushTokenRegistry.js`, 100% mutatie).
- ✅ Plat-6 — CI naar Node 22 (4 workflows) + `engines` in package.json.
- ✅ Plat-7 — `npm run import:catalog` wijst weer naar een bestaand script.
- ✅ Data-D — backlog §6 gesynchroniseerd met de gemergde 0067–0069.

## Aanbevolen fixronde-volgorde (rest)

1. **P7 — DB-hardening-migratie(s)** (Sec-1 + Data-10 samen; Data-2 replica identity;
   Data-3 share-guards; Data-7 indexen) — elk klein, wél de live-RLS-suite als gate.
2. **P8 — Release-keten** (Plat-3 web-source-maps in `deploy:web`; Plat-4 applinks-
   placeholders (Erik: credentials); app-icoon/splash vóór de store-build).
3. **P9 — Push-pijplijn-poets** (Plat-2 pre-prompt; receipts-check + kanaal HIGH).
4. Ontwerpkeuzes agenderen: Data-1 (account-verwijdering/GDPR) en Data-4
   (completions-historie).
