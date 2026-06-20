-- ============================================================================
-- HUISHOEK — 0019: Kosten-inzichten & budget
-- ============================================================================
-- Geeft uitgaven een categorie (voor inzicht "waar gaat ons geld heen") en het
-- huishouden een optioneel maandbudget. Bouwt voort op 0007/0017 (expenses +
-- create_expense). Bedragen blijven hele centen (geen floats).
-- ============================================================================

-- 1. Categorie op de uitgave. Vaste set (CHECK), default 'overig'. Bestaande rijen
--    krijgen 'overig'.
alter table public.expenses add column if not exists category text not null default 'overig'
  check (category in ('boodschappen','wonen','energie','vervoer','vrije tijd','overig'));

-- Index voor de inzicht-queries (per huishouden, op datum).
create index if not exists expenses_household_spent_idx on public.expenses(household_id, spent_on);

-- 2. Eén optioneel maandbudget per huishouden (null = geen budget ingesteld).
alter table public.households add column if not exists monthly_budget_cents int
  check (monthly_budget_cents is null or monthly_budget_cents >= 0);

-- 3. create_expense uitbreiden met p_category. Eerst de 0017-signatuur droppen.
drop function if exists public.create_expense(
  uuid, text, integer, uuid, date, text, text, uuid, uuid[], jsonb, text, uuid);

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
  p_source_id         uuid default null,
  p_category          text default 'overig'
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
    visibility, share_subgroup_id, share_with, created_by, source_type, source_id, category
  ) values (
    p_household_id, p_description, p_amount_cents, p_paid_by, coalesce(p_spent_on, current_date), p_split_type,
    coalesce(p_visibility, 'household'),
    case when p_visibility = 'subgroup' then p_share_subgroup_id else null end,
    case when p_visibility = 'custom' then p_share_with else null end,
    auth.uid(), p_source_type, p_source_id, coalesce(p_category, 'overig')
  ) returning id into v_id;

  insert into public.expense_shares (expense_id, profile_id, amount_cents)
  select v_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return v_id;
end;
$$;
