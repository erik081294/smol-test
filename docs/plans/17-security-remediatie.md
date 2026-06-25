# 17 — Security-remediatie (gecombineerd plan)

> **Soort:** security/hardening · **Migratie:** ja (meerdere) · **Backlog-items:** SEC-1 t/m SEC-7 (§6),
> plus onderbouwing bij INF-9 (L1) en INF-10 (M1/L4/L5). Mapping naar de tier-ID's hieronder:
> **SEC-1 = K1**, **SEC-2 = H1**, **SEC-3 = H2**, **SEC-4 = M2**, **SEC-5 = M4**, **SEC-6 = M5**,
> **SEC-7 = L2+L3**. **M3 = bewuste keuze (gedeeld bewerken), géén actie** (zie backlog §5).

## Uitvoeringsstatus (2026-06-25)

Geïmplementeerd en **live toegepast** via Supabase MCP `apply_migration` (project `nayqbzekpdyigvfcroxd`):
- **SEC-1** — migr. `0041`: `create_household`-RPC + `revoke insert on household_members`; `lib/household.js` om naar RPC; RLS-tests + grant-checks live groen (directe owner-insert in vreemd huishouden → geweigerd; create_household maakt household+owner atomair).
- **SEC-2** — migr. `0042`: `run_recurring_expenses` van public/anon/authenticated gerevoke't (live: anon/authenticated kunnen niet meer, cron/service_role wel).
- **SEC-4** — migr. `0041`: `households_update` → owner-only (RLS-test groen).
- **M1 (INF-10)** — migr. `0042`–`0044`: PUBLIC/anon-EXECUTE ingetrokken op de user-facing DEFINER-RPC's; authenticated behouden.
- **SEC-3** — code + units: `lib/secureStorage.js` + `lib/supabase.js`-wiring (device-verificatie resteert).
- **SEC-5** — code + units (mutatie-ratchet 80,2% ≥ baseline): `notify/core.js` payload-hardening (gate op PLT-1-deploy).
- **SEC-7/L3** — code: SSRF-allowlist in `scripts/refresh-off-delta.mjs`.

**Twee bevindingen onderweg (gedocumenteerd):**
1. **Supabase default-privileges** verlenen EXECUTE op nieuwe functies **direct aan `anon`/`authenticated`**, niet alleen via PUBLIC. `revoke … from public` alléén is dus onvoldoende (live geverifieerd: anon kon `create_expense`/`create_household` nog aanroepen na een public-revoke). Een revoke móét `anon` expliciet noemen → vandaar de correctie-migraties `0043`/`0044`.
2. **De RLS-integratiesuite raakt de Supabase auth-rate-limit** (`Request rate limit reached` bij `signInWithPassword`) wanneer 'm in z'n geheel draait — ~45-60 testlogins. De laatste ~6 tests falen dan flakey. Niet door de security-fixes (SEC-1/SEC-4-cases slaagden). Mitigatie: in kleinere batches draaien of een korte sleep tussen `makeUser`-calls. → kandidaat voor een aparte test-infra-rij.

**Niet automatisch uitgevoerd:** SEC-6 (service-role-key uit `.env` — handmatig, want de sleutel is nodig voor de live RLS-tests), SEC-7/L2 (`npm audit fix` — build-time Expo-toolketen, bij de SDK-bump), B5/B6 van INF-10 (pg_trgm uit public + leaked-password dashboard-toggle).

## Context

Op verzoek is de volledige security van de app doorgelicht met **drie parallelle Opus-subagents**,
elk met een eigen methode en aandachtsgebied:

1. **Backend/autorisatie** — RLS-policies, multi-tenant isolatie, SECURITY DEFINER-functies,
   storage-buckets; statische SQL-review **+** live inspectie via Supabase MCP (`get_advisors`,
   system-catalogs).
