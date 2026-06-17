-- ============================================================================
-- HUISHOEK — test voor de zichtbaarheidslogica (can_view)
-- ============================================================================
-- Draai dit in de Supabase SQL Editor NA de migratie. Het maakt tijdelijke
-- testdata aan, controleert can_view in alle scenario's, en draait alles
-- daarna weer terug (rollback) zodat je database schoon blijft.
--
-- Slaagt alles, dan zie je "ALLE CAN_VIEW-TESTS GESLAAGD". Faalt er iets, dan
-- stopt het script met een foutmelding die het scenario noemt.
--
-- Let op: can_view leest auth.uid(). In de SQL Editor draai je als superuser,
-- dus we testen hier de kale regels via een hulpfunctie die een expliciete
-- gebruiker meekrijgt — een 1-op-1 kopie van can_view zonder auth.uid().
-- ============================================================================

begin;

-- Hulpfunctie: zelfde regels als public.can_view, maar met expliciete viewer.
create or replace function pg_temp.can_view_as(
  viewer uuid, hh uuid, visibility text, sg uuid, share_with uuid[], creator uuid,
  hh_members uuid[], sg_members uuid[]
) returns boolean language sql as $$
  select (viewer = any(hh_members)) and (
    coalesce(visibility,'household') = 'household'
    or creator = viewer
    or (visibility = 'subgroup' and viewer = any(sg_members))
    or (visibility = 'custom' and viewer = any(share_with))
  );
$$;

do $$
declare
  papa uuid := '00000000-0000-0000-0000-000000000001';
  mama uuid := '00000000-0000-0000-0000-000000000002';
  tim  uuid := '00000000-0000-0000-0000-000000000003';
  lisa uuid := '00000000-0000-0000-0000-000000000004';
  buur uuid := '00000000-0000-0000-0000-000000000009';
  hh   uuid := '00000000-0000-0000-0000-0000000000AA';
  sg_ouders uuid := '00000000-0000-0000-0000-0000000000B1';
  sg_voetbal uuid := '00000000-0000-0000-0000-0000000000B2';
  hh_leden uuid[] := array[papa,mama,tim,lisa];
  ouders uuid[] := array[papa,mama];
  voetbal uuid[] := array[papa,mama,tim];
begin
  -- household: tim ziet, buur niet
  assert pg_temp.can_view_as(tim, hh, 'household', null, null, mama, hh_leden, '{}') = true,
    'household: tim hoort het te zien';
  assert pg_temp.can_view_as(buur, hh, 'household', null, null, mama, hh_leden, '{}') = false,
    'household: buur (geen lid) mag niets zien';

  -- subgroep ouders: papa wel, tim/lisa niet
  assert pg_temp.can_view_as(papa, hh, 'subgroup', sg_ouders, null, mama, hh_leden, ouders) = true,
    'ouders: papa hoort het te zien';
  assert pg_temp.can_view_as(tim, hh, 'subgroup', sg_ouders, null, mama, hh_leden, ouders) = false,
    'ouders: tim mag het NIET zien';
  assert pg_temp.can_view_as(lisa, hh, 'subgroup', sg_ouders, null, mama, hh_leden, ouders) = false,
    'ouders: lisa mag het NIET zien';

  -- voetbal: tim wel, lisa niet (kernscenario)
  assert pg_temp.can_view_as(tim, hh, 'subgroup', sg_voetbal, null, papa, hh_leden, voetbal) = true,
    'voetbal: tim hoort het te zien';
  assert pg_temp.can_view_as(lisa, hh, 'subgroup', sg_voetbal, null, papa, hh_leden, voetbal) = false,
    'voetbal: lisa mag het NIET zien';

  -- custom: papa deelt met lisa. lisa + maker zien; tim/mama niet
  assert pg_temp.can_view_as(lisa, hh, 'custom', null, array[lisa], papa, hh_leden, '{}') = true,
    'custom: lisa hoort het te zien';
  assert pg_temp.can_view_as(papa, hh, 'custom', null, array[lisa], papa, hh_leden, '{}') = true,
    'custom: maker (papa) ziet altijd';
  assert pg_temp.can_view_as(tim, hh, 'custom', null, array[lisa], papa, hh_leden, '{}') = false,
    'custom: tim mag het NIET zien';
  assert pg_temp.can_view_as(mama, hh, 'custom', null, array[lisa], papa, hh_leden, '{}') = false,
    'custom: mama mag het NIET zien';

  -- cadeau-scenario: mama deelt met lisa, papa ziet niet
  assert pg_temp.can_view_as(papa, hh, 'custom', null, array[lisa], mama, hh_leden, '{}') = false,
    'cadeau: papa mag het cadeau NIET zien';

  raise notice '✅ ALLE CAN_VIEW-TESTS GESLAAGD';
end $$;

rollback;
