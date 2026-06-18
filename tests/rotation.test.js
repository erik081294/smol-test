// Units voor beurtrotatie (lib/rotation.js, KLU-4). De toewijzing moet netjes
// langs de leden rouleren en bij randgevallen (leeg, onbekend, enkel lid) geen
// rare sprongen maken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAssignee } from '../lib/rotation.js';

test('nextAssignee: wrap-around langs de lijst', () => {
  const r = ['a', 'b', 'c'];
  assert.equal(nextAssignee(r, 'a'), 'b');
  assert.equal(nextAssignee(r, 'b'), 'c');
  assert.equal(nextAssignee(r, 'c'), 'a'); // laatste -> eerste
});

test('nextAssignee: current niet in de lijst -> eerste', () => {
  assert.equal(nextAssignee(['a', 'b'], 'z'), 'a');
});

test('nextAssignee: current null -> eerste', () => {
  assert.equal(nextAssignee(['a', 'b'], null), 'a');
});

test('nextAssignee: lege of ontbrekende rotatie -> null', () => {
  assert.equal(nextAssignee([], 'a'), null);
  assert.equal(nextAssignee(undefined, 'a'), null);
  assert.equal(nextAssignee(null, 'a'), null);
});

test('nextAssignee: enkel lid -> zichzelf', () => {
  assert.equal(nextAssignee(['a'], 'a'), 'a');
});

test('nextAssignee: filtert lege gaten (verwijderde leden) weg', () => {
  // Een uitgefilterde rotatie hoort al schoon te zijn, maar wees defensief.
  assert.equal(nextAssignee(['a', null, 'b'], 'a'), 'b');
});
