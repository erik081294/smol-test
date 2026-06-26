-- ============================================================================
-- HUISHOEK — 0059: Recept-categorisering (MLT)
-- ============================================================================
-- Twee vrije-tekst-assen op `recipes` zodat de recepten-catalogus doorzoekbaar/
-- filterbaar wordt, net als de boodschappen-catalogus (0013/0014):
--   meal_moment : 'ontbijt' | 'lunch' | 'diner' | 'overig'  (eet-moment)
--   dish_type   : vrije taxonomie (pasta/salade/soep/…) — leeft in lib/recipeCatalog.js
-- Bewust GEEN CHECK-constraint: de taxonomie leeft in JS (zoals de boodschappen-
-- categorieën in lib/groceryCatalog.js), zodat 'ie uitbreidt zonder migratie. Beide
-- kolommen nullable — bestaande recepten zijn simpelweg (nog) ongecategoriseerd.
-- ============================================================================

alter table public.recipes
  add column if not exists meal_moment text,
  add column if not exists dish_type   text;

create index if not exists recipes_meal_moment_idx on public.recipes(household_id, meal_moment);
