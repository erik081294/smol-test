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

## 2. Openstaande Supabase-acties (DIT vereist de volgende sessie)
Volg het **Snelrecept** in `VERIFICATIE.md` (secrets uit `.env`, CLI ingelogd). Concreet:

### 2a. Migraties pushen
```bash
supabase migration list      # bevestig: lokaal t/m 0023, remote t/m 0022
supabase db push             # idempotent; past het ontbrekende 0023 toe
```
`0023_push_deliveries` = idempotentie-/audittabel voor remote push (RLS aan, geen policies →
alleen service-role). `0022_update_expense` zou al live moeten zijn (zie INF-1) — `db push`
bevestigt dat en doet niets dubbel.

### 2b. RLS-integratietests tegen de live DB
```bash
set -a; . ./.env; set +a
SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" npm test
```
Verwacht: **alle tests groen, 0 skipped** (incl. de nieuwe `update_expense`-RLS-case).

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
Volledig met `pad:regel` in **`docs/audit-2026-06-21.md`**. Prioriteit:
1. **Security-mediums** (kleine migratie + RPC): `expense_shares`-write-policy aanscherpen (S-M2)
   en `create_expense` membership-validatie van `paid_by`/shares (S-M1); `scan-receipt`
   rate-limit + MIME-whitelist (S-M4).
2. **Grootste structurele hefboom:** `useRealtimeQuery`-primitief — incrementele realtime-patches
   + gedeelde channels + verplicht `household_id`-filter (lost A-H1/H2 + P-H1/H3 op). Eigen ronde.
3. **Schaalbaarheid:** limit/venster op `task_completions`/`expenses`/`tasks` (P-H2); bulk-RPC
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
