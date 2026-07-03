// Units voor de pure huisdier-verzorgingslogica (lib/petCare.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_TYPES, PET_TYPE_KEYS, petType, speciesLabel, careTemplates, defaultCareKeys, buildCareTasks, ageLabel,
  isCareTaskFor, presentCareKeys, diffCareSelection,
} from '../lib/petCare.js';
import { RECUR_VALUES } from '../lib/constants.js';

test('PET_TYPES: vaste set met label + emoji (dekking tegen drift)', () => {
  assert.deepEqual(PET_TYPES, [
    { key: 'hond', label: 'Hond', emoji: '🐕' },
    { key: 'kat', label: 'Kat', emoji: '🐈' },
    { key: 'konijn', label: 'Konijn', emoji: '🐇' },
    { key: 'knaagdier', label: 'Knaagdier', emoji: '🐹' },
    { key: 'vogel', label: 'Vogel', emoji: '🐦' },
    { key: 'vis', label: 'Vis', emoji: '🐠' },
    { key: 'reptiel', label: 'Reptiel', emoji: '🦎' },
    { key: 'anders', label: 'Anders', emoji: '🐾' },
  ]);
  assert.deepEqual(PET_TYPE_KEYS, ['hond', 'kat', 'konijn', 'knaagdier', 'vogel', 'vis', 'reptiel', 'anders']);
  assert.equal(petType('hond').emoji, '🐕');
});

test('speciesLabel: vast type → vaste naam; "anders" + eigen label → het label', () => {
  assert.equal(speciesLabel({ type: 'hond' }), 'Hond');
  assert.equal(speciesLabel({ type: 'anders', species_label: 'Bidsprinkhaan' }), 'Bidsprinkhaan');
  assert.equal(speciesLabel({ type: 'anders' }), 'Anders');
  assert.equal(speciesLabel({ type: 'anders', species_label: '   ' }), 'Anders');
  assert.equal(speciesLabel({ type: 'hond', species_label: 'Wolf' }), 'Hond');
  assert.equal(speciesLabel({}), 'Anders');
  assert.equal(speciesLabel(), 'Anders');
});

test('PET_TYPES: unieke keys en "anders" als terugval', () => {
  const keys = PET_TYPES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('anders'));
  assert.equal(petType('bestaat-niet').key, 'anders'); // terugval
  assert.equal(petType('kat').label, 'Kat');
});

test('elke template gebruikt een geldige RECUR-frequentie en een positief interval', () => {
  const valid = new Set(RECUR_VALUES);
  for (const key of PET_TYPE_KEYS) {
    for (const tpl of careTemplates(key)) {
      assert.ok(valid.has(tpl.freq), `${key}/${tpl.key} heeft ongeldige freq '${tpl.freq}'`);
      assert.ok(Number.isInteger(tpl.interval) && tpl.interval > 0, `${key}/${tpl.key} interval`);
      assert.ok(tpl.title, `${key}/${tpl.key} mist title`);
    }
  }
});

test('template-keys zijn uniek per soort', () => {
  for (const key of PET_TYPE_KEYS) {
    const ks = careTemplates(key).map((t) => t.key);
    assert.equal(new Set(ks).size, ks.length, `dubbele template-key in ${key}`);
  }
});

test('careTemplates valt terug op "anders" bij een onbekende soort', () => {
  assert.deepEqual(careTemplates('xyz'), careTemplates('anders'));
});

test('defaultCareKeys: precies de defaultOn-templates', () => {
  const keys = defaultCareKeys('hond');
  assert.ok(keys.includes('voeren'));
  assert.ok(keys.includes('uitlaten'));
  assert.ok(!keys.includes('borstelen')); // optioneel → uit
});

test('buildCareTasks: default-selectie levert de defaultOn-taken (category huisdier + pet_id)', () => {
  const pet = { id: 'p1', name: 'Rex', type: 'hond', visibility: 'household' };
  const tasks = buildCareTasks(pet, null); // null → defaults
  assert.equal(tasks.length, defaultCareKeys('hond').length);
  for (const t of tasks) {
    assert.equal(t.category, 'huisdier');
    assert.equal(t.pet_id, 'p1');
    assert.ok(t.title.endsWith('— Rex'));
  }
  const ontwormen = tasks.find((t) => t.title.startsWith('Ontwormen'));
  assert.equal(ontwormen.recur_freq, 'monthly');
  assert.equal(ontwormen.recur_interval, 3); // kwartaal
});

test('buildCareTasks: alleen geselecteerde keys, met interval-override', () => {
  const pet = { id: 'p1', name: 'Mauw', type: 'kat', visibility: 'household' };
  const tasks = buildCareTasks(pet, ['voeren'], { overrides: { voeren: 2 } });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].recur_freq, 'daily');
  assert.equal(tasks[0].recur_interval, 2);
});

test('buildCareTasks: een onbekende selectie-key levert geen taak', () => {
  const pet = { id: 'p1', name: 'X', type: 'vis', visibility: 'household' };
  assert.deepEqual(buildCareTasks(pet, ['bestaat-niet']), []);
});

test('buildCareTasks: erft de zichtbaarheid van het dier', () => {
  const pet = { id: 'p1', name: 'Geheim', type: 'hond', visibility: 'subgroup', share_subgroup_id: 'sg1' };
  const [task] = buildCareTasks(pet, ['voeren']);
  assert.equal(task.visibility, 'subgroup');
  assert.equal(task.share_subgroup_id, 'sg1');
  assert.equal(task.share_with, null);
});

