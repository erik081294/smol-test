-- ============================================================================
-- HUISHOEK — Database schema voor Supabase (Postgres)
-- ============================================================================
-- Draai dit in de Supabase SQL Editor (of via `supabase db push`).
-- Bevat: huishoudens, leden, taken, boodschappen, planten, en volledige
-- Row Level Security zodat leden alleen hun eigen huishouden(s) zien.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFIELEN  (1-op-1 met auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Naamloos',
  avatar_emoji text not null default '🙂',
  created_at  timestamptz not null default now()
);

-- Automatisch een profiel aanmaken bij registratie
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. HUISHOUDENS  (een gezin, een groep huisgenoten, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null default '🏡',
  invite_code text not null unique default upper(substring(md5(random()::text) for 6)),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. LEDEN  (koppeltabel profiel <-> huishouden)
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, profile_id)
);

-- Helper: is de huidige gebruiker lid van dit huishouden?
create or replace function public.is_member(hh uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 3b. SUBGROEPEN  (herbruikbare, benoemde groepjes binnen een huishouden)
--      Bijv. "Ouders", "Voetbal Tim". Een item kan ermee gedeeld worden.
-- ---------------------------------------------------------------------------
create table if not exists public.subgroups (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  emoji        text not null default '👥',
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.subgroup_members (
  subgroup_id uuid not null references public.subgroups(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (subgroup_id, profile_id)
);

create index if not exists subgroups_household_idx on public.subgroups(household_id);

-- Helper: zit de huidige gebruiker in deze subgroep?
create or replace function public.in_subgroup(sg uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.subgroup_members
    where subgroup_id = sg and profile_id = auth.uid()
  );
$$;

-- Helper: mag de huidige gebruiker een item met deze zichtbaarheid zien?
-- Eén plek voor de regels, gedeeld door taken en boodschappen.
--   visibility = 'household' -> iedereen in het huishouden
--   visibility = 'subgroup'  -> leden van de gekoppelde subgroep (+ maker)
--   visibility = 'custom'    -> personen in share_with (+ maker)
create or replace function public.can_view(
  hh uuid, visibility text, sg uuid, share_with uuid[], creator uuid
) returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_member(hh) and (
    coalesce(visibility, 'household') = 'household'
    or creator = auth.uid()
    or (visibility = 'subgroup' and public.in_subgroup(sg))
    or (visibility = 'custom' and auth.uid() = any(share_with))
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. TAKEN  (klusjes, huishouden, afspraken, planten water geven, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  notes         text,
  category      text not null default 'klus'
                  check (category in ('klus','huishouden','plant','afspraak','overig')),
  -- Toewijzing
  assigned_to   uuid references public.profiles(id) on delete set null,
  -- Planning
  due_date      date,
  due_time      time,
  -- Herhaling: null = eenmalig. Anders RRULE-achtige korte notatie.
  recur_freq    text check (recur_freq in ('daily','weekly','monthly')),
  recur_interval int not null default 1,        -- elke N dagen/weken/maanden
  recur_weekdays int[],                          -- 0=zo .. 6=za (voor weekly)
  -- Status
  completed_at  timestamptz,
  completed_by  uuid references public.profiles(id) on delete set null,
  -- Delen met: 'household' (default) | 'subgroup' | 'custom'
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],                          -- profielen bij visibility='custom'
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

create index if not exists tasks_household_idx on public.tasks(household_id);
create index if not exists tasks_due_idx on public.tasks(household_id, due_date);

-- ---------------------------------------------------------------------------
-- 5. BOODSCHAPPEN  (gedeelde lijst per huishouden)
-- ---------------------------------------------------------------------------
create table if not exists public.groceries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  quantity     text,                 -- vrije tekst: "2 pak", "500 g"
  category     text default 'overig',
  checked      boolean not null default false,
  added_by     uuid not null references public.profiles(id),
  -- Delen met (zelfde model als taken); default = hele huishouden
  visibility   text not null default 'household'
                 check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with   uuid[],
  created_at   timestamptz not null default now()
);

create index if not exists groceries_household_idx on public.groceries(household_id);

-- ---------------------------------------------------------------------------
-- RLS — Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.subgroups         enable row level security;
alter table public.subgroup_members  enable row level security;
alter table public.tasks             enable row level security;
alter table public.groceries         enable row level security;

-- Profielen: iedereen leest profielen van mede-leden; je bewerkt alleen jezelf.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members m1
      join public.household_members m2 on m1.household_id = m2.household_id
      where m1.profile_id = auth.uid() and m2.profile_id = profiles.id
    )
  );
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid());

