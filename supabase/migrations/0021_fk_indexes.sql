-- ============================================================================
-- HUISHOEK — 0021: Dekkende indexen op foreign keys (nieuwe modules 0016/0017)
-- ============================================================================
-- De database-advisor meldde onge-indexeerde foreign keys op de tabellen uit 0016
-- (maaltijden/voorraad) en 0017 (kosten-autodelen/reserveringen). Zonder dekkende
-- index moet Postgres bij joins/cascade-deletes een seq scan doen; nu nog gratis
-- (tabellen leeg), maar het groeit mee. household_id / recipe_id / resource_id zijn
-- al gedekt door de composiete/losse indexen uit 0016/0017 — die staan hier niet.
-- Alles idempotent (create index if not exists).
-- ============================================================================

-- 0016 — maaltijden & voorraad
create index if not exists meal_plan_created_by_idx          on public.meal_plan_entries(created_by);
create index if not exists meal_plan_recipe_idx              on public.meal_plan_entries(recipe_id);
create index if not exists pantry_catalog_product_idx        on public.pantry_items(catalog_product_id);
create index if not exists pantry_product_idx                on public.pantry_items(product_id);
create index if not exists pantry_updated_by_idx             on public.pantry_items(updated_by);
create index if not exists recipe_ingredients_catalog_product_idx on public.recipe_ingredients(catalog_product_id);
create index if not exists recipe_ingredients_household_idx  on public.recipe_ingredients(household_id);
create index if not exists recipe_ingredients_product_idx    on public.recipe_ingredients(product_id);
create index if not exists recipes_created_by_idx            on public.recipes(created_by);

-- 0017 — terugkerende uitgaven, gedeelde resources & reserveringen
create index if not exists recurring_expenses_created_by_idx on public.recurring_expenses(created_by);
create index if not exists recurring_expenses_paid_by_idx    on public.recurring_expenses(paid_by);
create index if not exists recurring_expenses_share_subgroup_idx on public.recurring_expenses(share_subgroup_id);
create index if not exists reservations_expense_idx          on public.reservations(expense_id);
create index if not exists reservations_household_idx        on public.reservations(household_id);
create index if not exists reservations_profile_idx          on public.reservations(profile_id);
create index if not exists shared_resources_created_by_idx   on public.shared_resources(created_by);
create index if not exists shared_resources_share_subgroup_idx on public.shared_resources(share_subgroup_id);
