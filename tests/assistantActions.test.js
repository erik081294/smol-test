// Unit-tests voor de pure client-onAction-bridge (lib/assistantActions.js, AI-8):
// request-bouw (whitelist), status-afleiding met TTL-grens, tree-stempeling
// (immutable) en de checkbox-toggle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_DECISIONS,
  ACTION_TTL_SECONDS,
  buildResolveBody,
  actionStatusFromRow,
  actionStatusMap,
  stampActionStatus,
  toggleSelection,
  patchActionNode,
  EDITABLE_FIELDS,
  toEditableItems,
  fromEditableItems,
} from '../lib/assistantActions.js';
import { ASSISTANT_TOOLS } from '../supabase/functions/_shared/tools/index.js';

const CREATED = '2026-07-05T10:00:00.000Z';
const atSeconds = (s) => new Date(Date.parse(CREATED) + s * 1000).toISOString();

test('buildResolveBody: alleen whitelist-besluiten; selected alleen als array meegegeven', () => {
  assert.deepEqual(ACTION_DECISIONS, ['confirm', 'reject', 'undo', 'edit']);
  assert.deepEqual(buildResolveBody('a1', 'confirm'), { action: { id: 'a1', decision: 'confirm' } });
  assert.deepEqual(buildResolveBody('a1', 'confirm', [0, 2]), { action: { id: 'a1', decision: 'confirm', selected: [0, 2] } });
  assert.deepEqual(buildResolveBody('a1', 'reject'), { action: { id: 'a1', decision: 'reject' } });
  assert.equal(buildResolveBody('a1', 'execute'), null); // geen verzonnen besluiten
  assert.equal(buildResolveBody('', 'confirm'), null);
  assert.equal(buildResolveBody(undefined, 'confirm'), null);
});

test('actionStatusFromRow: niet-pending status telt letterlijk; pending verloopt exact ná de TTL', () => {
  const row = (status, createdAt = CREATED) => ({ content: { status }, created_at: createdAt });
  assert.equal(actionStatusFromRow(row('done'), atSeconds(999999)), 'done');
  assert.equal(actionStatusFromRow(row('rejected'), atSeconds(1)), 'rejected');
  assert.equal(actionStatusFromRow(row('pending'), atSeconds(ACTION_TTL_SECONDS)), 'pending');
  assert.equal(actionStatusFromRow(row('pending'), atSeconds(ACTION_TTL_SECONDS + 1)), 'expired');
  // Status ontbreekt → als pending behandelen; onleesbare tijd → expired (niet bevestigbaar).
  assert.equal(actionStatusFromRow({ content: {}, created_at: CREATED }, atSeconds(1)), 'pending');
  assert.equal(actionStatusFromRow({ content: {}, created_at: 'rommel' }, atSeconds(1)), 'expired');
});

test('actionStatusMap: rijen zonder id vallen weg; default-args geven een leeg object', () => {
  const rows = [
    { id: 'a1', content: { status: 'done' }, created_at: CREATED },
    { id: '', content: { status: 'pending' }, created_at: CREATED },
    { content: { status: 'pending' }, created_at: CREATED },
  ];
  assert.deepEqual(actionStatusMap(rows, atSeconds(1)), { a1: 'done' });
  assert.deepEqual(actionStatusMap(), {});
});

test('stampActionStatus: stempelt alleen bekende confirm_action-nodes en muteert de invoer niet', () => {
  const tree = [
    { type: 'text', text: 'hoi' },
    { type: 'confirm_action', actionId: 'a1', summary: 'S', status: 'pending' },
    { type: 'confirm_action', actionId: 'onbekend', summary: 'T', status: 'pending' },
  ];
  const stamped = stampActionStatus(tree, { a1: 'done' });
  assert.equal(stamped[1].status, 'done');
  assert.equal(stamped[2].status, 'pending');       // onbekende id blijft staan
  assert.equal(tree[1].status, 'pending');          // origineel onaangeroerd
  assert.equal(stamped[0], tree[0]);                // niet-actie-nodes zelfde referentie
  assert.deepEqual(stampActionStatus(), []);
  assert.deepEqual(stampActionStatus(tree), tree);
});

