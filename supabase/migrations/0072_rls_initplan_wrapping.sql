-- ============================================================================
-- HUISHOEK — 0072: RLS init-plan-optimalisatie (Data-6, review-addendum 2026-07-04)
-- ============================================================================
-- De performance-advisor (auth_rls_initplan) flagt 23 policies met een "naakte"
-- auth.uid(): bij een naakte aanroep evalueert Postgres 'm PER RIJ i.p.v. één keer
-- per query. `(select auth.uid())` laat de planner 'm als init-plan cachen — exact
-- hetzelfde gedrag, maar één evaluatie i.p.v. N (merkbaar op de grote household-
-- gescopete lijsten). Puur perf: de USING/WITH CHECK-LOGICA blijft letterlijk gelijk.
--
-- Bewust ALTER POLICY (géén DROP+CREATE): dit raakt alléén de expressie, niet het
-- command of de rol-scope (TO ...) — geen risico op een per ongeluk verruimde policy.
-- Migratie 0067 (timeline_reactions) deed de wrapping al goed; dit trekt de rest gelijk.
-- ============================================================================

-- Assistent (0068/0069) — creator-privé.
alter policy assistant_conversations_owner on public.assistant_conversations
  using ((created_by = (select auth.uid())) and is_member(household_id))
  with check ((created_by = (select auth.uid())) and is_member(household_id));

alter policy assistant_messages_owner on public.assistant_messages
  using ((created_by = (select auth.uid())) and is_member(household_id))
  with check ((created_by = (select auth.uid())) and is_member(household_id) and (exists (
    select 1
    from public.assistant_conversations c
    where c.id = assistant_messages.conversation_id
      and c.created_by = (select auth.uid())
      and c.household_id = assistant_messages.household_id)));

-- Kosten (0007/0025).
alter policy expense_shares_write on public.expense_shares
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and e.created_by = (select auth.uid())))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id and e.created_by = (select auth.uid())));

alter policy expenses_insert on public.expenses
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy recurring_expenses_insert on public.recurring_expenses
  with check (is_member(household_id) and (created_by = (select auth.uid())));

-- Boodschappen.
alter policy groceries_insert on public.groceries
  with check (is_member(household_id) and (added_by = (select auth.uid())));

-- Home-layout (per gebruiker).
alter policy home_layouts_select on public.home_layouts
  using (profile_id = (select auth.uid()));

alter policy home_layouts_write on public.home_layouts
  using ((profile_id = (select auth.uid())) and is_member(household_id))
  with check ((profile_id = (select auth.uid())) and is_member(household_id));

-- Huishouden-fundament.
alter policy members_delete on public.household_members
  using ((profile_id = (select auth.uid())) or is_owner(household_id));

alter policy households_insert on public.households
  with check (created_by = (select auth.uid()));

alter policy households_select on public.households
  using (is_member(id) or (created_by = (select auth.uid())));

-- Profielen.
alter policy profiles_select on public.profiles
  using ((id = (select auth.uid())) or (exists (
    select 1
    from public.household_members m1
    join public.household_members m2 on m1.household_id = m2.household_id
    where m1.profile_id = (select auth.uid()) and m2.profile_id = profiles.id)));

alter policy profiles_update on public.profiles
  using (id = (select auth.uid()));

-- Module-voorkeuren (per gebruiker).
alter policy user_module_prefs_select on public.user_module_prefs
  using (profile_id = (select auth.uid()));

alter policy user_module_prefs_write on public.user_module_prefs
  using ((profile_id = (select auth.uid())) and is_member(household_id))
  with check ((profile_id = (select auth.uid())) and is_member(household_id));

-- Push-tokens (per gebruiker).
alter policy push_tokens_self on public.push_tokens
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Plant-soorten (gedeelde referentietabel; alleen ingelogd zichtbaar).
alter policy plant_species_select on public.plant_species
  using ((select auth.uid()) is not null);

-- Module-insert-policies (0066/0070: creator = de inzender).
alter policy tasks_insert on public.tasks
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy plants_insert on public.plants
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy pets_insert on public.pets
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy vehicles_insert on public.vehicles
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy shared_resources_insert on public.shared_resources
  with check (is_member(household_id) and (created_by = (select auth.uid())));

alter policy timeline_posts_insert on public.timeline_posts
  with check (is_member(household_id) and (author_id = (select auth.uid())));
