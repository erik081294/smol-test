-- ============================================================================
-- HUISHOEK — 0044: anon-EXECUTE intrekken op de overige user-facing DEFINER-RPC's
-- ============================================================================
-- Supabase verleent EXECUTE op nieuwe functies via ALTER DEFAULT PRIVILEGES DIRECT
-- aan anon/authenticated (niet alleen via PUBLIC). Daardoor lieten eerdere
-- 'revoke ... from public' de directe anon-grant staan (live geverifieerd: anon kon
-- create_household nog aanroepen). We trekken hier anon (én public) in en geven
-- authenticated expliciet terug — voor de user-facing RPC's die geen anon-pad hebben:
--   create_household (0041), insert_catalog_product (0027/0031), record_receipt_scan (0026).
--
-- BEWUST NIET hier: de RLS-helpers is_member/is_owner/can_view/in_subgroup/
-- check_subgroup_household/handle_new_user. Die worden BINNEN RLS-policies aangeroepen;
-- EXECUTE daar intrekken breekt de policy-evaluatie voor gewone gebruikers. Hun
-- anon-aanroep is bovendien onschadelijk (geven false terug bij auth.uid() = null).
-- Idempotent.
-- ============================================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_household', 'insert_catalog_product', 'record_receipt_scan')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
