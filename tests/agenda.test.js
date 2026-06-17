// Units voor de pure Agenda-helpers (lib/agenda.js). Geen React/Supabase nodig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthMatrix, datedTasks, groupByDate, filterBySubgroup,
  dominantCategory, sortDayTasks, dateKey, monthLabel,
} from '../lib/agenda.js';

test('monthMatrix: altijd 6×7, ma-start, juni 2026 begint op 1 jun (ma)', () => {
  const weeks = monthMatrix(2026, 5); // juni 2026
  assert.equal(weeks.length, 6);
  for (const w of weeks) assert.equal(w.length, 7);
  // 1 juni 2026 is een maandag -> eerste cel van de grid is 1 juni, inMonth true.
  assert.equal(weeks[0][0].key, '2026-06-01');
  assert.equal(weeks[0][0].inMonth, true);
});

test('monthMatrix: uitlopers van naburige maand staan inMonth=false', () => {
  const weeks = monthMatrix(2026, 6); // juli 2026, 1 juli = woensdag
  // ma+di van de eerste week horen bij juni.
  assert.equal(weeks[0][0].inMonth, false); // 29 juni
  assert.equal(weeks[0][2].key, '2026-07-01');
  assert.equal(weeks[0][2].inMonth, true);
});

test('monthMatrix: alle inMonth-cellen samen vormen precies de maand', () => {
  const weeks = monthMatrix(2026, 1); // februari 2026 (28 dagen)
  const inMonth = weeks.flat().filter((c) => c.inMonth);
  assert.equal(inMonth.length, 28);
  assert.equal(inMonth[0].key, '2026-02-01');
  assert.equal(inMonth.at(-1).key, '2026-02-28');
});

test('datedTasks: filtert items zonder due_date weg', () => {
  const tasks = [{ id: 1, due_date: '2026-06-10' }, { id: 2, due_date: null }, { id: 3 }];
  assert.deepEqual(datedTasks(tasks).map((t) => t.id), [1]);
});

test('groupByDate: groepeert per dag, negeert datumloze items', () => {
  const tasks = [
    { id: 1, due_date: '2026-06-10' },
    { id: 2, due_date: '2026-06-10' },
    { id: 3, due_date: '2026-06-11' },
    { id: 4, due_date: null },
  ];
  const g = groupByDate(tasks);
  assert.equal(g['2026-06-10'].length, 2);
  assert.equal(g['2026-06-11'].length, 1);
  assert.equal(g['2026-06-12'], undefined);
});

test('filterBySubgroup: null toont alles; concrete subgroep filtert', () => {
  const tasks = [
    { id: 1, share_subgroup_id: null },
    { id: 2, share_subgroup_id: 'sg-voetbal' },
    { id: 3, share_subgroup_id: 'sg-ouders' },
  ];
  assert.equal(filterBySubgroup(tasks, null).length, 3);
  assert.deepEqual(filterBySubgroup(tasks, 'sg-voetbal').map((t) => t.id), [2]);
});

test('dominantCategory: afspraak wint van de rest, null bij leeg', () => {
  assert.equal(dominantCategory([{ category: 'klus' }, { category: 'afspraak' }]), 'afspraak');
  assert.equal(dominantCategory([{ category: 'plant' }, { category: 'klus' }]), 'klus');
  assert.equal(dominantCategory([]), null);
});

test('sortDayTasks: op tijd, items zonder tijd onderaan, dan titel', () => {
  const out = sortDayTasks([
    { title: 'B', due_time: null },
    { title: 'A', due_time: '09:00' },
    { title: 'C', due_time: '08:00' },
  ]);
  assert.deepEqual(out.map((t) => t.title), ['C', 'A', 'B']);
});

test('dateKey: accepteert string en Date', () => {
  assert.equal(dateKey('2026-06-10'), '2026-06-10');
  assert.equal(dateKey(new Date(2026, 5, 10)), '2026-06-10');
});

test('monthLabel: Nederlands', () => {
  assert.match(monthLabel(2026, 5).toLowerCase(), /juni 2026/);
});