test('buildResolveBody: edit vereist args en draagt memberNames alleen als die er zijn', () => {
  assert.deepEqual(
    buildResolveBody('a1', 'edit', undefined, { args: { items: [{ name: 'Melk' }] } }),
    { action: { id: 'a1', decision: 'edit', args: { items: [{ name: 'Melk' }] } } }
  );
  assert.deepEqual(
    buildResolveBody('a1', 'edit', undefined, { args: { items: [] }, memberNames: { u1: 'Erik' } }),
    { action: { id: 'a1', decision: 'edit', args: { items: [] }, memberNames: { u1: 'Erik' } } }
  );
  assert.equal(buildResolveBody('a1', 'edit'), null);                       // args verplicht
  assert.equal(buildResolveBody('a1', 'edit', undefined, { args: 'x' }), null);
});

test('patchActionNode: patcht alleen de juiste kaart, immutable, en negeert lege patch-velden', () => {
  const tree = [
    { type: 'text', text: 'hoi' },
    { type: 'confirm_action', actionId: 'a1', summary: 'Oud', items: [{ id: 0, text: 'x' }], status: 'pending' },
  ];
  const patched = patchActionNode(tree, 'a1', { summary: 'Nieuw', items: [{ id: 0, text: 'y' }, { id: 1, text: 'z' }] });
  assert.equal(patched[1].summary, 'Nieuw');
  assert.equal(patched[1].items.length, 2);
  assert.equal(patched[1].status, 'pending');       // onaangeroerd
  assert.equal(tree[1].summary, 'Oud');             // origineel immutable
  assert.equal(patched[0], tree[0]);                // andere nodes zelfde referentie
  assert.equal(patchActionNode(tree, 'onbekend', { summary: 'X' })[1].summary, 'Oud');
  assert.equal(patchActionNode(tree, 'a1', { summary: '' })[1].summary, 'Oud'); // lege summary genegeerd
  assert.deepEqual(patchActionNode(undefined, 'a1', {}), []);
});

test('EDITABLE_FIELDS: elke write-tool in de registry heeft een veldenkaart (edit-contract)', () => {
  for (const tool of ASSISTANT_TOOLS.filter((t) => t.kind === 'write')) {
    const fields = EDITABLE_FIELDS[tool.name];
    assert.ok(Array.isArray(fields) && fields.length > 0, `${tool.name}: geen EDITABLE_FIELDS-entry`);
    for (const f of fields) {
      assert.ok(typeof f.key === 'string' && f.key.length > 0, `${tool.name}: veld zonder key`);
      assert.ok(typeof f.labelKey === 'string' && f.labelKey.startsWith('assistant.edit.'), `${tool.name}/${f.key}: labelKey`);
    }
  }
});

test('toEditableItems: opgeslagen args → invoervorm; assigned_to wordt weer een naam; nulls → ""', () => {
  const out = toEditableItems(
    'taken_toevoegen',
    { items: [
      { title: 'Stofzuigen', due_date: '2026-07-10', assigned_to: 'u1' },
      { title: 'Afwassen', due_date: null, assigned_to: null },
    ] },
    { u1: 'Erik' }
  );
  assert.deepEqual(out, [
    { title: 'Stofzuigen', due_date: '2026-07-10', assignee_name: 'Erik' },
    { title: 'Afwassen', due_date: '', assignee_name: '' },
  ]);
  // Onbekende assigned_to-id → leeg veld (nooit een rauwe uuid tonen).
  assert.equal(toEditableItems('taken_toevoegen', { items: [{ title: 'X', assigned_to: 'weg' }] }, {})[0].assignee_name, '');
  // Servings (int) wordt string voor het invoerveld.
  assert.deepEqual(
    toEditableItems('maaltijden_plannen', { items: [{ date: '2026-07-10', meal_type: 'diner', title: 'Soep', servings: 4 }] }),
    [{ date: '2026-07-10', title: 'Soep', meal_type: 'diner', servings: '4' }]
  );
  assert.deepEqual(toEditableItems('taken_toevoegen'), []);
  assert.deepEqual(toEditableItems('onbekend', { items: [{ x: 1 }] }), [{}]);
});

