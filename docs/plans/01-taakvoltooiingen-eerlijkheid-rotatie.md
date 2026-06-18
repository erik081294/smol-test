# Plan 01 — Taakvoltooiingen, eerlijkheid & beurtrotatie

**Backlog:** SCH-3 (eerlijkheidsoverzicht), KLU-4 (beurtrotatie) + een architectuur-fix.
**Soort:** fundament + twee features. **Migratie:** ja (1 nieuwe tabel + 1 kolom).
**Afhankelijkheden:** geen.

## Waarom

Een terugkerende taak rolt bij afvinken door en **wist** `completed_at`/`completed_by`
(`lib/useTasks.js`). Daardoor is er geen duurzame historie van wie wat deed — precies wat
een eerlijkheidsoverzicht (SCH-3) nodig heeft, en juist schoonmaaktaken zijn vrijwel
allemaal terugkerend. Dit plan voegt een **voltooiingen-log** toe (de robuuste bouwsteen),
en bouwt daarop **SCH-3** (wie deed hoeveel) en **KLU-4** (beurtrotatie: terugkerende taak
roteert automatisch langs de leden).

## Onderdeel A — Voltooiingen-log (fundament)

### Datamodel — migratie `NNNN_task_completions.sql`
Een kind-tabel van `tasks` die de zichtbaarheid van de parent-taak erft (patroon
`expense_shares`/`plant_photos`). Eén rij per voltooiing — ook voor doorrollende taken.

```sql
create table if not exists public.task_completions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  completed_by  uuid references public.profiles(id) on delete set null,
  occurrence_date date,                 -- de due_date die werd afgevinkt (kan null zijn)
  completed_at  timestamptz not null default now()
);
create index if not exists task_completions_hh_idx on public.task_completions(household_id, completed_at desc);
create index if not exists task_completions_by_idx on public.task_completions(household_id, completed_by);
create index if not exists task_completions_task_idx on public.task_completions(task_id);

alter table public.task_completions enable row level security;

-- Zien: wie de parent-taak mag zien (erft can_view).
drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions for select using (
  exists (select 1 from public.tasks t where t.id = task_id
    and public.can_view(t.household_id, t.visibility, t.share_subgroup_id, t.share_with, t.created_by))
);

-- Schrijven: lid van het huishouden van de parent-taak.
drop policy if exists task_completions_write on public.task_completions;
create policy task_completions_write on public.task_completions for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_member(t.household_id))
) with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_member(t.household_id))
);

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='task_completions') then
    alter publication supabase_realtime add table public.task_completions;
  end if;
end $$;
```

### App-laag
- **`lib/useTasks.js` → `completeTask`** aanpassen zodat het altijd een log-rij schrijft,
  vóór (of na) het bestaande gedrag. Houd het bestaande doorrol-/afvink-gedrag intact:
  ```js
  const logCompletion = (task) => mutate(
    supabase.from('task_completions').insert({
      household_id: task.household_id, task_id: task.id,
      completed_by: c.user.id, occurrence_date: task.due_date ?? null,
    }), { context: 'voltooiing loggen' });
  ```
  Roep `logCompletion(task)` aan in `completeTask` (zowel in de terugkerende doorrol-tak
  als de eenmalige-afvink-tak). Bij `uncompleteTask` voor **eenmalige** taken: verwijder
  de laatste log-rij van die taak (anders telt een per ongeluk afgevinkte taak mee):
  ```js
  // in uncompleteTask, naast het wissen van completed_at/by:
  await mutate(supabase.from('task_completions')
    .delete().eq('task_id', id)
    .order('completed_at', { ascending: false }).limit(1), { context: 'voltooiing terugdraaien' });
  ```
  (Supabase staat `delete().order().limit()` toe; valt dat tegen in jouw versie, gebruik
  dan een subselect-RPC of verwijder op de hoogste `completed_at`.)
- Importeer `supabase` en `mutate` in `useTasks.js` (nu importeert het alleen
  `useCollection`/`recurrence`).

### Tests
- `tests/rls.integration.test.js`: nieuwe case — een huisgenoot ziet de
  `task_completions` van een zichtbare taak; een buitenstaander niet; een log voor een
  `custom`/`subgroup`-taak volgt dezelfde zichtbaarheid als de parent.

## Onderdeel B — SCH-3 Eerlijkheidsoverzicht

### Pure logica — `lib/fairness.js` (nieuw)
```js
// Telt voltooiingen per lid over een periode en geeft een verdeelbaar overzicht.
// completions: [{ completed_by, completed_at }] (uit task_completions)
// members: [{ id, display_name, avatar_emoji }]
// since: Date | null (null = alle tijd)
export function tally(completions, members, since = null) { /* … */ }
//  -> [{ profileId, name, emoji, count, pct }] gesorteerd op count desc, stabiel op id.
//     pct = count / max(1, totaal) * 100 (voor de balk). Leden met 0 ook opnemen.

export const PERIODS = { WEEK: 7, MONTH: 30, ALL: null }; // dagen terug
export function sinceDate(period, now = new Date()) { /* now - period dagen, of null */ }
```

