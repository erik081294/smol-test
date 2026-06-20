-- ============================================================================
-- HUISHOEK — 0017: Kosten-uitbreiding & autodelen (KOS-3/4, AUT-1/2)
-- ============================================================================
-- Bouwt voort op de Kosten-module (0007). Vier onderdelen:
--   KOS-3  expenses.source_type/source_id  — een bon/aankoop als gedeelde uitgave
--   KOS-4  recurring_expenses              — huur/abonnementen die periodiek
--                                            materialiseren (idempotent)
--   AUT-1  shared_resources + reservations — gedeeld item + reserveringen
--   AUT-2  reservations.usage_value/expense_id — gebruik → gesplitste uitgave
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. KOS-3: zachte (polymorfe) bron-referentie op een uitgave. Geen FK: één
--    kolompaar dekt meerdere bronsoorten. Idempotentie voor terugkerende
--    uitgaven via een partiële unieke index (alleen source_type='recurring').
-- ---------------------------------------------------------------------------
alter table public.expenses add column if not exists source_type text
  check (source_type in ('purchase','grocery','reservation','recurring'));
alter table public.expenses add column if not exists source_id uuid;
create index if not exists expenses_source_idx on public.expenses(source_type, source_id);
create unique index if not exists expenses_recurring_unique
  on public.expenses(source_id, spent_on) where source_type = 'recurring';

-- create_expense uitbreiden met de bron-parameters. Eerst de oude (0007) signatuur
-- droppen zodat we geen tweede overload houden.
drop function if exists public.create_expense(uuid, text, integer, uuid, date, text, text, uuid, uuid[], jsonb);

create or replace function public.create_expense(
  p_household_id      uuid,
  p_description       text,
  p_amount_cents      int,
  p_paid_by           uuid,
  p_spent_on          date,
  p_split_type        text,
  p_visibility        text,
  p_share_subgroup_id uuid,
  p_share_with        uuid[],
  p_shares            jsonb,
  p_source_type       text default null,
  p_source_id         uuid default null
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  insert into public.expenses (
    household_id, description, amount_cents, paid_by, spent_on, split_type,
    visibility, share_subgroup_id, share_with, created_by, source_type, source_id
  ) values (
    p_household_id, p_description, p_amount_cents, p_paid_by, coalesce(p_spent_on, current_date), p_split_type,
    coalesce(p_visibility, 'household'),
    case when p_visibility = 'subgroup' then p_share_subgroup_id else null end,
    case when p_visibility = 'custom' then p_share_with else null end,
    auth.uid(), p_source_type, p_source_id
  ) returning id into v_id;

  insert into public.expense_shares (expense_id, profile_id, amount_cents)
  select v_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. KOS-4: terugkerende uitgaven (sjabloon). Volgt het zichtbaarheidscontract.
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  description   text not null,
  amount_cents  int  not null check (amount_cents > 0),
  paid_by       uuid not null references public.profiles(id),
  split_type    text not null default 'equal' check (split_type in ('equal','shares','exact')),
  participants  jsonb not null default '[]',     -- [{profile_id, weight?, amount_cents?}]
  recur_freq    text not null default 'monthly' check (recur_freq in ('daily','weekly','monthly')),
  recur_interval int not null default 1,
  next_date     date not null,
  active        boolean not null default true,
  visibility    text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists recurring_expenses_household_idx on public.recurring_expenses(household_id);
alter table public.recurring_expenses drop constraint if exists recurring_expenses_visibility_consistent;
alter table public.recurring_expenses add constraint recurring_expenses_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);
select public.enable_module_rls('recurring_expenses', 'created_by');

-- ---------------------------------------------------------------------------
-- 3. AUT-1: gedeelde resources (zichtbaarheidscontract) + reserveringen (kind).
-- ---------------------------------------------------------------------------
create table if not exists public.shared_resources (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  kind          text not null default 'overig' check (kind in ('auto','gereedschap','overig')),
  notes         text,
  visibility    text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists shared_resources_household_idx on public.shared_resources(household_id);
alter table public.shared_resources drop constraint if exists shared_resources_visibility_consistent;
alter table public.shared_resources add constraint shared_resources_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);
select public.enable_module_rls('shared_resources', 'created_by');

create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  resource_id  uuid not null references public.shared_resources(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  note         text,
  usage_value  numeric,                          -- AUT-2: bijv. gereden km
  expense_id   uuid references public.expenses(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists reservations_resource_idx on public.reservations(resource_id, starts_at);

-- RLS: reserveringen erven de zichtbaarheid van hun parent-resource (kind-tabel).
alter table public.reservations enable row level security;
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations for select using (
  exists (select 1 from public.shared_resources r where r.id = resource_id
    and public.can_view(r.household_id, r.visibility, r.share_subgroup_id, r.share_with, r.created_by))
);
drop policy if exists reservations_write on public.reservations;
create policy reservations_write on public.reservations for all using (
  exists (select 1 from public.shared_resources r where r.id = resource_id and public.is_member(r.household_id))
) with check (
  exists (select 1 from public.shared_resources r where r.id = resource_id and public.is_member(r.household_id))
);

-- ---------------------------------------------------------------------------
-- 4. Realtime (idempotent).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['recurring_expenses','shared_resources','reservations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
