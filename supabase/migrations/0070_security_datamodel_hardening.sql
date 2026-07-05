-- ============================================================================
-- HUISHOEK — 0070: security/datamodel-hardening (review-addendum 2026-07-04, P7)
-- ============================================================================
-- Vier gerichte reparaties uit de Security- en Datamodel-dimensies van de
-- app-review (docs/reviews/2026-07-02-app-review.md, addendum):
--
--  A. Sec-1/Data-10 — de 0066-attributie-fix was via een UPDATE te omzeilen:
--     de INSERT-policies eisen creator = auth.uid(), maar de UPDATE-policies
--     alleen is_member. Een `with check` op de creator zou gedeeld bewerken
--     breken (huisgenoot B mag A's taak afvinken), dus de juiste vorm is
--     ONVERANDERLIJKHEID: een rekey-guard-trigger die verbiedt dat
--     household_id of de creator-kolom van waarde wisselt. Plus: de directe
--     INSERT-policies op expenses/recurring_expenses (die 0066 oversloeg)
--     krijgen alsnog de creator-eis.
--  B. Data-2 (high) — realtime-DELETE-events bereikten huisgenoten niet:
--     bij de standaard REPLICA IDENTITY bevat een DELETE-event alleen de PK,
--     dus het `household_id=eq.`-filter van de client matcht nooit (0032
--     documenteerde en fixte dit voor slechts 2 tabellen). Nu FULL op alle
--     tabellen waarop de app gefilterd subscribet. WAL-afweging: dit zijn
--     huishoud-schaal tabellen (tientallen–honderden rijen), de extra
--     DELETE-payload is verwaarloosbaar; foto-/logtabellen dragen alleen
--     paden/tekst, geen blobs.
--  C. Data-3 — expense_shares waren client-vertrouwend: negatieve aandelen of
--     een opgeblazen som konden de saldi (financiële kern) vervuilen. Guard in
--     beide DEFINER-RPC's + CHECK op de tabel. LET OP: som == amount_cents is
--     BEWUST geen eis — subset-splits (niet iedereen doet mee) zijn legitiem
--     en de saldologica (computeBalances) rekent op de shares zelf; we eisen
--     aandeel >= 0 en som <= bedrag.
--  D. Data-7 — twee household-brede query-paden misten een dekkende index
--     (plant-/huisdier-tijdlijn, en de ledenlookup bij elke app-start).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1. Rekey-guard: household_id + creator-kolom zijn onveranderlijk.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_module_rekey()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  creator_col text := tg_argv[0];
begin
  if (to_jsonb(new)->>'household_id') is distinct from (to_jsonb(old)->>'household_id') then
    raise exception 'household_id is onveranderlijk' using errcode = 'check_violation';
  end if;
  if (to_jsonb(new)->>creator_col) is distinct from (to_jsonb(old)->>creator_col) then
    raise exception '% is onveranderlijk', creator_col using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Trigger-functies horen door geen enkele rol direct aanroepbaar te zijn (0058-patroon).
revoke all on function public.prevent_module_rekey() from public, anon, authenticated;

-- Alle tabellen met een creator-kolom die can_view/policies voedt of attributie
-- draagt. DEFINER-RPC's omzeilen RLS maar géén triggers — en geen enkele RPC
-- herschrijft deze kolommen, dus dit breekt niets legitiems.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('tasks',              'created_by'),
      ('groceries',          'added_by'),
      ('plants',             'created_by'),
      ('pets',               'created_by'),
      ('vehicles',           'created_by'),
      ('shared_resources',   'created_by'),
      ('timeline_posts',     'author_id'),
      ('recurring_expenses', 'created_by'),
      ('expenses',           'created_by'),
      ('purchases',          'created_by'),
      ('recipes',            'created_by'),
      ('tags',               'created_by'),
      ('products',           'created_by'),
      ('meal_plan_entries',  'created_by'),
      ('plant_photos',       'created_by'),
      ('pet_log',            'created_by')
    ) as v(tbl, creator_col)
  loop
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_rekey_guard', t.tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.prevent_module_rekey(%L)',
      t.tbl || '_rekey_guard', t.tbl, t.creator_col
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- A2. De directe INSERT-policies die 0066 oversloeg: creator = de inzender.
--     (expenses schrijft de app via DEFINER-RPC's — die raken RLS niet — maar
--     de REST-route stond open voor gespoofte created_by; recurring_expenses
--     schrijft de client wél direct.)
-- ---------------------------------------------------------------------------
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists recurring_expenses_insert on public.recurring_expenses;
create policy recurring_expenses_insert on public.recurring_expenses for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- B. Realtime-DELETE: replica identity FULL op de gefilterd-gesubscribede
--    tabellen (expense_shares/purchase_items/timeline_reactions hadden het al).
-- ---------------------------------------------------------------------------
alter table public.tasks              replica identity full;
alter table public.groceries          replica identity full;
alter table public.plants             replica identity full;
alter table public.pets               replica identity full;
alter table public.vehicles           replica identity full;
alter table public.zones              replica identity full;
alter table public.tags               replica identity full;
alter table public.recipes            replica identity full;
alter table public.recipe_ingredients replica identity full;
alter table public.pantry_items       replica identity full;
alter table public.products           replica identity full;
alter table public.recurring_expenses replica identity full;
alter table public.shared_resources   replica identity full;
alter table public.expenses           replica identity full;
alter table public.purchases          replica identity full;
alter table public.task_completions   replica identity full;
alter table public.meal_plan_entries  replica identity full;
alter table public.reservations       replica identity full;
alter table public.timeline_posts     replica identity full;
alter table public.timeline_photos    replica identity full;
alter table public.home_layouts       replica identity full;
alter table public.pet_log            replica identity full;
alter table public.plant_photos       replica identity full;

