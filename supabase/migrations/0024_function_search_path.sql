-- ============================================================================
-- HUISHOEK — 0024: Vaste search_path op de twee resterende functies (B4)
-- ============================================================================
-- Security-advisor `function_search_path_mutable`: een functie zonder vaste
-- `search_path` lost objectnamen op volgens de search_path van de aanroeper, wat
-- bij een kwaadwillend gezette search_path tot shadowing kan leiden. Beide
-- functies hieronder zijn SECURITY INVOKER en verwijzen alleen naar objecten in
-- `public` (incl. de `pg_trgm`-operator `%` en `similarity()`, die in `public`
-- staan) plus ingebouwde functies (`pg_catalog`, altijd impliciet doorzocht).
-- `set search_path = public` pint dat vast zonder de bodies te wijzigen en zonder
-- gedrag te veranderen. Idempotent (ALTER … SET is herhaalbaar).
-- ============================================================================

alter function public.enable_module_rls(text, text)
  set search_path = public;

alter function public.search_catalog(text, text, int, int)
  set search_path = public;
