// Units voor de jaar-activiteit/heatmap (lib/yearHeatmap.js, TKN-2). De bucketing,
// het raster (kolommen=weken, rand-weken, maandlabels, schaal) en de samenvatting
// (totaal/actieve dagen/streaks/drukste weekdag) moeten kloppen — dit is de "slimme"
// laag onder een puur visuele component, dus hier zit de borging.
//
// Datums worden bewust met de LOKALE Date-constructor gemaakt (new Date(y, m, d, ...)),
// niet met ISO-Z-strings, zodat de dag-bucketing TZ-onafhankelijk deterministisch is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDayKey, countsByDay, levelFor, yearGrid, yearSummary,
  todayColumn, heatmapScrollX,
} from '../lib/yearHeatmap.js';

const at = (y, m, d, h = 12) => new Date(y, m, d, h, 0).toISOString();
const comp = (assignee, y, m, d, category = 'huishouden') =>
  ({ completed_by: assignee, completed_at: at(y, m, d), task: { category } });

test('localDayKey: lokale kalenderdag, nul-gepadde sleutel', () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 9)), '2026-01-05');
  assert.equal(localDayKey(new Date(2026, 11, 31, 23)), '2026-12-31');
  assert.equal(localDayKey('niet-een-datum'), null);
});

test('localDayKey: sleutels sorteren chronologisch als string', () => {
  const keys = ['2026-12-31', '2026-01-05', '2025-06-01'].sort();
  assert.deepEqual(keys, ['2025-06-01', '2026-01-05', '2026-12-31']);
});

test('countsByDay: telt per dag en negeert rijen zonder datum', () => {
  const counts = countsByDay([
    comp('a', 2026, 0, 5),
    comp('a', 2026, 0, 5),
    comp('b', 2026, 0, 6),
    { completed_by: 'a', completed_at: null }, // geen datum → overslaan
  ]);
  assert.equal(counts.get('2026-01-05'), 2);
  assert.equal(counts.get('2026-01-06'), 1);
  assert.equal(counts.size, 2);
});

test('countsByDay: filtert op lid en op categorie', () => {
  const rows = [
    comp('a', 2026, 0, 5, 'huishouden'),
    comp('b', 2026, 0, 5, 'plant'),
    comp('a', 2026, 0, 6, 'plant'),
  ];
  assert.equal(countsByDay(rows, { assigneeId: 'a' }).get('2026-01-05'), 1);
  assert.equal(countsByDay(rows, { assigneeId: 'a' }).size, 2);
  assert.equal(countsByDay(rows, { category: 'plant' }).get('2026-01-05'), 1);
  assert.equal(countsByDay(rows, { category: 'plant' }).get('2026-01-06'), 1);
  assert.equal(countsByDay(rows, { assigneeId: 'a', category: 'plant' }).get('2026-01-06'), 1);
  assert.equal(countsByDay(rows, { assigneeId: 'a', category: 'plant' }).size, 1);
});

test('levelFor: 0 bij geen activiteit, 1 bij lage max, schaalt anders 1..4', () => {
  assert.equal(levelFor(0, 10), 0);
  assert.equal(levelFor(-3, 10), 0);
  assert.equal(levelFor(1, 1), 1);   // max==1 → één tint
  assert.equal(levelFor(1, 4), 1);   // 0.25
  assert.equal(levelFor(2, 4), 2);   // 0.5
  assert.equal(levelFor(3, 4), 3);   // 0.75
  assert.equal(levelFor(4, 4), 4);   // 1.0
});

test('yearGrid: kolommen zijn volle weken (7 rijen), maandag-start', () => {
  const grid = yearGrid(2026, new Map(), { today: new Date(2026, 5, 1) });
  // Elke kolom heeft exact 7 cellen.
  for (const wk of grid.weeks) assert.equal(wk.length, 7);
  // 1 jan 2026 is een donderdag → rij-index 3 bij maandag-start (Ma=0..Zo=6).
  const firstJan = grid.weeks.flat().find((c) => c.key === '2026-01-01');
  assert.ok(firstJan);
  const col0 = grid.weeks[0];
  assert.equal(col0[3].key, '2026-01-01');
  // De cellen vóór 1 jan horen bij dec 2025 en vallen buiten het jaar.
  assert.equal(col0[0].inYear, false);
  assert.equal(col0[0].date.getFullYear(), 2025);
});

