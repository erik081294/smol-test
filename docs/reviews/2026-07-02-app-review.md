# Multidimensionale app-review — Huishoek

**Datum:** 2026-07-02 · **Scope:** hele app (lib/*.js pure logica + React-schil, schermen in
app/, RLS/migraties, edge functions, test/CI) · **Methode:** multi-agent workflow — 9 dimensie-
reviewers, elk met eigen onderwerp en bewijs-eis (bestand + regel + citaat), plus roadmap-context.
Bevindingen zouden daarna adversarieel geverifieerd worden (3-lens-panel bij high/critical).

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
| Security | ❌ niet gedraaid | — | — | — | — |
| Datamodel & database | ❌ niet gedraaid | — | — | — | — |
| Platform & tooling | ❌ niet gedraaid | — | — | — | — |

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

## Nog te draaien (sessielimiet)

Drie dimensies zijn **niet** beoordeeld. Aanbevolen om ze in een verse sessie alsnog te draaien —
de workflow-cache herspeelt de 6 voltooide dimensies gratis:

```
Workflow({ scriptPath: ".../huishoek-app-review-wf_6c4a0932-323.js",
           resumeFromRunId: "wf_6c4a0932-323", args: {"date":"2026-07-02"} })
```

- **Security** — RLS-gaten buiten het contract, edge-function-auth (notify/scan-receipt), invite/
  join-token-entropie, foto-bucket-policies, PII naar Sentry, gecommitte secrets. *(De live Supabase
  `get_advisors` security-scan zat in de opdracht — nog niet uitgevoerd.)*
- **Datamodel & database** — FK's/ON DELETE, ontbrekende CHECK/NOT NULL, indexen op household_id/
  created_at-paden, RLS-performance (`(select auth.uid())`-wrapping), realtime-publication-match.
- **Platform & tooling** — app.config.js/eas.json/permissies, Sentry-source-maps, `@opentelemetry/api`
  dood of levend, ongebruikte dependencies, web-parity (Platform.OS), notificatie-pijplijn.

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
