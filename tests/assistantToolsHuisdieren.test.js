// Unit-tests voor het Huisdieren-tool-pack (tools/huisdieren.js, AI-19 fase A):
// leeftijd-spiegel (petAgeLabel), overzicht-render en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUISDIEREN_TOOLS, HUISDIEREN_BRIEF, HUISDIEREN_MANIFEST, petAgeLabel, renderPetsOverview, proposeAddPetLog } from '../supabase/functions/_shared/tools/huisdieren.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_overzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(HUISDIEREN_BRIEF, {
    moduleKey: 'huisdieren',
    label: 'Huisdieren',
    brief: 'de huisdieren en hun verzorging; kan het dierenoverzicht tonen en logboek-regels (gewicht/notitie) toevoegen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(HUISDIEREN_MANIFEST, { moduleKey: 'huisdieren', label: 'Huisdieren', brief: HUISDIEREN_BRIEF.brief, tools: HUISDIEREN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'huisdieren_overzicht',
    moduleKey: 'huisdieren',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even bij de dieren kijken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de huisdieren, hun leeftijd of gewicht, of welke dierverzorging er openstaat. Toont alle huisdieren met soort, leeftijd, laatst gelogde gewicht en het aantal open verzorgingstaken.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('petAgeLabel: maanden onder het jaar, jaren erboven, maandgrens exact', () => {
  assert.equal(petAgeLabel('2025-11-06', '2026-07-06'), '8 mnd');
  assert.equal(petAgeLabel('2025-07-06', '2026-07-06'), '1 jaar');   // precies jarig
  assert.equal(petAgeLabel('2025-07-07', '2026-07-06'), '11 mnd');   // één dag vóór de verjaardag
  assert.equal(petAgeLabel('2023-03-01', '2026-07-06'), '3 jaar');
  assert.equal(petAgeLabel('2026-07-06', '2026-07-06'), '0 mnd');    // vandaag geboren
});

test('petAgeLabel: rommel/toekomst/ontbrekend → null', () => {
  assert.equal(petAgeLabel(null, '2026-07-06'), null);
  assert.equal(petAgeLabel('geen datum', '2026-07-06'), null);
  assert.equal(petAgeLabel('2027-01-01', '2026-07-06'), null);   // toekomst
  assert.equal(petAgeLabel('2025-01-01', ''), null);
});

test('renderPetsOverview: soortlabel-voorkeur, nieuwste gewicht wint, open taken geteld', () => {
  const { data, render } = renderPetsOverview(
    [
      { id: 'd1', name: 'Nala', type: 'hond', species_label: null, birth_date: '2023-07-01' },
      { id: 'd2', name: 'Rex', type: 'anders', species_label: 'Baardagaam', birth_date: null },
    ],
    [
      { pet_id: 'd1', weight_grams: 12500, created_at: '2026-07-01' },   // nieuwste eerst aangeleverd → wint
      { pet_id: 'd1', weight_grams: 11900, created_at: '2026-06-01' },
      { pet_id: 'd2', weight_grams: 0, created_at: '2026-07-01' },       // 0 telt niet
    ],
    [{ pet_id: 'd1' }, { pet_id: 'd1' }, { pet_id: null }],
    '2026-07-06'
  );
  assert.deepEqual(data.pets, [
    { name: 'Nala', type: 'hond', age: '3 jaar', weight_grams: 12500, open_care_tasks: 2 },
    { name: 'Rex', type: 'Baardagaam', age: null, weight_grams: null, open_care_tasks: 0 },
  ]);
  assert.deepEqual(render[0].items.map((i) => i.text), [
    'Nala — hond · 3 jaar · 12,5 kg · 2 open taken',
    'Rex — Baardagaam',
  ]);
});

test('renderPetsOverview: leeg/default → uitnodigende kaart', () => {
  assert.deepEqual(renderPetsOverview().render, [{ type: 'card', title: 'Huisdieren', lines: ['Er staan nog geen huisdieren in de app.'] }]);
});

test('huisdieren_overzicht: juiste tabellen/kolommen/filters', async () => {
  const calls = [];
  await tool.run(toolCtx({ pets: [], pet_log: [], tasks: [] }, calls));
  assert.equal(calls.find((c) => c.table === 'pets').selected, 'id, name, type, species_label, birth_date');
  assert.deepEqual(calls.find((c) => c.table === 'pet_log').filters, [['not', 'weight_grams', 'is', null]]);
  assert.deepEqual(calls.find((c) => c.table === 'tasks').filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'category', 'huisdier'],
    ['is', 'completed_at', null],
    ['not', 'pet_id', 'is', null],
  ]);
});

// --- Fase B: huisdieren_logboek_toevoegen (HITL).

