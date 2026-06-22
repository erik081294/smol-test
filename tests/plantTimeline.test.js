// Units voor de pure cross-plant-tijdlijn-helpers (lib/plantTimeline.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyOf, groupTimelineByDay, relativeDayLabel } from '../lib/plantTimeline.js';

test('dayKeyOf: ISO-timestamp -> lokale yyyy-MM-dd', () => {
  assert.equal(dayKeyOf('2026-06-22T08:30:00'), '2026-06-22');
  assert.equal(dayKeyOf(new Date(2026, 5, 22, 23, 59)), '2026-06-22');
});

test('dayKeyOf: ongeldige datum -> null', () => {
  assert.equal(dayKeyOf('niet-een-datum'), null);
  assert.equal(dayKeyOf(undefined), null);
});

test('groupTimelineByDay: groepeert opeenvolgende entries van dezelfde dag', () => {
  const entries = [
    { id: 'a', created_at: '2026-06-22T10:00:00' },
    { id: 'b', created_at: '2026-06-22T08:00:00' },
    { id: 'c', created_at: '2026-06-20T12:00:00' },
  ];
  const groups = groupTimelineByDay(entries);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { key: '2026-06-22', entries: [entries[0], entries[1]] });
  assert.deepEqual(groups[1], { key: '2026-06-20', entries: [entries[2]] });
});

test('groupTimelineByDay: behoudt de nieuwste-eerst-volgorde binnen een groep', () => {
  const entries = [
    { id: 'a', created_at: '2026-06-22T10:00:00' },
    { id: 'b', created_at: '2026-06-22T18:00:00' },
  ];
  const [group] = groupTimelineByDay(entries);
  assert.deepEqual(group.entries.map((e) => e.id), ['a', 'b']);
});

test('groupTimelineByDay: lege/null invoer -> lege lijst', () => {
  assert.deepEqual(groupTimelineByDay([]), []);
  assert.deepEqual(groupTimelineByDay(null), []);
});

test('groupTimelineByDay: entry zonder geldige datum valt in "onbekend"', () => {
  const groups = groupTimelineByDay([{ id: 'x', created_at: null }]);
  assert.equal(groups[0].key, 'onbekend');
});

test('relativeDayLabel: vandaag / gisteren / ouder', () => {
  const now = new Date(2026, 5, 22, 9, 0); // 22 juni 2026
  assert.equal(relativeDayLabel('2026-06-22', now), 'today');
  assert.equal(relativeDayLabel('2026-06-21', now), 'yesterday');
  assert.equal(relativeDayLabel('2026-06-20', now), null);
});

test('relativeDayLabel: gisteren over een maandgrens', () => {
  const now = new Date(2026, 6, 1, 9, 0); // 1 juli 2026
  assert.equal(relativeDayLabel('2026-06-30', now), 'yesterday');
});
