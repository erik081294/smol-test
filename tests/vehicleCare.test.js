// Units voor de pure voertuig-onderhoudslogica (lib/vehicleCare.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maintenanceTemplates, defaultMaintenanceKeys, buildMaintenanceTasks,
  nextServiceMileage, intervalLabel,
} from '../lib/vehicleCare.js';
import { RECUR, RECUR_VALUES, VISIBILITY } from '../lib/constants.js';

const V = (extra = {}) => ({ id: 'v1', name: 'Golf', ...extra });

test('maintenanceTemplates: unieke keys, geldige freq/interval, km-interval positief', () => {
  const tpls = maintenanceTemplates();
  assert.ok(tpls.length >= 5);
  const keys = tpls.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length, 'keys uniek');
  const valid = new Set(RECUR_VALUES);
  for (const t of tpls) {
    assert.ok(valid.has(t.freq), `${t.key} freq`);
    assert.ok(Number.isInteger(t.interval) && t.interval > 0, `${t.key} interval`);
    assert.ok(t.title, `${t.key} title`);
    if (t.kmInterval != null) assert.ok(Number.isInteger(t.kmInterval) && t.kmInterval > 0, `${t.key} km`);
  }
});

test('defaultMaintenanceKeys: precies de defaultOn-sjablonen, niet leeg, subset van alle', () => {
  const def = defaultMaintenanceKeys();
  const all = maintenanceTemplates();
  const expected = all.filter((t) => t.defaultOn).map((t) => t.key);
  assert.deepEqual(def, expected);
  assert.ok(def.length > 0 && def.length < all.length, 'sommige aan, sommige uit');
  assert.ok(def.includes('apk'));
  assert.ok(!def.includes('distributieriem')); // bewust uit (niet elke auto)
});

test('buildMaintenanceTasks: geen voertuig → lege lijst', () => {
  assert.deepEqual(buildMaintenanceTasks(null, ['apk']), []);
  assert.deepEqual(buildMaintenanceTasks(undefined), []);
});

test('buildMaintenanceTasks: null selectedKeys valt terug op de defaultOn-set', () => {
  const tasks = buildMaintenanceTasks(V(), null, { startDate: new Date('2026-06-25T10:00:00') });
  assert.equal(tasks.length, defaultMaintenanceKeys().length);
  // elke taak draagt het juiste contract
  for (const tk of tasks) {
    assert.equal(tk.category, 'voertuig');
    assert.equal(tk.vehicle_id, 'v1');
    assert.equal(tk.due_date, '2026-06-25'); // exact geformatteerd uit startDate
    assert.equal(tk.recur_freq, RECUR.MONTHLY);
    assert.ok(tk.recur_interval >= 1);
    assert.equal(tk.recur_weekdays, null);
  }
});

test('buildMaintenanceTasks: alleen de gekozen keys, titel = sjabloon — voertuig', () => {
  const tasks = buildMaintenanceTasks(V({ name: 'Polo' }), ['apk']);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'APK-keuring — Polo');
  assert.equal(tasks[0].recur_interval, 12); // APK = jaarlijks = 12 maanden
});

test('buildMaintenanceTasks: APK valt op de RDW-vervaldatum, overige op startdatum', () => {
  const start = new Date('2026-06-25T10:00:00');
  const tasks = buildMaintenanceTasks(
    V({ apk_expires_on: '2027-03-14' }), ['apk', 'olie'], { startDate: start });
  const apk = tasks.find((t) => t.title.startsWith('APK'));
  const olie = tasks.find((t) => t.title.startsWith('Olie'));
  assert.equal(apk.due_date, '2027-03-14', 'APK op de echte RDW-datum');
  assert.equal(olie.due_date, '2026-06-25', 'overige op de startdatum');
  // Zonder (geldige) RDW-datum valt APK terug op de startdatum.
  const [apk2] = buildMaintenanceTasks(V({ apk_expires_on: null }), ['apk'], { startDate: start });
  assert.equal(apk2.due_date, '2026-06-25');
  const [apk3] = buildMaintenanceTasks(V({ apk_expires_on: 'onzin' }), ['apk'], { startDate: start });
  assert.equal(apk3.due_date, '2026-06-25', 'ongeldige datum → startdatum');
});

test('buildMaintenanceTasks: zichtbaarheid — household (default), subgroup, custom', () => {
  const [household] = buildMaintenanceTasks(V(), ['apk']);
  assert.equal(household.visibility, VISIBILITY.HOUSEHOLD);
  assert.equal(household.share_subgroup_id, null);
  assert.equal(household.share_with, null);

  const [sub] = buildMaintenanceTasks(
    V({ visibility: VISIBILITY.SUBGROUP, share_subgroup_id: 'g1', share_with: ['x'] }), ['apk']);
  assert.equal(sub.visibility, VISIBILITY.SUBGROUP);
  assert.equal(sub.share_subgroup_id, 'g1');
  assert.equal(sub.share_with, null); // share_with hoort niet bij subgroup

  const [custom] = buildMaintenanceTasks(
    V({ visibility: VISIBILITY.CUSTOM, share_subgroup_id: 'g1', share_with: ['a', 'b'] }), ['apk']);
  assert.equal(custom.visibility, VISIBILITY.CUSTOM);
  assert.equal(custom.share_subgroup_id, null); // share_subgroup_id hoort niet bij custom
  assert.deepEqual(custom.share_with, ['a', 'b']);
});

test('buildMaintenanceTasks: overrides schalen het interval, met ondergrens 1', () => {
  const [t1] = buildMaintenanceTasks(V(), ['apk'], { overrides: { apk: 24 } });
  assert.equal(t1.recur_interval, 24);
  const [t0] = buildMaintenanceTasks(V(), ['apk'], { overrides: { apk: 0 } });
  assert.equal(t0.recur_interval, 1, 'Math.max(1, …) ondergrens'); // 0 → 1
});

test('nextServiceMileage: km-sjabloon + geldige stand → som; anders null', () => {
  const kleine = maintenanceTemplates().find((t) => t.key === 'kleine_beurt');
  const apk = maintenanceTemplates().find((t) => t.key === 'apk');
  assert.equal(nextServiceMileage(kleine, 42000), 57000); // 42000 + 15000
  assert.equal(nextServiceMileage(kleine, 0), 15000);     // 0 is geldig (grenswaarde)
  assert.equal(nextServiceMileage(apk, 42000), null);     // geen kmInterval
  assert.equal(nextServiceMileage(kleine, -5), null);     // negatief ongeldig
  assert.equal(nextServiceMileage(kleine, undefined), null);
  assert.equal(nextServiceMileage(kleine, 'abc'), null);  // NaN
  assert.equal(nextServiceMileage(null, 1000), null);
});

test('intervalLabel: datum-tekst + optionele km, deterministisch geformatteerd', () => {
  assert.equal(intervalLabel({ interval: 12 }), 'jaarlijks');
  assert.equal(intervalLabel({ interval: 24 }), 'elke 2 jaar');
  assert.equal(intervalLabel({ interval: 6 }), 'elke 6 maanden');
  assert.equal(intervalLabel({ interval: 1 }), 'maandelijks');
  assert.equal(intervalLabel({ interval: 12, kmInterval: 15000 }), 'jaarlijks of elke 15.000 km');
  assert.equal(intervalLabel({ interval: 48, kmInterval: 90000 }), 'elke 4 jaar of elke 90.000 km');
  assert.equal(intervalLabel(null), '');
});
