-- ============================================================================
-- HUISHOEK — 0039: Tags (UX-41)
-- ============================================================================
-- Door gebruikers gemaakte, gekleurde labels die aan afspraken (tasks) hangen.
-- Geeft gezinnen ultieme flexibiliteit in het type afspraken dat ze bijhouden,
-- ook als geen enkele module hun wens dekt; tegelijk voeden de tags de filters.
--
-- Net als zones (0006) is een tag lichte huishouden-structuur, geen "item": het
-- volledige can_view-zichtbaarheidscontract is niet nodig — lid van het huishouden
-- mag alles. De koppeling met tasks gaat via een uuid[]-kolom (tasks.tag_ids),
-- consistent met de andere array-kolommen op tasks (recur_weekdays, share_with).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tags-tabel
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  color        text not null default '#6B7280',
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists tags_household_idx on public.tags(household_id);
-- Eén naam per huishouden (hoofdletter-ongevoelig) — voorkomt dubbele tags.
create unique index if not exists tags_household_name_idx on public.tags(household_id, lower(name));

alter table public.tags enable row level security;

drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags for select using (public.is_member(household_id));
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert with check (public.is_member(household_id));
drop policy if exists tags_update on public.tags;
create policy tags_update on public.tags for update using (public.is_member(household_id));
drop policy if exists tags_delete on public.tags;
create policy tags_delete on public.tags for delete using (public.is_member(household_id));

-- Realtime (idempotent, zoals 0006/0038).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tags'
  ) then
    alter publication supabase_realtime add table public.tags;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Koppel tags aan een task via een uuid[]-kolom. Een tag verwijderen ruimt
--    de losse koppeling niet automatisch op; de UI filtert onbekende ids weg.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists tag_ids uuid[] not null default '{}';
create index if not exists tasks_tag_ids_idx on public.tasks using gin (tag_ids);
