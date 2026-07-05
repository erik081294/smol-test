// Unit-tests voor het Taken-tool-pack (supabase/functions/_shared/tools/taken.js).
// Focus per CLAUDE.md-mutantenpatronen: sorteervolgorde mét omgekeerde invoer,
// default-params, ontbrekende velden en de propose-validatiegrenzen (AI-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAKEN_TOOLS,
  renderOpenTasks,
  proposeAddTasks,
  MAX_PROPOSED_TASKS,
} from '../supabase/functions/_shared/tools/taken.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = (name) => TAKEN_TOOLS.find((t) => t.name === name);

test('renderOpenTasks: sorteert op due_date, zonder datum achteraan — ook bij omgekeerde invoer', () => {
  const rows = [
    { title: 'Zonder datum', due_date: null, assigned_to: null },
    { title: 'Later', due_date: '2026-07-10', assigned_to: 'u2' },
    { title: 'Eerst', due_date: '2026-07-05', assigned_to: 'u1' },
  ];
  const names = { u1: 'Erik', u2: 'Sam' };
  const { data, render } = renderOpenTasks(rows, names);
  assert.deepEqual(data.tasks.map((t) => t.title), ['Eerst', 'Later', 'Zonder datum']);
  // Omgekeerde invoer → zelfde volgorde (anders overleeft de sorteer-vergelijker).
  const reversed = renderOpenTasks([...rows].reverse(), names);
  assert.deepEqual(reversed.data.tasks.map((t) => t.title), ['Eerst', 'Later', 'Zonder datum']);
  assert.equal(render[0].type, 'list');
  assert.equal(render[0].title, 'Open taken (3)');
  assert.deepEqual(render[0].items[0], { text: 'Eerst · 2026-07-05 · Erik' });
  assert.deepEqual(render[0].items[2], { text: 'Zonder datum' });
  assert.equal(data.tasks[2].assignee, null);
});

test('renderOpenTasks: leeg → vriendelijke kaart; default-args', () => {
  const { data, render } = renderOpenTasks();
  assert.equal(data.count, 0);
  assert.deepEqual(render, [{ type: 'card', title: 'Open taken', lines: ['Niets open — lekker bezig!'] }]);
});

test('renderOpenTasks: onbekende assignee-id valt stil weg (geen "undefined" in de regel)', () => {
  const { render } = renderOpenTasks([{ title: 'X', due_date: '2026-07-05', assigned_to: 'onbekend' }], {});
  assert.deepEqual(render[0].items[0], { text: 'X · 2026-07-05' });
});

test('renderOpenTasks: twee taken zonder datum behouden hun invoervolgorde (stabiele sort)', () => {
  const rows = [
    { title: 'Eerste zonder', due_date: null, assigned_to: null },
    { title: 'Met datum', due_date: '2026-07-05', assigned_to: null },
    { title: 'Tweede zonder', due_date: null, assigned_to: null },
  ];
  const { data } = renderOpenTasks(rows, {});
  assert.deepEqual(data.tasks.map((t) => t.title), ['Met datum', 'Eerste zonder', 'Tweede zonder']);
});

test('renderOpenTasks: gelijke due_dates behouden hun invoervolgorde (comparator geeft 0)', () => {
  const rows = [
    { title: 'A', due_date: '2026-07-05', assigned_to: null },
    { title: 'B', due_date: '2026-07-05', assigned_to: null },
    { title: 'C', due_date: '2026-07-01', assigned_to: null },
  ];
  assert.deepEqual(renderOpenTasks(rows).data.tasks.map((t) => t.title), ['C', 'A', 'B']);
  assert.deepEqual(renderOpenTasks([...rows].reverse()).data.tasks.map((t) => t.title), ['C', 'B', 'A']);
});

test('taken_open: filtert op huishouden + open, only_mine voegt assignee-filter toe', async () => {
  const calls = [];
  const out = await tool('taken_open').run(toolCtx({ tasks: [{ title: 'T', due_date: null, assigned_to: 'u1' }] }, calls), { only_mine: true });
  assert.equal(calls[0].table, 'tasks');
  assert.equal(calls[0].selected, 'title, due_date, assigned_to');
  assert.deepEqual(calls[0].filters, [
    ['eq', 'household_id', 'h1'],
    ['is', 'completed_at', null],
    ['eq', 'assigned_to', 'u1'],
  ]);
  assert.deepEqual(calls[0].order, ['due_date', { ascending: true, nullsFirst: false }]);
  assert.equal(out.render[0].items[0].text, 'T · Erik');
});

test('taken_open: zonder only_mine (of false) géén assignee-filter', async () => {
  for (const args of [undefined, {}, { only_mine: false }]) {
    const calls = [];
    await tool('taken_open').run(toolCtx({ tasks: [] }, calls), args);
    assert.deepEqual(calls[0].filters, [
      ['eq', 'household_id', 'h1'],
      ['is', 'completed_at', null],
    ]);
  }
});

