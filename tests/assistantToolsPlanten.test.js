// Unit-tests voor het Planten-tool-pack (tools/planten.js, AI-19 fase A):
// overzicht-render (eerstvolgende verzorgingstaak per plant) + query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANTEN_TOOLS, PLANTEN_BRIEF, PLANTEN_MANIFEST, renderPlantsOverview, proposeAddPlants, MAX_PROPOSED_PLANTS } from '../supabase/functions/_shared/tools/planten.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = PLANTEN_TOOLS.find((t) => t.name === 'planten_overzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(PLANTEN_BRIEF, {
    moduleKey: 'planten',
    label: 'Planten',
    brief: 'de kamerplanten en hun verzorging; kan het overzicht tonen en planten toevoegen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(PLANTEN_MANIFEST, { moduleKey: 'planten', label: 'Planten', brief: PLANTEN_BRIEF.brief, tools: PLANTEN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'planten_overzicht',
    moduleKey: 'planten',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even langs de planten…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de planten, welke plant water of voeding nodig heeft, of wat er aan plantverzorging openstaat. Toont alle planten met locatie en de eerstvolgende verzorgingstaak.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('renderPlantsOverview: eerstvolgende taak per plant (vroegste due_date wint), locatie optioneel', () => {
  const { data, render } = renderPlantsOverview(
    [
      { id: 'p1', name: 'Monstera', location: 'woonkamer' },
      { id: 'p2', name: 'Ficus', location: null },
    ],
    [
      { plant_id: 'p1', title: 'Water geven', due_date: '2026-07-10' },
      { plant_id: 'p1', title: 'Voeden', due_date: '2026-07-08' },     // vroeger → wint
      { plant_id: 'p1', title: 'Zonder datum', due_date: null },        // telt niet als "volgende"
      { plant_id: null, title: 'Los', due_date: '2026-07-07' },         // geen plant → weg
    ]
  );
  assert.deepEqual(data, {
    count: 2,
    plants: [
      { name: 'Monstera', location: 'woonkamer', next_care: { title: 'Voeden', due_date: '2026-07-08' } },
      { name: 'Ficus', location: null, next_care: null },
    ],
  });
  assert.deepEqual(render[0].items.map((i) => i.text), [
    'Monstera (woonkamer) — Voeden wo 8 jul',
    'Ficus',
  ]);
});

test('renderPlantsOverview: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderPlantsOverview().render, [{ type: 'card', title: 'Planten', lines: ['Er staan nog geen planten in de app.'] }]);
});

test('planten_overzicht: juiste tabellen/kolommen/filters (RLS-scoped, category plant, open taken)', async () => {
  const calls = [];
  await tool.run(toolCtx({ plants: [], tasks: [] }, calls));
  const plantsCall = calls.find((c) => c.table === 'plants');
  const tasksCall = calls.find((c) => c.table === 'tasks');
  assert.equal(plantsCall.selected, 'id, name, location');
  assert.deepEqual(plantsCall.filters, [['eq', 'household_id', 'h1']]);
  assert.equal(tasksCall.selected, 'plant_id, title, due_date');
  assert.deepEqual(tasksCall.filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'category', 'plant'],
    ['is', 'completed_at', null],
    ['not', 'plant_id', 'is', null],
  ]);
});

// --- Fase B: planten_toevoegen (HITL).

