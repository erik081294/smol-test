// @ts-check
// Open Food Facts-koppeling (BOO-9): zoek een onbekende barcode live op bij OFF en
// map de respons naar onze catalog_products-vorm. De parser is puur/testbaar; de
// fetch-wrapper is dun en injecteerbaar (fetchImpl) zodat ook die te testen is.
//
// OFF-data is CC-BY-SA: image_url is een hotlink naar de OFF-CDN (niet rehosten;
// attributie hoort in de UI), net als bij de bulk-import in 0014.
import { normalize } from './productMatch';
import { mapCategory } from './offCategoryMap';

const FIELDS = 'code,product_name,product_name_nl,brands,quantity,image_url,image_front_url,categories_tags,categories_tags_en,pnns_groups_1';

// OFF v2 product-respons → { code, name, brands, quantity, image_url, category, search }
// of null als er geen bruikbaar product is (niet gevonden / geen naam).
export function parseOffProduct(json, code) {
  const p = json?.product;
  if (!p || json?.status === 0) return null;
  const name = (p.product_name_nl || p.product_name || '').trim();
  if (!name) return null;
  const cleanCode = String(code ?? p.code ?? '').replace(/\D/g, '');
  if (!cleanCode) return null;
  const clean = (v) => {
    const s = (v ?? '').toString().trim();
    return s || null;
  };
  return {
    code: cleanCode,
    name,
    brands: clean(p.brands),
    quantity: clean(p.quantity),
    image_url: clean(p.image_url) || clean(p.image_front_url),
    category: mapCategory(p), // zelfde categorie-brein als de dump-import (lib/offCategoryMap)
    search: normalize(name),
  };
}

// Live lookup bij OFF. Geeft het geparste product of null (niet gevonden / fout /
// offline). Faalt stil: de UI valt terug op "onbekende code → handmatig toevoegen".
export async function fetchOffProduct(code, { fetchImpl = fetch } = {}) {
  const c = String(code ?? '').replace(/\D/g, '');
  if (!c) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${FIELDS}`;
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'Huishoek/1.0 (huishoudapp)' } });
    if (!res.ok) return null;
    return parseOffProduct(await res.json(), c);
  } catch {
    return null;
  }
}
