// Units voor de pure schoonmaakrooster-logica (lib/cleaningTemplates.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEANING_TEMPLATES, getCleaningTemplate, planTemplate, firstDueDate, buildCustomSchedule,
} from '../lib/cleaningTemplates.js';

test('elk sjabloon heeft een unieke key en minstens één ruimte', () => {
  const keys = CLEANING_TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const t of CLEANING_TEMPLATES) {
    assert.ok(t.label, `label ontbreekt voor ${t.key}`);
    assert.ok(t.rooms.length > 0, `geen ruimtes in ${t.key}`);
  }
});

test('getCleaningTemplate vindt op key, null bij onbekend', () => {
  assert.equal(getCleaningTemplate('standaard-week').key, 'standaard-week');
  assert.equal(getCleaningTemplate('bestaat-niet'), null);
});

test('planTemplate: één taak per ruimte, allemaal category huishouden + household-zichtbaar', () => {
  const t = getCleaningTemplate('standaard-week');
  const { tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  assert.equal(tasks.length, t.rooms.length);
  for (const task of tasks) {
    assert.equal(task.category, 'huishouden');
    assert.equal(task.visibility, 'household');
    assert.ok(task.zone_name);
    assert.match(task.due_date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('planTemplate: zones worden gededupliceerd binnen het sjabloon', () => {
  // 'standaard-week' heeft Badkamer en Toilet als aparte zones, maar Badkamer + Toilet
  // komen elk één keer voor; de twee taken in dezelfde zone mogen geen dubbele zone maken.
  const t = {
    key: 'x', label: 'x', rooms: [
      { zone: 'Keuken', title: 'A', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [1] },
      { zone: 'keuken', title: 'B', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [2] },
    ],
  };
  const { zonesToCreate, tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  assert.equal(zonesToCreate.length, 1, 'Keuken/keuken moet één zone worden');
  assert.equal(tasks.length, 2, 'beide taken blijven bestaan');
});

test('planTemplate: bestaande zones worden niet opnieuw aangemaakt (case-insensitief)', () => {
  const t = getCleaningTemplate('licht');
  const { zonesToCreate } = planTemplate(t, {
    existingZones: [{ name: 'badkamer' }, { name: 'KEUKEN' }],
    startDate: new Date(2026, 5, 1),
  });
  const names = zonesToCreate.map((z) => z.name.toLowerCase());
  assert.ok(!names.includes('badkamer'));
  assert.ok(!names.includes('keuken'));
  assert.ok(names.includes('algemeen'));
});

test('firstDueDate: wekelijks met weekdag pakt de eerste passende dag', () => {
  // 1 juni 2026 is maandag (getDay 1). Vraag om zaterdag (6) -> 6 juni 2026.
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'weekly', [6]), '2026-06-06');
  // Vraag om maandag (1) terwijl start al maandag is -> zelfde dag.
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'weekly', [1]), '2026-06-01');
});

test('firstDueDate: maandelijks of zonder weekdagen gebruikt de startdatum', () => {
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'monthly', []), '2026-06-01');
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'weekly', null), '2026-06-01');
});

