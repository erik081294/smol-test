# Plan 04 — Kosten & autodelen (KOS-3, KOS-4, AUT-1, AUT-2)

**Backlog:** KOS-3 (kosten koppelen aan modules), KOS-4 (terugkerende uitgaven), AUT-1
(gedeeld item + reserveringskalender), AUT-2 (gebruik → kosten). **Soort:** uitbreiding van
de Kosten-module (0007). **Migratie:** ja. **Afhankelijkheden:** `expenses`/`create_expense`
(0007) en — voor KOS-3 — de gebouwde `purchases` (0013). Cores `lib/recurringExpense.js` en
`lib/reservations.js` (+ units) staan al klaar.

> Conventies: zie [`00-overzicht.md`](./00-overzicht.md). Geld in hele centen
> (`lib/expenses.js`: `computeShares`, `formatCents`, `parseAmountToCents`); uitgaven via
> `lib/useExpenses.js` (`addExpense` → `create_expense`).

## C1. KOS-3 — Kosten koppelen aan modules — migratie `NNNN_kosten_autodelen.sql` (deel 1)
```sql
alter table public.expenses add column if not exists source_type text
  check (source_type in ('purchase','grocery','reservation','recurring'));
alter table public.expenses add column if not exists source_id uuid;   -- polymorf (zachte ref, geen FK)
create index if not exists expenses_source_idx on public.expenses(source_type, source_id);
```
- Breid `create_expense` uit met `p_source_type`/`p_source_id` (nieuwe migratie die de functie
  `create or replace`t); geef ze door in `lib/useExpenses.js` → `addExpense`.
- **UI**: `app/purchase/[id].js` actie "Splitsen met het huishouden" → opent `app/expense/[id].js`
  voorgevuld (`description` = winkel + datum, `amountCents` = `total_cents`, `source_type='purchase'`,
  `source_id`). Idem (optioneel) vanaf een boodschap. Toon op de uitgave-rij een bron-icoon +
  terug-link wanneer de bron nog bestaat.

## C2. KOS-4 — Terugkerende uitgaven — (deel 2)
```sql
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  paid_by uuid not null references public.profiles(id),
  split_type text not null default 'equal' check (split_type in ('equal','shares','exact')),
  participants jsonb not null default '[]',   -- [{profile_id, weight?, amount_cents?}]
  recur_freq text not null default 'monthly' check (recur_freq in ('daily','weekly','monthly')),
  recur_interval int not null default 1,
  next_date date not null, active boolean not null default true,
  visibility text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with uuid[],
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now());
-- visibility-consistent CHECK + select public.enable_module_rls('recurring_expenses','created_by');
```
- Pure `lib/recurringExpense.js` (bestaat: `advance`, `dueRun`). Materialiseren via
  `lib/useRecurringExpenses.js`: bij het laden van Kosten de actieve sjablonen ophalen, met
  `dueRun` bepalen welke uitgaven ontbreken, ze via `create_expense` aanmaken (`spentOn` =
  occurrence-datum, shares uit `participants`, `source_type='recurring'`, `source_id=template.id`),
  `next_date` bijwerken. **Idempotentie:** unieke index op `expenses(source_type, source_id,
  spent_on)`. (Upgrade-pad: `pg_cron` + `run_recurring_expenses()` — documenteren.)
- **UI**: sectie "Terugkerende uitgaven" op `app/(tabs)/kosten.js` → `app/recurring-expense/[id].js`.

## C3. AUT-1 — Gedeeld item + reserveringskalender — (deel 3)
```sql
create table if not exists public.shared_resources ( -- volgt visibility-contract
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null, kind text default 'overig', notes text,
  visibility text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null, share_with uuid[],
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now());
-- visibility-consistent CHECK + select public.enable_module_rls('shared_resources','created_by');

create table if not exists public.reservations ( -- kind-tabel van shared_resources
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  resource_id uuid not null references public.shared_resources(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  note text, usage_value numeric, expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(), check (ends_at > starts_at));
-- RLS: reservations erven can_view van de parent-resource (kind-tabel-patroon); realtime.
```
- Pure `lib/reservations.js` (bestaat: `overlaps`, `hasConflict`, `onDay`).
- **Module** `delen` in `lib/modules.js` (`table:'shared_resources'`, primary:false) +
  `app/(tabs)/delen.js` (lijst) + `app/resource/[id].js` (maandkalender — hergebruik
  `lib/agenda.js` `monthMatrix`). Nieuwe reservering met `hasConflict`-waarschuwing (`Banner`).
  Icoon `share` bestaat al.

## C4. AUT-2 — Gebruik → kosten
- Op een reservering "Kosten verdelen" → bedrag + sleutel: **gelijk** onder de reserveerders,
  of **naar gebruik** (`usage_value`/km als gewicht → `computeShares` met `splitType='shares'`).
  Uitgave via `create_expense` (`source_type='reservation'`, `source_id`); schrijf `expense_id`
  terug op de reservering. Pure helper `usageParticipants(reservations)` in `lib/reservations.js`
  (+ unit-test met `computeShares`).

## C5. Tests, edge cases, acceptatie
- **Units**: `tests/recurringExpense.test.js`, `tests/reservations.test.js` (bestaan; vul
  `usageParticipants` aan). **RLS-integratie**: `reservations` erft `shared_resources`.
- **Edge cases**: KOS-4 idempotentie (unieke index); polymorfe `source_id` zonder FK → wees-
  uitgave blijft geldig (UI toont link alleen als bron bestaat); AUT-3 (tussen huishoudens)
  bewust **buiten scope** (vertrouwens-/uitnodigingsmodel) — genoteerd, niet half gebouwd.
- **Acceptatie**: bon "splitsen" → correcte gesplitste uitgave met terug-link; maandelijkse
  huur verschijnt automatisch (niet dubbel); auto reserveren in de kalender + dubbelboek-
  waarschuwing; "naar gebruik" verdelen → km-gewogen aandelen. `npm test` groen.

## C6. File-checklist
**Nieuw:** `supabase/migrations/NNNN_kosten_autodelen.sql` · `lib/useRecurringExpenses.js` ·
`lib/useResources.js` · `app/recurring-expense/[id].js` (+ `_layout.js`) · `app/(tabs)/delen.js`
· `app/resource/[id].js` (+ `_layout.js`). **Gewijzigd:** `create_expense`-RPC (`source_*`) ·
`lib/useExpenses.js` · `lib/reservations.js` (`usageParticipants`) · `lib/modules.js` (`delen`)
· `app/(tabs)/kosten.js` · `app/expense/[id].js` · `app/purchase/[id].js` · `lib/icons.js` ·
`tests/recurringExpense.test.js` · `tests/reservations.test.js` · `tests/rls.integration.test.js`
· `huishoek-backlog.md` · `docs/plans/00-overzicht.md`.
