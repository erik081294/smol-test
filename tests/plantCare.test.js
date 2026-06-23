// Units voor de pure verzorgingslogica (lib/plantCare.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { season, waterIntervalDays, buildCareTasks, careCard, searchSpecies } from '../lib/plantCare.js';

const MONSTERA = {
  water_days_growing: 7, water_days_resting: 14, feed_weeks_growing: 4,
  light: 'halfschaduw', care_notes: 'Gele blaadjes = te veel water.',
};
const CACTUS = { // geen voeding nodig
  water_days_growing: 14, water_days_resting: 30, feed_weeks_growing: null,
  light: 'vol-zon', care_notes: null,
};

test('season: groei mrt–sep, rust okt–feb (grenzen)', () => {
  assert.equal(season(new Date(2026, 1, 28)), 'resting'); // 28 feb
  assert.equal(season(new Date(2026, 2, 1)), 'growing');  // 1 mrt
  assert.equal(season(new Date(2026, 8, 30)), 'growing'); // 30 sep
  assert.equal(season(new Date(2026, 9, 1)), 'resting');  // 1 okt
});

test('waterIntervalDays: kiest het juiste seizoen', () => {
  assert.equal(waterIntervalDays(MONSTERA, new Date(2026, 5, 1)), 7);   // juni = groei
  assert.equal(waterIntervalDays(MONSTERA, new Date(2026, 11, 1)), 14); // dec = rust
});

test('buildCareTasks: groeiseizoen levert water + voeding', () => {
  const plant = { id: 'p1', name: 'Mostafa', visibility: 'household' };
  const tasks = buildCareTasks(plant, MONSTERA, { startDate: new Date(2026, 5, 1) });
  assert.equal(tasks.length, 2);
  const water = tasks.find((t) => t.title.startsWith('Water'));
  const feed = tasks.find((t) => t.title.startsWith('Voeding'));
  assert.equal(water.recur_freq, 'daily');
  assert.equal(water.recur_interval, 7);
  assert.equal(water.category, 'plant');
  assert.equal(water.plant_id, 'p1');
  assert.equal(feed.recur_freq, 'weekly');
  assert.equal(feed.recur_interval, 4);
});

test('buildCareTasks: rustseizoen levert alleen water', () => {
  const plant = { id: 'p1', name: 'Mostafa', visibility: 'household' };
  const tasks = buildCareTasks(plant, MONSTERA, { startDate: new Date(2026, 11, 1) });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].recur_interval, 14);
});

test('buildCareTasks: geen voeding als de soort het niet nodig heeft (ook in groei)', () => {
  const plant = { id: 'c1', name: 'Stekel', visibility: 'household' };
  const tasks = buildCareTasks(plant, CACTUS, { startDate: new Date(2026, 5, 1) });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].recur_interval, 14);
});

test('buildCareTasks: erft de zichtbaarheid van de plant', () => {
  const plant = { id: 'p1', name: 'Geheim', visibility: 'subgroup', share_subgroup_id: 'sg1' };
  const [water] = buildCareTasks(plant, MONSTERA, { startDate: new Date(2026, 5, 1) });
  assert.equal(water.visibility, 'subgroup');
  assert.equal(water.share_subgroup_id, 'sg1');
  assert.equal(water.share_with, null);
});

test('buildCareTasks: geen soort -> geen taken', () => {
  assert.deepEqual(buildCareTasks({ id: 'p1', name: 'x' }, null, {}), []);
});

test('careCard: vertaalt regels naar leesbare tekst', () => {
  const card = careCard(MONSTERA, 'woonkamer');
  assert.match(card.waterText, /elke 7 dagen/i);
  assert.match(card.feedText, /4 weken/);
  assert.equal(card.light, 'Halfschaduw');
  assert.equal(card.location, 'woonkamer');
  assert.equal(card.notes, 'Gele blaadjes = te veel water.');
});

test('careCard: zonder soort een nette terugval', () => {
  const card = careCard(null, 'balkon');
  assert.match(card.waterText, /zelf/i);
  assert.equal(card.feedText, '—');
});

test('searchSpecies: zoekt op naam, latijn en search-veld; lege query = alles', () => {
  const list = [
    { common_name: 'Monstera', latin_name: 'Monstera deliciosa', search: 'monstera gatenplant' },
    { common_name: 'Aloë vera', latin_name: 'Aloe vera', search: 'aloe vera' },
  ];
  assert.equal(searchSpecies(list, '').length, 2);
  assert.equal(searchSpecies(list, 'gaten')[0].common_name, 'Monstera');
  assert.equal(searchSpecies(list, 'aloe')[0].common_name, 'Aloë vera');
  assert.equal(searchSpecies(list, 'xyz').length, 0);
});

// --- Aanvullende randgevallen (mutatietest-analyse 2026-06-22).

test('buildCareTasks: household-plant met stale share-velden blijft household (geen lek)', () => {
  const plant = { id: 'p1', name: 'X', visibility: 'household', share_subgroup_id: 'sg-oud', share_with: ['u9'] };
  const [water] = buildCareTasks(plant, MONSTERA, { startDate: new Date(2026, 5, 1) });
  assert.equal(water.share_subgroup_id, null);
  assert.equal(water.share_with, null);
});

test('buildCareTasks: custom-plant erft de gedeelde-met-lijst', () => {
  const plant = { id: 'p1', name: 'X', visibility: 'custom', share_with: ['u1', 'u2'] };
  const [water] = buildCareTasks(plant, MONSTERA, { startDate: new Date(2026, 5, 1) });
  assert.deepEqual(water.share_with, ['u1', 'u2']);
  assert.equal(water.share_subgroup_id, null);
});

test('searchSpecies: trimt+lowercased de query en matcht naam/latijn los van het search-veld', () => {
  assert.equal(searchSpecies([{ common_name: 'Monstera', search: 'monstera gatenplant' }], '  GATEN ')[0].common_name, 'Monstera');
  assert.equal(searchSpecies([{ common_name: 'Ficus' }], 'ficus').length, 1);   // alleen common_name
  assert.equal(searchSpecies([{ latin_name: 'Aloe vera' }], 'aloe').length, 1); // alleen latin_name
});