test('proposeAddPlants: normaliseert naam/locatie/water_days, items 1-op-1 met args', () => {
  const out = proposeAddPlants({ items: [
    { name: '  Monstera  ', location: ' woonkamer ', water_days: 7 },
    { name: 'Ficus' },
  ] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, '2 planten toevoegen');
  assert.deepEqual(out.items, ['Monstera · woonkamer · water elke 7 dgn', 'Ficus']);
  assert.deepEqual(out.args.items, [
    { name: 'Monstera', location: 'woonkamer', water_days: 7 },
    { name: 'Ficus', location: null, water_days: null },
  ]);
});

test('proposeAddPlants: grenzen — lege naam, te lang, water_days buiten 1-60, cap en default-arg', () => {
  assert.equal(proposeAddPlants({ items: [{ name: '' }] }).ok, false);
  assert.equal(proposeAddPlants({ items: [{ name: 'x'.repeat(81) }] }).ok, false);
  assert.deepEqual(proposeAddPlants({ items: [{ name: 'A', water_days: 0 }] }).args.items[0].water_days, null);
  assert.deepEqual(proposeAddPlants({ items: [{ name: 'A', water_days: 61 }] }).args.items[0].water_days, null);
  assert.equal(proposeAddPlants({ items: [{ name: 'A', water_days: 1 }] }).args.items[0].water_days, 1);
  assert.equal(proposeAddPlants({ items: Array.from({ length: MAX_PROPOSED_PLANTS + 1 }, () => ({ name: 'p' })) }).ok, false);
  assert.equal(proposeAddPlants().ok, false);
});

test('planten_toevoegen: execute schrijft plant + eerste water-taak (undo-spoor beide)', async () => {
  const calls = [];
  const tool2 = PLANTEN_TOOLS.find((t) => t.name === 'planten_toevoegen');
  const out = await tool2.execute(toolCtx({}, calls), { items: [{ name: 'Monstera', location: 'woonkamer', water_days: 7 }] });
  const plantIns = calls.find((c) => c.table === 'plants');
  const taskIns = calls.find((c) => c.table === 'tasks');
  assert.deepEqual(plantIns.inserted, [{ household_id: 'h1', created_by: 'u1', name: 'Monstera', location: 'woonkamer', water_days: 7 }]);
  assert.equal(taskIns.inserted[0].plant_id, 'plants-1');
  assert.equal(taskIns.inserted[0].due_date, '2026-07-11'); // today (2026-07-04) + 7
  assert.equal(taskIns.inserted[0].recur_interval, 7);
  assert.deepEqual(out.inserted, [{ table: 'plants', id: 'plants-1' }, { table: 'tasks', id: 'tasks-1' }]);
});

// Descriptor-contract van de write-tool exact vastpinnen (zelfde reden als bij
// de read-tool: een gewijzigde description verandert de tool-selectie en hoort
// een test te breken — en gaat daarna door de eval-gate).
test('descriptor-contract (write): statische vorm ligt exact vast', () => {
  const w = PLANTEN_TOOLS.find((t) => t.name === 'planten_toevoegen');
  assert.deepEqual(shape(w), {
      "name": "planten_toevoegen",
      "moduleKey": "planten",
      "kind": "write",
      "risk": "write",
      "destructive": false,
      "idempotent": false,
      "statusLabel": "Plant klaarzetten…",
      "description": "Roep dit aan wanneer de gebruiker een plant in de app wil zetten (bv. \"we hebben een nieuwe monstera\"). Stelt de plant voor, optioneel met locatie en een water-interval — bij een interval maakt de app na bevestiging meteen de eerste water-taak aan. De gebruiker beslist op de bevestigingskaart.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "description": "De toe te voegen planten (maximaal 5).",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                  "description": "Naam van de plant, bv. \"Monstera\""
                },
                "location": {
                  "type": "string",
                  "description": "Optionele plek, bv. \"woonkamer\""
                },
                "water_days": {
                  "type": "integer",
                  "description": "Optioneel: om de hoeveel dagen water (1-60)"
                }
              },
              "required": [
                "name"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "items"
        ],
        "additionalProperties": false
      }
    });
});

test('proposeAddPlants: precies op de cap is oké; foutteksten liggen vast', () => {
  assert.equal(proposeAddPlants({ items: Array.from({ length: MAX_PROPOSED_PLANTS }, (_, i) => ({ name: `p${i}` })) }).ok, true);
  assert.equal(proposeAddPlants({ items: [{ name: '' }] }).error, 'Elke plant heeft een naam nodig.');
  assert.equal(proposeAddPlants({ items: [] }).error, 'Geen plant om toe te voegen.');
  assert.equal(proposeAddPlants({ items: [{ name: 'A' }] }).summary, 'Plant "A" toevoegen');
});

// ── Ratchet-verdieping (AI-19 fase C): de randen die de mutatietest aanwees. ──

test('renderPlantsOverview: kapotte taakrijen tellen niet mee; gelijke due_date → eerste wint; teksten liggen vast', () => {
  const { data, render } = renderPlantsOverview(
    [
      { id: 'p1', name: 'Monstera', location: 'woonkamer' },
      { id: 'p2', name: 'Ficus' },
    ],
    [
      null,                                                            // rij null → geen crash
      { title: 'Zwevend', due_date: '2026-07-10' },                    // geen plant_id → weg
      { plant_id: 'p1', title: 42, due_date: '2026-07-10' },           // titel geen string → weg
      { plant_id: 'p1', title: 'Voeding', due_date: '' },              // lege datum → weg
      { plant_id: 'p1', title: 'Zonder datum' },                       // geen datum → weg
      { plant_id: 'p1', title: 'Later', due_date: '2026-07-12' },
      { plant_id: 'p1', title: 'Vroegst', due_date: '2026-07-10' },    // vroegste wint...
      { plant_id: 'p1', title: 'Gelijk', due_date: '2026-07-10' },     // ...en bij gelijk blijft de eerdere staan
    ]
  );
  assert.deepEqual(data.plants, [
    { name: 'Monstera', location: 'woonkamer', next_care: { title: 'Vroegst', due_date: '2026-07-10' } },
    { name: 'Ficus', location: null, next_care: null },
  ]);
  assert.equal(render[0].title, 'Planten (2)');
  assert.deepEqual(render[0].items, [
    { text: 'Monstera (woonkamer) — Vroegst vr 10 jul', emoji: '🪴' },
    { text: 'Ficus', emoji: '🪴' },
  ]);
});

