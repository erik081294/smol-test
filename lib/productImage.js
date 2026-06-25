// Beeld-resolver voor een product of catalogus-item. Bepaalt wélk visueel een product
// krijgt, met een nette terugval-keten (UX, Boodschappen-redesign):
//   1. een expliciete asset (later door ons geleverde PNG of een OpenMoji-asset) op
//      `image_key`/`key`, opgezocht in de meegegeven `assets`-map;
//   2. de emoji op het item zelf (per-product placeholder uit de catalogus);
//   3. de emoji van het schap (categorie);
//   4. een generieke kar als laatste redmiddel.
//
// De keuze-logica is puur en injectbaar (de `assets`-map wordt in de UI met require()
// opgebouwd) zodat 'm los te unit-testen is, zónder asset-bestanden in de testomgeving.
import { categoryMeta } from './groceryCatalog';

const FALLBACK = '🛒';

// item: catalogus-item ({ key, name, category, emoji }) of huishoud-product
// ({ name, category, image_key? }). Geeft een descriptor terug die de UI rendert:
//   { kind: 'asset', source, key } | { kind: 'emoji', char }
export function resolveProductImage(item, { assets = {} } = {}) {
  if (!item) return { kind: 'emoji', char: FALLBACK };
  const assetKey = item.image_key ?? item.key ?? null;
  if (assetKey && assets[assetKey]) {
    return { kind: 'asset', source: assets[assetKey], key: assetKey };
  }
  if (item.emoji) return { kind: 'emoji', char: item.emoji };
  // categoryMeta valt altijd terug op 'overig' (emoji 🛒), dus dit dekt óók de
  // onbekende-categorie-/laatste-redmiddel-case — geen aparte (dode) fallback-tak.
  return { kind: 'emoji', char: categoryMeta(item.category).emoji };
}
