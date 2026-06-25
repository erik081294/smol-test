// Units voor de pure verschijning-helpers (lib/vehicleAppearance.js): kleur → hex,
// licht/donker-bepaling en RDW-carrosserie → silhouet-soort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorHex, isLightColor, bodyKind } from '../lib/vehicleAppearance.js';

test('colorHex: bekende RDW-kleuren → hex, tolerant voor casing/diakriet/spaties', () => {
  assert.equal(colorHex('BLAUW'), '#3B6FB0');
  assert.equal(colorHex('blauw'), '#3B6FB0');
  assert.equal(colorHex('  Rood '), '#C0392B');
  assert.equal(colorHex('Crème'), '#EFE6CC');   // diakriet wordt genormaliseerd
  assert.equal(colorHex('zwart'), '#2B2B2B');
});

test('colorHex: onbekend/leeg/diversen → null (UI valt terug op themakleur)', () => {
  assert.equal(colorHex('mauve'), null);
  assert.equal(colorHex('diversen'), null);
  assert.equal(colorHex(''), null);
  assert.equal(colorHex(null), null);
  assert.equal(colorHex(undefined), null);
});

test('isLightColor: lichte kleuren → true, donkere/ongeldige → false', () => {
  assert.equal(isLightColor('#EDEDED'), true);   // wit-achtig
  assert.equal(isLightColor('#2B2B2B'), false);  // zwart-achtig
  assert.equal(isLightColor('#3B6FB0'), false);  // blauw is donker genoeg
  assert.equal(isLightColor('#E8C541'), true);   // geel is licht
  assert.equal(isLightColor('geen-hex'), false);
  assert.equal(isLightColor(null), false);
});

test('bodyKind: RDW-inrichting → grove silhouet-soort, onbekend → hatchback', () => {
  assert.equal(bodyKind('stationwagen'), 'station');
  assert.equal(bodyKind('MPV'), 'van');
  assert.equal(bodyKind('gesloten opbouw'), 'van');
  assert.equal(bodyKind('SUV'), 'suv');
  assert.equal(bodyKind('sedan'), 'sedan');
  assert.equal(bodyKind('cabriolet'), 'sedan');
  assert.equal(bodyKind('hatchback'), 'hatchback');
  assert.equal(bodyKind(''), 'hatchback');
  assert.equal(bodyKind(null), 'hatchback');
});
