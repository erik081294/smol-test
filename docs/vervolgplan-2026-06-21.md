# Vervolgplan — na de overdracht van 2026-06-21

> Vervolg op **`docs/HANDOVER.md`**. Geschreven nadat de live Supabase-status deze sessie
> **geverifieerd** is via de Supabase-connector (project `huishoek`, ref `nayqbzekpdyigvfcroxd`,
> `ACTIVE_HEALTHY`). Dit plan vervangt de losse to-do's uit de handover door een geordend
> traject met sporen, volgorde en afhankelijkheden.

## 0. Geverifieerde startstand (deze sessie gemeten, niet aangenomen)
- **DB-migraties live t/m `0022_update_expense`.** `0023_push_deliveries` staat in de repo maar
  is **nog niet toegepast** (bevestigd via `list_migrations`). Klopt met handover §2a.
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

### A1. Migratie `0023_push_deliveries` pushen — *kan via connector*
- Idempotent; voegt alleen de audit-/idempotentietabel toe (RLS aan, geen policies → service-role).
- Daarna `get_advisors(security)` opnieuw draaien om te bevestigen dat er geen nieuwe RLS-gaten
  ontstaan (verwacht: ongewijzigd t.o.v. §0).
- **Klaar als:** `list_migrations` toont `0023`; advisors ongewijzigd.

### A2. RLS-integratietests tegen live DB — *vereist secrets/runner*
- Recept staat in `VERIFICATIE.md` (Snelrecept). Verwacht: **alle tests groen, 0 skipped**,
  inclusief de nieuwe `update_expense`-RLS-case.
- In de remote container kan dit alleen met `EXPO_PUBLIC_*` + `SUPABASE_SERVICE_ROLE_KEY` als
  env-vars **en** `*.supabase.co`/`*.pooler.supabase.com` op de network-allowlist (zie kop van
  `VERIFICATIE.md`). Anders lokaal draaien.
- **Klaar als:** 196 tests groen, 0 skipped.

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

| Item | Wat | Bron |
|---|---|---|
| B1 | `expense_shares`-write-policy aanscherpen (alleen door betaler/lid binnen huishouden) | audit S-M2 |
| B2 | `create_expense`: membership-validatie van `paid_by` én alle `shares`-leden | audit S-M1 |
| B3 | `scan-receipt`: rate-limit + MIME-whitelist op de upload | audit S-M4 |
| B4 | `set search_path = ''` (of expliciet) op `enable_module_rls` en `search_catalog` | advisor |
| B5 | `pg_trgm` uit `public` naar een eigen schema (`extensions`) verplaatsen | advisor |
| B6 | Leaked-password-protection aanzetten (Auth-instelling, Dashboard) | advisor |

- B1/B2/B4/B5 → één migratie `0024_security_hardening.sql` + RLS-tests die de nieuwe
  afwijzingen bewijzen. B3 → revisie + redeploy van `scan-receipt`. B6 → Dashboard-toggle.
- **Volgorde:** ná A1 (zodat de DB op een schone, bekende staat staat).

---

## Spoor C — Structurele hefboom: `useRealtimeQuery` (eigen ronde)
Grootste architectuur-/performance-winst uit de audit (lost A-H1/H2 + P-H1/H3 op). Eén primitief
`useRealtimeQuery(queryFn, { table, filter })` dat:
1. de gewijzigde rij **incrementeel** uit `payload.new/.old` patcht i.p.v. volledig herlaadt;
2. channel-uniciteit + optimistische rollback + pending-delete-filtering centraliseert;
3. een **verplicht `household_id`-filter** op de subscriptie afdwingt (lost de ongefilterde
   `expense_shares`-subscriptie in `useExpenses.js:53` op).
- `useCollection`/`useExpenses`/`useMealPlan`/`useReservations` bouwen erbovenop i.p.v. ~80 regels
  te dupliceren. Inspanning **L**; plan dit als losse ronde met eigen testdekking.

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
1. **A1** (push 0023 + advisors) → **A2** (RLS-tests) — herstel repo↔DB-pariteit.
2. **A3 + A4** (flip-on + rooktest) — sluit PLT-1 en INF-1 af.
3. **Spoor B** (één security-migratie + scan-receipt-revisie + Auth-toggle).
4. **Spoor C** (`useRealtimeQuery`) als eigen ronde, of **Spoor D** (BOO-9/PLT-6) als de voorkeur
   naar voelbare features gaat. C is de duurzamere investering; D levert sneller zichtbaar resultaat.

## Waar staat wat (ongewijzigd t.o.v. handover)
| Onderwerp | Bestand |
|---|---|
| Overdracht / openstaande acties | `docs/HANDOVER.md` |
| Audit + geprioriteerde roadmap | `docs/audit-2026-06-21.md` |
| Migratie-/RLS-runbook | `VERIFICATIE.md` |
| Push-setup + flip-on | `docs/notify-setup.md` |
| Backlog (canonieke status) | `huishoek-backlog.md` §6 |
