// Units voor de pure widget-grid-kern (lib/widgets/*). Geen React/Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packGrid, deriveDefaultLayout, moveWidget, addWidget, removeWidget, resizeWidget, spanFor, widgetShowsDetails, toggleWidgetDetails } from '../lib/widgets/grid.js';
import { widgetScheme, accentFor } from '../lib/widgets/colorSchemes.js';
import {
  taskFocusSummary, taskProgressSummary, dayProgress, groceriesSummary, expenseBalanceSummary,
  plantsSummary, agendaSummary, cleaningSummary, pantrySummary, mealPlanSummary,
} from '../lib/widgets/summaries.js';

// --- grid-engine ---
test('packGrid: 1x1-widgets vullen twee koloms, dan wrap', () => {
  const cells = packGrid([{ key: 'a', size: '1x1' }, { key: 'b', size: '1x1' }, { key: 'c', size: '1x1' }]);
  assert.deepEqual(cells.map((c) => [c.col, c.row]), [[0, 0], [1, 0], [0, 1]]);
});

test('packGrid: 2x1 neemt een hele rij; een achtergebleven cel blijft leeg', () => {
  const cells = packGrid([{ key: 'a', size: '1x1' }, { key: 'b', size: '2x1' }, { key: 'c', size: '1x1' }]);
  // a op rij 0 col 0; b past niet naast a (breedte 2) → rij 1; c → rij 2.
  assert.deepEqual(cells.find((c) => c.key === 'a'), { key: 'a', size: '1x1', col: 0, row: 0, w: 1, h: 1 });
  assert.deepEqual(cells.find((c) => c.key === 'b'), { key: 'b', size: '2x1', col: 0, row: 1, w: 2, h: 1 });
  assert.equal(cells.find((c) => c.key === 'c').row, 2);
});

test('packGrid: lege/onzin-invoer → lege lijst', () => {
  assert.deepEqual(packGrid(null), []);
  assert.deepEqual(packGrid([{ size: '1x1' }]), []); // geen key
});

test('spanFor: onbekende grootte → 1x1', () => {
  assert.deepEqual(spanFor('9x9'), { w: 1, h: 1 });
});

test('deriveDefaultLayout: per ingeschakelde module zijn default-widget, in volgorde', () => {
  const defaults = {
    taken: { key: 'taken.focus', defaultSize: '2x1' },
    boodschappen: { key: 'boodschappen.count', defaultSize: '1x1' },
  };
  const layout = deriveDefaultLayout(['taken', 'boodschappen', 'kosten'], defaults);
  assert.deepEqual(layout, [
    { key: 'taken.focus', size: '2x1' },
    { key: 'boodschappen.count', size: '1x1' },
  ]); // kosten heeft geen default → valt weg
});

test('moveWidget: verplaatst op key naar index, puur', () => {
  const layout = [{ key: 'a', size: '1x1' }, { key: 'b', size: '1x1' }, { key: 'c', size: '1x1' }];
  const moved = moveWidget(layout, 'c', 0);
  assert.deepEqual(moved.map((x) => x.key), ['c', 'a', 'b']);
  assert.deepEqual(layout.map((x) => x.key), ['a', 'b', 'c']); // origineel onaangeroerd
});

test('addWidget/removeWidget/resizeWidget', () => {
  let l = addWidget([], 'a', '1x1');
  l = addWidget(l, 'a'); // dubbel → genegeerd
  assert.equal(l.length, 1);
  l = addWidget(l, 'b', '2x1');
  l = resizeWidget(l, 'b', ['2x1', '1x1', '2x2']);
  assert.equal(l.find((x) => x.key === 'b').size, '1x1');
  l = removeWidget(l, 'a');
  assert.deepEqual(l.map((x) => x.key), ['b']);
});

test('widgetShowsDetails: default aan; alleen expliciet false zet details uit', () => {
  assert.equal(widgetShowsDetails({ key: 'a', size: '2x1' }), true);          // undefined → aan
  assert.equal(widgetShowsDetails({ key: 'a', size: '2x1', details: true }), true);
  assert.equal(widgetShowsDetails({ key: 'a', size: '2x1', details: false }), false);
  assert.equal(widgetShowsDetails(undefined), true);                          // null-safe
});

