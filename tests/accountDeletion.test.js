// Units voor de pure beslislogica van account-verwijdering (PLT-11). Zie
// lib/accountDeletion.js. Wat vast moet staan: de drie emmers + prioriteit
// (enig-lid wint van blocked), de grenswaarden (memberCount/ownerCount) en
// de default-on/null-veilige randen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyHouseholds, canDeleteAccount, ROLE_OWNER } from '../lib/accountDeletion.js';

test('classifyHouseholds: enig lid → toDelete (ongeacht rol), inclusief naam', () => {
  const c = classifyHouseholds([
    { householdId: 'h1', name: 'Solo', role: 'owner', memberCount: 1, ownerCount: 1 },
    { householdId: 'h2', name: 'OokSolo', role: 'member', memberCount: 1, ownerCount: 0 },
  ]);
  assert.deepEqual(c.toDelete, [{ householdId: 'h1', name: 'Solo' }, { householdId: 'h2', name: 'OokSolo' }]);
  assert.deepEqual(c.blocked, []);
  assert.deepEqual(c.toLeave, []);
});

test('classifyHouseholds: enige owner met andere leden → blocked', () => {
  const c = classifyHouseholds([{ householdId: 'h1', name: 'Gezin', role: ROLE_OWNER, memberCount: 3, ownerCount: 1 }]);
  assert.deepEqual(c.blocked, [{ householdId: 'h1', name: 'Gezin' }]);
  assert.equal(c.toDelete.length, 0);
  assert.equal(c.toLeave.length, 0);
});

test('classifyHouseholds: mede-owner aanwezig → toLeave (niet blocked)', () => {
  const c = classifyHouseholds([{ householdId: 'h1', name: 'Gezin', role: ROLE_OWNER, memberCount: 3, ownerCount: 2 }]);
  assert.deepEqual(c.toLeave, [{ householdId: 'h1', name: 'Gezin' }]);
  assert.equal(c.blocked.length, 0);
});

test('classifyHouseholds: gewoon lid van een huishouden met anderen → toLeave', () => {
  const c = classifyHouseholds([{ householdId: 'h1', name: 'Gezin', role: 'member', memberCount: 4, ownerCount: 1 }]);
  assert.deepEqual(c.toLeave, [{ householdId: 'h1', name: 'Gezin' }]);
  assert.equal(c.blocked.length, 0);
});

test('classifyHouseholds: grenswaarde — memberCount 2 met enige owner blokkeert; 1 lid nooit', () => {
  // Precies op de rand: 2 leden, jij enige owner → blocked.
  assert.deepEqual(
    classifyHouseholds([{ householdId: 'h1', role: 'owner', memberCount: 2, ownerCount: 1 }]).blocked.map((b) => b.householdId),
    ['h1'],
  );
  // 1 lid → altijd toDelete, ook als je "owner" bent (er is niemand om te blokkeren).
  assert.deepEqual(
    classifyHouseholds([{ householdId: 'h1', role: 'owner', memberCount: 1, ownerCount: 1 }]).toDelete.map((b) => b.householdId),
    ['h1'],
  );
});

test('classifyHouseholds: prioriteit — enig lid wint van de blocked-tak', () => {
  // memberCount 1 maar ownerCount toevallig 1: de toDelete-tak moet eerst pakken.
  const c = classifyHouseholds([{ householdId: 'h1', role: 'owner', memberCount: 1, ownerCount: 1 }]);
  assert.equal(c.toDelete.length, 1);
  assert.equal(c.blocked.length, 0);
});

test('classifyHouseholds: ontbrekende counts → 0 (enig lid), naam default null, kapotte rijen overgeslagen', () => {
  const c = classifyHouseholds([
    { householdId: 'h1', role: 'owner' },       // geen counts → members 0 → toDelete
    { householdId: 'h2', role: 'member', memberCount: 3, ownerCount: 1 },  // naam ontbreekt → null
    null,                                        // kapot → overslaan
    { name: 'geen id' },                         // geen householdId → overslaan
  ]);
  assert.deepEqual(c.toDelete, [{ householdId: 'h1', name: null }]);
  assert.deepEqual(c.toLeave, [{ householdId: 'h2', name: null }]);
  assert.equal(c.blocked.length, 0);
});

test('classifyHouseholds: zonder argument → lege emmers (default-param)', () => {
  assert.deepEqual(classifyHouseholds(), { blocked: [], toDelete: [], toLeave: [] });
});

test('canDeleteAccount: alleen zonder blokkerende huishoudens', () => {
  assert.equal(canDeleteAccount({ blocked: [], toDelete: [{ householdId: 'h1', name: null }], toLeave: [] }), true);
  assert.equal(canDeleteAccount({ blocked: [{ householdId: 'h1', name: 'X' }], toDelete: [], toLeave: [] }), false);
  assert.equal(canDeleteAccount(classifyHouseholds([{ householdId: 'h1', role: 'owner', memberCount: 2, ownerCount: 1 }])), false);
  // Null-veilig: geen classification → mag niet zomaar true zijn behalve lege blocked.
  assert.equal(canDeleteAccount({}), true);
  assert.equal(canDeleteAccount(), true);
});