test('buildCareTasks: household-dier met stale share-velden lekt niet', () => {
  const pet = { id: 'p1', name: 'X', type: 'hond', visibility: 'household', share_subgroup_id: 'oud', share_with: ['u9'] };
  const [task] = buildCareTasks(pet, ['voeren']);
  assert.equal(task.share_subgroup_id, null);
  assert.equal(task.share_with, null);
});

test('buildCareTasks: interval-override onder 1 wordt opgehoogd naar 1', () => {
  const pet = { id: 'p1', name: 'X', type: 'hond', visibility: 'household' };
  const [task] = buildCareTasks(pet, ['voeren'], { overrides: { voeren: 0 } });
  assert.equal(task.recur_interval, 1);
});

test('buildCareTasks: geen dier → geen taken', () => {
  assert.deepEqual(buildCareTasks(null, ['voeren']), []);
});

test('isCareTaskFor: matcht op de "<titel> — "-prefix (niet op losse substring)', () => {
  const tpl = { title: 'Voeren' };
  assert.equal(isCareTaskFor({ title: 'Voeren — Rex' }, tpl), true);
  assert.equal(isCareTaskFor({ title: 'Voeren' }, tpl), false);        // geen "— naam"
  assert.equal(isCareTaskFor({ title: 'Extra Voeren — Rex' }, tpl), false); // prefix, niet substring
  assert.equal(isCareTaskFor({ title: 'Voeren en water — Rex' }, tpl), false);
  assert.equal(isCareTaskFor({ title: null }, tpl), false);
  assert.equal(isCareTaskFor({}, tpl), false);
  assert.equal(isCareTaskFor(null, tpl), false);
});

test('presentCareKeys: precies de templates met een gekoppelde taak', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }, { key: 'uitlaten', title: 'Uitlaten' }, { key: 'nagels', title: 'Nagels knippen' }];
  const tasks = [{ id: 't1', title: 'Voeren — Rex' }, { id: 't2', title: 'Nagels knippen — Rex' }];
  assert.deepEqual(presentCareKeys(templates, tasks), ['voeren', 'nagels']);
  assert.deepEqual(presentCareKeys(templates, []), []);
});

test('diffCareSelection: nieuw-aangevinkt → toevoegen met interval', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }, { key: 'nagels', title: 'Nagels knippen' }];
  const tasks = []; // nog geen taken
  const selection = { voeren: { on: true, interval: 2 }, nagels: { on: false, interval: 4 } };
  assert.deepEqual(diffCareSelection(templates, tasks, selection), {
    addKeys: ['voeren'], overrides: { voeren: 2 }, removeIds: [],
  });
});

test('diffCareSelection: uitgevinkt wat er wél was → de gekoppelde taak-id\'s verwijderen', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }];
  const tasks = [{ id: 't1', title: 'Voeren — Rex' }, { id: 't2', title: 'Voeren — Rex' }];
  const selection = { voeren: { on: false, interval: 1 } };
  assert.deepEqual(diffCareSelection(templates, tasks, selection), {
    addKeys: [], overrides: {}, removeIds: ['t1', 't2'], // álle gekoppelde taken
  });
});

test('diffCareSelection: aangevinkt dat al bestaat → geen wijziging (geen dubbele taak)', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }];
  const tasks = [{ id: 't1', title: 'Voeren — Rex' }];
  const selection = { voeren: { on: true, interval: 3 } };
  assert.deepEqual(diffCareSelection(templates, tasks, selection), {
    addKeys: [], overrides: {}, removeIds: [],
  });
});

test('diffCareSelection: uitgevinkt dat er niet was → niets te doen', () => {
  const templates = [{ key: 'nagels', title: 'Nagels knippen' }];
  const selection = { nagels: { on: false, interval: 1 } };
  assert.deepEqual(diffCareSelection(templates, [], selection), {
    addKeys: [], overrides: {}, removeIds: [],
  });
});

test('diffCareSelection: template zonder selectie-entry wordt overgeslagen', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }, { key: 'nagels', title: 'Nagels knippen' }];
  const selection = { voeren: { on: true, interval: 1 } }; // 'nagels' ontbreekt
  assert.deepEqual(diffCareSelection(templates, [], selection), {
    addKeys: ['voeren'], overrides: { voeren: 1 }, removeIds: [],
  });
});

test('diffCareSelection: gemengd — tegelijk toevoegen én verwijderen', () => {
  const templates = [{ key: 'voeren', title: 'Voeren' }, { key: 'nagels', title: 'Nagels knippen' }];
  const tasks = [{ id: 't1', title: 'Nagels knippen — Rex' }]; // nagels bestaat, voeren niet
  const selection = { voeren: { on: true, interval: 5 }, nagels: { on: false, interval: 1 } };
  assert.deepEqual(diffCareSelection(templates, tasks, selection), {
    addKeys: ['voeren'], overrides: { voeren: 5 }, removeIds: ['t1'],
  });
});

test('ageLabel: maanden, jaren en samengesteld', () => {
  const now = new Date(2026, 5, 22); // 22 jun 2026
  assert.equal(ageLabel(null, now), null);
  assert.equal(ageLabel('2026-05-22', now), '1 maand');
  assert.equal(ageLabel('2025-10-22', now), '8 maanden');
  assert.equal(ageLabel('2025-07-22', now), '11 maanden'); // net onder de grens (11 < 12)
  assert.equal(ageLabel('2025-06-22', now), '1 jaar');     // exact 12 mnd → jaar (grens)
  assert.equal(ageLabel('2024-04-22', now), '2 jaar, 2 mnd');
});

test('ageLabel: toekomstige datum → null', () => {
  const now = new Date(2026, 5, 22);
  assert.equal(ageLabel('2027-01-01', now), null);
});
