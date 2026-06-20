# Terugkerende uitgaven — server-side (KOS-4)

Terugkerende uitgaven (huur, abonnementen) worden op twee manieren gematerialiseerd,
allebei **idempotent** via de partiële unieke index
`expenses(source_id, spent_on) where source_type = 'recurring'` (migratie `0017`):

1. **Server (primair)** — `public.run_recurring_expenses()` (migratie `0020`), dagelijks
   gedraaid door **pg_cron**. Werkt onafhankelijk van of de app openstaat. Dekt de
   `equal`-splitsing cent-exact (de dominante huur/abonnement-case).
2. **Client (vangnet)** — `lib/useRecurringExpenses.js` materialiseert bij het openen van
   Kosten alsnog wat ontbreekt (alle splittypen, via `lib/expenses.computeShares`). Dubbel
   draaien kan geen kwaad: de unieke index houdt het schoon.

## Activeren (eenmalig, jouw kant)
1. Push de migraties: `supabase db push` (zet `0019` + `0020`).
2. **pg_cron aanzetten** (indien nog niet): Supabase Dashboard → Database → Extensions →
   `pg_cron` inschakelen. Daarna draait `0020` de `cron.schedule(...)` vanzelf (de migratie
   is non-fataal als de extensie ontbreekt — dan wordt alleen de schedule overgeslagen).
3. Controle: `select * from cron.job;` toont de job `run-recurring-expenses` (03:05 dagelijks).
   Handmatig testen kan altijd met `select public.run_recurring_expenses();` (geeft het
   aantal aangemaakte uitgaven terug).

## Let op
- `shares`/`exact`-sjablonen worden door de cron **niet** server-side gesplitst (de
  cent-exacte verdeling leeft in JS); die materialiseren via het client-vangnet. `equal`
  (verreweg het meest voorkomend) gaat volledig server-side.
- Wil je geen pg_cron? Roep `run_recurring_expenses()` aan vanuit een externe scheduler
  (bv. een dagelijkse GitHub Action met de service-role) — dezelfde functie, zelfde garanties.