test('planTemplate: recur_weekdays wordt null als de taak geen weekdagen heeft', () => {
  const t = getCleaningTemplate('standaard-week');
  const { tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  const ramen = tasks.find((x) => x.title === 'Ramen lappen');
  assert.equal(ramen.recur_weekdays, null);
  assert.equal(ramen.recur_freq, 'monthly');
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22):
// emoji-/interval-/weekdagen-overname per ruimte, normalisatie met spaties+hoofdletters,
// en de lus-grens in firstDueDate.

test('planTemplate: emoji, interval en weekdagen volgen exact de ruimte-definitie', () => {
  const t = getCleaningTemplate('standaard-week');
  const { zonesToCreate, tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  // emoji uit de ruimte zelf (niet de 🧹-fallback)
  assert.equal(zonesToCreate.find((z) => z.name === 'Badkamer').emoji, '🛁');
  // recur_interval letterlijk overgenomen ('Stof afnemen' = elke 2 weken)
  const stof = tasks.find((x) => x.title === 'Stof afnemen');
  assert.equal(stof.recur_interval, 2);
  // wekelijks mét weekdagen → array behouden; wekelijks zónder → null
  assert.deepEqual(tasks.find((x) => x.title === 'Badkamer schoonmaken').recur_weekdays, [6]);
  assert.equal(stof.recur_weekdays, null); // 'Stof afnemen' is weekly maar recur_weekdays []
});

test('planTemplate: emoji valt terug op 🧹 zonder eigen emoji; interval default 1', () => {
  const t = { key: 'x', label: 'x', rooms: [{ zone: 'Zolder', title: 'Vegen', recur_freq: 'monthly' }] };
  const { zonesToCreate, tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  assert.equal(zonesToCreate[0].emoji, '🧹');
  assert.equal(tasks[0].recur_interval, 1);
  assert.equal(tasks[0].recur_weekdays, null);
});

test('planTemplate: bestaande zone met spaties/hoofdletters wordt herkend (genormaliseerd)', () => {
  const t = { key: 'x', label: 'x', rooms: [{ zone: 'Keuken', title: 'A', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [1] }] };
  const { zonesToCreate } = planTemplate(t, { existingZones: [{ name: '  KEUKEN  ' }], startDate: new Date(2026, 5, 1) });
  assert.deepEqual(zonesToCreate, [], 'spaties + hoofdletters: zelfde zone → niet opnieuw aanmaken');
});

test('firstDueDate: wekelijks zonder passende weekdag valt terug op precies een week later', () => {
  // 1 juni 2026 = maandag; een set zonder geldige match → de lus draait 7 dagen door.
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'weekly', [9]), '2026-06-08');
});

test('firstDueDate: weekdagen tellen alleen bij wekelijks, niet bij maandelijks', () => {
  // maandelijks mét weekdagen → gewoon de startdatum, niet doorzoeken naar woensdag.
  assert.equal(firstDueDate(new Date(2026, 5, 1), 'monthly', [3]), '2026-06-01');
});

test('planTemplate: recur_weekdays alleen bij wekelijks; veilig zonder weekdagen-veld', () => {
  const t = {
    key: 'x', label: 'x', rooms: [
      { zone: 'A', title: 'Maandelijks met dagen', recur_freq: 'monthly', recur_interval: 1, recur_weekdays: [3] },
      { zone: 'B', title: 'Wekelijks zonder dagen-veld', recur_freq: 'weekly', recur_interval: 1 }, // geen recur_weekdays
    ],
  };
  const { tasks } = planTemplate(t, { startDate: new Date(2026, 5, 1) });
  // maandelijks → weekdagen genegeerd (null), ook al staan ze gedefinieerd
  assert.equal(tasks.find((x) => x.title === 'Maandelijks met dagen').recur_weekdays, null);
  // wekelijks zonder veld → null en geen crash
  assert.equal(tasks.find((x) => x.title === 'Wekelijks zonder dagen-veld').recur_weekdays, null);
});

// === buildCustomSchedule (SCH-4) — zelf samengesteld rooster ===

test('buildCustomSchedule: zelfde vorm als planTemplate (zones + taken)', () => {
  const rooms = [
    { zone: 'Badkamer', emoji: '🛁', title: 'Schrobben', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [6] },
    { zone: 'Keuken', emoji: '🍳', title: 'Dweilen', recur_freq: 'weekly', recur_interval: 2, recur_weekdays: [] },
  ];
  const { zonesToCreate, tasks } = buildCustomSchedule(rooms, { startDate: new Date(2026, 5, 1) });
  assert.equal(zonesToCreate.length, 2);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].category, 'huishouden');
  assert.equal(tasks[0].visibility, 'household');
  assert.deepEqual(tasks[0].recur_weekdays, [6]);
  assert.equal(tasks[1].recur_interval, 2);
  assert.equal(tasks[1].recur_weekdays, null); // weekly maar lege weekdagen → null
});

test('buildCustomSchedule: ontbrekende titel valt terug op "<zone> schoonmaken"', () => {
  const { tasks } = buildCustomSchedule(
    [{ zone: '  Zolder  ', recur_freq: 'monthly' }],
    { startDate: new Date(2026, 5, 1) },
  );
  assert.equal(tasks[0].title, 'Zolder schoonmaken'); // getrimd
});

test('buildCustomSchedule: lege/spatie-only zonenaam valt weg', () => {
  const { zonesToCreate, tasks } = buildCustomSchedule(
    [
      { zone: 'Keuken', title: 'Dweilen', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [1] },
      { zone: '   ', title: 'Niks', recur_freq: 'weekly' },
    ],
    { startDate: new Date(2026, 5, 1) },
  );
  assert.equal(zonesToCreate.length, 1);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].zone_name, 'Keuken');
});

test('buildCustomSchedule: respecteert bestaande zones (case-insensitief)', () => {
  const { zonesToCreate } = buildCustomSchedule(
    [{ zone: 'Keuken', title: 'Dweilen', recur_freq: 'weekly', recur_interval: 1, recur_weekdays: [1] }],
    { existingZones: [{ name: '  keuken ' }], startDate: new Date(2026, 5, 1) },
  );
  assert.deepEqual(zonesToCreate, []);
});

test('buildCustomSchedule: leeg/ontbrekend rooster → lege uitkomst, geen crash', () => {
  assert.deepEqual(buildCustomSchedule([], {}), { zonesToCreate: [], tasks: [] });
  assert.deepEqual(buildCustomSchedule(undefined, {}), { zonesToCreate: [], tasks: [] });
  assert.deepEqual(buildCustomSchedule(), { zonesToCreate: [], tasks: [] });
});
