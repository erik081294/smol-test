-- ============================================================================
-- HUISHOEK — 0011: Plantendagboek (PLA-5)
-- ============================================================================
-- Meerdere foto's per plant over tijd. Elke foto is een rij in plant_photos en
-- een object in de bestaande 'plants'-bucket onder <household_id>/<plant_id>/<key>.<ext>.
-- De nieuwste dagboekfoto fungeert als omslag (plants.photo_path).
--
-- plant_photos heeft geen eigen visibility-kolommen: het erft de zichtbaarheid
-- van zijn parent-plant (zelfde patroon als expense_shares ↔ expenses in 0007).
-- ============================================================================

create table if not exists public.plant_photos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plant_id     uuid not null references public.plants(id) on delete cascade,
  photo_path   text not null,
  note         text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists plant_photos_plant_idx on public.plant_photos(plant_id, created_at desc);

alter table public.plant_photos enable row level security;

-- Zien: wie de parent-plant mag zien (can_view), mag ook de dagboekfoto's zien.
drop policy if exists plant_photos_select on public.plant_photos;
create policy plant_photos_select on public.plant_photos for select using (
  exists (
    select 1 from public.plants p
    where p.id = plant_id
      and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.created_by)
  )
);

-- Schrijven: lid van het huishouden van de parent-plant.
drop policy if exists plant_photos_write on public.plant_photos;
create policy plant_photos_write on public.plant_photos for all using (
  exists (select 1 from public.plants p where p.id = plant_id and public.is_member(p.household_id))
) with check (
  exists (select 1 from public.plants p where p.id = plant_id and public.is_member(p.household_id))
);

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plant_photos'
  ) then
    alter publication supabase_realtime add table public.plant_photos;
  end if;
end $$;
