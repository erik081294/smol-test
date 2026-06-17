// Invarianten van de module-registry. Houdt het inplug-punt van het framework
// gezond: unieke keys/routes, geldige 'kind', en data-modules die het
// zichtbaarheidscontract kunnen volgen (een tabel + creator-kolom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, DATA_MODULES, getModule } from '../lib/modules.js';

const KINDS = new Set(['overview', 'data', 'admin']);

test('elke module heeft de verplichte velden', () => {
  for (const m of MODULES) {
    assert.ok(m.key, 'key ontbreekt');
    assert.ok(m.label, `label ontbreekt voor ${m.key}`);
    assert.ok(m.emoji, `emoji ontbreekt voor ${m.key}`);
    assert.ok(m.route, `route ontbreekt voor ${m.key}`);
    assert.ok(KINDS.has(m.kind), `ongeldige kind '${m.kind}' voor ${m.key}`);
  }
});

test('keys en routes zijn uniek', () => {
  const keys = MODULES.map((m) => m.key);
  const routes = MODULES.map((m) => m.route);
  assert.equal(new Set(keys).size, keys.length, 'dubbele key');
  assert.equal(new Set(routes).size, routes.length, 'dubbele route');
});

test("data-modules hebben een tabel + creator-kolom; niet-data hebben geen tabel", () => {
  for (const m of MODULES) {
    if (m.kind === 'data') {
      assert.ok(m.table, `data-module ${m.key} mist table`);
      assert.ok(m.creatorColumn, `data-module ${m.key} mist creatorColumn`);
    } else {
      assert.equal(m.table, null, `${m.kind}-module ${m.key} hoort geen table te hebben`);
    }
  }
});

test('DATA_MODULES bevat precies de data-kind modules', () => {
  assert.deepEqual(
    DATA_MODULES.map((m) => m.key).sort(),
    MODULES.filter((m) => m.kind === 'data').map((m) => m.key).sort(),
  );
});

test('getModule vindt op key en geeft null bij onbekend', () => {
  assert.equal(getModule(MODULES[0].key)?.key, MODULES[0].key);
  assert.equal(getModule('bestaat-niet'), null);
});

test('creator-kolommen matchen wat de DB/can_view verwacht', () => {
  // can_view wordt in 0001 aangeroepen met created_by (tasks) en added_by (groceries).
  const byTable = Object.fromEntries(DATA_MODULES.map((m) => [m.table, m.creatorColumn]));
  assert.equal(byTable.tasks, 'created_by');
  assert.equal(byTable.groceries, 'added_by');
});
