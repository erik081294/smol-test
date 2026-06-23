// Units voor de pure grote-aankopen-logica (lib/decisions.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallyVotes, leadingOption, budgetLabel, withinBudget } from '../lib/decisions.js';

const options = [{ id: 'a', title: 'Optie A' }, { id: 'b', title: 'Optie B' }, { id: 'c', title: 'Optie C' }];

test('tallyVotes: telt, sorteert op count desc, stabiel op id; 0 stemmen -> 0', () => {
  const votes = [{ option_id: 'b' }, { option_id: 'b' }, { option_id: 'a' }, { option_id: 'x' }];
  const t = tallyVotes(options, votes);
  assert.deepEqual(t.map((x) => [x.optionId, x.count]), [['b', 2], ['a', 1], ['c', 0]]);
});

test('leadingOption: winnaar, of null bij gelijkspel/0 stemmen', () => {
  assert.equal(leadingOption(options, [{ option_id: 'a' }]).optionId, 'a');
  assert.equal(leadingOption(options, []), null);
  assert.equal(leadingOption(options, [{ option_id: 'a' }, { option_id: 'b' }]), null); // gelijkspel
});

test('budgetLabel: vier vormen', () => {
  assert.equal(budgetLabel(50000, 80000), '€500,00–€800,00');
  assert.equal(budgetLabel(null, 80000), 'tot €800,00');
  assert.equal(budgetLabel(50000, null), 'vanaf €500,00');
  assert.equal(budgetLabel(null, null), 'Geen budget');
});

test('withinBudget: binnen/boven/onbekend', () => {
  assert.equal(withinBudget(70000, 50000, 80000), 'binnen');
  assert.equal(withinBudget(80000, 50000, 80000), 'binnen'); // grens telt als binnen
  assert.equal(withinBudget(90000, 50000, 80000), 'boven');
  assert.equal(withinBudget(null, 50000, 80000), 'onbekend');
});

// --- Aanvullende randgevallen (toegevoegd n.a.v. de mutatietest-analyse, 2026-06-22).

test('leadingOption: lege opties → null (geen crash)', () => {
  assert.equal(leadingOption([], []), null);
});

test('leadingOption: één optie met stem → die optie (geen valse gelijkspel-check)', () => {
  assert.equal(leadingOption([{ id: 'a', title: 'A' }], [{ option_id: 'a' }]).optionId, 'a');
});

test('withinBudget: zonder maximum is alles binnen', () => {
  assert.equal(withinBudget(90000, 50000, null), 'binnen');
  assert.equal(withinBudget(90000, null, null), 'binnen');
});

test('tallyVotes: id-tie-break onafhankelijk van de optie-volgorde', () => {
  const mk = (ids) => ids.map((id) => ({ id, title: id }));
  assert.deepEqual(tallyVotes(mk(['b', 'a']), []).map((x) => x.optionId), ['a', 'b']);
  assert.deepEqual(tallyVotes(mk(['a', 'b']), []).map((x) => x.optionId), ['a', 'b']);
});
