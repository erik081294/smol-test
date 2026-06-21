-- ============================================================================
-- HUISHOEK — 0026: per-gebruiker rate-limit voor scan-receipt (INF-9 / audit S-M4)
-- ============================================================================
-- De Edge Function `scan-receipt` proxiet naar een betaalde LLM-gateway (Orq.ai).
-- Zonder rate-limit kan elk ingelogd lid onbeperkt dure calls afvuren (kosten/DoS).
-- Deze tabel + RPC houden per gebruiker een schuivend venster bij. De functie roept
-- `record_receipt_scan()` aan mét het JWT van de gebruiker (→ auth.uid()); de RPC
-- prunet oude rijen, telt de recente, en staat de scan toe of weigert 'm.
--
-- RLS staat AAN zonder policies: alleen de SECURITY DEFINER-RPC (en de service-role)
-- raken de tabel; reguliere clients kunnen er niets mee.
-- ============================================================================

create table if not exists public.receipt_scans (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists receipt_scans_profile_idx
  on public.receipt_scans (profile_id, created_at desc);

alter table public.receipt_scans enable row level security;

-- Registreer een scan-poging en geef terug of die binnen de limiet valt.
-- Geeft `true` = toegestaan (en geregistreerd), `false` = over de limiet/geen gebruiker.
create or replace function public.record_receipt_scan(
  p_max int default 20, p_window_seconds int default 3600
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return false;
  end if;

  -- Houd de tabel klein: gooi rijen buiten het venster voor deze gebruiker weg.
  delete from public.receipt_scans
   where profile_id = v_uid
     and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
    from public.receipt_scans
   where profile_id = v_uid
     and created_at >= now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.receipt_scans (profile_id) values (v_uid);
  return true;
end;
$$;

-- Niet door anon aanroepbaar; alleen ingelogde gebruikers (via de Edge Function).
revoke all on function public.record_receipt_scan(int, int) from public;
grant execute on function public.record_receipt_scan(int, int) to authenticated;