test('planten_overzicht: query-kolommen en sortering liggen vast', async () => {
  const calls = [];
  await tool.run(toolCtx({ plants: [], tasks: [] }, calls));
  const pq = calls.find((c) => c.table === 'plants');
  assert.equal(pq.selected, 'id, name, location');
  assert.deepEqual(pq.order, ['name', undefined]);
  assert.equal(calls.find((c) => c.table === 'tasks').selected, 'plant_id, title, due_date');
});

test('proposeAddPlants: exacte fouttekst per pad; naam-grens 80/81; locatie-cap; water-tekst zonder ruis', () => {
  assert.deepEqual(proposeAddPlants(), { ok: false, error: 'Geen plant om toe te voegen.' });
  const zes = Array.from({ length: 6 }, () => ({ name: 'p' }));
  assert.equal(proposeAddPlants({ items: zes }).error, 'Maximaal 5 planten per voorstel.');
  assert.deepEqual(proposeAddPlants({ items: [null] }), { ok: false, error: 'Elke plant heeft een naam nodig.' });
  assert.equal(proposeAddPlants({ items: [{ name: 'x'.repeat(81) }] }).error, 'Een plantnaam mag maximaal 80 tekens zijn.');
  assert.equal(proposeAddPlants({ items: [{ name: 'x'.repeat(80) }] }).ok, true);   // precies op de grens mag
  assert.equal(proposeAddPlants({ items: [{ name: 'A', location: '   ' }] }).args.items[0].location, null);
  assert.equal(proposeAddPlants({ items: [{ name: 'A', location: 'x'.repeat(90) }] }).args.items[0].location.length, 80);
  assert.equal(proposeAddPlants({ items: [{ name: 'A', water_days: 60 }] }).args.items[0].water_days, 60);
  assert.equal(proposeAddPlants({ items: [{ name: 'A', water_days: 7.5 }] }).args.items[0].water_days, null);
  // Zonder water_days géén "water elke null dgn"-ruis.
  assert.deepEqual(proposeAddPlants({ items: [{ name: 'A', location: 'balkon' }] }).items, ['A · balkon']);
});

test('planten_toevoegen: zonder locatie/water_days een kale insert en géén taak; summary telt alleen planten', async () => {
  const w = PLANTEN_TOOLS.find((t) => t.name === 'planten_toevoegen');
  const calls = [];
  const out = await w.execute(toolCtx({}, calls), { items: [{ name: 'Ficus', location: null, water_days: null }] });
  const plantIns = calls.find((c) => c.table === 'plants');
  assert.deepEqual(plantIns.inserted, [{ household_id: 'h1', created_by: 'u1', name: 'Ficus' }]);
  assert.equal(plantIns.selected, 'id');
  assert.equal(calls.find((c) => c.table === 'tasks'), undefined);   // geen water-interval → geen taak
  assert.equal(out.summary, 'Plant toegevoegd.');
  // Twee planten (één mét water-taak): summary telt alleen de planten, niet de taken.
  const out2 = await w.execute(toolCtx({}, []), { items: [
    { name: 'Monstera', location: null, water_days: 7 },
    { name: 'Ficus', location: null, water_days: null },
  ] });
  assert.equal(out2.summary, '2 planten toegevoegd.');
  assert.equal(out2.inserted.filter((r) => r.table === 'tasks').length, 1);
});

test('planten_toevoegen: de eerste water-taak draagt titel/categorie/recurrence exact', async () => {
  const w = PLANTEN_TOOLS.find((t) => t.name === 'planten_toevoegen');
  const calls = [];
  await w.execute(toolCtx({}, calls), { items: [{ name: 'Monstera', location: null, water_days: 7 }] });
  const taskIns = calls.find((c) => c.table === 'tasks');
  assert.deepEqual(taskIns.inserted, [{
    household_id: 'h1',
    created_by: 'u1',
    title: 'Monstera water geven',
    category: 'plant',
    plant_id: 'plants-1',
    due_date: '2026-07-11',
    recur_freq: 'daily',
    recur_interval: 7,
  }]);
  assert.equal(taskIns.selected, 'id');
});
