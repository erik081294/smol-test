-- ============================================================================
-- RLS-verificatie via de Supabase-connector (zonder secrets / zonder egress)
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
-- Verwacht resultaat: PASS=[... 7 checks ...] FAIL=[geen].
-- Laatst gedraaid: 2026-06-21 → 7/7 pass, 0 residu (geverifieerd).
-- ============================================================================
do $$
declare
  alice uuid := gen_random_uuid();
  bob   uuid := gen_random_uuid();
  eve   uuid := gen_random_uuid();
  hh    uuid := gen_random_uuid();
  t_hh  uuid := gen_random_uuid();
  t_cus uuid := gen_random_uuid();
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

  -- ALICE (maker + lid)
  perform set_config('request.jwt.claims', json_build_object('sub',alice,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where id=t_hh;
  if v_cnt=1 then v_pass:=v_pass||'alice-ziet-household; '; else v_fail:=v_fail||'alice-MIST-household; '; end if;
  select count(*) into v_cnt from public.tasks where id=t_cus;
  if v_cnt=1 then v_pass:=v_pass||'alice-ziet-custom(maker); '; else v_fail:=v_fail||'alice-MIST-custom; '; end if;

  -- BOB (lid, geen maker)
  perform set_config('request.jwt.claims', json_build_object('sub',bob,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where id=t_hh;
  if v_cnt=1 then v_pass:=v_pass||'bob-ziet-household; '; else v_fail:=v_fail||'bob-MIST-household; '; end if;
  select count(*) into v_cnt from public.tasks where id=t_cus;
  if v_cnt=0 then v_pass:=v_pass||'bob-ziet-GEEN-custom; '; else v_fail:=v_fail||'bob-ZIET-custom(LEK!); '; end if;

  -- EVE (buitenstaander)
  perform set_config('request.jwt.claims', json_build_object('sub',eve,'role','authenticated')::text, true);
  select count(*) into v_cnt from public.tasks where household_id=hh;
  if v_cnt=0 then v_pass:=v_pass||'eve-ziet-NIETS; '; else v_fail:=v_fail||'eve-ZIET-'||v_cnt||'(LEK!); '; end if;

  -- INSERT-policy: lid mag, buitenstaander niet
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

  -- Surface resultaat + rol alles terug (geen persistentie)
  raise exception E'RLS_RESULT||PASS=[%]||FAIL=[%]', v_pass, coalesce(nullif(v_fail,''),'geen');
end $$;