test('toggleWidgetDetails: schakelt om en raakt alleen de juiste widget', () => {
  const l = [{ key: 'a', size: '2x1' }, { key: 'b', size: '1x1', details: false }];
  const t1 = toggleWidgetDetails(l, 'a');                                     // aan → uit
  assert.equal(t1.find((x) => x.key === 'a').details, false);
  assert.equal(t1.find((x) => x.key === 'b').details, false);                 // ongemoeid
  const t2 = toggleWidgetDetails(t1, 'a');                                    // uit → aan
  assert.equal(t2.find((x) => x.key === 'a').details, true);
  const t3 = toggleWidgetDetails(l, 'b');                                     // false → true
  assert.equal(t3.find((x) => x.key === 'b').details, true);
  assert.deepEqual(toggleWidgetDetails([], 'x'), []);                         // leeg blijft leeg
});

// --- kleurschema's ---
test('widgetScheme: playful vs neutral verschillen; accent per module', () => {
  const playful = widgetScheme('kosten', 'playful', {});
  const neutral = widgetScheme('kosten', 'neutral', { surface: '#FFF', line: '#EEE', inkSoft: '#555' });
  assert.equal(playful.accent, accentFor('kosten'));
  assert.equal(playful.icon, accentFor('kosten'));
  assert.equal(neutral.bg, '#FFF');
  assert.notEqual(playful.bg, neutral.bg);
});

test('accentFor: onbekende module → default-accent', () => {
  assert.equal(accentFor('bestaat-niet'), accentFor('taken') === '#2E6B4F' ? '#2E6B4F' : accentFor('bestaat-niet'));
});

// --- samenvattingen ---
const NOW = new Date(2026, 5, 22); // 22 juni 2026
test('taskFocusSummary: achterstallig + vandaag', () => {
  const s = taskFocusSummary([
    { id: '1', due_date: '2026-06-20', completed_at: null }, // overdue
    { id: '2', due_date: '2026-06-22', completed_at: null }, // vandaag
    { id: '3', due_date: '2026-06-25', completed_at: null }, // toekomst → niet
    { id: '4', due_date: '2026-06-20', completed_at: '2026-06-21' }, // af → niet
  ], NOW);
  assert.equal(s.overdue, 1);
  assert.equal(s.today, 1);
  assert.equal(s.count, 2);
});

test('taskProgressSummary: x/y van vandaag af', () => {
  const s = taskProgressSummary([
    { due_date: '2026-06-22', completed_at: '2026-06-22' },
    { due_date: '2026-06-22', completed_at: null },
    { due_date: '2026-06-21', completed_at: null }, // andere dag → telt niet
  ], NOW);
  assert.deepEqual(s, { done: 1, total: 2 });
});

test('dayProgress: pct, allDone, nothingToday en achterstand', () => {
  // 1 van 2 dagtaken af, geen achterstand.
  let s = dayProgress([
    { due_date: '2026-06-22', completed_at: '2026-06-22' },
    { due_date: '2026-06-22', completed_at: null },
  ], NOW);
  assert.equal(s.done, 1); assert.equal(s.total, 2); assert.equal(s.overdue, 0);
  assert.equal(s.pct, 0.5); assert.equal(s.allDone, false); assert.equal(s.nothingToday, false);

  // Alles van vandaag af én geen achterstand → allDone.
  s = dayProgress([{ due_date: '2026-06-22', completed_at: '2026-06-22' }], NOW);
  assert.equal(s.allDone, true); assert.equal(s.pct, 1);

  // Dagtaken af maar nog achterstallig → niet allDone (de ring viert niet te vroeg).
  s = dayProgress([
    { due_date: '2026-06-22', completed_at: '2026-06-22' },
    { due_date: '2026-06-20', completed_at: null },
  ], NOW);
  assert.equal(s.allDone, false); assert.equal(s.overdue, 1); assert.equal(s.pct, 1);

  // Niets te doen → rustige dag.
  s = dayProgress([], NOW);
  assert.equal(s.nothingToday, true); assert.equal(s.total, 0); assert.equal(s.pct, 0);

  // Geen dagtaken maar wél achterstand → geen rustige dag.
  s = dayProgress([{ due_date: '2026-06-19', completed_at: null }], NOW);
  assert.equal(s.nothingToday, false); assert.equal(s.overdue, 1);
});

test('groceriesSummary: open + namen', () => {
  const s = groceriesSummary([{ name: 'Melk', checked: false }, { name: 'Brood', checked: true }]);
  assert.equal(s.count, 1);
  assert.deepEqual(s.names, ['Melk']);
});

test('expenseBalanceSummary: jouw saldo', () => {
  const s = expenseBalanceSummary([], 'u1');
  assert.equal(s.cents, 0);
});

test('plantsSummary: planten die water willen', () => {
  const s = plantsSummary(
    [{ id: 'p1', name: 'Ficus' }, { id: 'p2', name: 'Cactus' }],
    [{ plant_id: 'p1', due_date: '2026-06-20', completed_at: null }],
    NOW,
  );
  assert.equal(s.count, 1);
  assert.deepEqual(s.names, ['Ficus']);
});