test('taken_open: query-fout gooit (de schil vertaalt naar {error}); zonder message → fallback', async () => {
  await assert.rejects(
    () => tool('taken_open').run(toolCtx({}, [], { queryError: { message: 'boem' } })),
    /boem/
  );
  await assert.rejects(
    () => tool('taken_open').run(toolCtx({}, [], { queryError: {} })),
    /query mislukt/
  );
});

// --- proposeAddTasks (AI-8): puur voorstel-bouwwerk, 1-op-1 items/args-uitlijning.

test('proposeAddTasks: normaliseert titel/datum/assignee en lijnt items uit met args.items', () => {
  const out = proposeAddTasks(
    { items: [
      { title: '  Stofzuigen ', due_date: '2026-07-10', assignee_name: 'erik' },
      { title: 'Afwassen' },
    ] },
    { memberNames: { u1: 'Erik', u2: 'Sam' } }
  );
  assert.equal(out.ok, true);
  assert.equal(out.summary, '2 taken toevoegen');
  assert.deepEqual(out.items, ['Stofzuigen · vr 10 jul · Erik', 'Afwassen']);
  assert.deepEqual(out.args.items, [
    { title: 'Stofzuigen', due_date: '2026-07-10', assigned_to: 'u1' },
    { title: 'Afwassen', due_date: null, assigned_to: null },
  ]);
  assert.equal(out.items.length, out.args.items.length);
});

test('proposeAddTasks: één taak → summary met titel', () => {
  const out = proposeAddTasks({ items: [{ title: 'Stofzuigen' }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, 'Taak "Stofzuigen" toevoegen');
});

test('proposeAddTasks: leeg, te veel, titel-loos, te lange titel en foute datum → duidelijke fout', () => {
  assert.equal(proposeAddTasks().ok, false);
  assert.equal(proposeAddTasks({ items: [] }).ok, false);
  const teVeel = { items: Array.from({ length: MAX_PROPOSED_TASKS + 1 }, () => ({ title: 'x' })) };
  assert.match(proposeAddTasks(teVeel).error, /Maximaal 10/);
  // Precies op de grens mag wél (grenswaarde-mutant).
  const precies = { items: Array.from({ length: MAX_PROPOSED_TASKS }, () => ({ title: 'x' })) };
  assert.equal(proposeAddTasks(precies).ok, true);
  assert.match(proposeAddTasks({ items: [{ title: '   ' }] }).error, /titel/);
  assert.equal(proposeAddTasks({ items: [{ title: 'x'.repeat(120) }] }).ok, true);
  assert.match(proposeAddTasks({ items: [{ title: 'x'.repeat(121) }] }).error, /120/);
  assert.match(proposeAddTasks({ items: [{ title: 'x', due_date: '2026-02-31' }] }).error, /Ongeldige datum/);
  assert.match(proposeAddTasks({ items: [{ title: 'x', due_date: 'morgen' }] }).error, /Ongeldige datum/);
});

test('proposeAddTasks: onbekende of dubbelzinnige naam → taak blijft ongekoppeld', () => {
  const twee = { memberNames: { u1: 'Erik', u2: 'erik' } }; // dubbelzinnig (case-insensitief)
  assert.equal(proposeAddTasks({ items: [{ title: 'x', assignee_name: 'Erik' }] }, twee).args.items[0].assigned_to, null);
  assert.equal(proposeAddTasks({ items: [{ title: 'x', assignee_name: 'Onbekend' }] }, { memberNames: { u1: 'Erik' } }).args.items[0].assigned_to, null);
});

test('taken_toevoegen.execute: insert met household/creator, ids terug voor undo', async () => {
  const calls = [];
  const out = await tool('taken_toevoegen').execute(
    toolCtx({}, calls),
    { items: [
      { title: 'Stofzuigen', due_date: '2026-07-10', assigned_to: 'u1' },
      { title: 'Afwassen', due_date: null, assigned_to: null },
    ] }
  );
  assert.equal(calls[0].table, 'tasks');
  assert.deepEqual(calls[0].inserted[0], {
    household_id: 'h1', created_by: 'u1', title: 'Stofzuigen', due_date: '2026-07-10', assigned_to: 'u1',
  });
  assert.equal(out.summary, '2 taken toegevoegd.');
  assert.deepEqual(out.inserted, [{ table: 'tasks', id: 'tasks-1' }, { table: 'tasks', id: 'tasks-2' }]);
});

test('taken_toevoegen.execute: één taak → enkelvoud-summary; insert-fout gooit', async () => {
  const out = await tool('taken_toevoegen').execute(toolCtx({}, []), { items: [{ title: 'X', due_date: null, assigned_to: null }] });
  assert.equal(out.summary, 'Taak toegevoegd.');
  await assert.rejects(
    () => tool('taken_toevoegen').execute(toolCtx({}, [], { insertError: { message: 'rls' } }), { items: [{ title: 'X', due_date: null, assigned_to: null }] }),
    /rls/
  );
});
