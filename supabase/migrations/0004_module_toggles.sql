-- ============================================================================
-- HUISHOEK — 0004: Module aan/uit (per huishouden én per gebruiker)
-- ============================================================================
-- Bouwt voort op het module-framework (0003). Doel: modules kunnen worden
-- in- en uitgeschakeld op twee niveaus, met een altijd-aan kern (Vandaag,
-- Huishouden) die niet uitzetbaar is.
--
--   household_modules  — de owner bepaalt welke modules in dit huishouden
--                        beschikbaar zijn (geldt voor alle leden).
--   user_module_prefs  — binnen wat het huishouden aanbiedt, kiest elk lid
--                        zelf wat hij/zij wil zien.
--
-- DEFAULT-ON: een module is aan tenzij er expliciet een rij met enabled=false
-- staat. Zo hoeven bestaande huishoudens/gebruikers niet geseed te worden — wie
-- niets instelt, krijgt alles. De effectieve set wordt in de app berekend
-- (lib/modules.js → effectiveModules); de DB houdt enkel de overrides bij.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: is de huidige gebruiker owner van dit huishouden? (spiegelt is_member)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists public.household_modules (
  household_id uuid not null references public.households(id) on delete cascade,
  module_key   text not null,
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (household_id, module_key)
);

create table if not exists public.user_module_prefs (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  module_key   text not null,
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (profile_id, household_id, module_key)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.household_modules enable row level security;
alter table public.user_module_prefs enable row level security;

-- household_modules: elk lid mag lezen (om de beschikbare modules te kennen),
-- maar alleen de owner mag aan/uit zetten voor het hele huishouden.
drop policy if exists "household_modules_select" on public.household_modules;
create policy "household_modules_select" on public.household_modules for select
  using (public.is_member(household_id));

drop policy if exists "household_modules_write" on public.household_modules;
create policy "household_modules_write" on public.household_modules for all
  using (public.is_owner(household_id))
  with check (public.is_owner(household_id));

-- user_module_prefs: je beheert uitsluitend je eigen voorkeuren, en alleen in
-- een huishouden waar je lid van bent.
drop policy if exists "user_module_prefs_select" on public.user_module_prefs;
create policy "user_module_prefs_select" on public.user_module_prefs for select
  using (profile_id = auth.uid());

drop policy if exists "user_module_prefs_write" on public.user_module_prefs;
create policy "user_module_prefs_write" on public.user_module_prefs for all
  using (profile_id = auth.uid() and public.is_member(household_id))
  with check (profile_id = auth.uid() and public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime (idempotent toevoegen, zoals in 0003)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'household_modules'
  ) then
    alter publication supabase_realtime add table public.household_modules;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'user_module_prefs'
  ) then
    alter publication supabase_realtime add table public.user_module_prefs;
  end if;
end $$;
