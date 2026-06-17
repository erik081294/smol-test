// Units voor de pure klus-bibliotheek + seizoenssuggesties (lib/choreLibrary.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORE_LIBRARY, getChore, yearRoundChores, seasonalChores, groupedChores, choreToTask,
} from '../lib/choreLibrary.js';
import { CATEGORIES, RECUR_VALUES, VISIBILITY } from '../lib/constants.js';

test('elke klus heeft een unieke key, titel, groep en geldige category', () => {
  const keys = CHORE_LIBRARY.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, 'keys moeten uniek zijn');
  for (const c of CHORE_LIBRARY) {
    assert.ok(c.title, `titel ontbreekt voor ${c.key}`);
    assert.ok(c.group, `groep ontbreekt voor ${c.key}`);
    assert.ok(CATEGORIES.includes(c.category), `ongeldige category voor ${c.key}`);
    if (c.recur_freq != null) assert.ok(RECUR_VALUES.includes(c.recur_freq), `ongeldige recur_freq voor ${c.key}`);
  }
});

test('months-velden zijn geldige maandnummers (1..12)', () => {
  for (const c of CHORE_LIBRARY) {
    if (!c.months) continue;
    for (const m of c.months) assert.ok(m >= 1 && m <= 12, `ongeldige maand ${m} in ${c.key}`);
  }
});

test('getChore vindt op key, null bij onbekend', () => {
  assert.equal(getChore('rookmelder').key, 'rookmelder');
  assert.equal(getChore('bestaat-niet'), null);
});

test('yearRoundChores bevat geen seizoensklussen; seizoensklussen hebben months', () => {
  for (const c of yearRoundChores()) assert.ok(!c.months || c.months.length === 0, `${c.key} is seizoensgebonden`);
  // Samen dekken jaar-rond + alle seizoensklussen de hele bibliotheek.
  const seasonalAll = CHORE_LIBRARY.filter((c) => c.months?.length);
  assert.equal(yearRoundChores().length + seasonalAll.length, CHORE_LIBRARY.length);
});

test('seasonalChores geeft alleen klussen voor die maand', () => {
  // Tuinslang aftappen staat op november (11), niet in mei (5).
  const nov = seasonalChores(11).map((c) => c.key);
  assert.ok(nov.includes('tuinslang'));
  const may = seasonalChores(5).map((c) => c.key);
  assert.ok(!may.includes('tuinslang'));
  // Dakgoot staat op zowel april (4) als oktober (10).
  assert.ok(seasonalChores(4).some((c) => c.key === 'dakgoot'));
  assert.ok(seasonalChores(10).some((c) => c.key === 'dakgoot'));
});

test('groupedChores groepeert op group, behoudt eerste-voorkomen-volgorde, alleen jaar-rond', () => {
  const groups = groupedChores();
  assert.deepEqual(groups.map((g) => g.group), ['Veiligheid', 'Onderhoud']);
  const total = groups.reduce((n, g) => n + g.chores.length, 0);
  assert.equal(total, yearRoundChores().length);
});

test('choreToTask: terugkerende klus krijgt freq/interval, datum en household-zichtbaarheid', () => {
  const task = choreToTask(getChore('rookmelder'), { startDate: new Date(2026, 5, 1) });
  assert.equal(task.title, 'Rookmelder testen');
  assert.equal(task.category, 'klus');
  assert.equal(task.recur_freq, 'monthly');
  assert.equal(task.recur_interval, 1);
  assert.equal(task.recur_weekdays, null);
  assert.equal(task.due_date, '2026-06-01');
  assert.equal(task.visibility, VISIBILITY.HOUSEHOLD);
  assert.equal(task.share_subgroup_id, null);
  assert.equal(task.share_with, null);
});

test('choreToTask: eenmalige (seizoens)klus heeft recur_freq null en interval 1', () => {
  const task = choreToTask(getChore('tuinslang'), { startDate: new Date(2026, 10, 1) });
  assert.equal(task.recur_freq, null);
  assert.equal(task.recur_interval, 1);
  assert.equal(task.due_date, '2026-11-01');
  assert.equal(task.notes, getChore('tuinslang').notes);
});
