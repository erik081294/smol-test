// Units voor de pure OFF-dump → catalog_products transform/filter (lib/offCatalog.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickName, isNetherlands, hasQualityErrors, transformOffProduct } from '../lib/offCatalog.js';

// Een minimale, geldige NL-dumprecord als basis; tests overschrijven velden.
const base = () => ({
  code: '4006381333931',
  product_name: 'Semi-skimmed milk',
  product_name_nl: 'Halfvolle melk',
  brands: ' Campina ',
  quantity: '1 L',
  image_small_url: 'https://images.off/milk.jpg',
  categories_tags: ['en:dairies', 'en:milks'],
  lang: 'nl',
  unique_scans_n: 42,
  countries_tags: ['en:netherlands', 'en:belgium'],
});

test('pickName: NL wint, dan hoofdtaal/en/fr/generiek, anders leeg', () => {
  assert.equal(pickName({ product_name_nl: 'Melk', product_name: 'Milk' }), 'Melk');
  assert.equal(pickName({ product_name: 'Milk' }), 'Milk');
  assert.equal(pickName({ product_name_en: 'Milk' }), 'Milk');
  assert.equal(pickName({ generic_name: 'Zuivel' }), 'Zuivel');
  assert.equal(pickName({ product_name: '   ' }), '');
  assert.equal(pickName({}), '');
});

test('isNetherlands / hasQualityErrors', () => {
  assert.equal(isNetherlands({ countries_tags: ['en:netherlands'] }), true);
  assert.equal(isNetherlands({ countries_tags: ['en:france'] }), false);
  assert.equal(isNetherlands({}), false);
  assert.equal(hasQualityErrors({ data_quality_errors_tags: ['en:energy-value-in-kj-does-not-match'] }), true);
  assert.equal(hasQualityErrors({ data_quality_errors_tags: [] }), false);
  assert.equal(hasQualityErrors({}), false);
});

test('transformOffProduct: geldig NL-product → opgeschoonde rij', () => {
  const out = transformOffProduct(base());
  assert.deepEqual(out, {
    row: {
      code: '4006381333931',
      name: 'Halfvolle melk',
      brands: 'Campina',
      quantity: '1 L',
      image_url: 'https://images.off/milk.jpg',
      category: 'zuivel',          // via lib/offCategoryMap (en:dairies/en:milks)
      off_categories: 'en:dairies,en:milks',
      lang: 'nl',
      search: 'halfvolle melk',     // via lib/productMatch.normalize
      popularity: 42,
    },
  });
});

test('transformOffProduct: filtert niet-NL, kwaliteitsfouten, naamloos, en ongeldige codes', () => {
  assert.deepEqual(transformOffProduct({ ...base(), countries_tags: ['en:germany'] }), { skip: 'niet-nl' });
  assert.deepEqual(transformOffProduct({ ...base(), data_quality_errors_tags: ['en:x'] }), { skip: 'kwaliteitsfout' });
  assert.deepEqual(
    transformOffProduct({ ...base(), product_name: '', product_name_nl: '', product_name_en: '', product_name_fr: '', generic_name: '' }),
    { skip: 'geen-naam' },
  );
  assert.deepEqual(transformOffProduct({ ...base(), code: '' }), { skip: 'geen-code' });
  assert.deepEqual(transformOffProduct({ ...base(), code: '12345' }), { skip: 'ongeldige-code' });
});

test('transformOffProduct: code wordt genormaliseerd (alleen cijfers)', () => {
  const out = transformOffProduct({ ...base(), code: ' 0036000291452 ' });
  assert.equal(out.row.code, '0036000291452');
});

test('transformOffProduct: minCompleteness-drempel en requireNL:false', () => {
  assert.deepEqual(transformOffProduct({ ...base(), completeness: 0.2 }, { minCompleteness: 0.5 }), { skip: 'onvolledig' });
  assert.ok(transformOffProduct({ ...base(), completeness: 0.9 }, { minCompleteness: 0.5 }).row);
  // requireNL:false laat een niet-NL product door (voor een evt. bredere import)
  assert.ok(transformOffProduct({ ...base(), countries_tags: ['en:germany'] }, { requireNL: false }).row);
});

test('transformOffProduct: onbekende categorie valt terug op overig; geen tags → null off_categories', () => {
  const out = transformOffProduct({ ...base(), categories_tags: [], pnns_groups_1: 'unknown' });
  assert.equal(out.row.category, 'overig');
  assert.equal(out.row.off_categories, null);
});
