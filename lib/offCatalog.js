// Pure transform/filter van één Open Food Facts DUMP-record naar een
// catalog_products-rij. Géén IO — los testbaar (tests/offCatalog.test.js). Het
// importscript (scripts/import-off-dump.mjs) streamt de JSONL-dump regel-voor-regel
// en roept transformOffProduct per record aan; deze module is het brein dat beslist
// wat we HOUDEN (NL-subset, kwaliteit, geldige code, naam aanwezig) en hoe we het
// OPschonen (beste taalnaam, categorie-mapping, naam-normalisatie voor zoeken).
//
// OFF is crowd-sourced: lege/anderstalige namen, dubbele/rommelige categorieën en
// door OFF gemarkeerde kwaliteitsfouten komen voor. Hier filteren we die eruit.

import { normalize } from './productMatch.js';
import { mapCategory } from './offCategoryMap.js';

const NL_TAG = 'en:netherlands';

// Eerste niet-lege string uit een reeks kandidaten (getrimd).
function firstStr(...vals) {
  for (const v of vals) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  }
  return '';
}

// Naam in voorkeursvolgorde: Nederlands → hoofdtaal → en → fr → generiek. OFF vult
// `product_name` met de hoofdtaal, die leeg of anderstalig kan zijn; daarom expliciet
// coalescen i.p.v. blind op `product_name` vertrouwen.
export function pickName(p = {}) {
  return firstStr(p.product_name_nl, p.product_name, p.product_name_en, p.product_name_fr, p.generic_name);
}

// Hoort dit product bij de Nederlandse subset? (countries_tags bevat en:netherlands)
export function isNetherlands(p = {}) {
  return Array.isArray(p.countries_tags) && p.countries_tags.includes(NL_TAG);
}

// Heeft OFF HARDE kwaliteitsfouten gemarkeerd? Warnings laten we door, errors niet.
export function hasQualityErrors(p = {}) {
  return Array.isArray(p.data_quality_errors_tags) && p.data_quality_errors_tags.length > 0;
}

const clamp = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};

// Eén OFF-dumprecord → { row } (bewaren) of { skip: <reden> } (overslaan, met reden
// voor de import-statistiek). opts:
//   requireNL          filter op de NL-subset (default true)
//   dropQualityErrors  negeer producten met data_quality_errors (default true)
//   minCompleteness    drempel op OFF's completeness 0..1.1 (default 0 = uit)
export function transformOffProduct(p = {}, opts = {}) {
  const { requireNL = true, dropQualityErrors = true, minCompleteness = 0 } = opts;

  const code = String(p.code ?? '').replace(/\D/g, '');
  if (!code) return { skip: 'geen-code' };
  if (![8, 12, 13, 14].includes(code.length)) return { skip: 'ongeldige-code' };
  if (requireNL && !isNetherlands(p)) return { skip: 'niet-nl' };
  if (dropQualityErrors && hasQualityErrors(p)) return { skip: 'kwaliteitsfout' };

  if (minCompleteness > 0) {
    const c = Number(p.completeness);
    if (Number.isFinite(c) && c < minCompleteness) return { skip: 'onvolledig' };
  }

  const name = pickName(p);
  if (!name) return { skip: 'geen-naam' };

  const offCats = Array.isArray(p.categories_tags) && p.categories_tags.length
    ? p.categories_tags.slice(0, 12).join(',')
    : null;

  return {
    row: {
      code,
      name: name.slice(0, 200),
      brands: clamp(p.brands, 160),
      quantity: clamp(p.quantity, 60),
      image_url: firstStr(p.image_small_url, p.image_front_small_url) || null,
      category: mapCategory(p),
      off_categories: offCats,
      lang: clamp(p.lang, 8),
      search: normalize(name),
      popularity: Math.max(0, Math.floor(Number(p.unique_scans_n) || 0)),
    },
  };
}
