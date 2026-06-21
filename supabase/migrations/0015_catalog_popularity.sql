-- ============================================================================
-- HUISHOEK — 0015: Populariteit voor de productcatalogus
-- ============================================================================
-- Open Food Facts geeft per product `unique_scans_n` mee: hoe vaak het gescand
-- is — een goede proxy voor populariteit. We bewaren dat in `popularity` en
-- sorteren de zoek-/blader-resultaten er primair op, zodat de bekende producten
-- bovenaan staan. Het importscript vult de kolom (scripts/import-off-dump.mjs).
-- ============================================================================

alter table public.catalog_products add column if not exists popularity int not null default 0;

-- Bladeren per schap = populairste eerst.
create index if not exists catalog_products_cat_pop_idx
  on public.catalog_products (category, popularity desc);

-- Zoek-RPC opnieuw: zelfde matching als 0014, maar nu gesorteerd op
-- overeenkomst → populariteit → naam. Bij bladeren (lege query) is similarity 0
-- voor alle rijen, dus dan bepaalt populariteit de volgorde.
drop function if exists public.search_catalog(text, text, int, int);
create function public.search_catalog(
  p_query    text default '',
  p_category text default null,
  p_limit    int  default 30,
  p_offset   int  default 0
) returns setof public.catalog_products
language sql stable
as $$
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
$$;

grant execute on function public.search_catalog(text, text, int, int) to authenticated;