2. **Client/secrets/auth** — token-/sessieopslag, secrets in bundle + git-historie, Sentry/PII,
   deep links, foto-metadata; statische source-review + secret-scan over de hele git-historie.
3. **Input/injectie/edge/supply-chain** — webhook-auth, prompt-injectie, SSRF, dynamische SQL,
   `npm audit`, CI/CD-workflows; statische analyse + live edge-function-inspectie via MCP.

Het beveiligingsmodel is over het geheel **volwassen** (centrale `is_member`/`is_owner`/`can_view`-laag,
`search_path` overal gepind, geen hardcoded secrets, Sentry zonder PII, geen EXIF-lek, CI SHA-gepind).
Maar er zijn een paar concrete, deels **live-geverifieerde** gaten — met één kritieke ontwerpfout die de
hele tenant-isolatie ondermijnt. Dit plan bundelt de bevindingen in prioriteitstiers met per item een
concrete fix, en sluit af met verificatie.

> **Uitvoer-noot:** alle DB-fixes zijn nieuwe migraties. Volgens projectgeheugen is `supabase db push`
> kapot (history divergeert) → nieuwe migraties **toepassen via Supabase MCP `apply_migration`**, niet via
> de CLI. Migratiebestanden gewoon als `00xx_*.sql` in `supabase/migrations/` toevoegen voor de repo-historie.
> Bevestig handmatig vóór elke `apply_migration` (SECURITY.md-richtlijn).

---

## Tier 1 — Kritiek (nu)

