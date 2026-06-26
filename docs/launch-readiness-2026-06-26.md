# Launch-readiness review — 2026-06-26

Grondige, kritische review met het oog op een lancering naar ~10.000 gebruikers,
uitgevoerd door vijf parallelle review-agents, elk op een eigen domein:

1. **Security & backend** — RLS, edge functions, auth/secrets
2. **Data & state** — hooks, realtime, caching, offline
3. **Domeinlogica** — pure `lib/*.js`-modules (geld, datums, matching)
4. **UI / performance / a11y** — schermen, `ui.js`, i18n, lijstrendering
5. **Tijdlijn-feature** — de nieuwste verticale slice (DB → hook → UI)

Algemeen oordeel: een ongewoon volwassen codebase (RLS op tabel-, RPC- én
bucketniveau correct; lijsten netjes gevirtualiseerd; integer-centen; zichtbare
mutatie-ratchet-cultuur). De review vond drie hoog-prioritaire risico's en een
reeks kleinere; hieronder per stuk wat het was en wat er is gedaan.

---

## ✅ Doorgevoerd

### Beveiliging

- **SEC-5 — cross-household datalek via de oude statische join-route gedicht.**
  `households.invite_code` was een 6-char code (16,7M combinaties, nooit
  verlopend) en `join_household(code)` was nog `authenticated`-grantable →
  elke ingelogde gebruiker kon codes bruteforcen en in een vreemd huishouden
  belanden (volledige leestoegang). De client gebruikte deze route niet meer
  (sinds het token-systeem 0053), enkel de onboarding-"join via code"-tab.
  - Migratie [`0055_security_drop_legacy_join.sql`](../supabase/migrations/0055_security_drop_legacy_join.sql)
    dropt `join_household` + de `invite_code`-kolom. **Live toegepast en
    geverifieerd** (beide weg op de productie-DB).
  - Client opgeschoond: `joinHousehold` uit [`lib/household.js`](../lib/household.js)
    en de code-tab uit [`app/onboarding.js`](../app/onboarding.js) verwijderd;
    onboarding wijst nu naar de uitnodigingslink.

- **INF-9b/c — scan-receipt getrapte rate-limit + kostenrem.** De per-gebruiker
  burst-limit (20/uur) stopte één account, niet account-farming op de open signup.
  De rem staat nu in drie lagen in `record_receipt_scan`:
  - **Burst** 20/uur (0026) · **per-gebruiker dag-quota** 30/24u (0057, de hoofd-rem
    — laat de totale kosten vanzelf lineair meeschalen met het aantal échte
    gebruikers, zonder een door test-/farm-accounts vertekenbare users-telling) ·
    **globaal dag-vangnet** 10.000/dag (0056, catastrofe-circuit-breaker).
  - Migraties [`0056`](../supabase/migrations/0056_receipt_scan_global_cap.sql) +
    [`0057`](../supabase/migrations/0057_receipt_scan_daily_quota.sql) **live
    toegepast** (anon expliciet ge-revoked, conform het SEC-patroon).
  - De edge-function-limiter is **fail-closed** + lekt geen interne foutstrings, en
    is **gedeployed** ([`scan-receipt`](../supabase/functions/scan-receipt/index.ts),
    version 3, `verify_jwt` behouden). De limieten staan als constants in `index.ts`.
  - Tuning: verlaag `SCAN_MAX_PER_DAY` (nu 30) voor een strakker budget, en zet
    daarnaast een Orq-side budget-alert als financiële harde rem.

### Data & realtime

- **Realtime valt niet meer stil na token-refresh.** `supabase.realtime.setAuth()`
  werd nergens (her)aangeroepen → na ~1u draaide de socket op een verlopen JWT en
  stopten RLS-gefilterde subscriptions stil. Nu gepropageerd bij init én elke
  auth-wijziging in [`lib/auth.js`](../lib/auth.js).
- **Reload-storm gedebounced.** Een bulk task-insert (care-taken bij een nieuw
  huisdier/plant/voertuig) vuurde N volledige herlaadbeurten van de zwaarste
  join-query. [`lib/useRealtimeReload.js`](../lib/useRealtimeReload.js) collapst nu
  een burst tot één reload (alleen het reload-pad, niet het incrementele patch-pad).
- **N+1-reductie.** Signed-URL-cache met TTL in
  [`lib/photoStorage.js`](../lib/photoStorage.js) (feed-thumbnails niet steeds
  opnieuw ophalen); `useProductFrequencies` ([`lib/useProducts.js`](../lib/useProducts.js))
  begrensd tot een 12-maands-venster i.p.v. de hele bon-historie.

### Tijdlijn

- **Paginering** (groeiend venster + `onEndReached`) — content ouder dan de
  nieuwste 100 is niet meer onbereikbaar.
- **Feed-query afgestemd op `timeline_posts_feed_idx`** (`pinned_at desc nulls
  last, created_at desc`) → geordende index-scan i.p.v. een sort per load.
- **Parallelle foto-uploads** (`Promise.allSettled`) + **orphan-cleanup**: bij een
  gefaalde foto-koppeling worden de geüploade bestanden opgeruimd; `deletePost`
  logt een mislukte opruiming i.p.v. 'm stil te slikken.
  Zie [`lib/useTimeline.js`](../lib/useTimeline.js).

