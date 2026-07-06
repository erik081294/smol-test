-- ============================================================================
-- HUISHOEK — 0076: Tijdlijn — filter-voorkeuren, twee lagen (TML-6, plan 19)
-- ============================================================================
-- De instelbare kant van de tijdlijn: wat verschijnt er in de feed? Twee lagen,
-- exact het model van module-toggling (0004):
--
--   household_timeline_prefs — de owner zet de basis: wat mag überhaupt op de
--                              tijdlijn (geldt voor alle leden).
--   user_timeline_prefs      — binnen die basis verfijnt elk lid voor zichzelf
--                              wat hij/zij ziet.
--
-- Eén rij per (as, waarde), bv. axis='module' value='boodschappen' of
-- axis='event_type' value='grocery_added'. De assen 'member' en 'subgroup' staan
-- alvast in de CHECK (TML-7/TML-8) maar krijgen pas later UI.
--
-- DEFAULT-ON: een item is zichtbaar tenzij er expliciet een rij met enabled=false
-- staat — wie niets instelt, ziet alles (geen seeding nodig). De effectieve
-- beslissing valt in de app (lib/timelineFilter.js → visibleOnTimeline); de DB
-- houdt enkel de overrides bij. Een huishouden-uitzetting wint van de gebruiker,
-- zelfde regel als effectiveModules (lib/modules.js).
--
-- RLS exact als 0004: huishouden-prefs leesbaar voor leden, schrijfbaar voor de
-- owner; user-prefs uitsluitend je eigen rijen. `(select auth.uid())` i.p.v.
-- kale auth.uid(): initplan i.p.v. per-rij-call (vgl. 0072).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists public.household_timeline_prefs (
  household_id uuid not null references public.households(id) on delete cascade,
  axis    text not null check (axis in ('module','event_type','member','subgroup')),
  value   text not null,            -- bv. 'boodschappen' (module) of 'grocery_added' (event_type)
  enabled boolean not null default true,
  primary key (household_id, axis, value)
);

create table if not exists public.user_timeline_prefs (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  axis    text not null check (axis in ('module','event_type','member','subgroup')),
  value   text not null,
  enabled boolean not null default true,
  primary key (household_id, profile_id, axis, value)
);

-- ---------------------------------------------------------------------------
-- RLS (spiegelt household_modules / user_module_prefs uit 0004)
-- ---------------------------------------------------------------------------
alter table public.household_timeline_prefs enable row level security;
alter table public.user_timeline_prefs enable row level security;

-- household_timeline_prefs: elk lid mag lezen (om de basis-filter te kennen),
-- maar alleen de owner mag 'm voor het hele huishouden zetten.
drop policy if exists household_timeline_prefs_select on public.household_timeline_prefs;
create policy household_timeline_prefs_select on public.household_timeline_prefs for select
  using (public.is_member(household_id));

drop policy if exists household_timeline_prefs_write on public.household_timeline_prefs;
create policy household_timeline_prefs_write on public.household_timeline_prefs for all
  using (public.is_owner(household_id))
  with check (public.is_owner(household_id));

-- user_timeline_prefs: je beheert (en ziet) uitsluitend je eigen voorkeuren, en
-- alleen in een huishouden waar je lid van bent.
drop policy if exists user_timeline_prefs_select on public.user_timeline_prefs;
create policy user_timeline_prefs_select on public.user_timeline_prefs for select
  using (profile_id = (select auth.uid()));

drop policy if exists user_timeline_prefs_write on public.user_timeline_prefs;
create policy user_timeline_prefs_write on public.user_timeline_prefs for all
  using (profile_id = (select auth.uid()) and public.is_member(household_id))
  with check (profile_id = (select auth.uid()) and public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime (idempotent toevoegen, zoals in 0004)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'household_timeline_prefs'
  ) then
    alter publication supabase_realtime add table public.household_timeline_prefs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'user_timeline_prefs'
  ) then
    alter publication supabase_realtime add table public.user_timeline_prefs;
  end if;
end $$;
