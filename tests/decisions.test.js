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
