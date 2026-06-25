-- ============================================================================
-- HUISHOEK — 0054: Tijdlijn / Prikbord — fundament (TML-1, plan 19)
-- ============================================================================
-- Het sociale hart van het huishouden: handgeschreven berichten (tekst + grote
-- foto's) als hoofdmoot van de tijdlijn, ter vervanging van het lees-only
-- Activiteit-scherm (PLT-6). De automatische event-laag komt in TML-5 als
-- samenvouwbare laag terug (geen nieuwe tabel; afgeleid uit bestaande bronnen).
--
-- timeline_posts volgt het standaard zichtbaarheidscontract (creator = author_id).
-- timeline_photos is een kind-tabel die de zichtbaarheid van de post erft (zelfde
-- patroon als plant_photos ↔ plants in 0011): geen eigen visibility-kolommen, RLS
-- via de parent. Net als plant_photos draagt het wél een household_id, puur zodat
-- de realtime-subscriptie gescopet kan worden (geen brede tabel-subscription →
-- geen cross-household refetch-storms, vgl. expense_shares sinds 0025).
--
-- Een leeg bericht (geen tekst én geen foto) voorkomen we in de app-laag (compose
-- valideert via lib/timeline.js → isPostValid), niet met een cross-tabel-CHECK —
-- dezelfde pragmatische keuze als bij plant_photos (notitie-of-foto in code).
-- ============================================================================

-- Berichten ------------------------------------------------------------------
create table if not exists public.timeline_posts (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete cascade,
  author_id         uuid not null references public.profiles(id),
  body              text,                                  -- nullable: foto-only mag
  pinned_at         timestamptz,                           -- TML-2 (null = niet gepind)
  pinned_by         uuid references public.profiles(id),
  visibility        text not null default 'household'
                      check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with        uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.timeline_posts drop constraint if exists timeline_posts_visibility_consistent;
alter table public.timeline_posts add constraint timeline_posts_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

-- Zet RLS + de 4 zichtbaarheidspolicies (via can_view) + subgroep-integriteitstrigger
-- + realtime aan, met author_id als creator-kolom.
select public.enable_module_rls('timeline_posts', 'author_id');

-- Feed-index: gepind eerst, daarna nieuwste eerst, per huishouden.
create index if not exists timeline_posts_feed_idx
  on public.timeline_posts (household_id, pinned_at desc nulls last, created_at desc);

-- Foto's (kind-tabel, erft post-zichtbaarheid) ------------------------------
create table if not exists public.timeline_photos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  post_id      uuid not null references public.timeline_posts(id) on delete cascade,
  photo_path   text not null,                              -- pad in bucket 'timeline'
  width        int,
  height       int,
  position     int not null default 0,                     -- volgorde in de galerij
  created_at   timestamptz not null default now()
);
create index if not exists timeline_photos_post_idx on public.timeline_photos (post_id, position);

alter table public.timeline_photos enable row level security;

-- Zien: wie de parent-post mag zien (can_view), ziet ook de foto's.
drop policy if exists timeline_photos_select on public.timeline_photos;
create policy timeline_photos_select on public.timeline_photos for select using (
  exists (
    select 1 from public.timeline_posts p
    where p.id = post_id
      and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
  )
);

-- Schrijven: lid van het huishouden van de parent-post.
drop policy if exists timeline_photos_write on public.timeline_photos;
create policy timeline_photos_write on public.timeline_photos for all using (
  exists (select 1 from public.timeline_posts p where p.id = post_id and public.is_member(p.household_id))
) with check (
  exists (select 1 from public.timeline_posts p where p.id = post_id and public.is_member(p.household_id))
);

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timeline_photos'
  ) then
    alter publication supabase_realtime add table public.timeline_photos;
  end if;
end $$;

-- Bucket 'timeline' (privé, household-gescopet; zoals 'plants'/'recipes'/'vehicles').
-- Pad-prefix <household_id>/… ; lezen/schrijven alleen voor leden van dat huishouden.
insert into storage.buckets (id, name, public)
values ('timeline', 'timeline', false)
on conflict (id) do nothing;

drop policy if exists "timeline_photos_read" on storage.objects;
create policy "timeline_photos_read" on storage.objects for select
  using (bucket_id = 'timeline' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "timeline_photos_insert" on storage.objects;
create policy "timeline_photos_insert" on storage.objects for insert
  with check (bucket_id = 'timeline' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "timeline_photos_update" on storage.objects;
create policy "timeline_photos_update" on storage.objects for update
  using (bucket_id = 'timeline' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "timeline_photos_delete" on storage.objects;
create policy "timeline_photos_delete" on storage.objects for delete
  using (bucket_id = 'timeline' and public.is_member( ((storage.foldername(name))[1])::uuid ));
