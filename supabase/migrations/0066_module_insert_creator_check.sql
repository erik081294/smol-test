-- ============================================================================
-- HUISHOEK — 0066: insert-policy dwingt creator = auth.uid() af (SEC-hardening)
-- ============================================================================
-- Review 2026-06-27 (docs/reviews/2026-06-27-multi-agent-review.md, Agent 2 P2).
--
-- Probleem: de module-insert-policy checkte bewust alleen `is_member(household_id)`
-- (zie 0003, regel 73-74: "insert checkt bewust alleen is_member, niet can_view").
-- Gevolg: een huishoudlid kon een rij invoegen met de creator-kolom
-- (created_by / added_by / author_id) op een ÁNDER lid gezet — attributie-spoofing.
-- Geen cross-household lek (household_id moet het eigen huishouden zijn), maar de
-- creator voedt `can_view` (subgroup/custom), dus een gespoofte maker kan de
-- zichtbaarheid binnen het huishouden subtiel beïnvloeden, en het auteurschap in de
-- feed/tijdlijn is vervalsbaar.
--
-- Fix: de insert WITH CHECK eist nu óók `<creator_col> = auth.uid()`. Om te voorkomen
-- dat een insert die de kolom wegláát breekt, krijgen de creator-kolommen een
-- DEFAULT auth.uid() — een weggelaten creator wordt zo de huidige gebruiker, en een
-- expliciet op een ander lid gezette creator wordt geweigerd.
--
-- Buiten scope (bewust ongemoeid):
--   * DEFINER-RPC-inserts (expenses via create_expense, household_invites, …) omzeilen
--     RLS en zetten de creator al server-side op auth.uid() — die zijn al veilig.
--   * Cross-cutting tabellen zonder creator/visibility-contract (zones; tags) houden
--     hun bestaande is_member-insert: daar is "creator" geen betekenisvol veld.
--
-- Idempotent: drop-if-exists + create; opnieuw draaien is veilig.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper bijwerken zodat NIEUWE module-tabellen de creator-check meekrijgen.
--    (Identiek aan 0003, alleen de insert-policy is aangescherpt.)
-- ---------------------------------------------------------------------------
create or replace function public.enable_module_rls(
  tbl text,
  creator_col text default 'created_by'
)
returns void
language plpgsql
as $$
declare
  qtbl text := format('public.%I', tbl);
begin
  execute format('alter table %s enable row level security', qtbl);

  execute format('drop policy if exists %I on %s', tbl || '_select', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_insert', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_update', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_delete', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_all', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_write', qtbl);

  execute format($f$
    create policy %I on %s for select
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
  $f$, tbl || '_select', qtbl, creator_col);

  -- Schrijven: lid van het huishouden ÉN de creator-kolom is de huidige gebruiker.
  execute format($f$
    create policy %I on %s for insert
      with check (public.is_member(household_id) and %I = auth.uid())
  $f$, tbl || '_insert', qtbl, creator_col);

  execute format($f$
    create policy %I on %s for update
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
      with check (public.is_member(household_id))
  $f$, tbl || '_update', qtbl, creator_col);

  execute format($f$
    create policy %I on %s for delete
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
  $f$, tbl || '_delete', qtbl, creator_col);

  execute format('drop trigger if exists %I on %s', tbl || '_subgroup_household', qtbl);
  execute format($f$
    create trigger %I before insert or update on %s
      for each row execute procedure public.check_subgroup_household()
  $f$, tbl || '_subgroup_household', qtbl);

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = tbl
  ) then
    execute format('alter publication supabase_realtime add table %s', qtbl);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Creator-kolommen krijgen DEFAULT auth.uid() zodat een weggelaten creator
--    de huidige gebruiker wordt (en de nieuwe insert-check niet breekt).
-- ---------------------------------------------------------------------------
alter table public.tasks            alter column created_by set default auth.uid();
alter table public.groceries        alter column added_by   set default auth.uid();
alter table public.plants           alter column created_by set default auth.uid();
alter table public.pets             alter column created_by set default auth.uid();
alter table public.vehicles         alter column created_by set default auth.uid();
alter table public.shared_resources alter column created_by set default auth.uid();
alter table public.timeline_posts   alter column author_id  set default auth.uid();

-- ---------------------------------------------------------------------------
-- 3. Bestaande module-content-tabellen: alléén de insert-policy vervangen
--    (chirurgisch — raakt select/update/delete niet, dus geen risico op een
--    visibility-kolom-mismatch). Eén regel per tabel met zijn eigen creator-kolom.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists groceries_insert on public.groceries;
create policy groceries_insert on public.groceries for insert
  with check (public.is_member(household_id) and added_by = auth.uid());

drop policy if exists plants_insert on public.plants;
create policy plants_insert on public.plants for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists pets_insert on public.pets;
create policy pets_insert on public.pets for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists shared_resources_insert on public.shared_resources;
create policy shared_resources_insert on public.shared_resources for insert
  with check (public.is_member(household_id) and created_by = auth.uid());

drop policy if exists timeline_posts_insert on public.timeline_posts;
create policy timeline_posts_insert on public.timeline_posts for insert
  with check (public.is_member(household_id) and author_id = auth.uid());
