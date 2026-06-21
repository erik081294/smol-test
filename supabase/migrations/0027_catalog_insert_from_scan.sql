-- ============================================================================
-- HUISHOEK — 0027: catalogus laten groeien vanuit een barcode-scan (BOO-9)
-- ============================================================================
-- De globale catalogus (0014) is alleen-lezen voor clients; schrijven kon enkel via
-- de service-role (importscript). Bij BOO-9 scant een gebruiker een barcode die nog
-- niet in de catalogus staat, haalt de app 'm live bij Open Food Facts op, en wil het
-- product opslaan zodat het de volgende keer (voor iedereen) meteen gevonden wordt.
--
-- Deze SECURITY DEFINER-RPC laat een ingelogde gebruiker een NIEUW product toevoegen,
-- maar nooit een bestaand (curated) item overschrijven: `on conflict (code) do nothing`.
-- Zo groeit de catalogus organisch zonder dat iemand gedeelde data kan vervuilen.
-- De client levert de genormaliseerde `search` mee (zelfde lib/productMatch.normalize
-- als 0014), zodat er één bron van waarheid voor normalisatie blijft.
-- ============================================================================
create or replace function public.insert_catalog_product(
  p_code text, p_name text, p_search text,
  p_brands text default null, p_quantity text default null, p_image_url text default null
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
    'overig',
    coalesce(nullif(trim(coalesce(p_search, '')), ''), lower(trim(p_name)))
  )
  on conflict (code) do nothing;

  select id into v_id from public.catalog_products where code = v_code;
  return v_id;
end;
$$;

revoke all on function public.insert_catalog_product(text, text, text, text, text, text) from public;
grant execute on function public.insert_catalog_product(text, text, text, text, text, text) to authenticated;
