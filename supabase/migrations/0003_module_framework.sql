-- ============================================================================
-- HUISHOEK — 0003: Module-framework (RLS-helper + integriteit)
-- ============================================================================
-- Bouwt voort op 0001/0002. Doel: een nieuwe module-tabel die het standaard
-- zichtbaarheidscontract volgt (household_id, visibility, share_subgroup_id,
-- share_with, <creator>) kan met één aanroep volledig worden afgedekt:
--
--   select public.enable_module_rls('mijn_tabel', 'created_by');
--
-- Dit zet aan: RLS, de vier policies (select/insert/update/delete) via can_view,
-- de subgroep-integriteitstrigger, en realtime. Idempotent: opnieuw draaien
-- vervangt de policies/trigger zonder fouten.
--
-- Daarnaast: harde integriteit op de bestaande module-tabellen (tasks,
-- groceries) zodat de zichtbaarheidsdata altijd consistent is met can_view.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Integriteit: een subgroep-deling mag alleen naar een subgroep uit
--    HETZELFDE huishouden wijzen. Zonder deze check zou een item via een
--    share_subgroup_id uit een vreemd huishouden gedeeld kunnen worden
--    (can_view->in_subgroup kijkt niet naar het huishouden van de subgroep).
-- ---------------------------------------------------------------------------
create or replace function public.check_subgroup_household()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.share_subgroup_id is not null then
    if not exists (
      select 1 from public.subgroups s
      where s.id = new.share_subgroup_id
        and s.household_id = new.household_id
    ) then
      raise exception
        'share_subgroup_id % hoort niet bij huishouden %',
        new.share_subgroup_id, new.household_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. De framework-helper. Maakt een module-tabel "af": RLS + policies +
--    integriteitstrigger + realtime. Veilig herhaalbaar.
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
  -- RLS aan
  execute format('alter table %s enable row level security', qtbl);

  -- Schoon opruimen: zowel de generieke (oude) als de per-tabel policy-namen.
  execute format('drop policy if exists %I on %s', tbl || '_select', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_insert', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_update', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_delete', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_all', qtbl);
  execute format('drop policy if exists %I on %s', tbl || '_write', qtbl);

  -- Zien: volgens het zichtbaarheidscontract (can_view).
  -- Schrijven: elk huishoudlid mag toevoegen; bewerken/verwijderen mag wie het
  -- item mag zien. Let op: insert checkt bewust alleen is_member, niet can_view
  -- (anders kun je nooit een item aanmaken dat je daarna zelf nog ziet).
  execute format($f$
    create policy %I on %s for select
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
  $f$, tbl || '_select', qtbl, creator_col);

  execute format($f$
    create policy %I on %s for insert
      with check (public.is_member(household_id))
  $f$, tbl || '_insert', qtbl);

  execute format($f$
    create policy %I on %s for update
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
      with check (public.is_member(household_id))
  $f$, tbl || '_update', qtbl, creator_col);

  execute format($f$
    create policy %I on %s for delete
      using (public.can_view(household_id, visibility, share_subgroup_id, share_with, %I))
  $f$, tbl || '_delete', qtbl, creator_col);

  -- Integriteitstrigger (subgroep hoort bij het huishouden van het item).
  execute format('drop trigger if exists %I on %s', tbl || '_subgroup_household', qtbl);
  execute format($f$
    create trigger %I before insert or update on %s
      for each row execute procedure public.check_subgroup_household()
  $f$, tbl || '_subgroup_household', qtbl);

  -- Realtime (alleen toevoegen als de tabel er nog niet in zit).
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
-- 3. CHECK-constraints op de bestaande module-tabellen: zichtbaarheidsdata
--    moet consistent zijn met de gekozen 'visibility'.
--      - subgroup -> share_subgroup_id verplicht
--      - niet-subgroup -> geen losse share_subgroup_id
-- ---------------------------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_visibility_consistent;
alter table public.tasks add constraint tasks_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

alter table public.groceries drop constraint if exists groceries_visibility_consistent;
alter table public.groceries add constraint groceries_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

-- ---------------------------------------------------------------------------
-- 4. Bestaande module-tabellen via de helper afdekken. Dit vervangt de met
--    de hand geschreven policies uit 0001 door exact dezelfde, nu DRY.
-- ---------------------------------------------------------------------------
select public.enable_module_rls('tasks', 'created_by');
select public.enable_module_rls('groceries', 'added_by');
