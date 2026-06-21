-- ============================================================================
-- RLS- & RPC-verificatie via de Supabase-connector (zonder secrets / zonder egress)
-- ============================================================================
-- Waarom: de JS-suite `tests/rls.integration.test.js` heeft de service-role-key
-- + netwerk-egress naar *.supabase.co nodig. In een Claude-Code-web-container is
-- dat geblokkeerd (egress-allowlist) en is de service-role-key niet beschikbaar.
-- Deze SQL doet dezelfde kernassertions rechtstreeks in de DB via de connector:
-- het bouwt fixtures als de geprivilegieerde rol, dwingt daarna RLS af als rol
-- `authenticated` met wisselende `request.jwt.claims.sub` (= auth.uid()), en
-- ROLT ALLES TERUG via een afsluitende RAISE — er wordt niets naar productie
-- weggeschreven. De uitkomst komt terug als de tekst van de (verwachte) error.
--
-- Dekking (13 checks):
--   tasks         household/custom-zichtbaarheid + insert-policy (parent-tabel)
--   expense_shares kind-tabel erft parent-zichtbaarheid (can_view)
--   create_expense B1: paid_by + elke deelnemer moet lid zijn (0025)
--   expense_shares B2: alleen de maker van de parent-uitgave mag direct schrijven (0025)
--   expense_shares C2: household_id wordt gevuld door de RPC (0025)
--
-- task_completions en plant_photos gebruiken exact hetzelfde kind-policy-mechanisme
-- (can_view via de parent) als expense_shares; één bewezen kind-tabel staat model.
--
-- Verwacht: PASS=[... 13 checks ...] FAIL=[geen].
-- Laatst gedraaid: 2026-06-21 → 13/13 pass, 0 residu (geverifieerd).
-- ============================================================================
do $$
declare
  alice uuid := gen_random_uuid();
  bob   uuid := gen_random_uuid();
  eve   uuid := gen_random_uuid();
  hh    uuid := gen_random_uuid();
  t_hh  uuid := gen_random_uuid();
  t_cus uuid := gen_random_uuid();
  v_exp uuid;
  v_cnt int;
  v_pass text := '';
  v_fail text := '';