-- ---------------------------------------------------------------------------
-- C. Share-guards: aandeel nooit negatief, som nooit boven het bedrag.
--    (Live gecontroleerd vóór deze migratie: 0 negatieve aandelen, 0 sommen
--    boven het bedrag — de CHECK kan direct valideren.)
-- ---------------------------------------------------------------------------
alter table public.expense_shares
  drop constraint if exists expense_shares_amount_nonneg;
alter table public.expense_shares
  add constraint expense_shares_amount_nonneg check (amount_cents >= 0);

create or replace function public.create_expense(p_household_id uuid, p_description text, p_amount_cents integer, p_paid_by uuid, p_spent_on date, p_split_type text, p_visibility text, p_share_subgroup_id uuid, p_share_with uuid[], p_shares jsonb, p_source_type text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_category text DEFAULT 'overig'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  if p_paid_by is not null and not exists (
    select 1 from public.household_members
    where household_id = p_household_id and profile_id = p_paid_by
  ) then
    raise exception 'betaler % is geen lid van huishouden %', p_paid_by, p_household_id
      using errcode = 'check_violation';
  end if;

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

  -- 0070 (Data-3): bedragen zijn hele centen >= 0; de som van de aandelen mag
  -- het bedrag niet overstijgen (subset-splits met som < bedrag zijn legitiem).
  if coalesce(p_amount_cents, -1) < 0 then
    raise exception 'bedrag moet >= 0 zijn' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) as s
    where coalesce((s->>'amount_cents')::int, -1) < 0
  ) then
    raise exception 'een aandeel is negatief of ontbreekt' using errcode = 'check_violation';
  end if;
  if coalesce((select sum((s->>'amount_cents')::int) from jsonb_array_elements(p_shares) as s), 0) > p_amount_cents then
    raise exception 'de aandelen tellen op tot meer dan het bedrag' using errcode = 'check_violation';
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

create or replace function public.update_expense(p_id uuid, p_household_id uuid, p_description text, p_amount_cents integer, p_paid_by uuid, p_spent_on date, p_split_type text, p_visibility text, p_share_subgroup_id uuid, p_share_with uuid[], p_shares jsonb, p_category text DEFAULT 'overig'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  if p_paid_by is not null and not exists (
    select 1 from public.household_members
    where household_id = p_household_id and profile_id = p_paid_by
  ) then
    raise exception 'betaler % is geen lid van huishouden %', p_paid_by, p_household_id
      using errcode = 'check_violation';
  end if;

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

  -- 0070 (Data-3): zelfde guards als create_expense.
  if coalesce(p_amount_cents, -1) < 0 then
    raise exception 'bedrag moet >= 0 zijn' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) as s
    where coalesce((s->>'amount_cents')::int, -1) < 0
  ) then
    raise exception 'een aandeel is negatief of ontbreekt' using errcode = 'check_violation';
  end if;
  if coalesce((select sum((s->>'amount_cents')::int) from jsonb_array_elements(p_shares) as s), 0) > p_amount_cents then
    raise exception 'de aandelen tellen op tot meer dan het bedrag' using errcode = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- D. Ontbrekende indexen op household-brede query-paden.
-- ---------------------------------------------------------------------------
create index if not exists plant_photos_household_created_idx
  on public.plant_photos (household_id, created_at desc);
create index if not exists pet_log_household_created_idx
  on public.pet_log (household_id, created_at desc);
create index if not exists household_members_profile_idx
  on public.household_members (profile_id);
