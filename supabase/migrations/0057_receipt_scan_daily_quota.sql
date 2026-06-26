-- ============================================================================
-- HUISHOEK — 0057: getrapte per-gebruiker quota voor scan-receipt (INF-9c)
-- ============================================================================
-- 0026 gaf een burst-limiet (20/uur), 0056 een globaal dag-vangnet. Wat ontbrak is
-- de standaard-rem die het meeste werk doet: een PER-GEBRUIKER DAG-QUOTA.
--
-- Waarom dit de juiste, simpele aanpak is (en niet een cap die je aan het aantal
-- users koppelt): een per-gebruiker dagquota laat de totale kosten vanzélf lineair
-- meeschalen met het aantal échte gebruikers — elke gebruiker heeft zijn eigen
-- budget — zónder een users-telling die door test-accounts of account-farming
-- vertekend raakt. Dit is het gangbare "tiered rate limit"-patroon (burst + dag).
--
-- Drie lagen, elk met een eigen doel:
--   1. burst  (p_max / p_window_seconds)  — een losgeslagen script in één uur afkappen.
--   2. dag    (p_daily_max)               — de hoofd-rem; kapt een gekaapt/script-account
--                                            op een realistisch dagmaximum (30) i.p.v. 24×20.
--   3. globaal (p_global_daily_max)        — catastrofe-vangnet bij massale farming/bug.
--
-- De prune gaat nu op 24u (het langste venster) i.p.v. op het uur-venster, anders
-- gooien we de rijen weg die de dag-telling nodig heeft. De tabel blijft klein
-- (≤ p_daily_max rijen per gebruiker).
--
-- Signatuur-wissel (3→4 params): de oude versie eerst droppen, anders wordt de
-- named-arg-aanroep ambigu (zie 0056).
-- ============================================================================

drop function if exists public.record_receipt_scan(int, int, int);

create or replace function public.record_receipt_scan(
  p_max int default 20,                  -- burst: max per uur
  p_window_seconds int default 3600,
  p_daily_max int default 30,            -- per gebruiker per 24u (de hoofd-rem)
  p_global_daily_max int default 10000   -- globaal vangnet (alle gebruikers samen)
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_hour   int;
  v_day    int;
  v_global int;
begin
  if v_uid is null then
    return false;
  end if;

  -- Houd de tabel klein: rijen ouder dan 24u (het langste venster) weg.
  delete from public.receipt_scans
   where profile_id = v_uid
     and created_at < now() - interval '24 hours';

  -- 1. Burst per uur (schuivend venster).
  select count(*) into v_hour
    from public.receipt_scans
   where profile_id = v_uid
     and created_at >= now() - make_interval(secs => p_window_seconds);
  if v_hour >= p_max then
    return false;
  end if;

  -- 2. Per-gebruiker dag-quota (24u) — de hoofd-rem; schaalt de totale kosten
  --    lineair met het aantal echte gebruikers.
  select count(*) into v_day
    from public.receipt_scans
   where profile_id = v_uid
     and created_at >= now() - interval '24 hours';
  if v_day >= p_daily_max then
    return false;
  end if;

  -- 3. Globaal dag-vangnet (alle gebruikers samen) — catastrofe-circuit-breaker.
  select coalesce(n, 0) into v_global
    from public.receipt_scan_daily where day = current_date;
  if coalesce(v_global, 0) >= p_global_daily_max then
    return false;
  end if;

  -- Alle drie de checks gehaald → registreer (per-gebruiker + globaal).
  insert into public.receipt_scans (profile_id) values (v_uid);
  insert into public.receipt_scan_daily (day, n) values (current_date, 1)
    on conflict (day) do update set n = public.receipt_scan_daily.n + 1;

  return true;
end;
$$;

-- anon EXPLICIET intrekken: een nieuwe functie-signatuur krijgt in Supabase de
-- anon-default-grant, en `revoke ... from public` haalt die niet weg (zie 0042/0043).
revoke all on function public.record_receipt_scan(int, int, int, int) from public, anon;
grant execute on function public.record_receipt_scan(int, int, int, int) to authenticated;
