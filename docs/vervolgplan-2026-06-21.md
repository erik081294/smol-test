# Vervolgplan — na de overdracht van 2026-06-21

> Vervolg op **`docs/HANDOVER.md`**. Geschreven nadat de live Supabase-status deze sessie
> **geverifieerd** is via de Supabase-connector (project `huishoek`, ref `nayqbzekpdyigvfcroxd`,
> `ACTIVE_HEALTHY`). Dit plan vervangt de losse to-do's uit de handover door een geordend
> traject met sporen, volgorde en afhankelijkheden.

## Uitvoeringslog (2026-06-21, deze sessie)
- ✅ **A1 — `0023_push_deliveries` live** via de connector. Geverifieerd met `list_migrations`.
  Advisors ongewijzigd op één verwachte `INFO rls_enabled_no_policy` op `push_deliveries` na —
  by-design (service-role-only, geen policies).
- ✅ **B4 — vaste `search_path`** op `enable_module_rls` en `search_catalog` (migratie
  **`0024_function_search_path`**, live). Beide `function_search_path_mutable`-WARN's zijn weg;
  `search_catalog('melk')` geeft nog steeds resultaten (pg_trgm-resolutie intact).
- ◐ **A2 — units groen** (`npm test` → **196 / 0 fail / 18 skipped**). De 18 skipped zijn de
  live-RLS-tests; die vereisen secrets + Supabase-netwerk (niet in deze container) → de JS-suite
  kan hier niet draaien (egress-allowlist blokkeert `*.supabase.co`: `host_not_allowed`).
- ✅ **A2′ — RLS + RPC live geverifieerd via de connector** (alternatief voor de geblokkeerde
  JS-suite). `docs/rls-connector-check.sql` bouwt fixtures, dwingt RLS af als `authenticated` met
  wisselende `request.jwt.claims.sub`, en rolt alles terug. Uitgebreid naar **13/13 PASS, 0 residu**:
  tasks-zichtbaarheid + insert-policy, `expense_shares`-kind-RLS, én de nieuwe B1/B2/C2-cases.
- ✅ **C1 — `useRealtimeReload`-primitief**: de gedupliceerde realtime-/channel-boilerplate uit
  **7** hooks geëxtraheerd naar `lib/useRealtimeReload.js`. Gedrag-behoudend; −69 regels,
  lint 68 → 61 warnings (0 errors), units 196/0. Eén seam voor de volgende scale-stappen.
- ✅ **B1 + B2 — kosten-hardening** (migratie **`0025_expense_shares_hardening`**, live):
  `create_expense`/`update_expense` valideren nu dat `paid_by` + elke deelnemer lid is; de
  `expense_shares`-schrijfpolicy is aangescherpt tot de maker van de parent-uitgave. Bewezen via
  de connector-check (B1 weigert niet-leden, B2 blokkeert niet-maker). Advisors: geen nieuwe gaten.
- ✅ **C2 — brede subscripties gefilterd** (scale + security): `expense_shares` kreeg een
  gedenormaliseerde `household_id` (migr. `0025`, backfill `shares_null_hh=0`); `purchase_items`
  had die al (0013). `useExpenses`/`usePurchases` filteren nu beide kindtabel-subscripties op
  `household_id` → geen cross-household refetch-storms meer. Units 196/0, lint 0 errors.
- ⏳ **Open (mens/secret/toestel nodig):** A2-volledige-JS-suite, A3 flip-on, A4 rooktest,
  B3 (`scan-receipt` rate-limit/MIME), B5 (pg_trgm verplaatsen — afhankelijke index), B6
  (Auth-toggle leaked-password-protection), C3 (incrementeel patchen + gedeelde kanalen).

## 0. Geverifieerde startstand (deze sessie gemeten, niet aangenomen)
- **DB-migraties** waren bij aanvang live t/m `0022_update_expense`; `0023`–`0025` zijn deze
  sessie toegepast (zie uitvoeringslog). DB staat nu op **`0025`**.
- **Edge Functions:** alleen **`scan-receipt`** is gedeployed (`verify_jwt: true`). De
  **`notify`-functie is nog niet gedeployed** — PLT-1 trap 2 is dus écht nog "flip-off".
- **Security-advisors (allen WARN, geen ERROR):** mutable `search_path` op `enable_module_rls`
  en `search_catalog`; `pg_trgm` in `public`-schema; leaked-password-protection uit; en de
  bekende "SECURITY DEFINER callable by anon/authenticated"-lints op de RLS-helpers + RPC's.
  Geen kritieke, direct exploiteerbare lekken — consistent met de audit.