test('proposeAddPetLog: spiegelt de DB-CHECK — minstens notitie of gewicht; gewicht in grammen', () => {
  const out = proposeAddPetLog({ items: [{ pet_name: ' Nala ', weight_grams: 12500 }] });
  assert.equal(out.ok, true);
  assert.equal(out.summary, 'Logboek-regel voor Nala toevoegen');
  assert.deepEqual(out.items, ['Nala · 12,5 kg']);
  assert.deepEqual(out.args.items, [{ pet_name: 'Nala', note: null, weight_grams: 12500 }]);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'Nala' }] }).ok, false);            // niets te loggen
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'Nala', weight_grams: 0 }] }).ok, false);
  assert.equal(proposeAddPetLog({ items: [{ note: 'zonder dier' }] }).ok, false);
  assert.equal(proposeAddPetLog().ok, false);
});

test('huisdieren_logboek_toevoegen: execute matcht dier case-insensitief; onbekend → duidelijke fout', async () => {
  const tool2 = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_logboek_toevoegen');
  const calls = [];
  const out = await tool2.execute(
    toolCtx({ pets: [{ id: 'd1', name: 'Nala' }] }, calls),
    { items: [{ pet_name: 'nala', note: 'alles goed', weight_grams: null }] }
  );
  const ins = calls.find((c) => c.table === 'pet_log');
  assert.deepEqual(ins.inserted, [{ pet_id: 'd1', created_by: 'u1', note: 'alles goed' }]);
  assert.deepEqual(out.inserted, [{ table: 'pet_log', id: 'pet_log-1' }]);
  await assert.rejects(
    () => tool2.execute(toolCtx({ pets: [] }, []), { items: [{ pet_name: 'Spook', note: 'x', weight_grams: null }] }),
    /niet \(eenduidig\) gevonden/
  );
});

// Descriptor-contract van de write-tool exact vastpinnen (zelfde reden als bij
// de read-tool: een gewijzigde description verandert de tool-selectie en hoort
// een test te breken — en gaat daarna door de eval-gate).
test('descriptor-contract (write): statische vorm ligt exact vast', () => {
  const w = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_logboek_toevoegen');
  assert.deepEqual(shape(w), {
      "name": "huisdieren_logboek_toevoegen",
      "moduleKey": "huisdieren",
      "kind": "write",
      "risk": "write",
      "destructive": false,
      "idempotent": false,
      "statusLabel": "Logboek-regel klaarzetten…",
      "description": "Roep dit aan wanneer de gebruiker iets over een huisdier wil vastleggen: een gewicht (\"Nala weegt 12,5 kilo\") of een notitie (\"dierenarts zei dat alles goed is\"). Geef het gewicht in GRAMMEN. De gebruiker beslist op de bevestigingskaart.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "description": "De logboek-regels (meestal één, maximaal 5).",
            "items": {
              "type": "object",
              "properties": {
                "pet_name": {
                  "type": "string",
                  "description": "De naam van het dier, zoals het in de app heet"
                },
                "note": {
                  "type": "string",
                  "description": "Optionele notitie"
                },
                "weight_grams": {
                  "type": "integer",
                  "description": "Optioneel gewicht in grammen (bv. 12500 voor 12,5 kg)"
                }
              },
              "required": [
                "pet_name"
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

test('proposeAddPetLog: precies op de cap is oké; foutteksten liggen vast', () => {
  const vijf = Array.from({ length: 5 }, (_, i) => ({ pet_name: `d${i}`, note: 'x' }));
  assert.equal(proposeAddPetLog({ items: vijf }).ok, true);
  assert.equal(proposeAddPetLog({ items: [...vijf, vijf[0]] }).ok, false);
  assert.equal(proposeAddPetLog({ items: [] }).error, 'Geen logboek-regel om toe te voegen.');
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'Nala' }] }).error, 'Een logboek-regel heeft een notitie of een gewicht (in grammen) nodig.');
  assert.equal(proposeAddPetLog({ items: [{ note: 'los' }] }).error, 'Zeg erbij over wélk dier het gaat.');
});

// ── Ratchet-verdieping (AI-19 fase C): de randen die de mutatietest aanwees. ──

test('petAgeLabel: strikt YYYY-MM-DD aan beide kanten — elke vorm-afwijking → null', () => {
  for (const kapot of ['2026-7-6', 'x2026-07-06', '2026-07-061', '2026-ab-06', '26-07-06']) {
    assert.equal(petAgeLabel(kapot, '2026-07-06'), null);
    assert.equal(petAgeLabel('2025-01-01', kapot), null);
  }
  assert.equal(petAgeLabel('2025-08-06', '2026-07-06'), '11 mnd');   // 11 vs 12: net onder het jaar
  assert.equal(petAgeLabel('2024-07-06', '2026-07-06'), '2 jaar');
});

test('renderPetsOverview: kapotte log-rijen tellen niet mee; enkelvoud "1 open taak"; lege soort → anders', () => {
  const { data, render } = renderPetsOverview(
    [
      { id: 'd1', name: 'Nala', type: null, species_label: '   ', birth_date: null },   // whitespace-label + type null → anders
    ],
    [
      null,                                                        // rij null → geen crash
      { pet_id: 'd1', weight_grams: -5, created_at: '2026-07-01' }, // negatief telt niet
      { pet_id: 'd1', weight_grams: 'zwaar' },                      // geen getal
      { weight_grams: 9000 },                                       // zonder dier
    ],
    [null, { pet_id: 'd1' }],
    ''
  );
  assert.deepEqual(data.pets, [{ name: 'Nala', type: 'anders', age: null, weight_grams: null, open_care_tasks: 1 }]);
  assert.equal(render[0].title, 'Huisdieren (1)');
  assert.deepEqual(render[0].items, [{ text: 'Nala — anders · 1 open taak', emoji: '🐾' }]);
});

test('huisdieren_overzicht: query-kolommen en sortering liggen vast', async () => {
  const calls = [];
  await tool.run(toolCtx({ pets: [], pet_log: [], tasks: [] }, calls));
  const pq = calls.find((c) => c.table === 'pets');
  assert.deepEqual(pq.filters, [['eq', 'household_id', 'h1']]);
  assert.deepEqual(pq.order, ['name', undefined]);
  const lq = calls.find((c) => c.table === 'pet_log');
  assert.equal(lq.selected, 'pet_id, weight_grams, created_at');
  assert.deepEqual(lq.order, ['created_at', { ascending: false }]);
  assert.equal(calls.find((c) => c.table === 'tasks').selected, 'pet_id');
});

test('proposeAddPetLog: exacte fouttekst per pad; notitie-cap 500; gewicht-grenzen 200000/200001; niet-integer → null', () => {
  assert.deepEqual(proposeAddPetLog(), { ok: false, error: 'Geen logboek-regel om toe te voegen.' });
  const zes = Array.from({ length: 6 }, () => ({ pet_name: 'N', note: 'x' }));
  assert.equal(proposeAddPetLog({ items: zes }).error, 'Maximaal 5 regels per voorstel.');
  assert.deepEqual(proposeAddPetLog({ items: [null] }), { ok: false, error: 'Zeg erbij over wélk dier het gaat.' });
  // Whitespace-notitie telt niet als notitie.
  assert.equal(
    proposeAddPetLog({ items: [{ pet_name: 'Nala', note: '   ' }] }).error,
    'Een logboek-regel heeft een notitie of een gewicht (in grammen) nodig.'
  );
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'N', note: 'x'.repeat(550) }] }).args.items[0].note.length, 500);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'N', weight_grams: 200000 }] }).args.items[0].weight_grams, 200000);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'N', weight_grams: 200001, note: 'x' }] }).args.items[0].weight_grams, null);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'N', weight_grams: 12.5, note: 'x' }] }).args.items[0].weight_grams, null);
  assert.equal(proposeAddPetLog({ items: [{ pet_name: 'N', weight_grams: 0, note: 'x' }] }).args.items[0].weight_grams, null);
});

