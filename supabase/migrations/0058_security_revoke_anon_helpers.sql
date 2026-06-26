-- ============================================================================
-- HUISHOEK — 0058: anon-EXECUTE intrekken op de RLS-helpers + trigger-functies
-- ============================================================================
-- Sluit de laatste open advisor-WARNs af (anon_/authenticated_security_definer_
-- function_executable) op de functies die 0044 BEWUST liet staan. 0044's premisse
-- ("EXECUTE intrekken breekt de policy-evaluatie") geldt alleen als je authenticated
-- raakt — dat doen we hier níét: we trekken alleen PUBLIC + anon in en geven
-- authenticated z'n directe grant terug. De live-ACL was per functie:
--   =X/postgres | anon=X | authenticated=X | service_role=X      (PUBLIC + 3 directe grants)
-- dus anon kreeg EXECUTE zowel via PUBLIC als direct → beide moeten weg.
--
-- Twee groepen, twee eindstaten:
--   1. RLS-HELPERS (is_member/is_owner/in_subgroup/can_view) — worden BINNEN RLS-
--      policies door `authenticated` aangeroepen → die behoudt EXECUTE. anon heeft
--      geen tabel-privileges en bereikt de policy nooit; SECURITY DEFINER-functies
--      (bv. peek_invite) roepen ze aan onder de owner, niet onder anon.
--   2. TRIGGER-FUNCTIES (handle_new_user/check_subgroup_household/
--      cleanup_vehicle_resource) — worden door de trigger-machine aangeroepen, niet
--      via een EXECUTE-privilege van de triggerende rol. Géén rol hoeft ze direct te
--      kunnen → ook authenticated eruit.
--
-- BEWUST ONGEMOEID: peek_invite (intentioneel anon, invite-preview vóór login) en de
-- user-facing RPC's die 0044 al dichtte. service_role houdt z'n directe grant
-- (revoke raakt alleen public + anon [+ authenticated bij triggers]). Idempotent.
-- ============================================================================
do $$
declare
  r record;
begin
  -- 1. RLS-helpers: anon (PUBLIC + direct) eruit, authenticated expliciet terug.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_member', 'is_owner', 'in_subgroup', 'can_view')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;

  -- 2. Trigger-functies: nergens direct nodig → public + anon + authenticated eruit.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'check_subgroup_household', 'cleanup_vehicle_resource')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