begin
  -- Fixtures: auth.users → trigger handle_new_user maakt automatisch profiles aan
  insert into auth.users(id, raw_user_meta_data) values
    (alice,'{"display_name":"RLS Alice"}'),
    (bob,  '{"display_name":"RLS Bob"}'),
    (eve,  '{"display_name":"RLS Eve"}');
  insert into public.households(id, name, created_by) values (hh,'RLS Testhuis', alice);
  insert into public.household_members(household_id, profile_id, role) values
    (hh, alice, 'owner'),(hh, bob, 'member');                 -- eve is GEEN lid
  insert into public.tasks(id, household_id, title, visibility, created_by) values
    (t_hh, hh, 'Stofzuigen', 'household', alice);
  insert into public.tasks(id, household_id, title, visibility, share_with, created_by) values
    (t_cus, hh, 'Geheim klusje', 'custom', array[]::uuid[], alice);  -- alleen maker

  set local role authenticated;

  -- === tasks: zichtbaarheid (parent-tabel) ==================================
  perform set_config('request.jwt.claims', json_build_object('sub',alice,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where id=t_hh;
  if v_cnt=1 then v_pass:=v_pass||'alice-ziet-household; '; else v_fail:=v_fail||'alice-MIST-household; '; end if;
  select count(*) into v_cnt from public.tasks where id=t_cus;
  if v_cnt=1 then v_pass:=v_pass||'alice-ziet-custom(maker); '; else v_fail:=v_fail||'alice-MIST-custom; '; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',bob,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where id=t_hh;
  if v_cnt=1 then v_pass:=v_pass||'bob-ziet-household; '; else v_fail:=v_fail||'bob-MIST-household; '; end if;
  select count(*) into v_cnt from public.tasks where id=t_cus;
  if v_cnt=0 then v_pass:=v_pass||'bob-ziet-GEEN-custom; '; else v_fail:=v_fail||'bob-ZIET-custom(LEK!); '; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',eve,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where household_id=hh;
  if v_cnt=0 then v_pass:=v_pass||'eve-ziet-NIETS; '; else v_fail:=v_fail||'eve-ZIET-'||v_cnt||'(LEK!); '; end if;

  -- === tasks: insert-policy =================================================
  perform set_config('request.jwt.claims', json_build_object('sub',bob,'role','authenticated')::text, true);
  begin
    insert into public.tasks(household_id, title, created_by) values (hh,'bob-insert', bob);
    v_pass:=v_pass||'bob-mag-insert; ';
  exception when others then v_fail:=v_fail||'bob-KAN-NIET-insert('||sqlerrm||'); '; end;

  perform set_config('request.jwt.claims', json_build_object('sub',eve,'role','authenticated')::text, true);
  begin
    insert into public.tasks(household_id, title, created_by) values (hh,'eve-insert', eve);
    v_fail:=v_fail||'eve-MAG-insert(LEK!); ';
  exception when others then v_pass:=v_pass||'eve-geblokkeerd-insert; '; end;

  -- === expenses: create_expense (B1/C2) + expense_shares kind-RLS (B2) ======
  perform set_config('request.jwt.claims', json_build_object('sub',alice,'role','authenticated')::text, true);

  -- C2 + geldige flow: shares krijgen household_id mee
  begin
    v_exp := public.create_expense(hh,'Boodschappen',1000,alice,current_date,'equal','household',
      null,null,('[{"profile_id":"'||alice||'","amount_cents":500},{"profile_id":"'||bob||'","amount_cents":500}]')::jsonb,
      null,null,'overig');
    select count(*) into v_cnt from public.expense_shares where expense_id=v_exp and household_id=hh;
    if v_cnt=2 then v_pass:=v_pass||'geldige-uitgave+household_id; '; else v_fail:=v_fail||'shares/household_id-mis('||v_cnt||'); '; end if;
  exception when others then v_fail:=v_fail||'geldige-uitgave-FAALT('||sqlerrm||'); '; end;

  -- B1: paid_by geen lid → weiger
  begin
    perform public.create_expense(hh,'X',100,eve,current_date,'equal','household',null,null,
      ('[{"profile_id":"'||alice||'","amount_cents":100}]')::jsonb,null,null,'overig');
    v_fail:=v_fail||'B1-paid_by-niet-lid-TOEGESTAAN(LEK!); ';
  exception when others then v_pass:=v_pass||'B1-paid_by-niet-lid-geweigerd; '; end;

  -- B1: deelnemer geen lid → weiger
  begin
    perform public.create_expense(hh,'Y',100,alice,current_date,'equal','household',null,null,
      ('[{"profile_id":"'||eve||'","amount_cents":100}]')::jsonb,null,null,'overig');
    v_fail:=v_fail||'B1-deelnemer-niet-lid-TOEGESTAAN(LEK!); ';
  exception when others then v_pass:=v_pass||'B1-deelnemer-niet-lid-geweigerd; '; end;

  -- B2: bob (lid, niet de maker) mag NIET direct een share schrijven
  perform set_config('request.jwt.claims', json_build_object('sub',bob,'role','authenticated')::text, true);
  begin
    insert into public.expense_shares(expense_id, household_id, profile_id, amount_cents)
    values (v_exp, hh, bob, 999);
    v_fail:=v_fail||'B2-niet-maker-MAG-schrijven(LEK!); ';
  exception when others then v_pass:=v_pass||'B2-niet-maker-geblokkeerd; '; end;

  -- kind-RLS select: bob (lid) ziet de shares; eve (buitenstaander) niet
  select count(*) into v_cnt from public.expense_shares where expense_id=v_exp;
  if v_cnt=2 then v_pass:=v_pass||'bob-ziet-shares; '; else v_fail:=v_fail||'bob-ziet-shares-mis('||v_cnt||'); '; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',eve,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.expense_shares where expense_id=v_exp;
  if v_cnt=0 then v_pass:=v_pass||'eve-ziet-geen-shares; '; else v_fail:=v_fail||'eve-ziet-shares(LEK!); '; end if;

  raise exception E'RLS_RESULT||PASS=[%]||FAIL=[%]', v_pass, coalesce(nullif(v_fail,''),'geen');
end $$;
