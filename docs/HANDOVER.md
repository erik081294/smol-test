# HANDOVER — stand van zaken & openstaande Supabase-acties

> **Voor de volgende sessie (mét Supabase-toegang).** Dit is het startpunt: alles wat
> deze sessie is gebouwd staat in de repo op `main`; wat hieronder bij **§2** staat vereist
> Supabase en kon in de bouwsessie niet gedraaid worden. Bijgewerkt: **2026-06-21**.

## 1. Wat er deze ronde op `main` is gezet
- **UX-sweep** (editor-flow, gedeelde `Editor`-scaffold, ingeklapte "Delen met", bewerkbare
  uitgaven + recept-ingrediënten, slimme defaults). Migratie **`0022_update_expense.sql`**.
- **PLT-1 trap 2 — remote push, productie-klaar.** `supabase/functions/notify/` opgesplitst in
  pure kern (`core.js`, event-router + 7 units) + impure schil (`index.ts`: fail-closed
  constant-time secret-check, idempotentie via `push_deliveries`, batchen, token-pruning).
  Migratie **`0023_push_deliveries.sql`**, `config.toml` (`[functions.notify] verify_jwt=false`).
- **Audit** (architectuur/security/performance): `docs/audit-2026-06-21.md`.
- Verificatie in de bouwsessie: **`npm test` → 196 tests, 0 fail** (18 RLS-tests geskipt zonder
  secrets), **`eslint` 0 errors**.

## 2. Openstaande Supabase-acties
> **Let op:** veel hiervan is op 2026-06-21 via de Supabase-connector gedaan. De **live
> status + uitvoeringslog** staat in **`docs/vervolgplan-2026-06-21.md`** (dat is nu de
> canonieke voortgangstracker). Hieronder per actie de actuele stand.

### 2a. Migraties pushen — ✅ GEDAAN (2026-06-21, via connector)
`0023_push_deliveries` (push-idempotentie/audit), `0024_function_search_path` (B4) **én**
`0025_expense_shares_hardening` (B1/B2 + C2) zijn live toegepast. **DB staat nu op `0025`.**
Geverifieerd via `list_migrations` + advisors. Niets meer te pushen tot er een nieuwe migratie bijkomt.

### 2b. RLS-integratietests tegen de live DB — ◐ kern bewezen via connector
De volledige **JS-suite** (`npm test` met secrets) vereist de service-role-key + egress naar
`*.supabase.co` en kon niet vanuit de web-container draaien. De **kern-RLS + RPC's** zijn wél
bewezen via **`docs/rls-connector-check.sql`** (13/13, rol/JWT-impersonatie + rollback). Voor de
volledige JS-run met 0 skipped: secrets + allowlist (kop van `VERIFICATIE.md`) of lokaal draaien.

### 2c. PLT-1 trap 2 live zetten (flip-on)
Exact stap-voor-stap in **`docs/notify-setup.md`**. Kort:
1. `supabase secrets set NOTIFY_WEBHOOK_SECRET=<lang-geheim>` — **verplicht** (de functie is
   fail-closed en weigert zonder dit secret).
2. `supabase functions deploy notify`.
3. Database Webhook op `public.tasks` (insert + update) → Edge Function `notify`, met HTTP-header
   `x-notify-secret` = hetzelfde geheim.
4. **Toesteltest** (2 accounts, dev build): A wijst B een taak toe → B krijgt push. Idempotentie
   + token-pruning verifiëren (checklist in `notify-setup.md`).

### 2d. Handmatige 2-account-rooktest
`VERIFICATIE.md` Stap 3 (Agenda/Schoonmaak/Kosten/Planten/Navigatie).

## 3. Aanbevolen follow-ups uit de audit (niet-blokkerend)
Volledig met `pad:regel` in **`docs/audit-2026-06-21.md`**. Stand:
1. **Security-mediums:** ✅ S-M1 (`create_expense`/`update_expense` membership-validatie) en
   ✅ S-M2 (`expense_shares`-write-policy) gedaan via migratie `0025`. ⏳ Resteert S-M4
   (`scan-receipt` rate-limit + MIME-whitelist).
2. **Grootste structurele hefboom:** ◐ realtime-primitief — ✅ `useRealtimeReload` extractie (C1)
   + ✅ brede subscripties gefilterd op `household_id` (C2, migr. `0025`). ⏳ Resteert C3
   (incrementeel patchen + gedeelde channels, vereist device-verificatie).
3. **Schaalbaarheid:** ⏳ limit/venster op `task_completions`/`expenses`/`tasks` (P-H2); bulk-RPC
   voor bon→voorraad (P-H4).

## 4. Waar staat wat
| Onderwerp | Bestand(en) |
|---|---|
| Backlog (canonieke status) | `huishoek-backlog.md` §6 |
| Remote-push setup + flip-on + troubleshooting | `docs/notify-setup.md` |
| Audit + geprioriteerde roadmap | `docs/audit-2026-06-21.md` |
| Migratie-/RLS-runbook (snelrecept + secrets) | `VERIFICATIE.md` |
| Notificatie-plan | `docs/plans/05-notificaties.md` |
| Edge Functions | `supabase/functions/notify/` (`core.js` + `index.ts`), `supabase/functions/scan-receipt/` |
| Nieuwe migraties deze ronde | `supabase/migrations/0022_update_expense.sql`, `0023_push_deliveries.sql` |

## 5. Branches
Alles is naar `main` gemerged. De feature-branches `claude/ux-flow-sweep` en
`claude/notify-remote-push` zijn daarmee verbruikt en mogen opgeruimd worden.
