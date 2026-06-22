-- VDG-4 — Vandaag-widget-layout, per gebruiker per huishouden (gesynct).
-- Gespiegeld op het user_module_prefs-patroon (0009): één rij per (profile, household)
-- met de geordende widget-layout als jsonb. Default (geen rij) = de afgeleide
-- standaard-layout uit de ingeschakelde modules (client-side, deriveDefaultLayout).
-- Idempotent.

create table if not exists public.home_layouts (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  layout       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (profile_id, household_id)
);

alter table public.home_layouts enable row level security;

-- Alleen je eigen layout-rijen zien.
drop policy if exists home_layouts_select on public.home_layouts;
create policy home_layouts_select on public.home_layouts
  for select using (profile_id = auth.uid());

-- Alleen je eigen rij schrijven, en alleen binnen een huishouden waar je lid van bent.
drop policy if exists home_layouts_write on public.home_layouts;
create policy home_layouts_write on public.home_layouts
  for all
  using (profile_id = auth.uid() and public.is_member(household_id))
  with check (profile_id = auth.uid() and public.is_member(household_id));

-- Realtime (zodat een wijziging op een ander toestel meekomt).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_layouts'
  ) then
    alter publication supabase_realtime add table public.home_layouts;
  end if;
end $$;
