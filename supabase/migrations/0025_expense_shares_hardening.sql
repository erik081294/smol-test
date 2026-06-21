-- ============================================================================
-- HUISHOEK — 0025: expense_shares hardening + scoping (B1/B2 + C2)
-- ============================================================================
-- Drie samenhangende verbeteringen op het kosten-domein, in één migratie omdat
-- ze dezelfde twee RPC's raken:
--
--   B1 (security)  create_expense/update_expense valideren nu dat `paid_by` én
--                  elke deelnemer in `shares` écht lid is van het huishouden.
--                  Voorheen kon je schuld toewijzen aan/namens een niet-lid.
--   B2 (security)  De schrijf-policy op expense_shares wordt aangescherpt tot de
--                  maker van de parent-uitgave. Alle legitieme schrijfacties lopen
--                  via de SECURITY DEFINER-RPC's (die RLS omzeilen); directe
--                  client-writes door wíllekeurige huisgenoten zijn niet nodig en
--                  worden zo dichtgezet (geen tampering met andermans shares).
--   C2 (scale)     expense_shares krijgt een gedenormaliseerde `household_id` zodat
--                  de realtime-subscription op huishouden kan filteren i.p.v. breed
--                  op de hele tabel te luisteren (cross-household refetch-storms).
--                  purchase_items had deze kolom al (zie 0013).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. C2: household_id op expense_shares (scope-kolom). Nullable toevoegen,
--    backfillen vanuit de parent-uitgave, dan NOT NULL + index.
-- ---------------------------------------------------------------------------
alter table public.expense_shares
  add column if not exists household_id uuid references public.households(id) on delete cascade;

update public.expense_shares es
   set household_id = e.household_id
  from public.expenses e
 where e.id = es.expense_id
   and es.household_id is null;

alter table public.expense_shares alter column household_id set not null;

create index if not exists expense_shares_household_idx
  on public.expense_shares (household_id);

-- ---------------------------------------------------------------------------
-- 2. B2: schrijf-policy aanscherpen — alleen de maker van de parent-uitgave.
--    (Lezen blijft via can_view: het kind erft de zichtbaarheid van de parent.)
-- ---------------------------------------------------------------------------
drop policy if exists expense_shares_write on public.expense_shares;
create policy expense_shares_write on public.expense_shares for all
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and e.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and e.created_by = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 3. B1 + C2: RPC's herschrijven (membership-validatie + household_id op shares).
-- ---------------------------------------------------------------------------
create or replace function public.create_expense(
  p_household_id uuid, p_description text, p_amount_cents integer, p_paid_by uuid,
  p_spent_on date, p_split_type text, p_visibility text, p_share_subgroup_id uuid,
  p_share_with uuid[], p_shares jsonb, p_source_type text default null,
  p_source_id uuid default null, p_category text default 'overig'
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  -- B1: de betaler moet lid zijn van het huishouden.
  if p_paid_by is not null and not exists (
    select 1 from public.household_members
    where household_id = p_household_id and profile_id = p_paid_by
  ) then
    raise exception 'betaler % is geen lid van huishouden %', p_paid_by, p_household_id
      using errcode = 'check_violation';
  end if;

  -- B1: elke deelnemer in de shares moet lid zijn.
  if exists (
    select 1 from jsonb_array_elements(p_shares) as s
    where not exists (
      select 1 from public.household_members
      where household_id = p_household_id and profile_id = (s->>'profile_id')::uuid
    )
  ) then
    raise exception 'een deelnemer is geen lid van huishouden %', p_household_id
      using errcode = 'check_violation';
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

  insert into public.expense_shares (expense_id, household_id, profile_id, amount_cents)
  select v_id, p_household_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return v_id;
end;
$function$;

create or replace function public.update_expense(
  p_id uuid, p_household_id uuid, p_description text, p_amount_cents integer,
  p_paid_by uuid, p_spent_on date, p_split_type text, p_visibility text,
  p_share_subgroup_id uuid, p_share_with uuid[], p_shares jsonb, p_category text default 'overig'
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  -- B1: de betaler moet lid zijn van het huishouden.
  if p_paid_by is not null and not exists (
    select 1 from public.household_members
    where household_id = p_household_id and profile_id = p_paid_by
  ) then
    raise exception 'betaler % is geen lid van huishouden %', p_paid_by, p_household_id
      using errcode = 'check_violation';
  end if;

  -- B1: elke deelnemer in de shares moet lid zijn.
  if exists (
    select 1 from jsonb_array_elements(p_shares) as s
    where not exists (
      select 1 from public.household_members
      where household_id = p_household_id and profile_id = (s->>'profile_id')::uuid
    )
  ) then
    raise exception 'een deelnemer is geen lid van huishouden %', p_household_id
      using errcode = 'check_violation';
  end if;

  update public.expenses set
    description       = p_description,
    amount_cents      = p_amount_cents,
    paid_by           = p_paid_by,
    spent_on          = coalesce(p_spent_on, current_date),
    split_type        = p_split_type,
    visibility        = coalesce(p_visibility, 'household'),
    share_subgroup_id = case when p_visibility = 'subgroup' then p_share_subgroup_id else null end,
    share_with        = case when p_visibility = 'custom' then p_share_with else null end,
    category          = coalesce(p_category, 'overig')
  where id = p_id and household_id = p_household_id;

  if not found then
    raise exception 'uitgave % niet gevonden in huishouden %', p_id, p_household_id
      using errcode = 'no_data_found';
  end if;

  delete from public.expense_shares where expense_id = p_id;

  insert into public.expense_shares (expense_id, household_id, profile_id, amount_cents)
  select p_id, p_household_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return p_id;
end;
$function$;
