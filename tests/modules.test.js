// Invarianten van de module-registry. Houdt het inplug-punt van het framework
// gezond: unieke keys/routes, geldige 'kind', en data-modules die het
// zichtbaarheidscontract kunnen volgen (een tabel + creator-kolom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULES, DATA_MODULES, TOGGLEABLE_MODULES, getModule,
  effectiveModules, availableModules, MODULE_GROUPS,
} from '../lib/modules.js';

const KINDS = new Set(['overview', 'data', 'admin']);

test('elke module heeft de verplichte velden', () => {
  for (const m of MODULES) {
    assert.ok(m.key, 'key ontbreekt');
    assert.ok(m.label, `label ontbreekt voor ${m.key}`);
    assert.ok(m.emoji, `emoji ontbreekt voor ${m.key}`);
    assert.ok(m.route, `route ontbreekt voor ${m.key}`);
    assert.ok(KINDS.has(m.kind), `ongeldige kind '${m.kind}' voor ${m.key}`);
    assert.equal(typeof m.core, 'boolean', `core moet boolean zijn voor ${m.key}`);
    assert.equal(typeof m.primary, 'boolean', `primary moet boolean zijn voor ${m.key}`);
  }
});

test('er is minstens één primaire module en de tabbalk blijft behapbaar', () => {
  const primary = MODULES.filter((m) => m.primary);
  assert.ok(primary.length >= 1, 'minstens één primaire module nodig');
  // Primair + de "Meer"-tab samen mogen de balk niet overladen.
  assert.ok(primary.length <= 5, `te veel primaire tabs (${primary.length}); zet er een onder "Meer"`);
  assert.ok(MODULES.some((m) => !m.primary), 'er hoort iets onder "Meer" te staan');
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

test('elke module heeft een geldige group (null of bekend) en niet-primaire data/overview-modules zitten in een groep', () => {
  const known = new Set(MODULE_GROUPS);
  for (const m of MODULES) {
    assert.ok(m.group === null || known.has(m.group), `onbekende group '${m.group}' voor ${m.key}`);
    // Wat via "Meer" bereikbaar is (niet-primair) en geen hub-kind is, hoort in een groep
    // te vallen zodat het gegroepeerd getoond kan worden — behalve bewust verborgen (group:null).
    if (!m.primary && m.group === null) {
      assert.ok(['huishouden'].includes(m.key), `${m.key} is niet-primair maar heeft geen groep`);
    }
  }
});

test('precies de dagelijkse modules zijn primair (vormen de tabbalk)', () => {
  assert.deepEqual(
    MODULES.filter((m) => m.primary).map((m) => m.key).sort(),
    ['boodschappen', 'taken', 'vandaag'],
  );
});

test('er is precies één kern-skelet (Vandaag + Huishouden + Instellingen) dat niet uitzetbaar is', () => {
  const coreKeys = MODULES.filter((m) => m.core).map((m) => m.key).sort();
  assert.deepEqual(coreKeys, ['huishouden', 'instellingen', 'vandaag']);
  assert.deepEqual(
    TOGGLEABLE_MODULES.map((m) => m.key).sort(),
    MODULES.filter((m) => !m.core).map((m) => m.key).sort(),
  );
});

test('effectiveModules: zonder overrides staat alles aan', () => {
  assert.deepEqual(
    effectiveModules().map((m) => m.key),
    MODULES.map((m) => m.key),
  );
});

test('effectiveModules: een persoonlijke uitzetting verbergt alleen die module', () => {
  const keys = effectiveModules({ userDisabled: ['boodschappen'] }).map((m) => m.key);
  assert.ok(!keys.includes('boodschappen'));
  assert.ok(keys.includes('taken'));
  assert.ok(keys.includes('vandaag') && keys.includes('huishouden'));
});

test('effectiveModules: kern is nooit uit te zetten', () => {
  const keys = effectiveModules({
    householdDisabled: ['vandaag', 'huishouden'],
    userDisabled: ['vandaag', 'huishouden'],
  }).map((m) => m.key);
  assert.ok(keys.includes('vandaag'));
  assert.ok(keys.includes('huishouden'));
});

test('effectiveModules: huishouden-uitzetting wint van de gebruiker', () => {
  // Huishouden zet boodschappen uit; ook al heeft de gebruiker niets uitgezet,
  // de module is weg. (En andersom blijft 'ie weg.)
  const keys = effectiveModules({ householdDisabled: ['boodschappen'], userDisabled: [] }).map((m) => m.key);
  assert.ok(!keys.includes('boodschappen'));
});

test('availableModules: toont kern + wat het huishouden niet heeft uitgezet', () => {
  const keys = availableModules({ householdDisabled: ['boodschappen'] }).map((m) => m.key);
  assert.ok(!keys.includes('boodschappen'));
  assert.ok(keys.includes('taken'));
  assert.ok(keys.includes('vandaag'));
});
