-- ============================================================================
-- HUISHOEK — 0007: Kosten / WieBetaaltWat (uitgaven + splitsen + saldo)
-- ============================================================================
-- Een hoofdtabel `expenses` die het zichtbaarheidscontract volgt (en dus via
-- enable_module_rls volledig wordt afgedekt) + een kindtabel `expense_shares`
-- met het aandeel per deelnemer. Bedragen in HELE CENTEN (int), nooit floats.
-- De splitsing/saldo/vereffening-logica leeft in lib/expenses.js (getest);
-- de DB bewaart enkel de berekende aandelen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Uitgaven (volgt het zichtbaarheidscontract: household_id, visibility,
--    share_subgroup_id, share_with, created_by).
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  description   text not null,
  amount_cents  int  not null check (amount_cents > 0),
  currency      text not null default 'EUR',
  paid_by       uuid not null references public.profiles(id),
  spent_on      date not null default current_date,
  split_type    text not null default 'equal'
                  check (split_type in ('equal','shares','exact')),
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists expenses_household_idx on public.expenses(household_id);

-- Zichtbaarheid-consistentie (zelfde patroon als 0003 §3).
alter table public.expenses drop constraint if exists expenses_visibility_consistent;
alter table public.expenses add constraint expenses_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

-- ---------------------------------------------------------------------------
-- 2. Aandeel per deelnemer. amount_cents = het (door lib/expenses berekende)
--    bedrag dat deze persoon van deze uitgave draagt.
-- ---------------------------------------------------------------------------
create table if not exists public.expense_shares (
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  amount_cents int  not null default 0,
  primary key (expense_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- 3. RLS. De hoofdtabel via het framework; de shares erven de zichtbaarheid
--    van hun parent-expense.
-- ---------------------------------------------------------------------------
select public.enable_module_rls('expenses', 'created_by');

alter table public.expense_shares enable row level security;

drop policy if exists expense_shares_select on public.expense_shares;
create policy expense_shares_select on public.expense_shares for select using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and public.can_view(e.household_id, e.visibility, e.share_subgroup_id, e.share_with, e.created_by)
  )
);

drop policy if exists expense_shares_write on public.expense_shares;
create policy expense_shares_write on public.expense_shares for all using (
  exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.household_id))
) with check (
  exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.household_id))
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expense_shares'
  ) then
    alter publication supabase_realtime add table public.expense_shares;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Atomair aanmaken: expense + alle shares in één transactie. Voorkomt een
--    halve uitgave als de tweede insert faalt. Aanroepen via supabase.rpc(...).
--    p_shares: jsonb-array [{ "profile_id": uuid, "amount_cents": int }, ...].
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(
  p_household_id     uuid,
  p_description      text,
  p_amount_cents     int,
  p_paid_by          uuid,
  p_spent_on         date,
  p_split_type       text,
  p_visibility       text,
  p_share_subgroup_id uuid,
  p_share_with       uuid[],
  p_shares           jsonb
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
    visibility, share_subgroup_id, share_with, created_by
  ) values (
    p_household_id, p_description, p_amount_cents, p_paid_by, coalesce(p_spent_on, current_date), p_split_type,
    coalesce(p_visibility, 'household'),
    case when p_visibility = 'subgroup' then p_share_subgroup_id else null end,
    case when p_visibility = 'custom' then p_share_with else null end,
    auth.uid()
  ) returning id into v_id;

  insert into public.expense_shares (expense_id, profile_id, amount_cents)
  select v_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return v_id;
end;
$$;
