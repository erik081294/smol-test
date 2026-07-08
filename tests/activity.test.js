// Units voor de pure kern van de activiteitenfeed (PLT-6). Zie lib/activity.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, formatActivity, buildFeed } from '../lib/activity.js';

const NOW = new Date('2026-06-21T12:00:00Z').getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000, UUR = 60 * MIN, DAG = 24 * UUR;

test('relativeTime: NL-drempels', () => {
  assert.equal(relativeTime(ago(10_000), NOW), 'zojuist');
  assert.equal(relativeTime(ago(5 * MIN), NOW), '5 min geleden');
  assert.equal(relativeTime(ago(3 * UUR), NOW), '3 uur geleden');
  assert.equal(relativeTime(ago(1 * DAG), NOW), 'gisteren');
  assert.equal(relativeTime(ago(3 * DAG), NOW), '3 dagen geleden');
  assert.equal(relativeTime(ago(16 * DAG), NOW), '2 wk geleden');
});

test('relativeTime: ongeldige input → lege string', () => {
  assert.equal(relativeTime('niet-een-datum', NOW), '');
});

test('formatActivity: taakvoltooiing → NL-regel + icoon + tijd', () => {
  const item = formatActivity(
    { id: 'c1', type: 'task_completed', at: ago(5 * MIN), actorName: 'Tim', actorId: 'u-tim', taskTitle: 'Stofzuigen' },
    NOW,
  );
  // `type` en `actorId` reizen mee naar de feed: de tijdlijn-filter beslist op
  // event-type/module (TML-6) en op lid/profiel-id (TML-7).
  assert.deepEqual(item, { id: 'c1', type: 'task_completed', at: ago(5 * MIN), actorId: 'u-tim', when: '5 min geleden', icon: 'check', text: "Tim vinkte 'Stofzuigen' af" });
});

test('formatActivity: zonder actorId → null op het feed-item (member-as slaat het item dan over)', () => {
  const item = formatActivity({ id: 'c9', type: 'task_completed', at: ago(MIN), actorName: 'Tim', taskTitle: 'Afwassen' }, NOW);
  assert.equal(item.actorId, null);
});

test('formatActivity: zonder actor → "Iemand"; zonder titel → null', () => {
  const noActor = formatActivity({ id: 'c2', type: 'task_completed', at: ago(MIN), taskTitle: 'Afwassen' }, NOW);
  assert.equal(noActor.text, "Iemand vinkte 'Afwassen' af");
  assert.equal(formatActivity({ id: 'c3', type: 'task_completed', at: ago(MIN), actorName: 'Tim' }, NOW), null);
});

test('formatActivity: onbekend type → null', () => {
  assert.equal(formatActivity({ id: 'x', type: 'iets_anders', at: ago(MIN) }, NOW), null);
});

