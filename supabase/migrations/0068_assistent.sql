-- ============================================================================
-- HUISHOEK — 0068: Huishoek Assistent (AI-1, plan 23) — gesprekken + rate-limit
-- ============================================================================
-- Twee tabellen voor de assistent-chat en één rate-limit-RPC naar het model van
-- record_receipt_scan (0026/0056/0057).
--
-- BEWUST GEEN enable_module_rls: dat sjabloon maakt rijen huishouden-breed
-- leesbaar, maar de assistent antwoordt met data die voor de VRAGENDE gebruiker
-- zichtbaar is (incl. privé-items via het visibility-contract). Household-brede
-- gesprekken zouden dat naar huisgenoten lekken (plan 23, spijt-check 1).
-- Daarom: creator-privé policies — je ziet en beheert alleen je EIGEN gesprekken,
-- en alleen binnen een huishouden waar je lid van bent (is_member-toolkit, 0003).
-- Gedeelde gesprekken zijn later een expliciete opt-in-feature.

create table if not exists public.assistant_conversations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  title         text,
  created_at    timestamptz not null default now()
);
create index if not exists assistant_conversations_owner_idx
  on public.assistant_conversations(created_by, household_id);

create table if not exists public.assistant_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.assistant_conversations(id) on delete cascade,
  household_id     uuid not null references public.households(id) on delete cascade,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  role             text not null check (role in ('user','assistant','tool','action')),
  -- content: { v: 1, text, tree?, ... } — v-versieveld voor latere migraties
  -- (plan 23, spijt-check 7). role='action' krijgt hier ook status/args (fase 3).
  content          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists assistant_messages_conversation_idx
  on public.assistant_messages(conversation_id, created_at);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

-- Creator-privé: alle rechten alleen voor de maker, en alleen zolang die lid is
-- van het huishouden (verlaat iemand het huishouden, dan vervalt de toegang).
drop policy if exists assistant_conversations_owner on public.assistant_conversations;
create policy assistant_conversations_owner on public.assistant_conversations
  for all
  using (created_by = auth.uid() and public.is_member(household_id))
  with check (created_by = auth.uid() and public.is_member(household_id));

drop policy if exists assistant_messages_owner on public.assistant_messages;
create policy assistant_messages_owner on public.assistant_messages
  for all
  using (created_by = auth.uid() and public.is_member(household_id))
  with check (
    created_by = auth.uid()
    and public.is_member(household_id)
    -- Een bericht hoort altijd bij een eigen gesprek in hetzelfde huishouden.
    and exists (
      select 1 from public.assistant_conversations c
       where c.id = conversation_id
         and c.created_by = auth.uid()
         and c.household_id = assistant_messages.household_id
    )
  );

-- ----------------------------------------------------------------------------
-- Rate-limit (plan 23 §9): zelfde drietraps-patroon als record_receipt_scan,
-- PLUS een per-huishouden dagplafond (spijt-check 7): een huishouden met veel
-- leden krijgt geen ongelimiteerd gezamenlijk budget.
-- Fail-closed wordt in de edge function afgedwongen (geen true = geen Orq-call).
-- ----------------------------------------------------------------------------

create table if not exists public.assistant_calls (
  id            bigint generated always as identity primary key,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index if not exists assistant_calls_profile_idx on public.assistant_calls(profile_id, created_at);
create index if not exists assistant_calls_household_idx on public.assistant_calls(household_id, created_at);

create table if not exists public.assistant_call_daily (
  day date primary key,
  n   int not null default 0
);

-- Geen client-toegang tot de tel-tabellen; alleen de definer-RPC schrijft erin.
alter table public.assistant_calls enable row level security;
alter table public.assistant_call_daily enable row level security;

create or replace function public.record_assistant_call(
  p_household uuid,
  p_max int default 20,                  -- burst: max beurten per gebruiker per uur
  p_window_seconds int default 3600,
  p_daily_max int default 60,            -- per gebruiker per 24u (de hoofd-rem)
  p_household_daily_max int default 150, -- per huishouden per 24u (gedeeld plafond)
  p_global_daily_max int default 10000   -- globaal vangnet (alle gebruikers samen)
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_hour int;
  v_day  int;
  v_hh   int;
  v_global int;
begin
  if v_uid is null then
    return false;
  end if;
  -- Alleen tellen voor een huishouden waar de aanroeper echt lid van is; anders
  -- kan een script andermans household-budget leegtrekken of omzeilen.
  if p_household is null or not public.is_member(p_household) then
    return false;
  end if;

  delete from public.assistant_calls
   where profile_id = v_uid
     and created_at < now() - interval '24 hours';

  -- 1. Burst per uur (schuivend venster).
  select count(*) into v_hour
    from public.assistant_calls
   where profile_id = v_uid
     and created_at >= now() - make_interval(secs => p_window_seconds);
  if v_hour >= p_max then
    return false;
  end if;

  -- 2. Per-gebruiker dag-quota.
  select count(*) into v_day
    from public.assistant_calls
   where profile_id = v_uid
     and created_at >= now() - interval '24 hours';
  if v_day >= p_daily_max then
    return false;
  end if;

  -- 3. Per-huishouden dag-plafond (gedeeld budget van alle leden samen).
  select count(*) into v_hh
    from public.assistant_calls
   where household_id = p_household
     and created_at >= now() - interval '24 hours';
  if v_hh >= p_household_daily_max then
    return false;
  end if;

  -- 4. Globaal dag-vangnet.
  select coalesce(n, 0) into v_global
    from public.assistant_call_daily where day = current_date;
  if coalesce(v_global, 0) >= p_global_daily_max then
    return false;
  end if;

  insert into public.assistant_calls (profile_id, household_id) values (v_uid, p_household);
  insert into public.assistant_call_daily (day, n) values (current_date, 1)
    on conflict (day) do update set n = public.assistant_call_daily.n + 1;

  return true;
end;
$$;

-- anon expliciet intrekken (nieuwe signatuur krijgt de anon-default-grant; zie 0042/0043).
revoke all on function public.record_assistant_call(uuid, int, int, int, int, int) from public, anon;
grant execute on function public.record_assistant_call(uuid, int, int, int, int, int) to authenticated;
