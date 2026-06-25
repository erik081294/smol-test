-- ============================================================================
-- HUISHOEK — 0053: Persoonlijk uitnodigingssysteem (PLT-7)
-- ============================================================================
-- Vervangt de ene statische households.invite_code als toetredingsroute door
-- persoonlijke, 24u geldige, EENMALIGE invite-tokens. Web-first & account-gebonden:
-- de link opent de (web-)app op /join/<token>, de ontvanger logt in/registreert en
-- accepteert; het lidmaatschap leeft op het ACCOUNT (niet op het device), dus er hoeft
-- niets een app-installatie te overleven.
--
-- Vier DEFINER-RPC's, consistent met create_household/join_household (0041) en het
-- SEC-revoke-patroon (0042–0044):
--   create_invite  — owner maakt een invite (token + 24u-expiry + rol). authenticated.
--   peek_invite    — niet-gevoelige preview (huishouden + uitnodiger + status) vóór
--                    inloggen. BEWUST anon-callable — de enige uitzondering op het
--                    anon-revoke: geeft alleen naam/emoji/voornaam terug voor een geldig,
--                    hoog-entropie token. Lekt geen ledenlijst of huishouden-data.
--   accept_invite  — ingelogde ontvanger wisselt het token in → lid met de invite-rol.
--                    Eenmalig (single-use); weigert verlopen/ingetrokken/al-gebruikt.
--   revoke_invite  — owner trekt een openstaande invite per stuk in (geen rotate-bom).
--
-- Token = twee gen_random_uuid() aaneen (64 hex, ~244 bit) — geen pgcrypto-extensie
-- nodig (vgl. INF-10 B5: geen extensies in public). Direct schrijven op de tabel is
-- ingetrokken; alles loopt via de RPC's. Leden lezen de openstaande invites van hún
-- huishouden (RLS) voor de beheerlijst. Idempotent (if not exists / create or replace /
-- drop policy if exists / revoke is herhaalbaar).
-- ============================================================================

create table if not exists public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token        text not null unique,
  role         text not null default 'member' check (role in ('member', 'owner')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id)
);

create index if not exists household_invites_household_id_idx
  on public.household_invites(household_id);

alter table public.household_invites enable row level security;

-- Leden van het huishouden mogen de invites lezen (beheerlijst). Schrijven kan niet
-- direct — uitsluitend via de DEFINER-RPC's hieronder.
drop policy if exists "invites_select" on public.household_invites;
create policy "invites_select" on public.household_invites for select
  using (public.is_member(household_id));

revoke insert, update, delete on public.household_invites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_invite — owner maakt een persoonlijke, 24u geldige invite
-- ---------------------------------------------------------------------------
create or replace function public.create_invite(p_household_id uuid, p_role text default 'member')
returns public.household_invites
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  if not public.is_owner(p_household_id) then
    raise exception 'Alleen de beheerder kan uitnodigen' using errcode = 'check_violation';
  end if;
  if coalesce(p_role, 'member') not in ('member', 'owner') then
    raise exception 'Ongeldige rol: %', p_role using errcode = 'check_violation';
  end if;
  insert into public.household_invites (household_id, token, role, created_by, expires_at)
  values (
    p_household_id,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    coalesce(p_role, 'member'),
    auth.uid(),
    now() + interval '24 hours'
  )
  returning * into inv;
  return inv;
end;
$$;

revoke all on function public.create_invite(uuid, text) from public, anon;
grant execute on function public.create_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- peek_invite — niet-gevoelige preview vóór inloggen (BEWUST anon-callable)
-- ---------------------------------------------------------------------------
create or replace function public.peek_invite(p_token text)
returns table (
  household_id    uuid,
  household_name  text,
  household_emoji text,
  inviter_name    text,
  role            text,
  status          text
)
language sql
security definer set search_path = public
as $$
  select
    h.id,
    h.name,
    h.emoji,
    coalesce(p.display_name, 'Iemand'),
    i.role,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at <= now()    then 'expired'
      else 'valid'
    end
  from public.household_invites i
  join public.households h on h.id = i.household_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;
$$;

revoke all on function public.peek_invite(text) from public;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- accept_invite — token inwisselen → lid met de invite-rol (eenmalig)
-- ---------------------------------------------------------------------------
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  select * into inv from public.household_invites where token = p_token;
  if not found then
    raise exception 'Ongeldige uitnodiging';
  end if;
  if inv.revoked_at is not null then
    raise exception 'Deze uitnodiging is ingetrokken';
  end if;
  -- Al gebruikt? Idempotent voor dezelfde gebruiker; anders weigeren (single-use).
  if inv.accepted_at is not null then
    if inv.accepted_by = auth.uid() then
      return inv.household_id;
    end if;
    raise exception 'Deze uitnodiging is al gebruikt';
  end if;
  if inv.expires_at <= now() then
    raise exception 'Deze uitnodiging is verlopen';
  end if;

  insert into public.household_members (household_id, profile_id, role)
  values (inv.household_id, auth.uid(), inv.role)
  on conflict do nothing;

  update public.household_invites
    set accepted_at = now(), accepted_by = auth.uid()
    where id = inv.id;

  return inv.household_id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_invite — owner trekt een openstaande invite in
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invite(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  hh uuid;
begin
  select household_id into hh from public.household_invites where id = p_id;
  if hh is null then
    raise exception 'Uitnodiging bestaat niet';
  end if;
  if not public.is_owner(hh) then
    raise exception 'Alleen de beheerder kan een uitnodiging intrekken' using errcode = 'check_violation';
  end if;
  update public.household_invites
    set revoked_at = now()
    where id = p_id and revoked_at is null and accepted_at is null;
end;
$$;

revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;
