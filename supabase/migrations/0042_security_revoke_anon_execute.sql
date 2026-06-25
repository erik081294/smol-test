-- ============================================================================
-- HUISHOEK — 0042: anon EXECUTE-oppervlak op SECURITY DEFINER-RPC's dichten
-- ============================================================================
--   SEC-2 (HOOG). run_recurring_expenses() (0020) is SECURITY DEFINER zonder
--     is_member/auth-guard en stond op de PUBLIC/anon-EXECUTE-default. Een anon
--     POST naar /rest/v1/rpc/run_recurring_expenses forceerde dan
--     expense-materialisatie over ALLE huishoudens (RLS-bypass via DEFINER; bij
--     herhaling DoS-amplificatie). Alleen de cron/service_role hoort dit te draaien
--     (de pg_cron-schedule draait als superuser en blijft werken). De client roept
--     de functie niet aan (geverifieerd: lib/useRecurringExpenses.js materialiseert
--     zelf, zonder deze RPC), dus revoke van authenticated is veilig.
--
--   INF-10 / M1 (defense-in-depth). Brede PUBLIC/anon-EXECUTE op de huishoud-RPC's.
--     Functioneel al afgeschermd door interne is_member-checks (falen bij
--     auth.uid()=null), maar het anon-oppervlak hoort dicht. We trekken alléén anon
--     in; 'authenticated' houdt EXECUTE want de app roept deze ingelogd aan.
--
-- Idempotent: revoke is herhaalbaar. De DO-loop gebruikt regprocedure, dus
-- ontbrekende namen/overloads worden simpelweg overgeslagen (geen signatuurfouten).
-- ============================================================================

-- SEC-2: volledig dichttrekken (cron/service_role-only).
revoke execute on function public.run_recurring_expenses() from public, anon, authenticated;

-- INF-10/M1: anon-EXECUTE intrekken op de DEFINER-RPC's zonder anon-pad.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_expense', 'update_expense',
        'create_purchase', 'update_purchase',
        'add_groceries', 'bump_product_usage',
        'join_household'
      )
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;