> **Belangrijk:** de meeste §2-acties uit de handover kunnen nu **deze sessie** via de connector,
> behalve het echte flip-on van push (vereist een geheim + Database Webhook + 2-toesteltest).
> Dit plan markeert per stap of die geautomatiseerd kan of menselijke input/toestel vereist.

---

## Spoor A — Live zetten & verifiëren (deblokkeert PLT-1 + INF-1)
Doel: repo en live-DB weer gelijk, en de notificatie-pijplijn aantoonbaar werkend.

### A1. Migratie `0023_push_deliveries` pushen — ✅ gedaan (deze sessie)
- Idempotent; voegt alleen de audit-/idempotentietabel toe (RLS aan, geen policies → service-role).
- Daarna `get_advisors(security)` opnieuw draaien om te bevestigen dat er geen nieuwe RLS-gaten
  ontstaan (verwacht: ongewijzigd t.o.v. §0).
- **Klaar als:** `list_migrations` toont `0023`; advisors ongewijzigd.

### A2. RLS-integratietests tegen live DB — *JS-suite vereist secrets/egress; kern via connector ✅*
- De JS-suite (`tests/rls.integration.test.js`) vereist `SUPABASE_SERVICE_ROLE_KEY` + egress naar
  `*.supabase.co`. In de web-container is dat geblokkeerd (`host_not_allowed`) en de service-role-
  key is niet via de connector beschikbaar → de suite skipt (18). Voor de volle run: zie de kop van
  `VERIFICATIE.md` (env-vars + allowlist), of lokaal draaien.
- **Alternatief dat hier wél kan, en is gedraaid:** `docs/rls-connector-check.sql` verifieert de
  RLS + RPC's rechtstreeks via de connector (rol/JWT-impersonatie + rollback). **13/13 PASS** op
  2026-06-21 (tasks-zichtbaarheid/insert + `expense_shares`-kind-RLS + B1/B2/C2).
- **Klaar als:** óf de JS-suite groen met 0 skipped, óf de connector-check 13/13 (gedaan voor de kern).

### A3. PLT-1 trap 2 flip-on — *vereist mens + 2 toestellen*
Exact stappenplan in `docs/notify-setup.md`. Kort:
1. `NOTIFY_WEBHOOK_SECRET` zetten (lang geheim) — **verplicht**, functie is fail-closed.
2. `notify` deployen (nu nog afwezig; `config.toml` heeft `verify_jwt=false`).
3. Database Webhook op `public.tasks` (insert+update) → Edge Function `notify`, header
   `x-notify-secret` = hetzelfde geheim.
4. 2-account-toesteltest (dev build): A wijst B een taak toe → B krijgt push; idempotentie +
   token-pruning verifiëren.
- **Klaar als:** push aantoonbaar afgeleverd; PLT-1 → ✅ in de backlog.

### A4. Handmatige 2-account-rooktest — *vereist mens*
`VERIFICATIE.md` Stap 3 (Agenda/Schoonmaak/Kosten/Planten/Navigatie). Sluit INF-1 af.

---

## Spoor B — Security-hardening (klein, hoge waarde, niet-blokkerend)
Bundel deze in één migratie + één `scan-receipt`-revisie. Bronnen: audit `docs/audit-2026-06-21.md`
(S-M1/2/4) + de advisor-lints uit §0.

| Item | Wat | Bron | Status |
|---|---|---|---|
| B1 | `create_expense`/`update_expense`: membership-validatie van `paid_by` + alle `shares`-leden | audit S-M1 | ✅ migr. `0025` |
| B2 | `expense_shares`-write-policy aanscherpen (alleen de maker van de parent-uitgave) | audit S-M2 | ✅ migr. `0025` |
| B3 | `scan-receipt`: rate-limit + MIME-whitelist op de upload | audit S-M4 | ⏳ edge-revisie |
| B4 | `set search_path = public` op `enable_module_rls` + `search_catalog` | advisor | ✅ migr. `0024` |
| B5 | `pg_trgm` uit `public` naar een eigen schema (`extensions`) verplaatsen | advisor | ⏳ apart |
| B6 | Leaked-password-protection aanzetten (Auth-instelling, Dashboard) | advisor | ⏳ dashboard |

- **B1/B2/B4 gedaan** en bewezen via `docs/rls-connector-check.sql` (13/13) + advisors (geen nieuwe
  gaten). **Resteert:** B3 (`scan-receipt`-revisie + redeploy), B5 (apart, vanwege de afhankelijke
  trigram-index op `catalog_products.search`), B6 (Auth-dashboard-toggle — geen connector-tool).

---

## Spoor C — Structurele hefboom: realtime-primitief (eigen ronde)
Grootste architectuur-/performance-winst uit de audit (lost A-H1/H2 + P-H1/H3 op). Gefaseerd:

