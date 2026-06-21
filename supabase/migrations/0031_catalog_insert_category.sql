-- ============================================================================
-- HUISHOEK — 0031: insert_catalog_product neemt de categorie mee (BOO-9 review-fix)
-- ============================================================================
-- 0027's insert_catalog_product schreef gescande producten altijd als 'overig' weg,
-- terwijl de live OFF-lookup (lib/openFoodFacts → lib/offCategoryMap) de juiste categorie
-- al berekent. Resultaat: gescande producten verschenen nooit in hun schap. Hier voegen
-- we een `p_category`-parameter toe (default 'overig') en bewaren die. De argument-count
-- verandert, dus eerst de oude 6-arg-versie droppen.
-- ============================================================================
drop function if exists public.insert_catalog_product(text, text, text, text, text, text);

create or replace function public.insert_catalog_product(
  p_code text, p_name text, p_search text,
  p_brands text default null, p_quantity text default null, p_image_url text default null,
  p_category text default 'overig'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_id   uuid;
begin
  if length(v_code) not in (8, 12, 13, 14) or coalesce(trim(p_name), '') = '' then
    raise exception 'ongeldige barcode of naam' using errcode = 'check_violation';
  end if;

  insert into public.catalog_products (code, name, brands, quantity, image_url, category, search)
  values (
    v_code, trim(p_name),
    nullif(trim(coalesce(p_brands, '')), ''),
    nullif(trim(coalesce(p_quantity, '')), ''),
    nullif(trim(coalesce(p_image_url, '')), ''),
    coalesce(nullif(trim(coalesce(p_category, '')), ''), 'overig'),
    coalesce(nullif(trim(coalesce(p_search, '')), ''), lower(trim(p_name)))
  )
  on conflict (code) do nothing;

  select id into v_id from public.catalog_products where code = v_code;
  return v_id;
end;
$$;

revoke all on function public.insert_catalog_product(text, text, text, text, text, text, text) from public;
grant execute on function public.insert_catalog_product(text, text, text, text, text, text, text) to authenticated;
