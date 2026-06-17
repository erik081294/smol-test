-- ============================================================================
-- HUISHOEK — 0008: Planten (soortdatabase + planten + verzorgingskoppeling)
-- ============================================================================
-- plant_species : globale, read-only soortkennis met regelgebaseerde verzorging
--                 (geseed in 0009). Niet per huishouden.
-- plants        : planten per huishouden, volgt het zichtbaarheidscontract.
-- tasks.plant_id: koppelt de gegenereerde water-/voedingstaken aan hun plant.
-- De schema-/verzorgingslogica leeft in lib/plantCare.js (getest).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Soort-referentie (globaal). Leesbaar voor elke ingelogde gebruiker; vullen
--    gebeurt via migratie/service-role (geen write-policy).
-- ---------------------------------------------------------------------------
create table if not exists public.plant_species (
  id                 uuid primary key default gen_random_uuid(),
  common_name        text not null,
  latin_name         text,
  water_days_growing int not null,
  water_days_resting int not null,
  feed_weeks_growing int,                 -- null = geen voeding nodig
  light              text check (light in ('schaduw','halfschaduw','licht','vol-zon')),
  care_notes         text,
  search             text                 -- genormaliseerd (lowercase) voor zoeken
);
create index if not exists plant_species_search_idx on public.plant_species (search);

alter table public.plant_species enable row level security;
drop policy if exists plant_species_select on public.plant_species;
create policy plant_species_select on public.plant_species for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 2. Planten per huishouden (zichtbaarheidscontract).
-- ---------------------------------------------------------------------------
create table if not exists public.plants (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  species_id    uuid references public.plant_species(id) on delete set null,
  location      text,
  photo_path    text,                                  -- pad in Storage-bucket 'plants' (later)
  water_days    int,                                   -- handmatige terugval als species_id null is
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists plants_household_idx on public.plants(household_id);

alter table public.plants drop constraint if exists plants_visibility_consistent;
alter table public.plants add constraint plants_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

select public.enable_module_rls('plants', 'created_by');

-- ---------------------------------------------------------------------------
-- 3. Koppel verzorgingstaken aan hun plant. Plant verwijderen ruimt de taken op.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists plant_id uuid
  references public.plants(id) on delete cascade;

create index if not exists tasks_plant_idx on public.tasks(plant_id) where plant_id is not null;
