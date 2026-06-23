-- ============================================================================
-- HUISHOEK — 0037: PERF-1 — server-side aggregaat-RPC's (exacte all-time-totalen)
-- ============================================================================
-- De data-hooks laden een ruim venster (`.limit(2000)`, useExpenses/useTaskCompletions)
-- en berekenen saldo/eerlijkheid client-side. In de praktijk is dat "alles", maar
-- boven de 2000 rijen zou een exact all-time-totaal stuk kunnen lopen. Deze twee
-- functies aggregeren server-side, zodat de client bij overschrijding een exact
-- totaal kan ophalen i.p.v. uit het afgekapte venster te rekenen.
--
-- SECURITY INVOKER (bewust): de bestaande RLS op expenses/expense_shares/
-- task_completions filtert dan precies de rijen die de aanroeper mag zien —
-- exact wat de client-queries nu ook vertrouwen ("RLS scopet de payload").
-- `set search_path = public` volgt de B4-hardening uit 0024.
-- ============================================================================

-- Per lid: hoeveel het voorschoot (paid) en hoeveel het zelf droeg (share).
-- Het netto saldo = paid - share. full join zodat een lid dat wél betaalde maar
-- niet meedeelde (of andersom) toch een rij krijgt.
create or replace function public.household_expense_totals(p_household uuid)
returns table (profile_id uuid, paid_cents bigint, share_cents bigint)
language sql
security invoker
stable
set search_path = public
as $$
  with paid as (
    select e.paid_by as profile_id, sum(e.amount_cents)::bigint as paid_cents
    from public.expenses e
    where e.household_id = p_household
    group by e.paid_by
  ),
  owed as (
    select s.profile_id, sum(s.amount_cents)::bigint as share_cents
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where e.household_id = p_household
    group by s.profile_id
  )
  select
    coalesce(p.profile_id, o.profile_id) as profile_id,
    coalesce(p.paid_cents, 0)            as paid_cents,
    coalesce(o.share_cents, 0)           as share_cents
  from paid p
  full join owed o on o.profile_id = p.profile_id;
$$;

-- Per lid: aantal voltooiingen (totaal) en het deel dat schoonmaak was (taak hangt
-- aan een zone). Voedt zowel het algemene als het schoonmaak-eerlijkheidsoverzicht.
create or replace function public.household_completion_totals(p_household uuid)
returns table (profile_id uuid, completions bigint, cleaning_completions bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    c.completed_by as profile_id,
    count(*)::bigint as completions,
    count(*) filter (where t.zone_id is not null)::bigint as cleaning_completions
  from public.task_completions c
  join public.tasks t on t.id = c.task_id
  where c.household_id = p_household
    and c.completed_by is not null
  group by c.completed_by;
$$;

grant execute on function public.household_expense_totals(uuid)    to authenticated;
grant execute on function public.household_completion_totals(uuid) to authenticated;
