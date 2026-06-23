-- ============================================================================
-- HUISHOEK — 0038: Huisdieren (HUI-1)
-- ============================================================================
-- Een nieuwe module, opgezet als de Planten-module maar met een eigen domeinmodel:
--   pets    : huisdieren per huishouden, volgt het zichtbaarheidscontract.
--   pet_log : tijdlijn-posts (foto / notitie / gewicht) per dier.
--   tasks.pet_id : koppelt de gegenereerde verzorgingstaken aan hun dier.
-- De verzorgingsroutines (welke taken per diersoort) leven in code (lib/petCare.js,
-- getest) — er zijn maar een handvol diertypen, dus geen soort-DB zoals bij planten.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categorie 'huisdier' toestaan op tasks. De verzorgingstaken zijn gewone
--    tasks-rijen; ze moeten door de bestaande CHECK heen. (De canonieke lijst in
--    0001_init.sql is bijgewerkt zodat constants-sync klopt; hier zetten we 'm
--    live op de al-gemigreerde database.)
-- ---------------------------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('klus','huishouden','plant','huisdier','afspraak','overig'));

-- ---------------------------------------------------------------------------
-- 2. Huisdieren per huishouden (zichtbaarheidscontract). `type` is vrije tekst:
--    de diertypen-lijst leeft in code ('anders' vangt de rest), dus geen CHECK.
-- ---------------------------------------------------------------------------
create table if not exists public.pets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  type          text not null default 'anders',
  birth_date    date,
  photo_path    text,                                  -- pad in Storage-bucket 'pets'
  chip_number   text,
  vet_name      text,
  notes         text,
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists pets_household_idx on public.pets(household_id);

alter table public.pets drop constraint if exists pets_visibility_consistent;
alter table public.pets add constraint pets_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

select public.enable_module_rls('pets', 'created_by');

-- ---------------------------------------------------------------------------
-- 3. Koppel verzorgingstaken aan hun dier. Dier verwijderen ruimt de taken op.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists pet_id uuid
  references public.pets(id) on delete cascade;

create index if not exists tasks_pet_idx on public.tasks(pet_id) where pet_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Tijdlijn per dier (foto / notitie / gewicht). Geen eigen visibility-kolommen:
--    erft de zichtbaarheid van het parent-dier (zoals plant_photos ↔ plants in 0011).
--    De CHECK eist minstens één van foto/notitie/gewicht — een lege post is zinloos.
-- ---------------------------------------------------------------------------
create table if not exists public.pet_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id       uuid not null references public.pets(id) on delete cascade,
  photo_path   text,
  note         text,
  weight_grams int check (weight_grams is null or weight_grams > 0),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  constraint pet_log_has_content check (
    photo_path is not null
    or nullif(btrim(note), '') is not null
    or weight_grams is not null
  )
);
create index if not exists pet_log_pet_idx on public.pet_log(pet_id, created_at desc);

alter table public.pet_log enable row level security;

-- Zien: wie het parent-dier mag zien (can_view), mag ook de tijdlijn zien.
drop policy if exists pet_log_select on public.pet_log;
create policy pet_log_select on public.pet_log for select using (
  exists (
    select 1 from public.pets p
    where p.id = pet_id
      and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.created_by)
  )
);

-- Schrijven: lid van het huishouden van het parent-dier.
drop policy if exists pet_log_write on public.pet_log;
create policy pet_log_write on public.pet_log for all using (
  exists (select 1 from public.pets p where p.id = pet_id and public.is_member(p.household_id))
) with check (
  exists (select 1 from public.pets p where p.id = pet_id and public.is_member(p.household_id))
);

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pet_log'
  ) then
    alter publication supabase_realtime add table public.pet_log;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Foto-opslag: een private bucket 'pets'. Eerste pad-segment = household_id,
--    zodat de toegang met dezelfde is_member-regel gescoped is (zoals 'plants' in 0010).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pets', 'pets', false)
on conflict (id) do nothing;

drop policy if exists "pets_photos_read" on storage.objects;
create policy "pets_photos_read" on storage.objects for select
  using (bucket_id = 'pets' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "pets_photos_insert" on storage.objects;
create policy "pets_photos_insert" on storage.objects for insert
  with check (bucket_id = 'pets' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "pets_photos_update" on storage.objects;
create policy "pets_photos_update" on storage.objects for update
  using (bucket_id = 'pets' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "pets_photos_delete" on storage.objects;
create policy "pets_photos_delete" on storage.objects for delete
  using (bucket_id = 'pets' and public.is_member( ((storage.foldername(name))[1])::uuid ));
