-- ============================================================================
-- HUISHOEK — 0043: PUBLIC-EXECUTE écht intrekken op de huishoud-RPC's (INF-10/M1)
-- ============================================================================
-- 0042 trok EXECUTE in van 'anon', maar het recht kwam via de PUBLIC-default
-- (grantee 0) — dus dat was een no-op (live geverifieerd: anon kon create_expense
-- nog steeds aanroepen). Hier trekken we EXECUTE van PUBLIC (én anon) in en geven
-- het expliciet aan 'authenticated' terug: precies het revoke-patroon van
-- record_receipt_scan/insert_catalog_product. Beide statements per functie binnen
-- één transactie, dus authenticated houdt onafgebroken toegang (geen gat).
--
-- De DO-loop gebruikt regprocedure en dekt zo álle overloads van een functienaam
-- (create_expense bestaat in meerdere signaturen door create-or-replace over de
-- migraties heen). Idempotent: revoke/grant zijn herhaalbaar.
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
      and p.proname in (
        'create_expense', 'update_expense',
        'create_purchase', 'update_purchase',
        'add_groceries', 'bump_product_usage',
        'join_household'
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
