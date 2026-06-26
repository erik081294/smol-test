-- ============================================================================
-- HUISHOEK — 0055: Oude statische join-route definitief slopen (SEC-5, HOOG)
-- ============================================================================
--   SEC-5 (HOOG — cross-household datalek). De oorspronkelijke toetredingsroute
--     uit 0001 leefde nog volledig:
--       • households.invite_code — een statische 6-char code over charset [0-9A-F]
--         (16^6 = 16,7M combinaties, nooit verlopend, oneindig herbruikbaar).
--       • join_household(code) — SECURITY DEFINER, nog steeds EXECUTE-grantable aan
--         'authenticated' (0043 gaf het bewust terug). Elke ingelogde gebruiker kon
--         dus codes bruteforcen; een hit voegt de caller stilletjes als 'member' toe
--         (on conflict do nothing) → volledige leestoegang tot andermans taken,
--         uitgaven, tijdlijn en foto's. Bij 10k huishoudens landt een random code
--         ~1 op 1.677 pogingen in een echt huishouden.
--
--   Sinds 0053 (PLT-7) loopt toetreden uitsluitend via persoonlijke, eenmalige,
--   24u-geldige invite-tokens (create_invite / peek_invite / accept_invite). De
--   client gebruikt het oude pad niet meer (joinHousehold + de onboarding-code-tab
--   zijn in dezelfde PR verwijderd). Daarmee is invite_code/join_household pure
--   dode, exploiteerbare oppervlakte — die halen we hier weg.
--
--   Geverifieerd vóór de drop: join_household is het ENIGE object dat invite_code
--   refereert (geen policy/view/trigger/andere functie). De kolom drop is dus veilig
--   en sleept niets onbedoeld mee.
--
-- Idempotent: drop ... if exists is herhaalbaar.
-- ============================================================================

-- 1. De exploiteerbare RPC weg (sluit het bruteforce-pad).
drop function if exists public.join_household(text);

-- 2. De statische code-kolom weg (incl. de unique-constraint en default). Niets
--    anders leest 'm meer; toetreden gaat voortaan enkel via household_invites.
alter table public.households drop column if exists invite_code;
