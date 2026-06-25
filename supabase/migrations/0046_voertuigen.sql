-- ============================================================================
-- HUISHOEK — 0046: Voertuigen (VTG-1)
-- ============================================================================
-- Een nieuwe module, opgezet als Huisdieren/Planten met een eigen domeinmodel:
--   vehicles        : voertuigen per huishouden, volgt het zichtbaarheidscontract.
--   tasks.vehicle_id: koppelt de gegenereerde onderhoudstaken aan hun voertuig.
-- De onderhoudssjablonen (welke beurten, datum- én km-interval) leven in code
-- (lib/vehicleCare.js, getest) — net als de huisdier-routines. RDW-kentekenlookup,
-- kosten/historie en delen via de Samen-module zijn aparte vervolgstappen (VTG-2/3/4).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categorie 'voertuig' toestaan op tasks. De onderhoudstaken zijn gewone
--    tasks-rijen; ze moeten door de bestaande CHECK heen. (De canonieke lijst in
--    0001_init.sql is bijgewerkt zodat constants-sync klopt; hier zetten we 'm
--    live op de al-gemigreerde database.)
-- ---------------------------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('klus','huishouden','plant','huisdier','afspraak','overig','voertuig'));

-- ---------------------------------------------------------------------------
-- 2. Voertuigen per huishouden (zichtbaarheidscontract). Voor een auto vul je in
--    de praktijk alleen het kenteken in; de RDW-lookup (VTG-3) vult merk/model/type
--    en blijft overschrijfbaar. mileage = km-stand voor km-gebaseerd plannen.
-- ---------------------------------------------------------------------------
create table if not exists public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  make          text,                                  -- merk (RDW of handmatig)
  model         text,                                  -- handelsbenaming/model
  vehicle_type  text,                                  -- RDW-voertuigsoort
  year          int check (year is null or (year between 1900 and 2100)),
  license_plate text,                                  -- kenteken (genormaliseerd opgeslagen)
  mileage       int check (mileage is null or mileage >= 0),
  notes         text,
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists vehicles_household_idx on public.vehicles(household_id);

alter table public.vehicles drop constraint if exists vehicles_visibility_consistent;
alter table public.vehicles add constraint vehicles_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

select public.enable_module_rls('vehicles', 'created_by');

-- ---------------------------------------------------------------------------
-- 3. Koppel onderhoudstaken aan hun voertuig. Voertuig verwijderen ruimt de taken op.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists vehicle_id uuid
  references public.vehicles(id) on delete cascade;

create index if not exists tasks_vehicle_idx on public.tasks(vehicle_id) where vehicle_id is not null;