test('proposeAddPetLog: regel-tekst met notitie én gewicht; whitespace-notitie getrimd; meervouds-summary', () => {
  const out = proposeAddPetLog({ items: [{ pet_name: 'Nala', note: ' alles goed ', weight_grams: 12500 }] });
  assert.deepEqual(out.items, ['Nala · 12,5 kg · alles goed']);
  assert.deepEqual(out.args.items, [{ pet_name: 'Nala', note: 'alles goed', weight_grams: 12500 }]);
  const twee = proposeAddPetLog({ items: [{ pet_name: 'Nala', note: 'a' }, { pet_name: 'Rex', note: 'b' }] });
  assert.equal(twee.summary, '2 logboek-regels toevoegen');
  assert.deepEqual(twee.items, ['Nala · a', 'Rex · b']);
});

test('huisdieren_logboek_toevoegen: dubbelzinnig/trim/null-naam; gewicht-only payload; summaries liggen vast', async () => {
  const w = HUISDIEREN_TOOLS.find((t) => t.name === 'huisdieren_logboek_toevoegen');
  const item = { pet_name: ' nala ', note: null, weight_grams: 12500 };
  await assert.rejects(
    () => w.execute(toolCtx({ pets: [{ id: 'd1', name: 'Nala' }, { id: 'd2', name: 'nala' }] }, []), { items: [item] }),
    /"\s?nala\s?" is niet \(eenduidig\) gevonden bij de huisdieren\./
  );
  const calls = [];
  const out = await w.execute(toolCtx({
    pets: [{ id: 'd0', name: null }, { id: 'dX', name: 'Rex' }, { id: 'd1', name: ' Nala ' }],
  }, calls), { items: [item] });
  assert.equal(out.summary, 'In het logboek gezet.');
  assert.equal(calls.find((c) => c.table === 'pets').selected, 'id, name');
  const ins = calls.find((c) => c.table === 'pet_log' && c.inserted);
  assert.deepEqual(ins.inserted[0], { pet_id: 'd1', created_by: 'u1', weight_grams: 12500 });   // note-key ontbreekt
  assert.equal(ins.selected, 'id');
  // Twee regels → meervoud.
  const twee = await w.execute(toolCtx({ pets: [{ id: 'd1', name: 'Nala' }] }, []), {
    items: [{ pet_name: 'Nala', note: 'a', weight_grams: null }, { pet_name: 'Nala', note: 'b', weight_grams: null }],
  });
  assert.equal(twee.summary, '2 logboek-regels toegevoegd.');
});
