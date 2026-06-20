-- ============================================================================
-- HUISHOEK — 0020: Terugkerende uitgaven server-side (robuustheid, KOS-4)
-- ============================================================================
-- Materialiseert verschuldigde terugkerende uitgaven onafhankelijk van of de app
-- openstaat. De client-materialisatie in lib/useRecurringExpenses.js blijft als
-- idempotent vangnet; de partiële unieke index expenses(source_id, spent_on) where
-- source_type='recurring' (0017) voorkomt dubbele rijen ongeacht wie als eerste draait.
--
-- Server-side dekt de dominante 'equal'-splitsing exact (huur/abonnementen). Sjablonen
-- met 'shares'/'exact' worden aan de client-kant gematerialiseerd (die rekent de
-- cent-exacte verdeling al via lib/expenses.computeShares).
-- ============================================================================

create or replace function public.run_recurring_expenses()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  tpl record;
  occ date;
  v_id uuid;
  n int;
  base int;
  rem int;
  created int := 0;
  guard int;
begin
  for tpl in select * from public.recurring_expenses where active loop
    occ := tpl.next_date;
    guard := 0;
    while occ <= current_date and guard < 60 loop
      guard := guard + 1;

      if tpl.split_type = 'equal' and jsonb_array_length(tpl.participants) > 0
         and not exists (
           select 1 from public.expenses
           where source_type = 'recurring' and source_id = tpl.id and spent_on = occ
         ) then
        insert into public.expenses (
          household_id, description, amount_cents, paid_by, spent_on, split_type,
          visibility, share_subgroup_id, share_with, created_by, source_type, source_id, category
        ) values (
          tpl.household_id, tpl.description, tpl.amount_cents, tpl.paid_by, occ, 'equal',
          tpl.visibility,
          case when tpl.visibility = 'subgroup' then tpl.share_subgroup_id else null end,
          case when tpl.visibility = 'custom'   then tpl.share_with       else null end,
          tpl.created_by, 'recurring', tpl.id, 'overig'
        ) returning id into v_id;

        -- Gelijke verdeling, cent-exact: ieder `base`, de eerste `rem` deelnemers
        -- (deterministisch op profile_id) krijgen +1 cent. Som == amount_cents.
        n := jsonb_array_length(tpl.participants);
        base := tpl.amount_cents / n;
        rem := tpl.amount_cents - base * n;
        insert into public.expense_shares (expense_id, profile_id, amount_cents)
        select v_id, pid, base + case when ord <= rem then 1 else 0 end
        from (
          select (p->>'profile_id')::uuid as pid,
                 row_number() over (order by (p->>'profile_id')) as ord
          from jsonb_array_elements(tpl.participants) as p
        ) s;
        created := created + 1;
      end if;

      occ := (occ + (case tpl.recur_freq
        when 'daily'  then tpl.recur_interval || ' days'
        when 'weekly' then tpl.recur_interval || ' weeks'
        else               tpl.recur_interval || ' months'
      end)::interval)::date;
    end loop;
    update public.recurring_expenses set next_date = occ where id = tpl.id;
  end loop;
  return created;
end;
$$;

-- Dagelijkse run om 03:05. pg_cron is op sommige Supabase-plannen pas na activatie
-- beschikbaar; daarom non-fataal: de functie bestaat altijd (ook handmatig/extern aan
-- te roepen), de schedule wordt alleen gezet als de extensie er is.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron niet beschikbaar — schedule overgeslagen; roep public.run_recurring_expenses() extern aan';
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('run-recurring-expenses', '5 3 * * *', 'select public.run_recurring_expenses();')
    where not exists (select 1 from cron.job where jobname = 'run-recurring-expenses');
  end if;
end $$;
