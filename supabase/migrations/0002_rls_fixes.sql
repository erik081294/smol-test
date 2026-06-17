-- ============================================================================
-- HUISHOEK — 0002: RLS- en integriteitsfixes
-- ============================================================================
-- Bouwt voort op 0001_init.sql (dat blijft ongewijzigd). Bevat:
--   1. Helper is_owner() + strengere/aanvullende policies op household_members.
--   2. Foreign keys naar profielen op ON DELETE SET NULL, zodat een gebruiker
--      verwijderd kan worden zonder dat het op FK-restricties stukloopt.
-- Idempotent waar mogelijk (drop-if-exists / NOT VALID-vrije her-creatie).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. household_members: alleen owners mogen anderen verwijderen / rollen wijzigen
-- ---------------------------------------------------------------------------

-- Helper: is de huidige gebruiker OWNER van dit huishouden?
-- security definer -> omzeilt RLS, voorkomt recursie als policies op
-- household_members deze tabel opnieuw zouden bevragen.
create or replace function public.is_owner(hh uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and profile_id = auth.uid() and role = 'owner'
  );
$$;

-- Verwijderen: jezelf verlaten OF je bent owner van het huishouden.
-- (0001 liet elk lid elk ander lid verwijderen — owner kon gekickt worden.)
drop policy if exists "members_delete" on public.household_members;
create policy "members_delete" on public.household_members for delete
  using (profile_id = auth.uid() or public.is_owner(household_id));

-- Wijzigen (bv. rol/ownership overdragen): alleen owners. Ontbrak in 0001.
drop policy if exists "members_update" on public.household_members;
create policy "members_update" on public.household_members for update
  using (public.is_owner(household_id))
  with check (public.is_owner(household_id));

-- ---------------------------------------------------------------------------
-- 2. Foreign keys -> ON DELETE SET NULL (account-/profielverwijdering)
-- ---------------------------------------------------------------------------
-- In 0001 zijn created_by/added_by NOT NULL zonder on-delete-actie. Bij het
-- verwijderen van een profiel (cascade vanaf auth.users) faalt dat dan op een
-- RESTRICT. We maken de kolommen nullable en zetten ON DELETE SET NULL: de
-- rij blijft bestaan, alleen de attributie ("door wie aangemaakt") vervalt.

-- households.created_by
alter table public.households alter column created_by drop not null;
alter table public.households drop constraint if exists households_created_by_fkey;
alter table public.households
  add constraint households_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- subgroups.created_by
alter table public.subgroups alter column created_by drop not null;
alter table public.subgroups drop constraint if exists subgroups_created_by_fkey;
alter table public.subgroups
  add constraint subgroups_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- tasks.created_by
alter table public.tasks alter column created_by drop not null;
alter table public.tasks drop constraint if exists tasks_created_by_fkey;
alter table public.tasks
  add constraint tasks_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- groceries.added_by
alter table public.groceries alter column added_by drop not null;
alter table public.groceries drop constraint if exists groceries_added_by_fkey;
alter table public.groceries
  add constraint groceries_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;
