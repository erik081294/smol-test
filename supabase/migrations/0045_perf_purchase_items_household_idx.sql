-- ============================================================================
-- HUISHOEK — 0045: Index voor de aankoopfrequentie-query (PERF-8)
-- ============================================================================
-- lib/useProducts.useProductFrequencies filtert purchase_items op
--   household_id  + product_id is not null
-- om per product de aankoopdatums op te halen (de motor onder BOO-8). Tot nu toe
-- bestonden er alleen indexen op (product_id, created_at) en (purchase_id) — de
-- household_id-filter deed dus een seq-scan over álle bonregels van álle huishoudens.
--
-- Deze partiële index bedient die query (en household-brede bonregel-scans) direct.
-- Partieel op `product_id is not null` houdt 'm klein: regels zonder gekoppeld
-- catalogusproduct tellen niet mee voor de frequentie en horen niet in de index.
-- Additief en idempotent; geen RLS-/datawijziging.
create index if not exists purchase_items_household_product_idx
  on public.purchase_items (household_id, product_id)
  where product_id is not null;
