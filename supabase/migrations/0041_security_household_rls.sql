-- ============================================================================
-- HUISHOEK — 0041: Security-hardening huishouden-RLS (SEC-1, SEC-4)
-- ============================================================================
-- Sluit twee tenant-isolatie-gaten uit de security-doorlichting (docs/plans/17):
--
--   SEC-1 (KRITIEK). De policy members_insert (0001) had `with check (profile_id =
--     auth.uid())` zonder rol-/lidmaatschap-eis. Daardoor kon élke ingelogde
--     gebruiker zichzelf als 'owner' aan een WILLEKEURIG household_id toevoegen
--     (raden/kennen van de id volstond) → volledige lees/schrijf op andermans data.
--     Fix: trek het directe INSERT-recht op household_members in en route
--     huishouden-aanmaak via een SECURITY DEFINER-RPC create_household, analoog aan
--     het revoke-patroon van record_receipt_scan/insert_catalog_product.
--
--   SEC-4. households_update (0001) stond elk LID toe het huishouden te wijzigen,
--     inclusief de invite_code roteren (lock-out/troll). Nu owner-only, consistent
--     met household_modules/members_update.
--
-- NB: members_delete/members_update zijn al sinds 0002 owner-only (geen wijziging).
-- Idempotent (create or replace / drop policy if exists / revoke is herhaalbaar).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SEC-1: huishouden + owner-membership atomair via één DEFINER-RPC
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_emoji text default '🏡')
returns public.households
language plpgsql
security definer set search_path = public
as $$
declare
  hh public.households;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Naam is verplicht';
  end if;
  insert into public.households (name, emoji, created_by)
  values (btrim(p_name), coalesce(nullif(btrim(p_emoji), ''), '🏡'), auth.uid())
  returning * into hh;
  insert into public.household_members (household_id, profile_id, role)
  values (hh.id, auth.uid(), 'owner');
  return hh;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

-- Directe client-inserts op household_members dichttrekken. Toetreden loopt
-- voortaan uitsluitend via de DEFINER-RPC's join_household (rol 'member') en
-- create_household (rol 'owner'); die draaien als functie-eigenaar (postgres) en
-- worden door dit revoke niet geraakt.
revoke insert on public.household_members from anon, authenticated;

-- Defense-in-depth: de permissieve insert-policy weghalen zodat een toekomstig,
-- per ongeluk hersteld grant het gat niet heropent. (De DEFINER-RPC's omzeilen RLS
-- als table-owner, dus dit raakt hun inserts niet.)
drop policy if exists "members_insert" on public.household_members;

-- ---------------------------------------------------------------------------
-- SEC-4: huishouden bewerken alleen door de owner
-- ---------------------------------------------------------------------------
drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households for update
  using (public.is_owner(id))
  with check (public.is_owner(id));