### K1 (→ SEC-1). Iedere gebruiker kan zichzelf als **owner** aan elk huishouden toevoegen
- **Bewijs:** [supabase/migrations/0001_init.sql:223-225](../../supabase/migrations/0001_init.sql#L223-L225) — `members_insert`
  heeft `with check (profile_id = auth.uid())`: geen rol-, lidmaatschap- of invite-eis. De rol-kolom accepteert
  vrij `'owner'`. [lib/household.js:201-203](../../lib/household.js#L201-L203) doet de owner-insert direct client-side,
  dus de policy moet directe inserts toestaan. Live geverifieerd (project `nayqbzekpdyigvfcroxd`).
- **Impact:** kent/raadt een gebruiker een `household_id` (bv. een verwijderde ex-huisgenoot), dan
  `insert into household_members(household_id, profile_id, role) values('<B>', auth.uid(), 'owner')` → volledige
  lees/schrijf op alle data van huishouden B (taken, boodschappen, uitgaven, planten, huisdieren, recepten, foto's).
  Versterkt door `members_delete` ([0001_init.sql:226-228](../../supabase/migrations/0001_init.sql#L226-L228)) dat elk lid
  anderen laat verwijderen → kick-en-re-insert-escalatielus.
- **Fix (nieuwe migratie):**
  1. `revoke insert on public.household_members from anon, authenticated;`
  2. Nieuwe `SECURITY DEFINER`-RPC `create_household(name, emoji)` die de household-rij **én** de owner-membership
     atomair aanmaakt (vervangt de twee directe client-inserts in `createHousehold`). Volg het revoke-patroon van
     `record_receipt_scan`/`insert_catalog_product` (die doen al `revoke ... from public`).
  3. Toetreden blijft uitsluitend via de bestaande RPC `join_household(code)` (forceert rol `member`).
  4. `members_delete` aanscherpen tot `using (is_owner(household_id) or profile_id = auth.uid())` (alleen owner kan
     anderen verwijderen; jezelf verlaten blijft kunnen).
- **Client:** [lib/household.js](../../lib/household.js) `createHousehold` ombouwen naar `supabase.rpc('create_household', …)`.
  Unit-test voor de RPC-wrapper toevoegen (DoD: elke nieuwe `export function` krijgt een test).

---

## Tier 2 — Hoog (nu)

### H1 (→ SEC-2). `run_recurring_expenses()` is oningelogd (anon) aanroepbaar zonder guard
- **Bewijs:** [supabase/migrations/0020_recurring_cron.sql:14-76](../../supabase/migrations/0020_recurring_cron.sql#L14-L76) —
  `SECURITY DEFINER`, geen `is_member`/`auth.uid()`-check, géén `revoke` → PUBLIC/anon-EXECUTE-default blijft staan.
  Live geverifieerd: anon staat in de grantees.
- **Impact:** anon POST naar `/rest/v1/rpc/run_recurring_expenses` forceert expense-materialisatie over **alle**
  huishoudens; herhaald = DoS-amplificatie (RLS-bypass via DEFINER).
- **Fix (migratie):** `revoke execute on function public.run_recurring_expenses() from public, anon, authenticated;`
  — alleen `service_role`/cron mag aanroepen (de cron-schedule draait als superuser, blijft werken).

### H2 (→ SEC-3). Onversleutelde Supabase-sessie (access + refresh token) op het toestel
- **Bewijs:** [lib/supabase.js:20-33](../../lib/supabase.js#L20-L33) — `storage: AsyncStorage` met `persistSession: true`.
  AsyncStorage = onversleutelde sqlite (`RKStorage`) op Android / plist op iOS. `expo-secure-store` is geïnstalleerd
  én als plugin geregistreerd ([app.config.js:20](../../app.config.js#L20)) maar **nergens gebruikt** (grep: 0 treffers).
  Versterkt door `allowBackup="true"`: de expo-secure-store backup-rules sluiten alleen de SecureStore-sharedpref uit,
  **niet** de AsyncStorage-sqlite-DB → de token reist mee in Android Auto Backup / device-transfer.
- **Impact:** bij toestel-compromittering, `adb backup`, forensische image of gecompromitteerd Google-account is de
  **refresh token** leesbaar → blijvende sessie-overname, ook na wachtwoordwijziging (tot expliciete intrekking).
- **Fix (gekozen: SecureStore-adapter):**
  1. Nieuwe `lib/secureStorage.js`: storage-adapter met `getItem/setItem/removeItem` op `expo-secure-store`
     (Keychain/Keystore, hardware-backed). Vang de ~2 KB-waardelimiet op met chunking (sessie-JSON splitsen over
     genummerde keys), of val terug op AsyncStorage-met-encryptie-sleutel-in-SecureStore voor grote waarden.
  2. In [lib/supabase.js](../../lib/supabase.js) de adapter meegeven op native; web houdt `undefined` (localStorage).
  3. Migratiepad: bij eerste start de bestaande AsyncStorage-sessie eenmalig overzetten en de oude key wissen.
  4. Aanvullend in een config-plugin / `expo-build-properties` de AsyncStorage-DB uitsluiten van backup
     (`<exclude domain="database" path="RKStorage"/>`) of `allowBackup="false"` — `/android` is CNG-gegenereerd
     en gitignored, dus **niet** het manifest handmatig editen.
  5. Unit-test voor de adapter (get/set/remove round-trip, chunk-grens).

---

## Tier 3 — Middel (kort daarna)

### M1 (→ INF-10). Brede PUBLIC/anon EXECUTE op SECURITY DEFINER-RPC's (defense-in-depth)
- **Bewijs:** live geverifieerd grantee `0` (PUBLIC) op `update_expense`, `update_purchase`, `create_expense`,
  `create_purchase`, `add_groceries`, `join_household`, `bump_product_usage`. Functioneel afgeschermd door interne
  `is_member`-checks (faalt bij `auth.uid()=null`), maar het anon-oppervlak hoort dicht. `record_receipt_scan`/
  `insert_catalog_product` tonen het juiste patroon.
- **Fix (migratie):** `revoke execute … from anon` (en `from public` waar de default nog staat) op alle RPC's die
  geen anon-pad nodig hebben. Lost de `get_advisors`-batch in één keer op. **Valt onder backlog INF-10.**

### M2 (→ SEC-4). `households_update` laat elk lid het huishouden wijzigen (incl. invite_code)
- **Bewijs:** [0001_init.sql:215-217](../../supabase/migrations/0001_init.sql#L215-L217) — `using (is_member(id))`, géén
  `WITH CHECK`. Een gewoon lid kan naam/budget aanpassen en de `invite_code` roteren (lock-out/troll). Inconsistent
  met `household_modules`/`members_update` die wél `is_owner` eisen.
- **Fix (migratie):** `using (is_owner(id)) with check (is_owner(id))`, of minimaal kolom-restrictie zodat
  `invite_code`/`created_by` niet door members muteerbaar zijn.

### M3 (→ bewuste keuze, géén actie). `update_expense`/`update_purchase` doen geen creator-check
- **Bewijs:** [0025_expense_shares_hardening.sql:112-170](../../supabase/migrations/0025_expense_shares_hardening.sql#L112-L170),
  [0033_update_purchase.sql](../../supabase/migrations/0033_update_purchase.sql) — valideren `is_member` maar niet
  `created_by = auth.uid()`. Elk lid kan andermans uitgave/aankoop binnen het huishouden bewerken.
- **Beslissing (2026-06-25):** dit is **bewust** — gedeelde administratie, iedereen in het huishouden mag een
  uitgave/aankoop aanpassen. **Geen fix.** (Bewaard als expliciete keuze in backlog §5.)

### M4 (→ SEC-5). `notify`-edge-function vertrouwt de webhook-payload volledig (vóór deploy)
- **Bewijs:** secret-check is solide (constant-time SHA-256, fail-closed). Maar `recipientId`/`title`/`body` komen
  ongevalideerd uit `record.*` ([supabase/functions/notify/core.js:30-48](../../supabase/functions/notify/core.js#L30-L48)),
  geen schema-validatie, geen token-eigenaarcontrole. `notify` is **nog niet gedeployed** (alleen `scan-receipt` live).
- **Fix (vóór deploy):** payload-schema + body-size-limiet valideren, server-side templating i.p.v. vrije `record.title`/
  `record.body`, en token-eigenaar (`recipientId`) verifiëren tegen `push_tokens`. **Gate op PLT-1-deploy.**

### M5 (→ SEC-6). Service-role-key in de dagelijkse lokale `.env` (dev-hygiëne)
- **Bewijs:** `SUPABASE_SERVICE_ROLE_KEY=sb_secret_…` is ingevuld in de werkmap-`.env`. **Niet** een repo-lek:
  gitignored en nooit gecommit (geverifieerd over hele historie); komt niet in de bundle.
- **Fix:** sleutel uit de app-`.env` halen; alleen ad-hoc in de shell injecteren bij de import-scripts
  (zie [VERIFICATIE.md:123](../../VERIFICATIE.md#L123)); periodiek roteren (rotatie-tabel staat al in SECURITY.md).

---

## Tier 4 — Laag / hygiëne (backlog)

- **L1 (→ INF-9). `scan-receipt` rate-limit is fail-open** ([supabase/functions/scan-receipt/index.ts:75-100](../../supabase/functions/scan-receipt/index.ts#L75-L100)) —
  bij RL-faal/ontbrekende header gaat de betaalde Orq-call door. Fail-closed maken + een globale Orq-kostencap toevoegen.
- **L2 (→ SEC-7). `npm audit`: 14 moderate, 0 high/critical** — relevante reachable: `qs` (ReDoS), `uuid <11.1.1`, beide via de
  Expo-build-toolketen, geen untrusted-input-pad. `npm audit fix` binnen de Expo-lockstep meenemen.
- **L3 (→ SEC-7). SSRF in CI-script** [scripts/refresh-off-delta.mjs:65-70](../../scripts/refresh-off-delta.mjs#L65-L70) — `filename` uit
  de OFF-index ongesanitized in de fetch-URL. Server-side CI-only; valideer/allowlist de bestandsnaam.
- **L4 (→ INF-10). Platform-toggles:** leaked-password-protection aanzetten in Supabase Auth; `pg_trgm` naar een eigen schema
  i.p.v. `public` (beide `get_advisors`-WARN).
- **L5 (→ INF-10). RLS-aan-zonder-policy** op `receipt_scans`/`push_deliveries`/`catalog_sync_state` is **veilig by-design**
  (weigert alle anon/authenticated); optioneel een no-op deny-policy om de advisor-ruis te dempen. Geen functionele actie.

---

## Te wijzigen/aan te maken bestanden (samengevat)

- **Nieuwe migraties** (via MCP `apply_migration` + als bestand in `supabase/migrations/`):
  `create_household`-RPC + `members_insert` revoke + `members_delete`-aanscherping (SEC-1); `run_recurring_expenses`
  revoke (SEC-2); RPC-grants revoke (INF-10/M1); `households_update` → owner (SEC-4).
- **Client:** [lib/household.js](../../lib/household.js) (createHousehold → RPC), nieuw `lib/secureStorage.js`,
  [lib/supabase.js](../../lib/supabase.js) (adapter), config-plugin voor backup-rules; bijbehorende `tests/*.test.js`.
- **Edge:** [supabase/functions/notify/core.js](../../supabase/functions/notify/core.js) + index (SEC-5),
  [supabase/functions/scan-receipt/index.ts](../../supabase/functions/scan-receipt/index.ts) (INF-9/L1).
- **Overig:** `.env`-hygiëne (SEC-6), `scripts/refresh-off-delta.mjs` (SEC-7/L3), `package-lock.json` (SEC-7/L2).

## Verificatie

1. **DB-fixes (SEC-1/SEC-2/INF-10/SEC-4):** na `apply_migration` opnieuw `get_advisors(type=security)` draaien — de
   RPC-anon-WARN's en eventuele RLS-bevindingen horen verdwenen. Aanvullend met een **tweede testaccount** (zie
   test-credentials in geheugen) tegen de live DB proberen: (a) `insert household_members` met vreemd `household_id` →
   moet **403/RLS-deny**; (b) anon `rpc('run_recurring_expenses')` → moet **403**; (c) niet-owner
   `update households … set invite_code` → deny. Sluit aan op de bestaande RLS-integratietests (geheugen: "RLS tests
   against live DB").
2. **Token-opslag (SEC-3):** op toestel inloggen, app killen, `adb shell run-as app.huishoek` → bevestig dat de
   AsyncStorage-sqlite **geen** `sb-…-auth-token` meer bevat en SecureStore wel; round-trip-unit-test groen.
3. **DoD-poort (CLAUDE.md):** elke nieuwe `export function` in `lib/*.js` heeft een unit-test; `npm test` groen;
   en `node scripts/mutation-check.mjs --since=origin/main` tot baseline voor de geraakte modules (o.a. `household`,
   `secureStorage`).
4. **Edge (SEC-5/INF-9):** lokaal de `notify`/`scan-receipt` core-functies unit-testen op afgewezen payloads /
   fail-closed RL vóór (re)deploy.

## Niet-bevindingen (expliciet uitgesloten na verificatie)

Geen hardcoded secrets in repo/historie · anon key is publiek-by-design · Sentry zonder PII (`sendDefaultPii:false`) ·
geen EXIF/GPS-lek (private buckets + signed URLs) · geen dynamische SQL met user-input · `search_path` overal gepind
(live) · storage cross-household gescoped · push-tokens gescoped op `auth.uid()` · CI SHA-gepind, geen
`pull_request_target` · barcode-lookup gesanitized (geen SSRF) · `receipts`-bucket bestaat niet (geen bonnetjes-lek) ·
geen drift live-vs-migraties · **gedeeld bewerken van uitgaven/aankopen is een bewuste keuze** (M3).