### C1 — `useRealtimeReload`-primitief + dedup — ✅ gedaan (deze sessie)
De identieke loadRef + channel-boilerplate stond in **7** hooks (`useCollection`, `useExpenses`,
`useTaskCompletions`, `useMealPlan`, `useReservations`, `usePurchases`, `useRecipe`). Geëxtraheerd
naar **`lib/useRealtimeReload.js`** (één plek voor channel-uniciteit + opruimen + reload-on-change).
Gedrag-behoudend; −69 regels in de hooks, lint-warnings 68 → 61 (0 errors), units 196/0. Dit is nu
de **enige seam** waar C2/C3 landen i.p.v. 7 plekken.

### C2 — Filter de brede subscripties (scale + security) — ✅ gedaan (deze sessie)
De `expense_shares`-subscriptie luisterde **ongefilterd** op de hele tabel: een wijziging in een
wíllekeurig ander huishouden triggerde hier een refetch (RLS blokkeert de payload, maar het event +
de refetch gebeuren wél). Opgelost: `expense_shares` kreeg een gedenormaliseerde `household_id`
(migr. `0025`, gevuld in `create_expense`/`update_expense` + backfill); `purchase_items` had die al
(0013). Beide bronnen in `useExpenses`/`usePurchases` krijgen nu een `household_id=eq.…`-filter.
Geverifieerd via de connector (backfill `shares_null_hh=0`, RPC vult household_id) + units/lint.

### C3 — Incrementeel patchen + gedeelde kanalen — ⏳ later (vereist device-verificatie)
Voor de platte collecties (`useCollection` met `select '*'`) kan het primitief de gewijzigde rij uit
`payload.new/.old` patchen i.p.v. volledig herladen. Geldt **niet** voor de embedded-select-hooks
(`expenses`+shares, `purchases`+items, mealplan+recipe): die hebben de join nodig en blijven
reload-on-event. Plus: kanalen bundelen om het aantal WebSocket-subscripties op het Thuis-scherm te
drukken. Beide raken runtime-realtime-gedrag → op een dev build verifiëren.

---

## Spoor D — Volgende feature-ronde (al gekozen in de backlog, 2026-06-21)
Pas oppakken ná Spoor A (live + verifieerbaar). Twee kandidaten staan al "gekozen":
- **BOO-9 — Barcode → catalogus** (`expo-camera` barcode-scanner → match op `products`/Open Food
  Facts → één tik naar lijst of voorraad; onbekende code → inline nieuw product). Mogelijk kleine
  migratie: `barcode`-kolom + index op `products`. Meest voelbare nieuwe feature, hergebruikt alles.
- **PLT-6 — Activiteitenfeed** ("Tim vinkte 'stofzuigen' af"). Nu goedkoop: voed uit
  `task_completions` (0012) + realtime + de nieuwe `push_deliveries`-audit (0023). Pure formatter
  `lib/activity.js` + feed-scherm/Thuis-kaart, gescopet via `can_view`/`is_member`.

Kleinere follow-ups die meeliften: **MLT-3** (recept-foto) samen met **STR-4 `PhotoPicker`**-extractie;
**UX-4** dark-mode afmaken (scaffold staat er al).

---

## Aanbevolen volgorde
**Gedaan deze sessie (connector-only):** A1, A2′ (connector-RLS 13/13), B1, B2, B4, C1, C2.
Resterend, gegroepeerd op wat het vereist:
1. **Vereist een dev build / 2 toestellen:** A3 + A4 (push flip-on + rooktest) → sluit PLT-1/INF-1 af;
   C3 (incrementeel patchen + gedeelde kanalen).
2. **Vereist het Auth-dashboard:** B6 (leaked-password-protection).
3. **Nog connector-/code-only mogelijk:** B3 (`scan-receipt` rate-limit + MIME), B5 (pg_trgm
   verplaatsen, met zorg om de trigram-index), en de volledige JS-RLS-suite (env-vars + egress).
4. **Daarna features:** Spoor D (BOO-9 barcode / PLT-6 activiteitenfeed).

## Waar staat wat
| Onderwerp | Bestand |
|---|---|
| Overdracht / openstaande acties | `docs/HANDOVER.md` |
| Audit + geprioriteerde roadmap | `docs/audit-2026-06-21.md` |
| Migratie-/RLS-runbook | `VERIFICATIE.md` |
| Connector-RLS-/RPC-verificatie (zonder secrets) | `docs/rls-connector-check.sql` |
| Push-setup + flip-on | `docs/notify-setup.md` |
| Backlog (canonieke status) | `huishoek-backlog.md` §6 |
