-- INF-10 B5 (security-hardening): pg_trgm uit het public-schema halen (advisor-WARN
-- "extension in public"). De trgm-operatoren/functies + de gin_trgm_ops-opclass (gebruikt
-- door catalog_products_search_trgm_idx) verhuizen mee; de index blijft geldig (oid-binding).
-- De enige trgm-gebruiker is search_catalog (de `%`-operator + similarity()); die krijgt
-- `extensions` in z'n search_path zodat de operatoren resolven. Niet-destructief: data/index
-- ongemoeid, grants op de functie blijven (CREATE OR REPLACE).
--
-- NB: `supabase db push` is kapot in dit project; live aangebracht via MCP apply_migration
-- (2026-06-27) en daarna geverifieerd: pg_trgm in `extensions`, index intact, search_catalog
-- geeft nog treffers ('melk' → 5, categorie-blader → 5). Dit bestand is de repo-spiegel.
create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;
alter extension pg_trgm set schema extensions;

create or replace function public.search_catalog(
  p_query text default '', p_category text default null, p_limit integer default 30, p_offset integer default 0)
returns setof public.catalog_products
language sql
stable
set search_path to 'public', 'extensions'
as $function$
  select c.*
  from public.catalog_products c
  where (p_category is null or p_category = '' or c.category = p_category)
    and (
      coalesce(p_query, '') = ''
      or c.search ilike '%' || p_query || '%'
      or c.search % p_query
    )
  order by similarity(c.search, coalesce(p_query, '')) desc, c.popularity desc, c.name asc
  limit  least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;
