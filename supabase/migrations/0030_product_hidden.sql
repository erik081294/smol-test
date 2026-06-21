-- ============================================================================
-- HUISHOEK — 0030: producten verbergen uit "Vaste boodschappen"
-- ============================================================================
-- Een subtiele opruim-optie: een product dat je zelden of nooit opnieuw koopt kun je
-- uit het "Vaste boodschappen"-overzicht verbergen (huishouden-breed). `hidden` filtert
-- alleen dát overzicht; het product blijft bestaan (prijshistorie, autocomplete, koppeling
-- aan bonnen) en is met één tik weer zichtbaar te maken. Lid-write valt onder de bestaande
-- products_member-policy (is_member).
-- ============================================================================
alter table public.products add column if not exists hidden boolean not null default false;
