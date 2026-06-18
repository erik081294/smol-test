# Plan 04 — Kosten & autodelen uitbreiding

**Backlog:** KOS-3 (kosten koppelen aan modules), KOS-4 (terugkerende uitgaven), AUT-1
(gedeeld item + reserveringskalender), AUT-2 (gebruik → kosten). **Soort:** uitbreiding van
de bestaande Kosten-module (0007). **Migratie:** ja. **Afhankelijkheden:** bouwt op
`expenses`/`create_expense` (0007); AUT-2 op AUT-1. Plan 02 versterkt KOS-3 (bon → uitgave).

## Waarom

De WieBetaaltWat-laag uitbouwen tot waar kosten écht ontstaan: een **bon of aankoop** met
één tik als **gedeelde uitgave** (KOS-3), **terugkerende uitgaven** voor huur/abonnementen
(KOS-4), en **informeel autodelen** — een gedeeld item (auto, boormachine) met een
**reserveringskalender** (AUT-1) waarvan het gebruik naar **kosten** wordt vertaald (AUT-2).
Alles leunt op de bestaande, atomaire `create_expense`-RPC en `lib/expenses.js`.

---

## KOS-3 — Kosten koppelen aan modules

### Datamodel — migratie `NNNN_kosten_uitbreiding.sql` (deel 1)
Een lichte, optionele terugkoppeling van een uitgave naar zijn bron.
```sql
alter table public.expenses add column if not exists source_type text
  check (source_type in ('purchase','grocery','reservation'));   -- null = handmatig
alter table public.expenses add column if not exists source_id uuid;             -- losse ref (geen harde FK: polymorf)
create index if not exists expenses_source_idx on public.expenses(source_type, source_id);
```
> Bewust een **polymorfe, zachte** referentie (geen FK) zodat één kolompaar meerdere
> bronsoorten dekt zonder per bron een kolom toe te voegen. De UI/joins resolven op
> `source_type`.

### App-laag
- **Vanaf een bon** (plan 02, `purchases`): actie "Splitsen met het huishouden" → open de
  uitgave-editor (`app/expense/[id].js`) voorgevuld met `description = store + datum`,
  `amountCents = total_cents`, `source_type='purchase'`, `source_id=purchase.id`. Daarna
  loopt het via de bestaande `addExpense`/`create_expense`.
- **Vanaf een boodschap**: idem met `source_type='grocery'` (handig voor een losse
  voorgeschoten boodschap).
- **Uitbreiding `create_expense`-RPC** met twee parameters `p_source_type`, `p_source_id`
  (default null) en ze meeschrijven; pas `lib/useExpenses.js` → `addExpense` aan om ze door
  te geven. Toon op de uitgave-rij een klein bron-icoon + link terug naar de bron.

### Tests
- RLS/integratie ongewijzigd (zelfde tabel). Pure logica: n.v.t. (UI-bekabeling).

---

## KOS-4 — Terugkerende uitgaven

### Datamodel — `NNNN_kosten_uitbreiding.sql` (deel 2)
Een **sjabloon** dat periodiek een echte `expenses`-rij oplevert. Volgt het
zichtbaarheidscontract (kan subgroep-scoped zijn).
```sql
create table if not exists public.recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  description   text not null,
  amount_cents  int  not null check (amount_cents > 0),
  paid_by       uuid not null references public.profiles(id),
  split_type    text not null default 'equal' check (split_type in ('equal','shares','exact')),
  participants  jsonb not null default '[]',    -- [{profile_id, weight?, amount_cents?}]
  recur_freq    text not null default 'monthly' check (recur_freq in ('daily','weekly','monthly')),
  recur_interval int not null default 1,
  next_date     date not null,                  -- eerstvolgende vervaldatum
  active        boolean not null default true,
  visibility    text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
alter table public.recurring_expenses drop constraint if exists rec_exp_visibility_consistent;
alter table public.recurring_expenses add constraint rec_exp_visibility_consistent check (
  (visibility='subgroup' and share_subgroup_id is not null)
  or (visibility<>'subgroup' and share_subgroup_id is null));
select public.enable_module_rls('recurring_expenses', 'created_by');
```