### Te schrijven units — `tests/fairness.test.js`
- Lege completions → elk lid count 0, pct 0.
- Telt per lid; `since` filtert oudere voltooiingen weg.
- Som van counts klopt; sortering op count desc, stabiel op id; onbekende `completed_by`
  (lid verwijderd → null) wordt overgeslagen of als "Onbekend" gebucket (kies één; documenteer).

### Hook — `lib/useTaskCompletions.js` (nieuw)
Laadt `task_completions` van het actieve huishouden (RLS scopet vanzelf), met realtime,
analoog aan `useExpenses` (maar zonder embed). Optioneel filter op `category`/`zone` door
te joinen met `tasks` in de select (`task_completions(*, tasks!inner(category, zone_id))`).

### UI
- **Component** `lib/FairnessBars.js`: per lid een `Avatar` + naam + een balk
  (`colors.forest`/`done`) op `pct` breedte + de telling. Herbruikbaar.
- **Schoonmaak** (`app/(tabs)/schoonmaak.js`): een kaart "Wie deed hoeveel" boven de zones,
  met een period-`Chip`-rij (Week/Maand/Alles) die `since` zet. Filter completions op
  schoonmaaktaken (`tasks.zone_id is not null` of `category='huishouden'`).
- Eventueel dezelfde component op **Huishouden** voor een huisbreed overzicht (alle taken).

## Onderdeel C — KLU-4 Beurtrotatie

### Datamodel — zelfde of losse migratie
```sql
alter table public.tasks add column if not exists rotation uuid[];  -- volgorde van profielen; null = geen rotatie
```
Geen CHECK nodig. Bij rotatie is `assigned_to` "de huidige beurt".

### Pure logica — `lib/rotation.js` (nieuw)
```js
// Volgende toegewezene na de huidige (wrap-around). Onbekende/niet-in-lijst current
// -> eerste in de rotatie. Lege rotatie -> null.
export function nextAssignee(rotation = [], current = null) { /* … */ }
```

### App-laag
- **`lib/useTasks.js` → `completeTask`**: bij een taak met `task.rotation?.length`, zet bij
  het doorrollen óók `assigned_to: nextAssignee(task.rotation, task.assigned_to)`. (Voor
  een eenmalige rotatie-taak is rotatie zinloos; alleen toepassen als er doorgerold wordt.)
- **Taak-editor** (`app/task/[id].js`): een sectie "Rouleren" — een toggle die een
  multi-select van leden toont (volgorde = tikvolgorde). Sla op als `rotation`; zet
  `assigned_to` op het eerste lid bij aanmaken. Toon bij een rotatie-taak in `TaskRow` een
  klein `repeat`/`group`-icoon met de huidige beurt.

### Te schrijven units — `tests/rotation.test.js`
- `nextAssignee` wrap-around; current niet in lijst → eerste; lege lijst → null;
  enkel lid → zichzelf.

## Edge cases & beslissingen
- **Verwijderd lid**: `completed_by`/rotatie-id kan naar een verwijderd profiel wijzen
  (`on delete set null` / array blijft staan). Fairness slaat null over; rotatie slaat
  ontbrekende leden over (filter `rotation` op huidige `members` vóór `nextAssignee`).
- **Privacy**: het overzicht erft taak-zichtbaarheid via RLS; een lid ziet alleen
  voltooiingen van taken die het mag zien. Goed genoeg; geen extra werk.
- **Backfill**: bestaande historie ontbreekt (logica start vanaf nu). Prima — documenteer
  in de UI "telt vanaf nu" of toon gewoon de groeiende data.

## Acceptatiecriteria
- Een terugkerende schoonmaaktaak een paar keer afvinken door verschillende leden →
  "Wie deed hoeveel" toont kloppende tellingen per periode.
- Een rotatie-taak afvinken → `assigned_to` springt naar het volgende lid; na het laatste
  weer naar het eerste.
- `npm test` groen incl. `fairness`/`rotation`; RLS-integratietest voor `task_completions`
  groen met secrets.

## File-checklist
**Nieuw:** `supabase/migrations/NNNN_task_completions.sql` · `lib/fairness.js` ·
`lib/rotation.js` · `lib/useTaskCompletions.js` · `lib/FairnessBars.js` ·
`tests/fairness.test.js` · `tests/rotation.test.js`
**Gewijzigd:** `lib/useTasks.js` (log + rotatie in complete/uncomplete) ·
`app/(tabs)/schoonmaak.js` (eerlijkheidskaart) · `app/task/[id].js` (rotatie-sectie) ·
`lib/TaskRow.js` (rotatie-indicator) · `lib/icons.js` (evt. nieuw icoon) ·
`tests/rls.integration.test.js` (nieuwe case) · `huishoek-backlog.md` (SCH-3/KLU-4 → ✅)
