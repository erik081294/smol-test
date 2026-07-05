// Unit-tests voor de pure HITL-statusmachine (supabase/functions/assistant/actions.js,
// AI-8). Focus: TTL-grenswaarde (exact op de grens), status-overgangen per besluit,
// selectie-randgevallen (leeg/dubbel/buiten bereik) en de undo-whitelist.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_TTL_SECONDS,
  ACTION_DECISIONS,
  ACTION_STATUSES,
  buildActionContent,
  confirmActionNode,
  isExpired,
  actionState,
  canResolve,
  selectItems,
  undoPlan,
  contentWithStatus,
  UNDO_TABLE_WHITELIST,
} from '../supabase/functions/assistant/actions.js';

const CREATED = '2026-07-05T10:00:00.000Z';
const pendingRow = (over = {}) => ({
  created_at: CREATED,
  content: { v: 1, kind: 'proposal', tool: 'taken_toevoegen', status: 'pending', ...over },
});
const atSeconds = (s) => new Date(Date.parse(CREATED) + s * 1000).toISOString();

test('buildActionContent: volledig audit-spoor met status pending', () => {
  const content = buildActionContent(
    { name: 'taken_toevoegen', moduleKey: 'taken' },
    { summary: 'Taak "X" toevoegen', items: ['X'], args: { items: [{ title: 'X' }] } }
  );
  assert.deepEqual(content, {
    v: 1,
    kind: 'proposal',
    tool: 'taken_toevoegen',
    moduleKey: 'taken',
    summary: 'Taak "X" toevoegen',
    items: ['X'],
    args: { items: [{ title: 'X' }] },
    status: 'pending',
  });
});

test('confirmActionNode: item-teksten krijgen hun index als id (selectie-contract)', () => {
  const node = confirmActionNode('a1', { summary: 'S', items: ['een', 'twee'] });
  assert.deepEqual(node, {
    type: 'confirm_action',
    actionId: 'a1',
    summary: 'S',
    items: [{ id: 0, text: 'een' }, { id: 1, text: 'twee' }],
  });
  assert.deepEqual(confirmActionNode('a1', { summary: 'S' }).items, []);
});

test('isExpired: exact op de TTL-grens nog geldig, één ms erna verlopen; alleen pending verloopt', () => {
  assert.equal(isExpired(pendingRow(), atSeconds(ACTION_TTL_SECONDS)), false);
  assert.equal(isExpired(pendingRow(), atSeconds(ACTION_TTL_SECONDS + 1)), true);
  assert.equal(isExpired(pendingRow({ status: 'done' }), atSeconds(999999)), false);
  // Onleesbare tijden → verlopen (niet uitvoeren wat je niet kunt dateren).
  assert.equal(isExpired({ content: { status: 'pending' }, created_at: 'rommel' }, CREATED), true);
  assert.equal(isExpired(pendingRow(), 'rommel'), true);
});

test('actionState: opgeslagen status telt, verlopen pending toont expired, onbekend → pending', () => {
  for (const status of ACTION_STATUSES) {
    assert.equal(actionState(pendingRow({ status }), atSeconds(1)), status);
  }
  assert.equal(actionState(pendingRow(), atSeconds(ACTION_TTL_SECONDS + 1)), 'expired');
  assert.equal(actionState({ content: { status: 'gek' }, created_at: CREATED }, atSeconds(1)), 'pending');
  assert.equal(actionState({}, atSeconds(1)), 'expired'); // geen created_at → onleesbaar
});

test('constanten: whitelists en statusmachine-vocabulaire liggen exact vast', () => {
  assert.deepEqual(ACTION_DECISIONS, ['confirm', 'reject', 'undo', 'edit']);
  assert.deepEqual(ACTION_STATUSES, ['pending', 'executing', 'done', 'failed', 'rejected', 'undone']);
  assert.equal(ACTION_TTL_SECONDS, 3600);
});

test('canResolve: edit mag alleen op een verse pending (net als confirm/reject)', () => {
  const now = atSeconds(1);
  assert.equal(canResolve(pendingRow(), 'edit', now).ok, true);
  assert.match(canResolve(pendingRow(), 'edit', atSeconds(ACTION_TTL_SECONDS + 1)).error, /verlopen/);
  assert.match(canResolve(pendingRow({ status: 'done' }), 'edit', now).error, /al verwerkt/);
  assert.match(canResolve(pendingRow({ status: 'rejected' }), 'edit', now).error, /al verwerkt/);
});

test('null-veiligheid: een null/lege rij crasht nergens en is nooit uitvoerbaar', () => {
  const now = atSeconds(1);
  assert.equal(isExpired(null, now), true);          // onleesbaar = niet uitvoeren
  assert.equal(isExpired(undefined, now), true);
  assert.equal(actionState(null, now), 'expired');
  assert.equal(canResolve(null, 'confirm', now).ok, false);
  assert.equal(canResolve(undefined, 'undo', now).ok, false);
});