### Domeinlogica

- **Maand-overflow in voertuigkosten gefixt.** `maintenanceMonthlyAvgCents`
  gebruikte `Date.setMonth`, dat op eind-van-maand overflowt (31 mrt − 1 mnd →
  3 mrt i.p.v. 28 feb) en zo het recente venster bijna uitsloot. Nu via
  `subMonths` (date-fns), met een edge-case-test. [`lib/vehicleCosts.js`](../lib/vehicleCosts.js)
- **`computeShares`-contract** (≥ 0, hele centen) gedocumenteerd + som-invariant
  bij negatief totaal vastgepind met een regressietest. [`lib/expenses.js`](../lib/expenses.js)

### UI / performance / a11y

- **Per-segment ErrorBoundary** (expo-router): een render-fout in een tab- of
  tijdlijn-scherm valt nu op een nette fallback i.p.v. de hele app mee te slepen.
  [`lib/ErrorBoundary.js`](../lib/ErrorBoundary.js) + re-export in de layouts.
- **Jaar-heatmap-jank weg.** `DayCell` gememoiseerd (+ stabiele `ramp` en
  `onSelectDay`), en de overdreven `hitSlop` verkleind tegen overlappende
  tikdoelen. [`lib/YearHeatmapView.js`](../lib/YearHeatmapView.js)
- **i18n robuuster.** `t()` valt terug op de default-taal (nl) bij een ontbrekende
  sleutel i.p.v. de kale sleutel; `SUPPORTED_LANGS` is teruggebracht tot `['nl']`
  (er is geen volledig `en`-woordenboek). Twee hardcoded "Sluiten"-labels via
  `t('common.close')`.

### Tests & ratchet

- Nieuwe unit-tests: vehicleCosts (maand-overflow), expenses (negatief som-behoud),
  i18n (nl-fallback). Volledige suite groen (`npm test`).
- Mutatie-ratchet uitgebreid: voertuig-, geld-, pet-, heatmap- en contrast-modules
  toegevoegd aan `GROUPS` in [`scripts/mutation.mjs`](../scripts/mutation.mjs);
  baseline opnieuw gegenereerd.
- RLS-integratietest [`tests/rls.integration.test.js`](../tests/rls.integration.test.js):
  de testhelper gemigreerd van de verwijderde `join_household` naar het
  invite-token-systeem, plus nieuwe isolatietests voor `timeline_posts/photos`
  en `household_invites`.

---

## ⏸️ Bewust (nog) niet gedaan

- **reCaptcha / captcha op signup** — op verzoek uitgesteld. E-mailbevestiging en
  leaked-password-protection blijven dashboard-toggles ter overweging.
- **Supabase realtime-tier vs 10k DAU** — capaciteits-/configuratiecheck (geen
  code). Goed om vóór de marketing-push te verifiëren (concurrent connections /
  channels per project).
- **Orq-side budget-alert/spend-cap** — de financiële harde rem buiten de app om;
  een dashboard-instelling als aanvulling op de app-laag rate-limit.

> Update: de scan-receipt edge-function is inmiddels wél gedeployed (version 3) mét
> de getrapte rate-limit; zie INF-9b/c hierboven.

---

## Validatiestatus

- `npm test` mét live-DB-secrets — **groen: 729 pass / 0 skip / 0 fail** (2026-06-26).
  De 21 RLS-integratietests draaiden dus écht (niet geskipt) tegen de live DB.
- Migraties 0055 + 0056 + **0057** (per-gebruiker dag-quota) — live toegepast en
  geverifieerd. MCP `list_migrations` bevestigt: de **volledige repo-set is live
  t/m `0057`** (incl. `0053_household_invites` en `0054_tijdlijn`).
- RLS-integratietests — **gedraaid tegen de live DB en groen** (2026-06-26), incl.
  de nieuwe isolatiecases voor `timeline_posts`/`timeline_photos` en
  `household_invites` en de naar het invite-token-systeem gemigreerde testhelper.
- Device-verificatie van de UI-wijzigingen — **emulator-rooktest 2026-06-26**
  (`Medium_Phone_API_36`, debug-APK op live Metro via `adb reverse`): de app **boot en
  bundelt schoon, géén crash/red-box** → alle LRN-JS-wijzigingen (per-segment
  ErrorBoundary, heatmap-memo, i18n nl-fallback, tijdlijn-paginering) laden zónder een
  gevallen segment. Geverifieerd: **Thuis** (echte data: voertuigtaak, gedeelde
  herhaalafspraak, widgetgrid), **Meer**-modulelijst (incl. de `activiteit`→`tijdlijn`-
  rename, Voertuigen + Huisdieren, Inzichten), **Tijdlijn**-feed (laadt tegen live `0054`
  → echte lege staat met illustratie + CTA, niet de oude crash-/leeg-fallback),
  **Inzichten/heatmap** (102 voltooiingen, rendert soepel — 2e toestel naast de moto).
  **Niet sluitend te testen op deze opstelling:** ErrorBoundary-fallback (vereist een
  geforceerde render-fout), tijdlijn-paginering (>100 posts nodig), onboarding (sessie
  was ingelogd). Zie [`VERIFICATIE.md`](../VERIFICATIE.md).
