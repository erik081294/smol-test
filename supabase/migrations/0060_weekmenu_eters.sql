-- ============================================================================
-- HUISHOEK — 0060: Weekmenu "wie eet mee" (MLT)
-- ============================================================================
-- Leg per geplande maaltijd vast welke huishoudleden mee-eten plus hoeveel gasten
-- van buiten het huishouden. Het aantal porties (`servings`) blijft de gezaghebbende
-- kook-hoeveelheid die de boodschappen-schaling voedt (lib/mealPlan.js): standaard =
-- aantal eters + gasten, maar in de UI overschrijfbaar.
--   eater_ids    : profile-ids van mee-etende huishoudleden. Bewust GÉÉN FK-array — we
--                  filteren in de app op de bekende leden; een lid dat het huishouden
--                  verlaat hoeft niet door de DB op te schonen.
--   extra_eaters : gasten van buiten het huishouden (>= 0).
-- ============================================================================

alter table public.meal_plan_entries
  add column if not exists eater_ids    uuid[] not null default '{}',
  add column if not exists extra_eaters int    not null default 0 check (extra_eaters >= 0);