test('yearGrid: telling, schaal en niveaus per dag', () => {
  const counts = countsByDay([
    comp('a', 2026, 0, 5), comp('a', 2026, 0, 5), comp('a', 2026, 0, 5), comp('a', 2026, 0, 5), // 4× op 5 jan
    comp('a', 2026, 0, 6), // 1× op 6 jan
  ]);
  const grid = yearGrid(2026, counts, { today: new Date(2026, 5, 1) });
  assert.equal(grid.total, 5);
  assert.equal(grid.maxCount, 4);
  const cells = Object.fromEntries(grid.weeks.flat().filter((c) => c.inYear).map((c) => [c.key, c]));
  assert.equal(cells['2026-01-05'].level, 4); // 4/4
  assert.equal(cells['2026-01-06'].level, 1); // 1/4 → 0.25
  assert.equal(cells['2026-01-07'].count, 0);
  assert.equal(cells['2026-01-07'].level, 0);
});

test('yearGrid: isToday en isFuture markeren correct', () => {
  const grid = yearGrid(2026, new Map(), { today: new Date(2026, 5, 15) });
  const byKey = Object.fromEntries(grid.weeks.flat().map((c) => [c.key, c]));
  assert.equal(byKey['2026-06-15'].isToday, true);
  assert.equal(byKey['2026-06-15'].isFuture, false);
  assert.equal(byKey['2026-06-16'].isFuture, true);
  assert.equal(byKey['2026-06-14'].isFuture, false);
});

