// Units voor de pure onderhoudsboekje-logica (lib/vehicleTimeline.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKeyOf, relativeDayLabel, logEntryKind, buildVehicleTimeline, groupVehicleTimelineByDay,
  totalLoggedCents, buildLogbookText,
} from '../lib/vehicleTimeline.js';

test('dayKeyOf: lokale dag-sleutel, null bij leeg/ongeldig', () => {
  assert.equal(dayKeyOf('2026-06-25'), '2026-06-25');
  assert.equal(dayKeyOf(''), null);
  assert.equal(dayKeyOf(null), null);
  assert.equal(dayKeyOf('geen-datum'), null);
});

test('dayKeyOf: datum-only string is tijdzone-veilig, timestamp blijft lokaal', () => {
  // '2026-06-01' is een kalenderdag; mag onder een negatieve-offset-zone niet 31 mei worden
  // (zie tests/register.mjs — de suite draait gepind op zo'n zone).
  assert.equal(dayKeyOf('2026-06-01'), '2026-06-01');
  // Een volledige timestamp blijft lokaal afgelezen (instant → lokale kalenderdag).
  assert.equal(dayKeyOf('2026-06-22T08:30:00'), '2026-06-22');
});

test('relativeDayLabel: vandaag/gisteren/anders', () => {
  const now = new Date('2026-06-25T12:00:00');
  assert.equal(relativeDayLabel('2026-06-25', now), 'today');
  assert.equal(relativeDayLabel('2026-06-24', now), 'yesterday');
  assert.equal(relativeDayLabel('2026-06-01', now), null);
  assert.equal(relativeDayLabel(null, now), null);
});

test('logEntryKind: kosten/titel → onderhoud, alleen km → km, anders notitie', () => {
  assert.equal(logEntryKind({ cost_cents: 5000 }), 'onderhoud');
  assert.equal(logEntryKind({ title: 'Grote beurt' }), 'onderhoud');
  assert.equal(logEntryKind({ mileage: 120000 }), 'km');
  assert.equal(logEntryKind({ mileage: 120000, note: 'tankbeurt' }), 'note'); // km + notitie → notitie
  assert.equal(logEntryKind({ note: 'krasje' }), 'note');
  assert.equal(logEntryKind({ cost_cents: 0 }), 'note'); // 0 telt niet als kosten
  assert.equal(logEntryKind(null), 'note');
});

test('buildVehicleTimeline: voegt 3 bronnen samen, nieuwste eerst', () => {
  const entries = buildVehicleTimeline({
    logs: [
      { id: 'a', performed_on: '2024-01-10', title: 'Kleine beurt', cost_cents: 19900, mileage: 80000 },
      { id: 'b', performed_on: '2026-06-01', mileage: 120000 },
    ],
    completions: [{ id: 'c', completed_at: '2025-03-15T10:00:00Z', task: { title: 'APK-keuring — Golf' } }],
    vehicle: { first_registration: '2018-07-04' },
  });
  assert.deepEqual(entries.map((e) => e.id), ['log:b', 'done:c', 'log:a', 'rdw:first']);
  assert.equal(entries[0].kind, 'km');
  assert.equal(entries[1].kind, 'taak');
  assert.equal(entries[3].kind, 'mijlpaal');
  assert.equal(entries[3].title, 'Eerste toelating (RDW)');
});

test('buildVehicleTimeline: lege bronnen → lege lijst; geen eerste-toelating → geen mijlpaal', () => {
  assert.deepEqual(buildVehicleTimeline(), []);
  assert.deepEqual(buildVehicleTimeline({ logs: [], vehicle: {} }), []);
  const only = buildVehicleTimeline({ logs: [{ id: 'x', performed_on: '2026-01-01' }] });
  assert.equal(only.length, 1);
});

test('groupVehicleTimelineByDay: groepeert op dag met behoud van volgorde', () => {
  const groups = groupVehicleTimelineByDay([
    { id: '1', date: '2026-06-25' }, { id: '2', date: '2026-06-25' }, { id: '3', date: '2026-06-01' },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { key: '2026-06-25', entries: [{ id: '1', date: '2026-06-25' }, { id: '2', date: '2026-06-25' }] });
  assert.equal(groups[1].key, '2026-06-01');
});

test('totalLoggedCents: sommeert, ontbrekend telt als 0', () => {
  assert.equal(totalLoggedCents([{ cost_cents: 19900 }, { cost_cents: 5000 }, { mileage: 1 }]), 24900);
  assert.equal(totalLoggedCents([]), 0);
  assert.equal(totalLoggedCents(), 0);
});

test('buildLogbookText: kop + chronologisch (oudste eerst), met km/kosten/notitie', () => {
  const txt = buildLogbookText(
    { name: 'Onze Golf', make: 'Volkswagen', model: 'Golf', license_plate: '12ABC3', year: 2018 },
    [
      { id: 'log:b', date: '2026-06-01', kind: 'km', mileage: 120000 },
      { id: 'log:a', date: '2024-01-10', kind: 'onderhoud', title: 'Kleine beurt', cost_cents: 19900, mileage: 80000, note: 'olie + filters' },
    ],
  );
  const lines = txt.split('\n');
  assert.equal(lines[0], 'Onderhoudsboekje — Onze Golf');
  assert.equal(lines[1], 'Volkswagen Golf · 12ABC3 · bouwjaar 2018');
  // oudste eerst: de beurt van 2024 vóór de km-stand van 2026
  assert.equal(lines[3], '10-01-2024 — Kleine beurt · 80000 km · € 199,00');
  assert.equal(lines[4], '   olie + filters');
  assert.equal(lines[5], '01-06-2026 — Km-stand · 120000 km');
});

test('buildLogbookText: lege historie → nette melding', () => {
  const txt = buildLogbookText({ name: 'Polo' }, []);
  assert.ok(txt.includes('Onderhoudsboekje — Polo'));
  assert.ok(txt.includes('Nog geen onderhoud gelogd.'));
});