-- Huishoudens: leden zien hun huishouden; iedereen mag er een aanmaken.
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households for select
  using (public.is_member(id) or created_by = auth.uid());
drop policy if exists "households_insert" on public.households;
create policy "households_insert" on public.households for insert
  with check (created_by = auth.uid());
drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households for update
  using (public.is_member(id));

-- Leden: je ziet leden van je eigen huishoudens. Toetreden via invite (insert jezelf).
drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members for select
  using (public.is_member(household_id));
drop policy if exists "members_insert" on public.household_members;
create policy "members_insert" on public.household_members for insert
  with check (profile_id = auth.uid());
drop policy if exists "members_delete" on public.household_members;
create policy "members_delete" on public.household_members for delete
  using (profile_id = auth.uid() or public.is_member(household_id));

-- Subgroepen: leden van het huishouden zien de subgroepen; iedereen in het
-- huishouden mag er aanmaken/bewerken (lichtgewicht; aanscherpen kan later).
drop policy if exists "subgroups_select" on public.subgroups;
create policy "subgroups_select" on public.subgroups for select
  using (public.is_member(household_id));
drop policy if exists "subgroups_write" on public.subgroups;
create policy "subgroups_write" on public.subgroups for all
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

-- Subgroep-leden: zichtbaar/bewerkbaar voor leden van het bijbehorende huishouden.
drop policy if exists "subgroup_members_all" on public.subgroup_members;
create policy "subgroup_members_all" on public.subgroup_members for all
  using (exists (
    select 1 from public.subgroups s
    where s.id = subgroup_id and public.is_member(s.household_id)))
  with check (exists (
    select 1 from public.subgroups s
    where s.id = subgroup_id and public.is_member(s.household_id)));

-- Taken: zien volgens zichtbaarheid; schrijven mag elk huishoudlid.
-- Let op: write-policies dekken bewust NIET 'select', anders zou hun is_member-
-- check (via OR) de can_view-restrictie omzeilen.
drop policy if exists "tasks_all" on public.tasks;
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_write" on public.tasks;
create policy "tasks_select" on public.tasks for select
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, created_by));
create policy "tasks_insert" on public.tasks for insert
  with check (public.is_member(household_id));
create policy "tasks_update" on public.tasks for update
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, created_by))
  with check (public.is_member(household_id));
create policy "tasks_delete" on public.tasks for delete
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, created_by));

-- Boodschappen: zelfde model.
drop policy if exists "groceries_all" on public.groceries;
drop policy if exists "groceries_select" on public.groceries;
drop policy if exists "groceries_write" on public.groceries;
create policy "groceries_select" on public.groceries for select
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, added_by));
create policy "groceries_insert" on public.groceries for insert
  with check (public.is_member(household_id));
create policy "groceries_update" on public.groceries for update
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, added_by))
  with check (public.is_member(household_id));
create policy "groceries_delete" on public.groceries for delete
  using (public.can_view(household_id, visibility, share_subgroup_id, share_with, added_by));

-- ---------------------------------------------------------------------------
-- RPC: toetreden tot huishouden via invite-code (omzeilt select-restrictie)
-- ---------------------------------------------------------------------------
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  hh uuid;
begin
  select id into hh from public.households where invite_code = upper(code);
  if hh is null then
    raise exception 'Ongeldige uitnodigingscode';
  end if;
  insert into public.household_members (household_id, profile_id, role)
  values (hh, auth.uid(), 'member')
  on conflict do nothing;
  return hh;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime aanzetten
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.groceries;
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.subgroups;
alter publication supabase_realtime add table public.subgroup_members;
