# Multi-agent code review — Huishoek

**Datum:** 2026-06-27 · **Scope:** hele codebase (lib/*.js, React-schil, RLS-migraties,
edge functions, test/CI/proces) · **Methode:** 7 parallelle review-agents, elk met een eigen
onderwerp + methode; P0/P1-bevindingen daarna adversarieel geverifieerd tegen de bron vóór
opname. Niets is gewijzigd behalve dit rapport — elke bevinding is een **werklijst-item met
fix-schets**, geen toegepaste fix.

**Severity-rubriek:** `P0` kritiek (datalek/RLS-gat/dataverlies) · `P1` echte bug ·
`P2` risico/edge-case/hardening · `P3` kwaliteit/onderhoud.

## Samenvatting

| Agent | Onderwerp | P0 | P1 | P2 | P3 |
|---|---|:--:|:--:|:--:|:--:|
| 1 | Correctheid pure logica | 0 | 0 | 3 | 2 |
| 2 | Security & RLS *(live DB)* | 0 | 0 | 3 | 2 |
| 3 | Test-kwaliteit & mutatie | 0 | 2 | 4 | 4 |
| 4 | Architectuur & hergebruik | 0 | 0 | 2 | 4 |
| 5 | React-schil & performance | 0 | 0 | 9 | 2 |
| 6 | Type-safety & null-safety *(typecheck)* | 0 | 1 | 4 | 2 |
| 7 | Docs/proces & launch-readiness *(live DB+CI)* | 0 | 1 | 4 | 2 |

**Topbevindingen (start hier):**
1. **[P1] `strictNullChecks` staat in werkelijkheid uit** — `tsconfig.check.json:23` (`"strict": false`
   overschrijft het, comment belooft het tegendeel). De hele null-safety-belofte van de typelaag is
   inert; ~26 signalen in 8 modules ontsnappen. *(Agent 6, geverifieerd.)*
2. **[P1] `VERIFICATIE.md` loopt 29 migraties achter** — header zegt "DB op `0036`", live DB staat op
   `0065`. Exact het bekende "0036 live"-risico uit CLAUDE.md, en het runbook beveelt het kapotte
   `supabase db push` aan. *(Agent 7, live-bevestigd.)*
3. **[P1] `vehicleCosts` geld-logica niet exact vastgepind in tests** — afschrijvings-exponent (`r=0.82`)
   en venster-deler nooit op een exacte centwaarde geassert; mutanten overleven. *(Agent 3.)*
4. **[P2, bijgesteld van P0] Geen expliciete realtime-teardown bij logout** — hardening, geen datalek
   (zie verificatie-noot onderaan). *(Agent 5.)*

**Geverifieerd correct (geen actie):** RLS-dekking op alle 42 tabellen (live), `can_view`-logica,
drielaags fail-closed rate-limiting, private storage-buckets met signed URLs, de 3-lagen-scheiding
(0 echte laag-lekken), en de migratie-/CI-stand achter LRN-1.

---

## Agent 1 — Correctheid pure logica (`lib/*.js`)

> Kern is opvallend solide: `expenses` (incl. negatief-totaal-invariant), `realtimePatch`,
> `recurrence`, `agenda`, `reservations`, `rotation`, `pantry`, `fairness` houden adversarieel stand.

- **[P2] Instabiele sort bij gelijke timestamps verstoort samenvouwen** — `lib/activity.js:78-87`
  `sort((a,b) => new Date(b.at) - new Date(a.at))` heeft geen tie-break op `id`. Bij events met
  exact gelijke `at` (batch-afvinken) is de volgorde engine-afhankelijk, waardoor het samenvouwen
  (`groupKey` op *aaneengesloten* gelijkheid) niet-deterministisch wordt.
  *Fix:* tie-break toevoegen, bv. `|| (String(a.id) < String(b.id) ? 1 : -1)`.

- **[P2] `countOf` telt maar één lijstregel** — `lib/groceryCount.js:8-13`
  Gebruikt `.find()` → count van de *eerste* matchende open regel. Hetzelfde product op twee open
  regels (handmatig "melk" + catalogus "Melk 1L") → stepper-badge ondertelt.
  *Fix:* `reduce` over álle matchende regels i.p.v. `.find()`.

- **[P2] Vensterrand mengt date-only met tijd-van-dag** — `lib/vehicleCosts.js:50-57`
  `cutoff = subMonths(new Date(now), months)` behoudt het uur van `now`, terwijl `performed_on`
  date-only is (UTC-middernacht). Een log op de venstergrens valt afhankelijk van het draai-uur
  in/uit het venster. *(Zie ook Agent 3 — ditzelfde venster is ook test-ondergedekt.)*
  *Fix:* beide naar kalenderdag normaliseren (`startOfDay`/dag-string) vóór vergelijken.

- **[P3] `withinBudget` negeert `minCents`** — `lib/decisions.js:35-39`
  Bewuste keuze (gedocumenteerd), maar de ongebruikte parameter is een valkuil.
  *Fix:* parameter verwijderen óf een test die het onder-minimum-geval als 'binnen' vastlegt.

- **[P3] `relativeTime` stopt bij weken** — `lib/activity.js:8-22`
  "28 wk geleden" i.p.v. maanden/jaren. UX-kwaliteit, geen bug.

---

## Agent 2 — Security & RLS *(live DB geverifieerd via Supabase MCP)*

> `get_advisors` (security): 4× `rls_enabled_no_policy` (bewust DEFINER-RPC-only), 1× `anon_security_definer`
> op `peek_invite` (bewust), ~20× `authenticated_security_definer` (verwacht), 1× leaked-password-protection uit.
> Alle 42 publieke tabellen `rls_enabled=true`. Migraties t/m `0065` live-bevestigd.

- **[P2] CORS `Access-Control-Allow-Origin: *` op scan-receipt** — `supabase/functions/scan-receipt/index.ts:37` *(statisch)*
  D1 bevestigd. Impact beperkt: functie zit achter `verify_jwt`, rate-limit op `auth.uid()`, geen cookies
  (Bearer-token). Restrisico: geen origin-allowlist als extra laag.
  *Fix:* `Allow-Origin` beperken tot bekende app-origin(s), of bewust documenteren. Lage prioriteit.

- **[P2] Insert-policy dwingt `created_by = auth.uid()` NIET af** — `enable_module_rls` insert-policy *(live-bevestigd)*
  Module-insert-policies zijn `with check (is_member(household_id))` zónder creator-check. Een huishoudlid
  kan een rij invoegen met `created_by`/`added_by`/`author_id` op een ander lid (attributie-spoofing). Geen
  cross-household lek, maar `created_by` voedt `can_view` (custom/subgroup) → subtiele zichtbaarheids-invloed.
  *Fix:* `and <creator_col> = auth.uid()` toevoegen aan de insert-`with check` in `0003`; RPC-tabellen ongemoeid.

- **[P2] Update-`with check` laat `household_id`/`visibility`/`created_by` herschrijven** — module-update-policies *(live-bevestigd)*
  Update-check is enkel `is_member(household_id)`. Een lid kan bij update `household_id` naar een ander eigen
  household zetten, of `visibility`/`created_by` aanpassen. Binnen-huishouden laag risico; data-integriteit.
  *Fix:* `created_by` immutable maken in de update-check, of bewust accepteren + documenteren.

- **[P3] `peek_invite` anon-callable — token-status-orakel** — `supabase/migrations/0053:93` *(advisor)*
  Bewust anon (preview vóór login); geeft alleen naam/emoji/voornaam voor een ~244-bit token. Brute-force
  onhaalbaar. *Fix:* geen; eventueel lichte rate-limit als hardening.

- **[P3] Leaked-password-protection uit** — Auth-config *(advisor)*
  HaveIBeenPwned-check staat uit. *Fix:* aanzetten in Auth-settings.

---

## Agent 3 — Test-kwaliteit & mutatie-gaten

> `mutation.mjs` kon niet draaien (`@stryker-mutator/core` ontbreekt zonder `npm ci`); bevindingen zijn
> statische analyse (baseline + export-vs-assert + de gat-patronen uit CLAUDE.md). Baseline 83.1% (4332/5214).
> Geld-/datum-kern (expenses, fairness, recurringExpense) is grondig getest — weinig echte gaten.

- **[P1] `maintenanceMonthlyAvgCents` — venster-deler `Math.max(1, months)` ongetest** — `lib/vehicleCosts.js:56`
  De `months=0`-guard (deling door 0) wordt nooit geraakt.
  *Test:* `maintenanceMonthlyAvgCents([{performed_on:'2026-06-01',cost_cents:1200}], { now:new Date('2026-06-25'), months:0 })`
  → `assert.equal(…, 1200)`.

- **[P1] `depreciationEstimate` — exponent `r=0.82` & 1-jaar-grens nooit exact vastgepind** — `lib/vehicleCosts.js:33-36`
  Tests asserten een *bereik* (`>0 && <catalogus`); een mutant op `r` of `Math.pow` overleeft.
  *Test:* vaste invoer (`catalogPriceCents:3000000`, registratie exact 1 jaar terug) →
  `assert.equal(currentValueCents, Math.round(3000000*0.82))` (= 2460000) exact.

- **[P2] `monthlyEquivalentCents` — `Math.max(1, interval)`-vloer ongetest** — `lib/vehicleCosts.js:15`
  *Test:* `monthlyEquivalentCents(5000, RECUR.MONTHLY, 0)` → `assert.equal(…, 5000)`.

- **[P2] `contrastRatio` — alleen `>= drempel`, nooit een exacte ratio** — `lib/contrast.js:22-28`
  Constanten (`+0.05`) en `max`/`min`-symmetrie nooit vastgepind (verklaart ~80.8%-score).
  *Test:* `contrastRatio('#000','#fff')` → `21`; omgekeerd → `21` (symmetrie); `('#000','#000')` → `1`.

- **[P2] `parseRatePerKm` — minteken-grens & `Math.round` ongetest** — `lib/vehicleSharing.js:17-24`
  *Test:* `parseRatePerKm('0,255')` → `26` (pint `*100`+round); `parseRatePerKm('1-2')` → `null`.

- **[P2] `dueRun` cap-grens scherp testen** — `lib/recurringExpense.js:31-34`
  *Test:* `dueRun({...}, now, 1)` → `assert.equal(occurrences.length, 1)` (raakt de `< cap`-grens).

- **[P2] `ageLabel` maand-grens 11→12** — `lib/petCare.js:162-167`
  *Test:* 11 maanden → `'11 maanden'`; exact 12 → `'1 jaar'`.

- **[P3] `computeShares` restcent-lus `remainder > 0` grens** — `lib/expenses.js:51` (waarschijnlijk al gedekt).
- **[P3] `logEntryKind` guard-volgorde & `cost_cents > 0`-grens** — `lib/vehicleTimeline.js:44-48`.
- **[P3] `secureStorage` 52%-score = NoCoverage-ruis** (impure native adapter), geen echt testgat —
  overweeg chunk-orchestratie te extraheren met injecteerbare store, óf de baseline-comment expliciet maken.
- **[P3] Config: `petCare`-groep mist `exclude: ['StringLiteral']`** — `scripts/mutation-groups.mjs:86`
  De 63.9%-score meet vooral ongeteste string-data (datatabel), niet test-effectiviteit. Zus-tabellen
  (i18n/groceryCatalog/…) hebben de exclude al. *Fix:* exclude toevoegen + baseline herijken.

---

## Agent 4 — Architectuur & hergebruik

> Drie lagen strikt gescheiden: **0 echte laag-lekken** (geen pure ratchet-module importeert
> react/react-native/`./supabase`). Module-contract (descriptor → hook → RLS) wordt gevolgd.

- **[P2] Twee editors zijn nooit op `useEntityForm`/`formValidation` gemigreerd — doc claimt "alle 8"** —
  `app/resource/[id].js`, `app/purchase/[id].js`
  `purchase` rolt validatie met de hand (`useState(null)` + inline `if (!filled.length) setError(...)`,
  `:49,137`); `resource` gebruikt ad-hoc `timeError`/`conflict` (`:208-213`). Precies de ongeteste
  copy-paste-validatie die ARCH-1 wilde uitbannen. `docs/architectuur.md:108` ("alle 8 gemigreerd") klopt niet —
  er zijn 9 echte editors.
  *Fix:* beide migreren (zoals `app/expense/[id].js`) + ARCH-1-claim in doc/§6 corrigeren.

- **[P2] Doc-drift `GROUPS`-pad** — `docs/architectuur.md:86`, `CLAUDE.md`
  `GROUPS`/`MUTATED_SOURCES` leven in `scripts/mutation-groups.mjs` (her-geëxporteerd door `mutation.mjs`);
  CLAUDE.md DoD #1 noemt `scripts/mutation.mjs`. *Fix:* één canoniek pad noemen in beide docs.

- **[P3] `secureStorage` lazy `require('expo-secure-store')` in ratchet-laag** — `lib/secureStorage.js:55`
  Geen schending: gesanctioneerde "pure kern + impure schil"-escape-hatch. *Fix:* geen.

- **[P3] Vier hooks omzeilen `useCollection` met eigen fetch — gerechtvaardigd** —
  `useExpenses/useMealPlan/useTimeline/usePurchases` (geneste selects). Allemaal nog op de ruggengraat
  (`useGatedHouseholdId` + `useRealtimeReload` + `pendingDeletes`). *Fix:* verifieer dat
  `tests/moduleGating.test.js` óók deze custom-fetch-hooks dekt, niet alleen useCollection-tabellen.

- **[P3] Photo+note-log-pattern bijna identiek** — `lib/usePlants.js:18-44`, `lib/usePets.js:17-43`
  Upload al gedeeld (`photoStorage.js`); resterende wrapper-duplicatie minimaal. *Fix:* laag-prioriteit,
  risico op over-abstractie reëel.

- **[P3] ARCH-4 file-size hotspots** — `lib/i18n.js` (~1145 r. platte data), `lib/ui.js` (35 componenten)
  Splitsen nog niet nodig; als het moet, begin bij `lib/ui.js` (component-clusters), niet `i18n.js`.

---

## Agent 5 — React-schil & performance

> Belangrijkste vondst hieronder is **bijgesteld van P0 naar P2** na verificatie (zie verificatie-noot onderaan).

- **[P2, was P0] Geen expliciete realtime-teardown bij logout** — `lib/auth.js:57`, `lib/realtimeHub.js`
  `signOut()` doet `clearCache()` maar de hub-API (`createRealtimeHub`) heeft geen `teardownAll()`; opruimen
  hangt aan React-unmount (`useRealtimeReload.js:72`). **Geen concreet datalek** (ander account = ander
  household-`key` = vers kanaal; `setAuth(null)` stopt RLS-events van het oude household), maar het is een
  hardening-gat: er is geen deterministische force-clear vóór `supabase.auth.signOut()`.
  *Fix:* `teardownAll()` aan de hub toevoegen en in `signOut()` aanroepen (+ overweeg `removeAllChannels()`).

- **[P2] Optimistische rollback herstelt mogelijk verouderde `prev`** — `lib/useCollection.js:128-167`
  `prev` wordt vastgelegd bij de actie; komt er tussen mutatie en fout een realtime-patch binnen, dan
  overschrijft de `.catch`-rollback die verse staat met `prev` (zichtbare terugspring-glitch onder
  gelijktijdige edits; self-heal bij volgende reload).
  *Fix:* per-id revert i.p.v. hele lijst naar `prev`, óf `load()` bij rollback.

- **[P2] `create` leest `user.id` zonder null-guard** — `lib/useCollection.js:120-121`
  `[creatorColumn]: user.id` gooit een TypeError als `user` null is (uitgelogd/auth-overgang).
  *Fix:* vroege guard `if (!activeId || !user) return Promise.reject(...)` (idem `usePets.addPet`, `useMealPlan.addEntry`).

- **[P2] `usePetLog` (en losse detail-loaders) — geen `active`-guard op in-flight fetch, geen realtime** —
  `lib/usePets.js:155-167`
  `useEffect(() => { load(); }, [load])` zonder `let active = true`-guard → late `setEntries` op een
  unmounted component; tijdlijn ververst niet live.
  *Fix:* `active`-guard (zoals `auth.js:32`); evt. `useRealtimeReload` aansluiten.

- **[P2] `addPetPhoto` storage-write buiten `mutate()`/`run()` — stille deelfout** — `lib/usePets.js:135,17-21`
  `storage…remove([...]).catch(() => {})` slikt fouten volledig in → wees-bestand of rij-zonder-bestand
  zonder melding. *Fix:* minstens `console.warn` (zoals `db.js`); overweeg een `runStorage()`-wrapper.

- **[P2] `useActivity` gebruikt ongegate `activeId` i.p.v. `useGatedHouseholdId`** — `lib/useActivity.js:21`
  De feed leest `task_completions`/`expenses`/`groceries` zonder module-gating → laadt uitgezette modules
  tóch (ARCH-3-afwijking; RLS beschermt households, niet uitgezette modules).
  *Fix:* bron-queries/subscriptions per ingeschakelde module filteren, óf bewust documenteren.

- **[P2] `useExpenses.deleteExpense` niet-optimistisch** — `lib/useExpenses.js:141-142`
  Inconsistent met `useCollection.remove`; bij gemiste DELETE-events blijft de rij zichtbaar tot reload.
  *Fix:* optimistische verwijdering met rollback, of expliciete `load()` na delete.

- **[P2] `useNotifications` herplant bij elke `prefs`-identiteitswissel** — `lib/useNotifications.js:78-97`
  Dep-array bevat het hele `prefs`-object → onnodige `cancelAllScheduledNotificationsAsync` + herplanning
  (tot 60 notificaties), ondanks de 1500ms-debounce. *Fix:* memoiseer op een stabiele prefs-hash.

- **[P2] `comparator` gememoiseerd met lege deps terwijl `order` een prop is** — `lib/useCollection.js:59`
  Voor de huidige (statische) `order` correct, maar een toekomstige dynamische `order` sorteert met een
  bevroren comparator. *Fix:* `JSON.stringify(order)` als dep, of de aanname expliciet asserten.

- **[P3] `AuthProvider`/`HouseholdProvider` `value` niet gememoiseerd** — `lib/auth.js:42-64`, `lib/household.js:301-312`
  Elke render een nieuwe referentie → brede re-render-cascade over alle consumers.
  *Fix:* `useMemo` op `value` + `useCallback` voor handlers.

- **[P3] `app/recipe/[id].js:218-228` schrijft via `mutate()` maar buiten `useRecipes`** — architectuur-drift,
  geen functionele bug. *Fix:* insert naar `addRecipeIngredients` in `lib/useRecipes.js` verplaatsen.

---

## Agent 6 — Type-safety & null-safety *(typecheck gedraaid, groen)*

> Coverage-drift: **geen** — alle 60 `MUTATED_SOURCES` hebben `// @ts-check` en `tsconfig.check.json`
> `include` == `MUTATED_SOURCES` exact (meta-test doet zijn werk). Maar de groene run is deels schijnveiligheid.

- **[P1] `strictNullChecks` staat in werkelijkheid UIT — null-safety-belofte is inert** — `tsconfig.check.json:23` *(geverifieerd)*
  Comment (r.7-8) claimt `strictNullChecks:true` als "hoogwaarde-bug-vanger", maar `"strict": false` zet het
  óók uit en niets zet het terug aan (`tsc --showConfig` → `"strictNullChecks": false`). Forceren op dezelfde
  include geeft ~26 errors in 8 modules die nu stil ontsnappen.
  *Fix:* `"strictNullChecks": true` toevoegen (config-only). **Maakt build rood tot de P2/P3's hieronder
  gedicht zijn** → gefaseerd: eerst de type-only fixes, dán de flag aan, plus de misleidende comment corrigeren.

- **[P2] `codePointAt()` mogelijk-undefined gedereferenced** — `supabase/functions/notify/core.js:23` (`TS18048`)
  *Type-only fix:* `const code = /** @type {number} */ (ch.codePointAt(0));` (runtime-`?? 0` zou de mutatie-score raken).

- **[P2] `.filter(Boolean)` narrow't `null` niet weg** — `lib/offDelta.js:35,37,42` (`TS18047`)
  *Type-only fix:* getypte guard `.filter((x) => x != null)` met JSDoc-predicate, of cast na de filter.

- **[P2] `dayMs(now)` als nullable in aritmetiek** — `lib/buyFrequency.js:71` (`TS18047`)
  *Type-only fix:* `dayMs` JSDoc `@returns {number}`, of cast op gebruiksplek.

- **[P2] Object mogelijk-undefined** — `lib/decisions.js:10` (`TS2532`)
  *Type-only fix:* cast naar niet-nullable shape met `@type` waar de aanroeper het garandeert.

- **[P3] Empty-array `never[]`-inferentie blokkeert getypte `.push`** —
  `lib/groceryCatalog.js:220,226`, `lib/plantTimeline.js:42`, `lib/vehicleTimeline.js:93`, `lib/yearHeatmap.js:91,100,108`
  *Type-only fix:* accumulator annoteren `/** @type {{…}[]} */ const acc = [];`.

- **[P3] `key`/`startKey`/`endKey` mogelijk-null in string-gebruik** — `lib/yearHeatmap.js:83,94,159,160,163`
  *Type-only fix:* helper-return als `string` typen waar invoer een geldige Date garandeert (1 fix → 5 plekken groen).

---

## Agent 7 — Docs/proces & launch-readiness *(live DB + CI geverifieerd)*

> MCP-checks: `list_migrations` → **65 migraties live, hoogste `0065`**; `scan-receipt` edge function **ACTIVE v3**;
> `notify` niet gedeployed (consistent met PLT-1/SEC-5 gegate). GitHub Actions: **CI op `main` groen**
> (run `e6365ed6`, 2026-06-27), mutatietesten groen. `mutation-baseline.json` gecommit (5214, 83.1%).

- **[P1] `VERIFICATIE.md` statusheader 29 migraties achter** — `VERIFICATIE.md:3-4` *(live-bevestigd)*
  Doc: "Alle migraties `0001`–`0036` zijn live (**DB op `0036`**) … (36 versies; `0036` = home_layout)" (2026-06-22).
  Bron: live DB op `0065`. Exact de valkuil uit CLAUDE.md ("lees geen hardgecodeerd nummer").
  *Fix:* statusregel → "DB op `0065` (geverifieerd via list_migrations, <datum>)"; hardcoded versienummer weg.

- **[P2] `VERIFICATIE.md` Snelrecept beveelt kapotte `supabase db push` aan** — `VERIFICATIE.md:33-34,76-94` *(t.o.v. CLAUDE.md)*
  CLAUDE.md (gezaghebbend): "`supabase db push` is in dit project kapot (history diverged) → via MCP `apply_migration`."
  *Fix:* stap 1 / Snelrecept-push vervangen door de MCP `apply_migration`-route.

- **[P2] INF-11 "Rest: committen" is stale — baseline al gecommit** — `huishoek-backlog.md:447` (§6) *(git-bevestigd)*
  Rij noemt "3040/3556 = 85.5%" + "Rest: committen", maar `mutation-baseline.json` staat op HEAD (5214 / 83.1%),
  CI-mutatierun groen. *Fix:* INF-11 → ✅ → archief; verouderde getallen weg.

- **[P2] VTG-2/VTG-4 status loopt achter op code (door §6 zelf gemarkeerd)** — `huishoek-backlog.md:419-422` (§6) *(live-bevestigd)*
  VTG-1-noot zegt dat de UI van VTG-2/3/4 op toestel gevuld is; live DB bevat de bijbehorende migraties, maar
  VTG-2 en VTG-4 staan nog op ⏳ Open. *Fix:* VTG-2/VTG-4 van ⏳ → 🔧 (gebouwd, device-rooktest open).

- **[P2] §6 noemt 729 én 775 pass voor de live RLS-suite — inconsistent** — `huishoek-backlog.md:340/388` vs `:439`
  Twee getallen voor dezelfde suite zonder context. *Fix:* harmoniseren naar één pass-getal + datum, op één plek.

- **[P3] LRN-1 klopt met de bron — ter bevestiging** — `huishoek-backlog.md:406`
  `0055`–`0057` live + scan-receipt v3 ACTIVE bevestigd. Geen actie (kanttekening: rij is build-historie-zwaar
  voor §6 — CLAUDE.md wil dat in voortgang/plans).
- **[P3] DoD-naleving — geen kale `export function` zonder test gevonden.** Alle pure modules zitten met test
  in de baseline; "NO TEST"-bestanden zijn de dunne React/IO-schil (terecht).

---

## Verificatie-noot (adversariële her-check vóór opname)

- **`tsconfig.check.json:23`** gelezen — `"strict": false`, geen `strictNullChecks`-override → Agent 6's P1 **bevestigd**.
- **`VERIFICATIE.md:3`** gelezen — letterlijk "DB op `0036`"; live DB op `0065` (onafhankelijk bevestigd door
  Agent 2 én Agent 7 via `list_migrations`) → Agent 7's P1 **bevestigd**.
- **`lib/auth.js` + `lib/realtimeHub.js` + `lib/useRealtimeReload.js`** gelezen — de hub ruimt op via React-unmount
  (`unsub()`), een ander account krijgt een andere household-`key` (vers kanaal, eigen JWT), en `setAuth(null)`
  stopt RLS-events van het oude household. **Geen concreet cross-account datalek** → Agent 5's P0 **bijgesteld naar P2**
  (hardening: expliciete `teardownAll()` ontbreekt, maar er is geen lek-pad).
- **`lib/useCollection.js:120-150`** gelezen — `create` leest `user.id` ongeguard (r.121) **bevestigd**;
  optimistische rollback naar `prev` (r.137,149,166) kan een verse realtime-patch overschrijven **bevestigd**.
  Beide zijn smalle race-vensters met self-heal → P2, niet P1.

**Live-geverifieerde feiten:** 42 tabellen RLS-aan · migraties t/m `0066` · scan-receipt ACTIVE v3 ·
CI `main` groen (2026-06-27) · mutatie-baseline gecommit (83.1%). Rate-limiting fail-closed,
`can_view`-logica en private storage-buckets statisch+live als correct bevonden (geen bevinding).

---

## Opvolging (2026-06-27)

Verwerkt op branch `claude/multi-agent-code-review-ra2dbp` (typecheck + suite + mutatie-ratchet groen per commit):

| Bevinding | Status |
|-----------|--------|
| Agent 6 P1 — `strictNullChecks` inert | ✅ flag expliciet aan + 26 null-signalen type-only gedicht (8 modules) |
| Agent 7 P1 — `VERIFICATIE.md` 29 migraties achter + `db push` | ✅ bijgewerkt (DB `0066`, `apply_migration`-route) |
| Agent 3 P1 — `vehicleCosts` geld-logica niet exact getest | ✅ exacte centen vastgepind (afschrijving/venster/interval) |
| Agent 1 P2 — `activity` instabiele feed-sort | ✅ deterministische id-tie-break + test |
| Agent 1 P2 — `groceryCount` telt één regel | ✅ telt alle open regels (filter+reduce) + test |
| Agent 3 P2 — `contrast` alleen `>=`-drempels | ✅ exacte WCAG-uitersten (21/1/symmetrie) |
| Agent 2 P2 — insert-policy zonder `created_by = auth.uid()` | ✅ **live** via migratie `0066` (7 tabellen + helper + `default auth.uid()`) |
| Agent 5 P2 (was P0) — geen realtime-teardown bij logout | ✅ `realtimeHub.teardownAll()` + wired in `signOut()` + test |
| Agent 5 P2 — `useCollection.create` ongeguard `user.id` | ✅ guard toegevoegd |
| Agent 4 P2 — ARCH-1 "alle 8" + GROUPS-pad | ✅ docs gecorrigeerd (7/9 editors; `mutation-groups.mjs`) |
| Agent 7 P2 — §6 INF-11 stale + 729/775 | ✅ INF-11 → ✅, pass-getal geharmoniseerd |

**Nog open (jouw keuze / lopend werk):** CORS-allowlist op scan-receipt (vereist app-origins) ·
leaked-password-protection (Auth-dashboard) · VTG-2/4-statusflips (device-verificatie) ·
resource/purchase → `useEntityForm` · resterende feature-hook P2's + test-versterking (volgende ronde).