### Pure logica — `lib/recurringExpense.js` (nieuw)
Hergebruik de herhaal-conventie van `lib/recurrence.js` (zelfde freq/interval).
```js
import { RECUR } from './constants';
// Volgende datum na `date` voor een freq/interval (analoog aan recurrence.nextDueDate,
// maar voor een kale datum i.p.v. een task).
export function advance(date, freq, interval) { /* -> Date */ }
// Welke occurrences zijn "verschuldigd" t/m vandaag? -> aantal + nieuwe next_date.
// Voorkomt een stortvloed: cap op bijv. 12 inhaalslagen.
export function dueRun(template, now = new Date(), cap = 12) { /* -> { occurrences: [date,…], nextDate } */ }
```

### Materialiseren (twee opties — kies één)
- **Client-side (eenvoud, geen extra infra):** een hook `lib/useRecurringExpenses.js` die bij
  het laden van Kosten de actieve sjablonen ophaalt, met `dueRun` bepaalt welke uitgaven
  nog ontbreken, ze via `create_expense` aanmaakt (één per occurrence, met `spentOn` = de
  occurrence-datum en de berekende shares uit `participants`), en `next_date` bijwerkt.
  Idempotent maken via een `source_type='recurring'`/`source_id=template.id`-check zodat
  dubbele aanmaak bij gelijktijdige clients wordt vermeden (of een unique index op
  `(source_id, spent_on)`).
- **DB-cron (robuuster):** een `security definer` functie `run_recurring_expenses()` +
  een `pg_cron`-schedule (dagelijks). Noteer als upgrade-pad; vergt alleen DB-config.

### Units — `tests/recurringExpense.test.js`
- `advance` voor dag/week/maand; `dueRun` levert het juiste aantal occurrences sinds
  `next_date`, respecteert de cap, en berekent de nieuwe `next_date` correct (ook als er
  niets verschuldigd is → 0 occurrences, ongewijzigde next_date).

### UI
- In `app/(tabs)/kosten.js`: een sectie/knop "Terugkerende uitgaven" → een sheet/scherm
  (`app/recurring-expense/[id].js`) om sjablonen te beheren (zelfde velden als de
  uitgave-editor + freq/interval + startdatum + aan/uit).

---

## AUT-1 — Gedeeld item + reserveringskalender

### Datamodel — `NNNN_autodelen.sql`
```sql
create table if not exists public.shared_resources (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  kind          text default 'overig',          -- 'auto' | 'gereedschap' | 'overig'
  notes         text,
  visibility    text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
alter table public.shared_resources drop constraint if exists resources_visibility_consistent;
alter table public.shared_resources add constraint resources_visibility_consistent check (
  (visibility='subgroup' and share_subgroup_id is not null)
  or (visibility<>'subgroup' and share_subgroup_id is null));
select public.enable_module_rls('shared_resources', 'created_by');

create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  resource_id  uuid not null references public.shared_resources(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  note         text,
  -- AUT-2 gebruiksdata (optioneel ingevuld bij afronden):
  usage_value  numeric,                          -- bijv. gereden km
  expense_id   uuid references public.expenses(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists reservations_resource_idx on public.reservations(resource_id, starts_at);
```
RLS: `reservations` erft via parent `shared_resources` (kind-tabel-patroon, met `can_view`
op de resource). Realtime voor beide.

### Pure logica — `lib/reservations.js` (nieuw)
```js
// Overlapt [aStart,aEnd) met [bStart,bEnd)? (voor dubbele-boeking-detectie)
export function overlaps(aStart, aEnd, bStart, bEnd) { /* … */ }
// Botst een nieuwe reservering met bestaande op dezelfde resource?
export function hasConflict(candidate, existing) { /* bool */ }
// Reserveringen die een gegeven dag raken (voor de kalender-dagcellen).
export function onDay(reservations, day) { /* [reservation] */ }
```

### Units — `tests/reservations.test.js`
- `overlaps`-grenzen (rakend ≠ overlappend); `hasConflict` negeert dezelfde id (bewerken);
  `onDay` selecteert meerdaagse reserveringen correct.

