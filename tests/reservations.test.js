// Units voor de pure reserverings-/autodeel-logica (lib/reservations.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, hasConflict, onDay, usageParticipants, reservationsByDay } from '../lib/reservations.js';
import { computeShares } from '../lib/expenses.js';

test('overlaps: rakend telt niet, echte overlap wel', () => {
  assert.equal(overlaps('2026-06-18T10:00', '2026-06-18T12:00', '2026-06-18T12:00', '2026-06-18T14:00'), false);
  assert.equal(overlaps('2026-06-18T10:00', '2026-06-18T12:00', '2026-06-18T11:00', '2026-06-18T13:00'), true);
});

test('hasConflict: negeert dezelfde id (bewerken), detecteert botsing', () => {
  const existing = [
    { id: 'r1', starts_at: '2026-06-18T10:00', ends_at: '2026-06-18T12:00' },
    { id: 'r2', starts_at: '2026-06-18T14:00', ends_at: '2026-06-18T16:00' },
  ];
  assert.equal(hasConflict({ id: 'r1', starts_at: '2026-06-18T10:00', ends_at: '2026-06-18T12:00' }, existing), false);
  assert.equal(hasConflict({ starts_at: '2026-06-18T11:00', ends_at: '2026-06-18T11:30' }, existing), true);
  assert.equal(hasConflict({ starts_at: '2026-06-18T12:00', ends_at: '2026-06-18T13:00' }, existing), false);
});

test('onDay: selecteert ook meerdaagse reserveringen', () => {
  const res = [
    { id: 'a', starts_at: '2026-06-17T20:00', ends_at: '2026-06-19T08:00' }, // overspant 18 juni
    { id: 'b', starts_at: '2026-06-20T09:00', ends_at: '2026-06-20T10:00' },
  ];
  const ids = onDay(res, new Date(2026, 5, 18)).map((r) => r.id);
  assert.deepEqual(ids, ['a']);
});

test('reservationsByDay: meerdaags op elke dag; eind op middernacht telt niet mee', () => {
  const res = [
    { id: 'a', starts_at: '2026-06-17T20:00', ends_at: '2026-06-19T08:00' }, // 17,18,19
    { id: 'b', starts_at: '2026-06-20T09:00', ends_at: '2026-06-20T10:00' }, // 20
    { id: 'c', starts_at: '2026-06-22T10:00', ends_at: '2026-06-23T00:00' }, // alleen 22 (eind middernacht)
  ];
  const map = reservationsByDay(res);
  assert.deepEqual(Object.keys(map['2026-06-18'] ?? []).length ? map['2026-06-18'].map((r) => r.id) : [], ['a']);
  assert.deepEqual(map['2026-06-17'].map((r) => r.id), ['a']);
  assert.deepEqual(map['2026-06-19'].map((r) => r.id), ['a']);
  assert.deepEqual(map['2026-06-20'].map((r) => r.id), ['b']);
  assert.deepEqual(map['2026-06-22'].map((r) => r.id), ['c']);
  assert.equal(map['2026-06-23'], undefined, 'eind op middernacht → geen reservering op 23 juni');
});

test('usageParticipants: sommeert per persoon, negeert 0/ontbrekend, voedt computeShares', () => {
  const res = [
    { profile_id: 'erik', usage_value: 120 },
    { profile_id: 'sam', usage_value: 40 },
    { profile_id: 'erik', usage_value: 0 },     // genegeerd
    { profile_id: 'tom', usage_value: null },   // genegeerd
  ];
  const participants = usageParticipants(res);
  assert.deepEqual(participants.sort((a, b) => (a.profileId < b.profileId ? -1 : 1)),
    [{ profileId: 'erik', weight: 120 }, { profileId: 'sam', weight: 40 }]);
  // €80 naar gebruik verdeeld: 120:40 => 6000 / 2000 centen.
  const shares = computeShares({ amountCents: 8000, splitType: 'shares', participants });
  assert.equal(shares['erik'], 6000);
  assert.equal(shares['sam'], 2000);
});
