// Units voor de pure schoonmaakrooster-logica (lib/cleaningTemplates.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEANING_TEMPLATES, getCleaningTemplate, planTemplate, firstDueDate,
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
