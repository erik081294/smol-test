// Tests voor de pure zichtbaarheidshelpers. Draaien met:  npm test
// Deze logica zit ook in de DB (can_view + CHECK + RLS), maar hier toetsen we
// de JS-spiegeling die de UI gebruikt om netjes te valideren en lokaal te filteren.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibilityPayload, validateVisibility, canView } from '../lib/visibility.js';
import { VISIBILITY } from '../lib/constants.js';

// --- visibilityPayload ------------------------------------------------------
test('visibilityPayload: household gooit subgroep en share_with weg', () => {
  const p = visibilityPayload({ visibility: VISIBILITY.HOUSEHOLD, shareSubgroupId: 'sg1', shareWith: ['a'] });
  assert.deepEqual(p, { visibility: 'household', share_subgroup_id: null, share_with: null });
});

test('visibilityPayload: subgroup behoudt alleen de subgroep', () => {
  const p = visibilityPayload({ visibility: VISIBILITY.SUBGROUP, shareSubgroupId: 'sg1', shareWith: ['a'] });
  assert.deepEqual(p, { visibility: 'subgroup', share_subgroup_id: 'sg1', share_with: null });
});

test('visibilityPayload: custom behoudt alleen share_with', () => {
  const p = visibilityPayload({ visibility: VISIBILITY.CUSTOM, shareSubgroupId: 'sg1', shareWith: ['a', 'b'] });
  assert.deepEqual(p, { visibility: 'custom', share_subgroup_id: null, share_with: ['a', 'b'] });
});

test('visibilityPayload: lege invoer valt terug op household', () => {
  const p = visibilityPayload();
  assert.deepEqual(p, { visibility: 'household', share_subgroup_id: null, share_with: null });
});

test('visibilityPayload: payload voldoet altijd aan de DB-CHECK (subgroep <-> share_subgroup_id)', () => {
  for (const v of Object.values(VISIBILITY)) {
    const p = visibilityPayload({ visibility: v, shareSubgroupId: 'sg1', shareWith: ['a'] });
    const ok = (p.visibility === 'subgroup' && p.share_subgroup_id != null)
      || (p.visibility !== 'subgroup' && p.share_subgroup_id == null);
    assert.ok(ok, `consistentie geschonden voor ${v}`);
  }
});

// --- validateVisibility -----------------------------------------------------
test('validateVisibility: household is altijd geldig', () => {
  assert.equal(validateVisibility({ visibility: VISIBILITY.HOUSEHOLD }), null);
});

test('validateVisibility: subgroup zonder gekozen groep faalt', () => {
  assert.match(validateVisibility({ visibility: VISIBILITY.SUBGROUP, shareSubgroupId: null }), /groep/i);
  assert.equal(validateVisibility({ visibility: VISIBILITY.SUBGROUP, shareSubgroupId: 'sg1' }), null);
});

test('validateVisibility: custom zonder personen faalt', () => {
  assert.match(validateVisibility({ visibility: VISIBILITY.CUSTOM, shareWith: [] }), /wie/i);
  assert.equal(validateVisibility({ visibility: VISIBILITY.CUSTOM, shareWith: ['a'] }), null);
});

// --- canView (spiegelt public.can_view) ------------------------------------
const HH = ['me', 'you', 'them'];

test('canView: niet-lid ziet nooit iets', () => {
  assert.equal(canView('outsider', { visibility: 'household' }, { householdMemberIds: HH }), false);
});

test('canView: household zichtbaar voor elk lid', () => {
  assert.equal(canView('you', { visibility: 'household', created_by: 'me' }, { householdMemberIds: HH }), true);
});

test('canView: maker ziet eigen item ongeacht zichtbaarheid', () => {
  assert.equal(canView('me', { visibility: 'custom', created_by: 'me', share_with: [] }, { householdMemberIds: HH }), true);
  assert.equal(canView('me', { visibility: 'subgroup', added_by: 'me' }, { householdMemberIds: HH, subgroupMemberIds: [] }), true);
});

test('canView: subgroup alleen voor subgroepleden', () => {
  const item = { visibility: 'subgroup', created_by: 'me', share_subgroup_id: 'sg1' };
  assert.equal(canView('you', item, { householdMemberIds: HH, subgroupMemberIds: ['you'] }), true);
  assert.equal(canView('them', item, { householdMemberIds: HH, subgroupMemberIds: ['you'] }), false);
});

test('canView: custom alleen voor genoemde personen', () => {
  const item = { visibility: 'custom', created_by: 'me', share_with: ['you'] };
  assert.equal(canView('you', item, { householdMemberIds: HH }), true);
  assert.equal(canView('them', item, { householdMemberIds: HH }), false);
});

test('canView: ontbrekende visibility valt terug op household', () => {
  assert.equal(canView('you', { created_by: 'me' }, { householdMemberIds: HH }), true);
});
