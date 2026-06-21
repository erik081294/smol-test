import { supabase } from './supabase';
import { run } from './db';
import { normalizeBarcode, isValidBarcode, toEan13 } from './barcode';
import { fetchOffProduct } from './openFoodFacts';

// Zoek een gescande barcode op (BOO-9). Eerst in de gedeelde catalogus (op `code`),
// anders live bij Open Food Facts — en dan toegevoegd aan de catalogus, zodat het de
// volgende keer (voor iedereen) meteen gevonden wordt. Geeft { status, product }:
//   'invalid'  onleesbare/ongeldige code (verkeerd controlecijfer of lengte)
//   'found'    stond al in de catalogus
//   'added'    via OFF gevonden + aan de catalogus toegevoegd
//   'unknown'  niet in de catalogus en niet bij OFF → gebruiker voert handmatig in
//
// Het teruggegeven product heeft een catalogus-`id`, zodat de aanroeper het direct
// aan de lijst (groceries.add) of voorraad (pantry.add) kan koppelen.
export async function lookupBarcode(raw) {
  if (!isValidBarcode(raw)) return { status: 'invalid', product: null };
  const code = normalizeBarcode(raw);

  // 1. Catalogus — probeer de code zoals gescand én de EAN-13-vorm van een UPC-A.
  const codes = [...new Set([code, toEan13(code)])];
  const hit = await run(
    supabase.from('catalog_products').select('*').in('code', codes).limit(1),
    { fallback: [], context: 'product opzoeken' },
  );
  if (hit?.length) return { status: 'found', product: hit[0] };

  // 2. Open Food Facts (live). Faalt stil → onbekend.
  const off = await fetchOffProduct(code);
  if (!off) return { status: 'unknown', product: null };

  // 3. Laat de catalogus groeien (overschrijft nooit een bestaand item).
  const id = await run(
    supabase.rpc('insert_catalog_product', {
      p_code: off.code, p_name: off.name, p_search: off.search,
      p_brands: off.brands, p_quantity: off.quantity, p_image_url: off.image_url,
    }),
    { fallback: null, context: 'product toevoegen aan catalogus' },
  );
  return { status: 'added', product: { ...off, id } };
}
