-- ============================================================================
-- HUISHOEK — 0056: globale dag-cap op bonscans (kosten-circuit-breaker, INF-9b)
-- ============================================================================
-- 0026 gaf scan-receipt een PER-GEBRUIKER rate-limit (20/uur). Dat stopt één
-- account, maar niet account-farming: signup is open, dus een aanvaller maakt N
-- wegwerp-accounts en haalt de betaalde Orq.ai-call alsnog duizenden keren binnen
-- → ongecapte rekening / quota-uitputting (DoS voor echte gebruikers).
--
-- Hier voegen we een tweede, GLOBALE rem toe: een harde bovengrens op het totale
-- aantal scans per kalenderdag over álle gebruikers samen. Dit is een
-- kosten-circuit-breaker, geen normaal-gebruik-limiet — de default (10.000/dag)
-- ligt ruim boven verwacht legitiem volume en vangt alleen misbruik-pieken af.
-- Stel 'm bij op basis van echt volume + het Orq-budget.
--
-- De globale teller staat in een eigen 1-rij-per-dag-tabel (niet in receipt_scans,
-- want die wordt per gebruiker geprund — onbetrouwbaar voor een globaal totaal).
-- record_receipt_scan krijgt een nieuwe optionele parameter mét default, zodat de
-- AL GEDEPLOYDE edge-function (die alleen p_max/p_window meegeeft) de globale cap
-- automatisch meekrijgt zonder opnieuw te hoeven deployen.
--
-- Idempotent: create ... if not exists / create or replace.
-- ============================================================================

create table if not exists public.receipt_scan_daily (
  day date primary key default current_date,
  n   int  not null default 0
);

alter table public.receipt_scan_daily enable row level security;
-- RLS aan zonder policies: alleen de SECURITY DEFINER-RPC + service-role raken 'm.

-- Drop de oude 2-param-signatuur: anders bestaat 'ie náást de nieuwe 3-param-versie
-- en wordt de named-arg-aanroep (p_max, p_window_seconds) vanuit de edge-function
-- AMBIGU (twee kandidaten). De 3-param-versie dekt diezelfde aanroep via de default
-- op p_global_daily_max.
drop function if exists public.record_receipt_scan(int, int);

create or replace function public.record_receipt_scan(
  p_max int default 20,
  p_window_seconds int default 3600,
  p_global_daily_max int default 10000
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_count  int;
  v_global int;
begin
  if v_uid is null then
    return false;
  end if;

  -- 1. Per-gebruiker schuivend venster (bestaand gedrag).
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

  -- 2. Globale dag-cap (alle gebruikers samen) — de harde kostenrem.
  select coalesce(n, 0) into v_global
    from public.receipt_scan_daily where day = current_date;

  if coalesce(v_global, 0) >= p_global_daily_max then
    return false;
  end if;

  -- 3. Beide checks gehaald → registreer (per-gebruiker + globaal).
  insert into public.receipt_scans (profile_id) values (v_uid);
  insert into public.receipt_scan_daily (day, n) values (current_date, 1)
    on conflict (day) do update set n = public.receipt_scan_daily.n + 1;

  return true;
end;
$$;

revoke all on function public.record_receipt_scan(int, int, int) from public;
grant execute on function public.record_receipt_scan(int, int, int) to authenticated;
