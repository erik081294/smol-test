---
name: supabase-migraties
description: Een nieuwe database-migratie of edge-function live zetten op het hosted Supabase-project en het resultaat verifiëren (incl. de live RLS-testsuite). Gebruik deze skill vóór je supabase/migrations/ of supabase/functions/ aanraakt. Trefwoorden: migratie, supabase, RLS, apply_migration, db push, edge function, deploy, list_migrations.
---

# Supabase-migraties & edge-functions

Hosted project: `huishoek`, ref `nayqbzekpdyigvfcroxd` (eu-central-1). De CLI is ingelogd en
gelinkt (`/opt/homebrew/bin/supabase`); alle drie de secrets staan in `.env` (gitignored).
Volledig runbook: [VERIFICATIE.md](../../../VERIFICATIE.md).

## ⚠️ `supabase db push` is KAPOT in dit project

De migratie-historie is diverged: migraties vanaf `0016` zijn via MCP `apply_migration`
toegepast en staan remote onder *timestamp*-versies, terwijl de repo *genummerde* bestanden
heeft. `db push` wil daardoor oude migraties opnieuw draaien of faalt. **Niet pushen, en ook
niet het gesuggereerde `migration repair --status reverted` draaien** (invasief).

## Nieuwe migratie — het recept

1. **Bepaal het vrije nummer tegen de bron:** MCP `list_migrations` (of
   `supabase migration list`). Vertrouw nóóit een nummer uit een doc of memory — die lopen
   achter. Let op: een feature-branch kan minder migratie-bestanden hebben dan live al heeft.
2. **Schrijf het bestand** `supabase/migrations/NNNN_naam.sql` in de repo. Gebruik idempotente
   DDL (`drop ... if exists` vóór `create`/`add`) — dat maakt her-appliceren veilig.
3. **Zet 'm live via MCP `apply_migration`** (project_id `nayqbzekpdyigvfcroxd`) met dezelfde
   SQL. Live-wijzigingen vereisen expliciete toestemming van de gebruiker — een generiek
   "test het even" is niet genoeg; vraag het of wacht op de opdracht.
4. **Verifieer tegen de bron:** MCP `execute_sql` (bestaat de tabel/kolom/policy?) +
   `list_migrations` (staat de versie erbij?).
5. **Raakt de migratie RLS of RPC's? Draai de live RLS-suite** (maakt tijdelijke
   `rlstest+…@example.com`-gebruikers aan en ruimt ze op; verwacht 0 skips):

   ```bash
   set -a; . ./.env; set +a
   SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" \
     SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
     npm test
   ```

6. **Docs-sync:** werk backlog §6 bij in dezelfde PR (zie de `pr-en-dod`-skill).

## Edge-functions deployen

Via MCP `deploy_edge_function` (de CLI-route wordt door de permissie-classifier geblokkeerd;
de MCP-route werkt na expliciete goedkeuring van de gebruiker). Bundel-bestandspaden moeten
geprefixt zijn met `functions/…` (entrypoint bv. `functions/assistant/index.ts`). Gedeelde
tool-packs staan onder `supabase/functions/_shared/`. Raak je de assistent-functie aan, lees
dan eerst [docs/assistent-architectuur.md](../../../docs/assistent-architectuur.md).

## Debuggen

Begin bij MCP `get_logs` en `get_advisors` vóór je iets wijzigt. Schema-inzicht: `list_tables`.