test('fromEditableItems: lege velden vallen weg, ints geparsed, rommel-ints weggelaten', () => {
  const out = fromEditableItems('maaltijden_plannen', [
    { date: '2026-07-10', title: 'Soep', meal_type: '', servings: '4' },
    { date: '2026-07-11', title: 'Pizza', meal_type: 'lunch', servings: 'veel' },
  ]);
  assert.deepEqual(out, {
    items: [
      { date: '2026-07-10', title: 'Soep', servings: 4 },
      { date: '2026-07-11', title: 'Pizza', meal_type: 'lunch' },
    ],
  });
  assert.deepEqual(fromEditableItems('boodschappen_toevoegen', [{ name: ' Melk ', quantity: '' }]), { items: [{ name: 'Melk' }] });
  assert.deepEqual(fromEditableItems('taken_toevoegen'), { items: [] });
});

test('edit-roundtrip: toEditable → fromEditable levert propose-geldige args op', () => {
  const stored = { items: [{ title: 'Stofzuigen', due_date: '2026-07-10', assigned_to: 'u1' }] };
  const editable = toEditableItems('taken_toevoegen', stored, { u1: 'Erik' });
  const back = fromEditableItems('taken_toevoegen', editable);
  // Zelfde vorm als wat het model zou sturen: propose() moet 'm accepteren.
  const tool = ASSISTANT_TOOLS.find((t) => t.name === 'taken_toevoegen');
  const proposal = tool.propose(back, { memberNames: { u1: 'Erik' } });
  assert.equal(proposal.ok, true);
  assert.deepEqual(proposal.args.items, stored.items);
});

test('CARRY_FIELDS: niet-bewerkbare velden reizen mee bij een edit (recept-ingrediënten, recipe_id)', () => {
  // Recept opslaan: de ingrediënten zijn niet plat bewerkbaar maar propose() eist
  // ze — zonder carry zou bewaren het recept leeg achterlaten.
  const storedRecipe = { items: [{ title: 'Pesto', servings: 4, instructions: 'Kook', ingredients: [{ name: 'Penne', quantity: 400, unit: 'gram' }] }] };
  const editableR = toEditableItems('maaltijden_recept_opslaan', storedRecipe);
  const backR = fromEditableItems('maaltijden_recept_opslaan', editableR, storedRecipe.items);
  assert.deepEqual(backR.items[0].ingredients, [{ name: 'Penne', quantity: 400, unit: 'gram' }]);
  const recipeTool = ASSISTANT_TOOLS.find((t) => t.name === 'maaltijden_recept_opslaan');
  assert.equal(recipeTool.propose(backR).ok, true);

  // Maaltijd inplannen: het recipe_id blijft aan de maaltijd gekoppeld na een edit.
  const storedMeal = { items: [{ date: '2026-07-10', meal_type: 'diner', title: 'Pesto', servings: null, recipe_id: '11111111-1111-1111-1111-111111111111' }] };
  const editableM = toEditableItems('maaltijden_plannen', storedMeal);
  const backM = fromEditableItems('maaltijden_plannen', editableM, storedMeal.items);
  assert.equal(backM.items[0].recipe_id, '11111111-1111-1111-1111-111111111111');

  // Zonder originalItems (oud aanroeppad) blijft het gedrag ongewijzigd: geen carry.
  assert.equal('ingredients' in fromEditableItems('maaltijden_recept_opslaan', editableR).items[0], false);
});

test('toggleSelection: aan/uit, gesorteerd en zonder duplicaten', () => {
  assert.deepEqual(toggleSelection([0, 2], 1), [0, 1, 2]);
  assert.deepEqual(toggleSelection([0, 1, 2], 1), [0, 2]);
  assert.deepEqual(toggleSelection([], 3), [3]);
  assert.deepEqual(toggleSelection(undefined, 0), [0]);
  assert.deepEqual(toggleSelection([2, 2, 0], 1), [0, 1, 2]); // dedupliceert de invoer
});