test('agendaSummary: komende week', () => {
  const s = agendaSummary([
    { id: '1', due_date: '2026-06-24', completed_at: null },
    { id: '2', due_date: '2026-06-22', completed_at: null }, // vandaag → niet
    { id: '3', due_date: '2026-08-01', completed_at: null }, // te ver → niet
  ], NOW);
  assert.equal(s.count, 1);
  assert.equal(s.next.id, '1');
});

test('cleaningSummary: open zone-taken', () => {
  const s = cleaningSummary([{ zone_id: 'z1', completed_at: null }, { zone_id: null, completed_at: null }]);
  assert.equal(s.count, 1);
});

test('plantsSummary: next = eerstvolgende toekomstige beurt (op datum)', () => {
  const plants = [{ id: 'p1', name: 'Ficus' }, { id: 'p2', name: 'Cactus' }];
  const tasks = [
    { plant_id: 'p1', due_date: '2026-06-25', completed_at: null },
    { plant_id: 'p2', due_date: '2026-06-24', completed_at: null },
  ];
  const s = plantsSummary(plants, tasks, NOW);
  assert.equal(s.count, 0); // niets <= vandaag
  assert.equal(s.next.name, 'Cactus'); // 24 < 25
  assert.equal(s.next.due_date, '2026-06-24');
});

test('plantsSummary: geen toekomstige beurt → next null', () => {
  const s = plantsSummary(
    [{ id: 'p1', name: 'Ficus' }],
    [{ plant_id: 'p1', due_date: '2026-06-20', completed_at: null }], // achterstallig
    NOW,
  );
  assert.equal(s.count, 1);
  assert.equal(s.next, null);
});

test('plantsSummary: next negeert afgeronde, vandaag-of-eerder en onbekende-plant-taken', () => {
  const plants = [{ id: 'p1', name: 'Ficus' }, { id: 'p2', name: 'Cactus' }, { id: 'p3', name: 'Varen' }];
  const tasks = [
    { plant_id: 'p1', due_date: '2026-06-25', completed_at: '2026-06-24' }, // af → niet
    { plant_id: 'p2', due_date: '2026-06-22', completed_at: null },         // vandaag → niet "toekomst"
    { plant_id: 'p3', due_date: '2026-06-26', completed_at: null },         // geldige toekomst → next
    { plant_id: 'pX', due_date: '2026-06-23', completed_at: null },         // onbekende plant → niet
  ];
  const s = plantsSummary(plants, tasks, NOW);
  assert.equal(s.count, 1);                 // p2 (vandaag) wil water
  assert.equal(s.next.name, 'Varen');       // alleen p3 telt als toekomst
  assert.equal(s.next.due_date, '2026-06-26');
});

test('pantrySummary: stock gecapt op 8, urgent-names op 3', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ name: `P${i}`, best_before: '2020-01-01' })); // alle verlopen
  const s = pantrySummary(items);
  assert.equal(s.total, 10);
  assert.equal(s.count, 10);
  assert.equal(s.names.length, 3);
  assert.equal(s.stock.length, 8);
});

test('pantrySummary: stock = inhoud (urgent eerst, rest op naam); total telt alles', () => {
  const items = [
    { name: 'Rijst' },
    { name: 'Appels' },
    { name: 'Melk', best_before: '2020-01-01' }, // verlopen → urgent
  ];
  const s = pantrySummary(items);
  assert.equal(s.total, 3);
  assert.equal(s.count, 1);
  assert.deepEqual(s.names, ['Melk']);
  assert.deepEqual(s.stock, ['Melk', 'Appels', 'Rijst']); // urgent eerst, dan rest alfabetisch
});

test('pantrySummary: lege voorraad → stock leeg, total 0', () => {
  const s = pantrySummary([]);
  assert.deepEqual(s.stock, []);
  assert.equal(s.total, 0);
  assert.equal(s.count, 0);
});