test('canResolve: kind én tool moeten er allebei zijn (geen half proposal uitvoeren)', () => {
  const now = atSeconds(1);
  // kind klopt maar tool ontbreekt → niet gevonden.
  assert.equal(canResolve({ content: { kind: 'proposal', status: 'pending' }, created_at: CREATED }, 'confirm', now).ok, false);
  // tool aanwezig maar kind fout → niet gevonden.
  assert.equal(canResolve({ content: { kind: 'iets', tool: 't', status: 'pending' }, created_at: CREATED }, 'confirm', now).ok, false);
});

test('canResolve: besluit-whitelist en de status-overgangen per besluit', () => {
  const now = atSeconds(1);
  assert.equal(canResolve(pendingRow(), 'weglaten', now).ok, false);
  // Geen proposal-rij (verkeerde kind/tool) → niet gevonden.
  assert.equal(canResolve({ content: { status: 'pending' }, created_at: CREATED }, 'confirm', now).ok, false);
  // confirm/reject: alleen op een verse pending.
  assert.equal(canResolve(pendingRow(), 'confirm', now).ok, true);
  assert.equal(canResolve(pendingRow(), 'reject', now).ok, true);
  assert.match(canResolve(pendingRow(), 'confirm', atSeconds(ACTION_TTL_SECONDS + 1)).error, /verlopen/);
  assert.match(canResolve(pendingRow({ status: 'done' }), 'confirm', now).error, /al verwerkt/);
  assert.match(canResolve(pendingRow({ status: 'rejected' }), 'reject', now).error, /al verwerkt/);
  // undo: alleen op done.
  assert.equal(canResolve(pendingRow({ status: 'done' }), 'undo', now).ok, true);
  assert.match(canResolve(pendingRow(), 'undo', now).error, /niets om ongedaan/);
  assert.match(canResolve(pendingRow({ status: 'undone' }), 'undo', now).error, /niets om ongedaan/);
});

test('selectItems: geen selectie = alles; subset behoudt volgorde en dedupliceert', () => {
  const args = { items: ['a', 'b', 'c'], extra: 1 };
  assert.deepEqual(selectItems(args, undefined), { ok: true, args: { items: ['a', 'b', 'c'], extra: 1 } });
  assert.deepEqual(selectItems(args, null).args.items, ['a', 'b', 'c']);
  assert.deepEqual(selectItems(args, [2, 0, 2]).args.items, ['a', 'c']);
  assert.deepEqual(selectItems(args, [1]).args.items, ['b']);
});

test('selectItems: lege of volledig ongeldige selectie → fout; buiten bereik valt weg', () => {
  const args = { items: ['a', 'b'] };
  assert.equal(selectItems(args, []).ok, false);
  assert.equal(selectItems(args, [9, -1, 0.5]).ok, false);
  assert.deepEqual(selectItems(args, [1, 9]).args.items, ['b']); // geldig deel blijft
  assert.equal(selectItems(args, 'alles').ok, false);
  assert.equal(selectItems({ items: [] }, undefined).ok, false);
  assert.equal(selectItems({}, undefined).ok, false);
  assert.equal(selectItems(null, undefined).ok, false);          // null-args crashen niet
  // Index exact op de lengte is buiten bereik (grens is exclusief).
  assert.equal(selectItems(args, [2]).ok, false);
  assert.deepEqual(selectItems(args, [1, 2]).args.items, ['b']);
});

test('undoPlan: groepeert per tabel binnen de whitelist; alles erbuiten wordt geweigerd', () => {
  assert.deepEqual(UNDO_TABLE_WHITELIST, ['tasks', 'groceries', 'meal_plan_entries']);
  const plan = undoPlan([
    { table: 'tasks', id: 't1' },
    { table: 'groceries', id: 'g1' },
    { table: 'tasks', id: 't2' },
  ]);
  assert.deepEqual(plan, { ok: true, byTable: { tasks: ['t1', 't2'], groceries: ['g1'] } });
  assert.equal(undoPlan([]).ok, false);
  assert.equal(undoPlan().ok, false);
  assert.equal(undoPlan([{ table: 'profiles', id: 'x' }]).ok, false); // buiten whitelist
  assert.equal(undoPlan([{ table: 'tasks' }]).ok, false);             // id ontbreekt
  assert.equal(undoPlan([{ table: 'tasks', id: '' }]).ok, false);
});

test('contentWithStatus: status + extra erbij, de rest van het audit-spoor blijft staan', () => {
  const content = { v: 1, tool: 't', args: { items: [1] }, status: 'pending' };
  const done = contentWithStatus(content, 'done', { result: { summary: 'ok' } });
  assert.deepEqual(done, { v: 1, tool: 't', args: { items: [1] }, status: 'done', result: { summary: 'ok' } });
  assert.equal(content.status, 'pending'); // origineel onaangeroerd (immutable)
  assert.deepEqual(contentWithStatus(content, 'rejected'), { ...content, status: 'rejected' });
});
