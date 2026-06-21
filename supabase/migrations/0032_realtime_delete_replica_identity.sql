-- ============================================================================
-- HUISHOEK — 0032: realtime DELETE-events voor gefilterde kindtabellen (C2 review-fix)
-- ============================================================================
-- C2 (0025 + de hooks) verving de BREDE expense_shares/purchase_items-subscripties door
-- een `household_id=eq.…`-filter (tegen cross-household refetch-storms). Maar bij de
-- standaard REPLICA IDENTITY bevat een DELETE-event alleen de primaire sleutel — niet
-- `household_id` — dus matcht het filter niet en wordt de DELETE NIET geleverd. Gevolg:
-- een uitgave/bon verwijderen weerspiegelde niet meer realtime (de oude, ongefilterde
-- subscriptie ving die deletes juist op via de cascade).
--
-- REPLICA IDENTITY FULL zet de volledige oude rij in het WAL, zodat `household_id` óók in
-- DELETE-events zit en het filter matcht. Beide tabellen zijn klein/laag-volume, dus de
-- extra WAL is verwaarloosbaar.
-- ============================================================================
alter table public.expense_shares replica identity full;
alter table public.purchase_items replica identity full;