### UI
- **Module registreren** (`lib/modules.js`): `{ key:'delen', label:'Delen', icon:'share',
  route:'delen', kind:'data', table:'shared_resources', creatorColumn:'created_by',
  core:false, primary:false }`.
- **`app/(tabs)/delen.js`**: lijst van gedeelde items + `FAB`. Tik → resource-detail.
- **`app/resource/[id].js`**: een **maandkalender** (hergebruik `lib/agenda.js` →
  `monthMatrix`, net als `app/(tabs)/agenda.js`) met de reserveringen; tik op een dag →
  nieuwe reservering (met `hasConflict`-waarschuwing). Toon per reservering wie/wanneer.

---

## AUT-2 — Gebruik → kosten

Bij het **afronden** van een reservering (of los): zet gebruik om in een gedeelde uitgave.
- UI op de reservering: "Kosten verdelen" → bedrag (bijv. tankbeurt €80) + verdeelsleutel.
  Twee modi: **gelijk** onder de reserveerders, of **naar gebruik** (`usage_value`/km per
  persoon → `splitType='shares'` met die waarden als gewicht).
- Maak de uitgave via `create_expense` (met `source_type='reservation'`, `source_id`), en
  schrijf het resulterende `expense_id` terug op de reservering. Hergebruik volledig
  `computeShares` uit `lib/expenses.js` (gewichten = km).
- Pure helper in `lib/reservations.js`: `usageParticipants(reservations)` → `[{profileId,
  weight}]` op basis van `usage_value` per persoon, klaar voor `computeShares`.

### Units
- Voeg aan `tests/reservations.test.js` toe: `usageParticipants` somt gebruik per persoon,
  negeert nullen, en levert gewichten die `computeShares` correct verdeelt (integratietestje
  met `computeShares`).

## Edge cases & beslissingen
- **KOS-4 idempotentie**: voorkom dubbele terugkerende uitgaven bij meerdere clients
  (unique index op `(source_type, source_id, spent_on)` of de cron-variant).
- **Polymorfe `source_id`**: geen FK, dus verwijderde bronnen laten een "wees"-uitgave
  achter (gewenst — de uitgave blijft geldig). De UI toont de link alleen als de bron nog
  bestaat.
- **Tussen huishoudens (AUT-3)** is bewust **buiten scope** (vraagt een vertrouwens-/
  uitnodigingsmodel tussen huishoudens). Dit plan blijft binnen één huishouden + subgroepen.

## Acceptatiecriteria
- Een bon "splitsen met het huishouden" maakt een correcte gesplitste uitgave met een link
  terug naar de bon.
- Een maandelijkse huur-sjabloon levert bij het openen van Kosten de ontbrekende uitgaven
  aan (en niet dubbel bij herladen).
- Een auto reserveren toont in de kalender, waarschuwt bij dubbelboeking, en een tankbeurt
  "naar gebruik" verdelen levert kloppende aandelen (km-gewogen).
- `npm test` groen incl. `recurringExpense`/`reservations`; RLS-integratie voor
  `reservations` (erft van `shared_resources`).

## File-checklist
**Nieuw:** `supabase/migrations/NNNN_kosten_uitbreiding.sql` ·
`supabase/migrations/NNNN_autodelen.sql` · `lib/recurringExpense.js` ·
`lib/reservations.js` · `lib/useRecurringExpenses.js` · `lib/useResources.js` ·
`app/recurring-expense/[id].js` (+ `_layout.js`) · `app/(tabs)/delen.js` ·
`app/resource/[id].js` (+ `_layout.js`) · `tests/recurringExpense.test.js` ·
`tests/reservations.test.js`
**Gewijzigd:** `supabase/migrations`-RPC `create_expense` (extra `source_*`-params; lever
als nieuwe migratie die de functie `create or replace`) · `lib/useExpenses.js`
(`addExpense` geeft `source_*` door) · `lib/modules.js` (descriptor 'delen') ·
`app/(tabs)/kosten.js` (terugkerende-sectie + bron-link) · `app/expense/[id].js`
(voorvullen vanuit bron) · `lib/icons.js` · `tests/rls.integration.test.js` ·
`huishoek-backlog.md` (KOS-3/4, AUT-1/2 status).
