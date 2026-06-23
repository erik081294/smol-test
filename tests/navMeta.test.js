// Units voor het "vorige"-lintje (lib/navMeta.js). Puur, geen React.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_PARENT, backLabelFor } from '../lib/navMeta.js';

test('backLabelFor: detail-route → label van de herkomst-tab', () => {
  assert.equal(backLabelFor('plant'), 'Planten');
  assert.equal(backLabelFor('pet'), 'Huisdieren'); // PET-detail keert terug naar de Huisdieren-tab
  assert.equal(backLabelFor('purchase'), 'Boodschappen');
  assert.equal(backLabelFor('kosten-inzichten'), 'Kosten');
  assert.equal(backLabelFor('resource'), 'Samen'); // module 'delen' heet 'Samen'
  assert.equal(backLabelFor('herinneringen'), 'Huishouden');
});

test('backLabelFor: onbekende route → null (val terug op de ✕)', () => {
  assert.equal(backLabelFor('bestaat-niet'), null);
  assert.equal(backLabelFor(undefined), null);
});

test('backLabelFor: fromKey overschrijft de statische parent', () => {
  // catalog hoort standaard bij boodschappen, maar kan vanaf elders geopend zijn.
  assert.equal(backLabelFor('catalog'), 'Boodschappen');
  assert.equal(backLabelFor('catalog', 'maaltijden'), 'Maaltijden');
});

test('backLabelFor: onbekende fromKey valt terug op null (niet op de parent)', () => {
  // Een expliciete maar onbekende herkomst is geen geldige tab → geen lintje.
  assert.equal(backLabelFor('plant', 'bestaat-niet'), null);
});

test('DETAIL_PARENT: elke parent-key is een bestaande module', () => {
  // Borgt dat de map niet stilletjes uit sync loopt met lib/modules.js.
  for (const parent of Object.values(DETAIL_PARENT)) {
    assert.ok(backLabelFor('plant', parent), `parent ontbreekt als module: ${parent}`);
  }
});