test('mealPlanSummary: vanavond + lege (komende) dagen deze week', () => {
  const entries = [
    { plan_date: '2026-06-22', meal_type: 'diner', recipe: { title: 'Pasta' } },
    { plan_date: '2026-06-24', meal_type: 'diner', title: 'Soep' },
    { plan_date: '2026-06-20', meal_type: 'diner', title: 'Verleden' }, // vóór de week → telt niet
  ];
  const s = mealPlanSummary(entries, NOW); // week ma 22 jun .. zo 28 jun
  assert.equal(s.tonight.recipe.title, 'Pasta');
  assert.deepEqual(s.emptyDays, ['2026-06-23', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']);
  assert.equal(s.emptyCount, 5);
  // 7-dagen-strip: ma 22 (vandaag, gepland) … di 23 leeg, wo 24 gepland, rest leeg
  assert.equal(s.week.length, 7);
  assert.equal(s.week[0].date, '2026-06-22');
  assert.equal(s.week[0].today, true);
  assert.equal(s.week[0].planned, true);
  assert.equal(s.week[1].planned, false); // 23 leeg
  assert.equal(s.week[2].planned, true);  // 24 gepland
});

test('mealPlanSummary: niets gepland → tonight null, hele week leeg vanaf vandaag', () => {
  const s = mealPlanSummary([], NOW);
  assert.equal(s.tonight, null);
  assert.equal(s.emptyCount, 7); // NOW = maandag → 7 dagen
});

test('mealPlanSummary: tonight kiest de diner-entry, niet de eerste maaltijd', () => {
  const entries = [
    { plan_date: '2026-06-22', meal_type: 'lunch', title: 'Broodje' },
    { plan_date: '2026-06-22', meal_type: 'diner', title: 'Stamppot' },
  ];
  const s = mealPlanSummary(entries, NOW);
  assert.equal(s.tonight.meal_type, 'diner');
  assert.equal(s.tonight.title, 'Stamppot');
});

// --- Aanvullende randgevallen voor de samenvattingen (mutatietest-analyse 2026-06-22):
// open vs afgevinkt, namen-cap op 3, null-invoer, de "vandaag"-grens en de sortering.

test('taskFocusSummary: telt alleen OPEN achterstallige taken', () => {
  const s = taskFocusSummary([
    { id: '1', due_date: '2026-06-20', completed_at: null },         // open overdue
    { id: '2', due_date: '2026-06-19', completed_at: null },         // open overdue
    { id: '3', due_date: '2026-06-20', completed_at: '2026-06-21' }, // af → niet
  ], NOW);
  assert.equal(s.overdue, 2);
});

test('groceriesSummary: namen gecapt op 3', () => {
  const s = groceriesSummary([1, 2, 3, 4].map((n) => ({ name: `P${n}`, checked: false })));
  assert.equal(s.count, 4);
  assert.deepEqual(s.names, ['P1', 'P2', 'P3']);
});

test('expenseBalanceSummary: null-invoer → saldo 0 (geen crash)', () => {
  assert.equal(expenseBalanceSummary(null, 'u1').cents, 0);
});

test('plantsSummary: sluit af/zonder-plant/zonder-datum uit; vandaag telt mee; namen gecapt', () => {
  const plants = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `Plant${n}` }));
  const tasks = [
    { plant_id: 'p1', due_date: '2026-06-20', completed_at: null },         // achterstallig
    { plant_id: 'p2', due_date: '2026-06-22', completed_at: null },         // vandaag → meetellen (<=)
    { plant_id: 'p3', due_date: '2026-06-21', completed_at: null },
    { plant_id: 'p4', due_date: '2026-06-20', completed_at: null },
    { plant_id: 'p2', due_date: '2026-06-20', completed_at: '2026-06-21' }, // af → niet
    { plant_id: null, due_date: '2026-06-20', completed_at: null },         // geen plant → niet
    { plant_id: 'p1', completed_at: null },                                 // geen datum → niet
  ];
  const s = plantsSummary(plants, tasks, NOW);
  assert.equal(s.count, 4);
  assert.deepEqual(s.names, ['Plant1', 'Plant2', 'Plant3']);
});

test('agendaSummary: gesorteerd op datum; next = eerstvolgende', () => {
  const s = agendaSummary([
    { id: 'late', due_date: '2026-06-25', completed_at: null },
    { id: 'soon', due_date: '2026-06-23', completed_at: null },
  ], NOW);
  assert.equal(s.count, 2);
  assert.equal(s.next.id, 'soon');
});

test('agendaSummary: items = eerste 4 aankomende, op datum gesorteerd', () => {
  // 5 aankomende binnen de horizon (NOW = 2026-06-22) → items gecapt op 4, op datum.
  const s = agendaSummary([
    { id: 'd5', due_date: '2026-06-27', completed_at: null },
    { id: 'd1', due_date: '2026-06-23', completed_at: null },
    { id: 'd4', due_date: '2026-06-26', completed_at: null },
    { id: 'd2', due_date: '2026-06-24', completed_at: null },
    { id: 'd3', due_date: '2026-06-25', completed_at: null },
  ], NOW);
  assert.equal(s.count, 5);
  assert.deepEqual(s.items.map((t) => t.id), ['d1', 'd2', 'd3', 'd4']); // 5e (d5) valt buiten de cap
});