test('buildFeed: filtert ongeldige events en sorteert nieuwste eerst', () => {
  const feed = buildFeed([
    { id: 'a', type: 'task_completed', at: ago(3 * UUR), actorName: 'Tim', taskTitle: 'Oud' },
    { id: 'b', type: 'task_completed', at: ago(2 * MIN), actorName: 'Ann', taskTitle: 'Nieuw' },
    { id: 'c', type: 'onbekend', at: ago(MIN) },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['b', 'a']);
  assert.equal(feed.length, 2);
  // Elk feed-item draagt zijn event-type (waar de tijdlijn-filter op beslist).
  assert.deepEqual(feed.map((f) => f.type), ['task_completed', 'task_completed']);
});

test('buildFeed: vouwt opeenvolgende identieke acties samen met teller', () => {
  const feed = buildFeed([
    { id: 'b1', type: 'task_completed', at: ago(1 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'b2', type: 'task_completed', at: ago(2 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'b3', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 3);
  assert.equal(feed[0].text, "Tim vinkte 'Badkamer' 3× af");
  // tijd/id van het nieuwste event in de groep
  assert.equal(feed[0].id, 'b1');
  assert.equal(feed[0].when, '1 min geleden');
});

test('buildFeed: ander event ertussen breekt de groep (chronologie blijft)', () => {
  const feed = buildFeed([
    { id: 'x1', type: 'task_completed', at: ago(1 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
    { id: 'y',  type: 'task_completed', at: ago(2 * MIN), actorName: 'Ann', taskTitle: 'Afwas' },
    { id: 'x2', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', taskTitle: 'Badkamer' },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['x1', 'y', 'x2']);
  assert.equal(feed.every((f) => !f.count), true); // geen enkele groep > 1
});

test('buildFeed: gelijke timestamps krijgen een stabiele id-tie-break (deterministisch)', () => {
  const at = ago(5 * MIN);
  const e1 = { id: 'a', type: 'task_completed', at, actorName: 'Tim', taskTitle: 'X' };
  const e2 = { id: 'b', type: 'task_completed', at, actorName: 'Ann', taskTitle: 'Y' };
  // Beide invoervolgordes leveren exact dezelfde feed-volgorde (id desc bij gelijk tijdstip);
  // zonder de tie-break zou de uitkomst van de invoervolgorde afhangen.
  assert.deepEqual(buildFeed([e1, e2], NOW).map((f) => f.id), ['b', 'a']);
  assert.deepEqual(buildFeed([e2, e1], NOW).map((f) => f.id), ['b', 'a']);
});

test('formatActivity: uitgave-event → NL-regel met bedrag (subject)', () => {
  const item = formatActivity(
    { id: 'e1', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Boodschappen', amountText: '€ 12,50' },
    NOW,
  );
  assert.equal(item.icon, 'expenses');
  assert.equal(item.text, "Ann voegde uitgave 'Boodschappen' toe (€ 12,50)");
});

test('formatActivity: boodschap-event → NL-regel (subject); zonder subject → null', () => {
  const ok = formatActivity({ id: 'g1', type: 'grocery_added', at: ago(MIN), actorName: 'Tim', subject: 'Melk' }, NOW);
  assert.equal(ok.icon, 'shopping');
  assert.equal(ok.text, "Tim zette 'Melk' op de lijst");
  assert.equal(formatActivity({ id: 'g2', type: 'grocery_added', at: ago(MIN), actorName: 'Tim' }, NOW), null);
});

test('formatActivity: uitgave zonder actor → "Iemand", zonder bedrag → geen haakjes', () => {
  const item = formatActivity({ id: 'e0', type: 'expense_added', at: ago(MIN), subject: 'Benzine' }, NOW);
  assert.equal(item.text, "Iemand voegde uitgave 'Benzine' toe");
  assert.equal('count' in item, false);
});

test('formatActivity: uitgave zonder subject → null', () => {
  assert.equal(formatActivity({ id: 'e9', type: 'expense_added', at: ago(MIN), actorName: 'Ann' }, NOW), null);
});

test('formatActivity: boodschap zonder actor → "Iemand"', () => {
  const item = formatActivity({ id: 'g0', type: 'grocery_added', at: ago(MIN), subject: 'Melk' }, NOW);
  assert.equal(item.text, "Iemand zette 'Melk' op de lijst");
});

test('buildFeed: opeenvolgende identieke uitgaven vouwen samen met teller', () => {
  const feed = buildFeed([
    { id: 'e1', type: 'expense_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Benzine' },
    { id: 'e2', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Benzine' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 2);
  assert.equal(feed[0].text, "Ann voegde uitgave 'Benzine' toe 2×");
});

test('buildFeed: opeenvolgende identieke boodschappen vouwen samen met teller', () => {
  const feed = buildFeed([
    { id: 'g1', type: 'grocery_added', at: ago(1 * MIN), actorName: 'Tim', subject: 'Melk' },
    { id: 'g2', type: 'grocery_added', at: ago(2 * MIN), actorName: 'Tim', subject: 'Melk' },
  ], NOW);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 2);
  assert.equal(feed[0].text, "Tim zette 'Melk' 2× op de lijst");
});

test('formatActivity: plant/huisdier/voertuig "toegevoegd" → juiste regel + icoon', () => {
  assert.deepEqual(
    { ...formatActivity({ id: 'pl1', type: 'plant_added', at: ago(MIN), actorName: 'Ann', subject: 'Monstera' }, NOW) },
    { id: 'pl1', type: 'plant_added', at: ago(MIN), actorId: null, when: '1 min geleden', icon: 'plants', text: "Ann voegde plant 'Monstera' toe" },
  );
  assert.equal(formatActivity({ id: 'pe1', type: 'pet_added', at: ago(MIN), actorName: 'Tim', subject: 'Rex' }, NOW).text, "Tim voegde huisdier 'Rex' toe");
  assert.equal(formatActivity({ id: 'v1', type: 'vehicle_added', at: ago(MIN), actorName: 'Tim', subject: 'Clio' }, NOW).icon, 'voertuig');
  // zonder actor → "Iemand"; zonder subject → null; teller bij samenvouwen.
  assert.equal(formatActivity({ id: 'pl2', type: 'plant_added', at: ago(MIN), subject: 'Varen' }, NOW).text, "Iemand voegde plant 'Varen' toe");
  assert.equal(formatActivity({ id: 'pl3', type: 'plant_added', at: ago(MIN), actorName: 'Ann' }, NOW), null);
  assert.equal(formatActivity({ id: 'pe2', type: 'pet_added', at: ago(MIN), actorName: 'Tim', subject: 'Rex' }, NOW, 2).text, "Tim voegde huisdier 'Rex' toe 2×");
});

test('buildFeed: verschillende uitgaven van hetzelfde lid vouwen NIET samen (subject in groupKey)', () => {
  const feed = buildFeed([
    { id: 'e1', type: 'expense_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Benzine' },
    { id: 'e2', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Boodschappen' },
  ], NOW);
  assert.equal(feed.length, 2);
  assert.equal(feed.every((f) => !f.count), true);
});

test('buildFeed: mengt bronnen en sorteert nieuwste eerst', () => {
  const feed = buildFeed([
    { id: 't1', type: 'task_completed', at: ago(3 * MIN), actorName: 'Tim', subject: 'Stofzuigen' },
    { id: 'g1', type: 'grocery_added', at: ago(1 * MIN), actorName: 'Ann', subject: 'Melk' },
    { id: 'e1', type: 'expense_added', at: ago(2 * MIN), actorName: 'Ann', subject: 'Benzine' },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.id), ['g1', 'e1', 't1']);
});

test('formatActivity: count 1 levert geen teller en geen count-veld', () => {
  const item = formatActivity({ id: 'c1', type: 'task_completed', at: ago(MIN), actorName: 'Tim', taskTitle: 'Stofzuigen' }, NOW, 1);
  assert.equal(item.text, "Tim vinkte 'Stofzuigen' af");
  assert.equal('count' in item, false);
});

// ── Ratchet-verdieping (2026-07-08): de randen die de mutatietest aanwees. ──

test('relativeTime: exacte drempels — 60 min wordt uur, 7 dagen wordt week', () => {
  assert.equal(relativeTime(ago(60 * MIN), NOW), '1 uur geleden');
  assert.equal(relativeTime(ago(59 * MIN), NOW), '59 min geleden');
  assert.equal(relativeTime(ago(7 * DAG), NOW), '1 wk geleden');
  assert.equal(relativeTime(ago(6 * DAG), NOW), '6 dagen geleden');
});

test('formatActivity: whitespace-only actor → "Iemand", whitespace-only subject → null (elke formatter)', () => {
  const cases = [
    ['task_completed', "Iemand vinkte 'X' af"],
    ['expense_added', "Iemand voegde uitgave 'X' toe"],
    ['grocery_added', "Iemand zette 'X' op de lijst"],
    ['plant_added', "Iemand voegde plant 'X' toe"],
  ];
  for (const [type, verwacht] of cases) {
    assert.equal(formatActivity({ id: 'w1', type, at: ago(MIN), actorName: '   ', subject: 'X' }, NOW).text, verwacht);
    assert.equal(formatActivity({ id: 'w2', type, at: ago(MIN), actorName: 'Tim', subject: '   ' }, NOW), null);
  }
  // Iconen van de fabriek-formatters liggen vast.
  assert.equal(formatActivity({ id: 'pe', type: 'pet_added', at: ago(MIN), subject: 'Rex' }, NOW).icon, 'pets');
  assert.equal(formatActivity({ id: 'v', type: 'vehicle_added', at: ago(MIN), actorName: 'Tim', subject: 'Clio' }, NOW).text, "Tim voegde voertuig 'Clio' toe");
});

test('buildFeed: null-events crashen niet; formatter-null (leeg subject) verdwijnt uit de feed', () => {
  const ok = buildFeed([null, { id: 'a', type: 'task_completed', at: ago(MIN), actorName: 'Tim', taskTitle: 'Echt' }], NOW);
  assert.equal(ok.length, 1);
  // Geldig type maar leeg subject: overleeft de type-filter, formatter geeft null → weggefilterd.
  assert.deepEqual(buildFeed([{ id: 'b', type: 'task_completed', at: ago(MIN), actorName: 'Tim' }], NOW), []);
});

test('buildFeed: actor-loze events vouwen samen met lege-naam-events (zelfde groep), niet met een benoemde actor', () => {
  const at = ago(5 * MIN);
  // null-actor en ''-actor → zelfde groupKey → vouwen; 'Tim' begint een eigen groep.
  const feed = buildFeed([
    { id: 'c', type: 'grocery_added', at, subject: 'Melk' },
    { id: 'b', type: 'grocery_added', at, actorName: '', subject: 'Melk' },
    { id: 'a', type: 'grocery_added', at, actorName: 'Tim', subject: 'Melk' },
  ], NOW);
  assert.deepEqual(feed.map((f) => [f.text, f.count ?? 1]), [
    ["Iemand zette 'Melk' 2× op de lijst", 2],
    ["Tim zette 'Melk' op de lijst", 1],
  ]);
});

test('buildFeed: tie-break op id bij exact gelijke tijd — volgorde is deterministisch (id aflopend)', () => {
  const at = ago(10 * MIN);
  const feed = buildFeed([
    { id: 'a', type: 'task_completed', at, actorName: 'Tim', taskTitle: 'Alfa' },
    { id: 'b', type: 'task_completed', at, actorName: 'Tim', taskTitle: 'Bravo' },
    { id: 'c', type: 'task_completed', at, actorName: 'Tim', taskTitle: 'Charlie' },
  ], NOW);
  assert.deepEqual(feed.map((f) => f.text), [
    "Tim vinkte 'Charlie' af",
    "Tim vinkte 'Bravo' af",
    "Tim vinkte 'Alfa' af",
  ]);
});