test('yearGrid: maandlabels — 12 maanden, oplopend, geen rand-jaar', () => {
  const grid = yearGrid(2026, new Map(), { today: new Date(2026, 5, 1) });
  assert.equal(grid.months.length, 12);
  assert.deepEqual(grid.months.map((m) => m.monthIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // Kolommen lopen strikt op.
  for (let i = 1; i < grid.months.length; i += 1) {
    assert.ok(grid.months[i].col > grid.months[i - 1].col);
  }
});

test('yearSummary: totaal, actieve dagen, weekdag-verdeling', () => {
  const counts = countsByDay([
    comp('a', 2026, 0, 5), comp('a', 2026, 0, 5), // ma 5 jan: 2
    comp('a', 2026, 0, 6),                         // di 6 jan: 1
    comp('a', 2026, 0, 8),                         // do 8 jan: 1
  ]);
  const s = yearSummary(counts, 2026, { today: new Date(2026, 5, 1) });
  assert.equal(s.total, 4);
  assert.equal(s.activeDays, 3);
  // 5 jan 2026 = maandag (getDay 1), 6 jan = di (2), 8 jan = do (4).
  assert.equal(s.byWeekday[1], 2);
  assert.equal(s.byWeekday[2], 1);
  assert.equal(s.byWeekday[4], 1);
  assert.deepEqual(s.busiestWeekday, { weekday: 1, count: 2 });
});

test('yearSummary: langste reeks = langste aaneengesloten run', () => {
  const counts = countsByDay([
    comp('a', 2026, 2, 1), comp('a', 2026, 2, 2), comp('a', 2026, 2, 3), // 3 op rij
    comp('a', 2026, 2, 10), comp('a', 2026, 2, 11),                       // 2 op rij
  ]);
  const s = yearSummary(counts, 2026, { today: new Date(2026, 5, 1) });
  assert.equal(s.longestStreak, 3);
});

test('yearSummary: huidige reeks loopt terug vanaf vandaag (lopend jaar)', () => {
  const counts = countsByDay([
    comp('a', 2026, 5, 13), comp('a', 2026, 5, 14), comp('a', 2026, 5, 15), // t/m vandaag
    comp('a', 2026, 5, 10), // los, breekt de reeks (11/12 leeg)
  ]);
  const s = yearSummary(counts, 2026, { today: new Date(2026, 5, 15) });
  assert.equal(s.currentStreak, 3);
});

test('yearSummary: huidige reeks 0 als vandaag geen activiteit had', () => {
  const counts = countsByDay([comp('a', 2026, 5, 13), comp('a', 2026, 5, 14)]);
  const s = yearSummary(counts, 2026, { today: new Date(2026, 5, 15) }); // 15 leeg
  assert.equal(s.currentStreak, 0);
  assert.equal(s.total, 2);
});

test('yearSummary: toekomstig jaar -> alles nul, geen reeks', () => {
  const counts = countsByDay([comp('a', 2027, 0, 5)]);
  const s = yearSummary(counts, 2027, { today: new Date(2026, 5, 15) });
  assert.equal(s.total, 1);          // de telling zelf klopt
  assert.equal(s.currentStreak, 0);  // maar "vandaag" ligt vóór het jaar
});

test('yearSummary: leeg jaar -> veilige nullen', () => {
  const s = yearSummary(new Map(), 2026, { today: new Date(2026, 5, 1) });
  assert.equal(s.total, 0);
  assert.equal(s.activeDays, 0);
  assert.equal(s.longestStreak, 0);
  assert.equal(s.currentStreak, 0);
  assert.equal(s.busiestWeekday, null);
});

test('todayColumn: kolom-index van de vandaag-cel in het lopende jaar', () => {
  const grid = yearGrid(2026, new Map(), { today: new Date(2026, 5, 15) });
  const col = todayColumn(grid);
  assert.ok(col > 0);
  // De gevonden kolom bevat écht de today-cel, en geen andere kolom doet dat.
  assert.equal(grid.weeks[col].some((c) => c.isToday), true);
  const withToday = grid.weeks.filter((wk) => wk.some((c) => c.isToday)).length;
  assert.equal(withToday, 1);
});

test('todayColumn: vandaag in de eerste week -> kolom 0 (geen -1-verwarring)', () => {
  // 1 jan 2026 = donderdag, valt in kolom 0; "vandaag" daar moet 0 teruggeven.
  const grid = yearGrid(2026, new Map(), { today: new Date(2026, 0, 1) });
  assert.equal(todayColumn(grid), 0);
});

test('todayColumn: -1 voor een afgelopen/toekomstig jaar en lege invoer', () => {
  const past = yearGrid(2025, new Map(), { today: new Date(2026, 5, 15) });
  const future = yearGrid(2027, new Map(), { today: new Date(2026, 5, 15) });
  assert.equal(todayColumn(past), -1);
  assert.equal(todayColumn(future), -1);
  assert.equal(todayColumn(undefined), -1);
  assert.equal(todayColumn({}), -1);
});

test('heatmapScrollX: 0 als er geen today-kolom is of de viewport ongemeten is', () => {
  const base = { gridWidth: 1000, colWidth: 17, labelWidth: 26, padRight: 24 };
  assert.equal(heatmapScrollX({ col: -1, viewportWidth: 300, ...base }), 0);
  assert.equal(heatmapScrollX({ col: 10, viewportWidth: 0, ...base }), 0);
});

test('heatmapScrollX: today vroeg in het jaar -> 0 (al links in beeld)', () => {
  // Rechterrand van kolom 1 (= 26 + 2*17 + 24 = 84) past binnen een 300-brede viewport
  // → desired negatief → geklemd op 0.
  const x = heatmapScrollX({ col: 1, viewportWidth: 300, gridWidth: 1000, colWidth: 17, labelWidth: 26, padRight: 24 });
  assert.equal(x, 0);
});

test('heatmapScrollX: kolom 0 bij een smalle viewport -> tóch scrollen (col<0-grens)', () => {
  // Kolom 0 is geen "geen today" (dat is −1): bij een viewport die smaller is dan
  // label+kolom+lucht moet 'ie wél scrollen. desired = 26 + 1*17 + 24 − 40 = 27.
  const x = heatmapScrollX({ col: 0, viewportWidth: 40, gridWidth: 1000, colWidth: 17, labelWidth: 26, padRight: 24 });
  assert.equal(x, 27);
});

test('heatmapScrollX: geen today (−1) scrollt nooit, ook niet bij een smalle viewport', () => {
  // Zonder de col<0-guard zou de smalle viewport hier 10px scrollen; dat mag niet.
  const x = heatmapScrollX({ col: -1, viewportWidth: 40, gridWidth: 1000, colWidth: 17, labelWidth: 26, padRight: 24 });
  assert.equal(x, 0);
});

test('heatmapScrollX: today in het midden -> kolom rechts uitgelijnd met lucht', () => {
  // desired = labelWidth + (col+1)*colWidth + padRight − viewportWidth
  //         = 26 + 26*17 + 24 − 300 = 26 + 442 + 24 − 300 = 192.
  const x = heatmapScrollX({ col: 25, viewportWidth: 300, gridWidth: 1000, colWidth: 17, labelWidth: 26, padRight: 24 });
  assert.equal(x, 192);
});

test('heatmapScrollX: nooit voorbij het einde — geklemd op contentbreedte − viewport', () => {
  // contentWidth = 26 + 900 + 24 = 950; maxScroll = 950 − 300 = 650.
  // desired voor een late kolom zou hoger zijn, maar wordt op 650 geklemd.
  const x = heatmapScrollX({ col: 60, viewportWidth: 300, gridWidth: 900, colWidth: 17, labelWidth: 26, padRight: 24 });
  assert.equal(x, 650);
});
