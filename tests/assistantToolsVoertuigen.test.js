// Unit-tests voor het Voertuigen-tool-pack (tools/voertuigen.js, AI-19 fase A):
// maand-equivalent-spiegel (monthlyCents), overzicht-render en query-compositie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOERTUIGEN_TOOLS, VOERTUIGEN_BRIEF, VOERTUIGEN_MANIFEST, monthlyCents, renderVehiclesOverview, proposeLogMaintenance } from '../supabase/functions/_shared/tools/voertuigen.js';
import { toolCtx } from './fakeAssistantDb.js';

const tool = VOERTUIGEN_TOOLS.find((t) => t.name === 'voertuigen_overzicht');
const shape = ({ run, propose, execute, ...rest }) => rest;

test('module-brief: ligt exact vast', () => {
  assert.deepEqual(VOERTUIGEN_BRIEF, {
    moduleKey: 'voertuigen',
    label: 'Voertuigen',
    brief: 'de voertuigen van het huishouden; kan km-stand, APK en kosten tonen en onderhoud loggen',
  });
});

test('manifest: composeert moduleKey/label/brief + tools', () => {
  assert.deepEqual(VOERTUIGEN_MANIFEST, { moduleKey: 'voertuigen', label: 'Voertuigen', brief: VOERTUIGEN_BRIEF.brief, tools: VOERTUIGEN_TOOLS });
});

test('descriptor-contract: statische vorm ligt exact vast', () => {
  assert.deepEqual(shape(tool), {
    name: 'voertuigen_overzicht',
    moduleKey: 'voertuigen',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Voertuiggegevens erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar een auto of ander voertuig: km-stand, wanneer de APK verloopt, wat een voertuig per maand kost of wat het laatste onderhoud was. Toont per voertuig een compact overzicht.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  });
});

test('monthlyCents: spiegelt monthlyEquivalentCents (maand/week/dag + interval), rommel → 0', () => {
  assert.equal(monthlyCents(3000, 'monthly'), 3000);
  assert.equal(monthlyCents(3000, 'monthly', 3), 1000);           // elke 3 maanden
  assert.equal(monthlyCents(1200, 'weekly'), Math.round((1200 * 52) / 12));
  assert.equal(monthlyCents(120, 'daily'), Math.round((120 * 365) / 12));
  assert.equal(monthlyCents(3000, 'yearly'), 0);                   // onbekende freq → 0 (CHECK kent 'm niet)
  assert.equal(monthlyCents(0, 'monthly'), 0);
  assert.equal(monthlyCents(-500, 'monthly'), 0);
  assert.equal(monthlyCents(3000, 'monthly', 0), 3000);            // kapot interval → 1
  assert.equal(monthlyCents(Number.NaN, 'monthly'), 0);
});

test('renderVehiclesOverview: vaste lasten opgeteld, laatste onderhoud (nieuwste eerst wint), APK-attentie', () => {
  const { data, render } = renderVehiclesOverview(
    [
      { id: 'v1', name: 'Grijze Volvo', license_plate: 'AB-12-CD', mileage: 123456, apk_expires_on: '2026-08-01' },
      { id: 'v2', name: 'Bakfiets', license_plate: null, mileage: null, apk_expires_on: null },
    ],
    [
      { vehicle_id: 'v1', amount_cents: 9000, recur_freq: 'monthly', recur_interval: 1 },
      { vehicle_id: 'v1', amount_cents: 60000, recur_freq: 'monthly', recur_interval: 12 }, // jaarlijkse premie → 5000/mnd
      { vehicle_id: null, amount_cents: 999, recur_freq: 'monthly' },                        // niet-voertuig → weg
    ],
    [
      { vehicle_id: 'v1', title: 'Grote beurt', performed_on: '2026-06-01' },   // nieuwste eerst → wint
      { vehicle_id: 'v1', title: 'Banden', performed_on: '2026-01-10' },
    ],
    '2026-09-04' // horizon: APK 2026-08-01 valt erbinnen → attentie
  );
  assert.equal(data.vehicles[0].fixed_monthly_cents, 14000);
  assert.deepEqual(data.vehicles[0].last_maintenance, { title: 'Grote beurt', performed_on: '2026-06-01' });
  const pairs = render[0].pairs;
  assert.deepEqual(pairs.map((p) => p.k), ['Kenteken', 'Km-stand', 'APK', 'Vaste lasten', 'Laatste onderhoud']);
  assert.equal(pairs[2].v, 'za 1 aug — binnenkort!');
  assert.equal(pairs[3].v, '€ 140,00/mnd');
  // Voertuig zonder gegevens → nette kaart i.p.v. lege keyvalue.
  assert.deepEqual(render[1], { type: 'card', title: 'Bakfiets', lines: ['Nog geen gegevens vastgelegd.'] });
});

test('renderVehiclesOverview: APK buiten de horizon → geen attentie; leeg/default → kaart', () => {
  const { render } = renderVehiclesOverview(
    [{ id: 'v1', name: 'Auto', license_plate: null, mileage: null, apk_expires_on: '2027-01-01' }],
    [], [], '2026-09-04'
  );
  assert.equal(render[0].pairs[0].v.includes('binnenkort'), false);
  assert.deepEqual(renderVehiclesOverview().render, [{ type: 'card', title: 'Voertuigen', lines: ['Er staan nog geen voertuigen in de app.'] }]);
});

test('voertuigen_overzicht: juiste tabellen/filters (alleen actieve voertuig-lasten)', async () => {
  const calls = [];
  await tool.run(toolCtx({ vehicles: [], recurring_expenses: [], vehicle_log: [] }, calls));
  assert.deepEqual(calls.find((c) => c.table === 'recurring_expenses').filters, [
    ['eq', 'household_id', 'h1'],
    ['eq', 'active', true],
    ['not', 'vehicle_id', 'is', null],
  ]);
  assert.deepEqual(calls.find((c) => c.table === 'vehicle_log').order, ['performed_on', { ascending: false }]);
});

// --- Fase B: voertuigen_onderhoud_loggen (HITL, bewust zonder kosten/expense).

test('proposeLogMaintenance: datum default vandaag (env), km optioneel, grenzen', () => {
  const out = proposeLogMaintenance(
    { items: [{ vehicle_name: 'Volvo', title: 'Grote beurt', mileage: 123456 }] },
    { today: '2026-07-06' }
  );
  assert.equal(out.ok, true);
  assert.deepEqual(out.args.items, [{ vehicle_name: 'Volvo', title: 'Grote beurt', performed_on: '2026-07-06', mileage: 123456 }]);
  assert.deepEqual(out.items, ['Volvo · Grote beurt · ma 6 jul · 123456 km']);
  assert.equal(proposeLogMaintenance({ items: [{ title: 'x' }] }, { today: '2026-07-06' }).ok, false);   // geen voertuig
  assert.equal(proposeLogMaintenance({ items: [{ vehicle_name: 'V' }] }, { today: '2026-07-06' }).ok, false); // geen titel
  assert.equal(proposeLogMaintenance({ items: [{ vehicle_name: 'V', title: 'x', mileage: -1 }] }, { today: '2026-07-06' }).args.items[0].mileage, null);
  assert.equal(proposeLogMaintenance().ok, false);
});

test('voertuigen_onderhoud_loggen: execute matcht voertuig en logt zonder kosten-koppeling', async () => {
  const tool2 = VOERTUIGEN_TOOLS.find((t) => t.name === 'voertuigen_onderhoud_loggen');
  const calls = [];
  const out = await tool2.execute(
    toolCtx({ vehicles: [{ id: 'v1', name: 'Volvo' }] }, calls),
    { items: [{ vehicle_name: 'volvo', title: 'Banden', performed_on: '2026-07-01', mileage: null }] }
  );
  const ins = calls.find((c) => c.table === 'vehicle_log');
  assert.deepEqual(ins.inserted, [{ vehicle_id: 'v1', created_by: 'u1', title: 'Banden', performed_on: '2026-07-01' }]);
  assert.deepEqual(out.inserted, [{ table: 'vehicle_log', id: 'vehicle_log-1' }]);
});

// Descriptor-contract van de write-tool exact vastpinnen (zelfde reden als bij
// de read-tool: een gewijzigde description verandert de tool-selectie en hoort
// een test te breken — en gaat daarna door de eval-gate).
test('descriptor-contract (write): statische vorm ligt exact vast', () => {
  const w = VOERTUIGEN_TOOLS.find((t) => t.name === 'voertuigen_onderhoud_loggen');
  assert.deepEqual(shape(w), {
      "name": "voertuigen_onderhoud_loggen",
      "moduleKey": "voertuigen",
      "kind": "write",
      "risk": "write",
      "destructive": false,
      "idempotent": false,
      "statusLabel": "Onderhoud klaarzetten…",
      "description": "Roep dit aan wanneer de gebruiker uitgevoerd onderhoud aan een voertuig wil vastleggen (bv. \"de Volvo heeft nieuwe banden gekregen op 123456 km\"). Alleen de historie-regel — kosten boeken hoort hier niet bij. De gebruiker beslist op de bevestigingskaart.",
      "parameters": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "description": "De te loggen onderhouds-regels (meestal één, maximaal 5).",
            "items": {
              "type": "object",
              "properties": {
                "vehicle_name": {
                  "type": "string",
                  "description": "De naam van het voertuig, zoals het in de app heet"
                },
                "title": {
                  "type": "string",
                  "description": "Wat er is gedaan, bv. \"Grote beurt\" of \"Nieuwe banden\""
                },
                "performed_on": {
                  "type": "string",
                  "description": "Optioneel: de datum als YYYY-MM-DD (default vandaag)"
                },
                "mileage": {
                  "type": "integer",
                  "description": "Optioneel: de km-stand op dat moment"
                }
              },
              "required": [
                "vehicle_name",
                "title"
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

test('proposeLogMaintenance: precies op de cap is oké; foutteksten en meervouds-summary liggen vast', () => {
  const vijf = Array.from({ length: 5 }, (_, i) => ({ vehicle_name: 'V', title: `t${i}` }));
  const ok = proposeLogMaintenance({ items: vijf }, { today: '2026-07-06' });
  assert.equal(ok.ok, true);
  assert.equal(ok.summary, '5 onderhouds-regels loggen');
  assert.equal(proposeLogMaintenance({ items: [...vijf, vijf[0]] }, { today: '2026-07-06' }).ok, false);
  assert.equal(proposeLogMaintenance({ items: [] }).error, 'Geen onderhoud om te loggen.');
  assert.equal(proposeLogMaintenance({ items: [{ title: 'x' }] }, { today: '2026-07-06' }).error, 'Zeg erbij om wélk voertuig het gaat.');
  assert.equal(proposeLogMaintenance({ items: [{ vehicle_name: 'V' }] }, { today: '2026-07-06' }).error, 'Wat voor onderhoud was het? Geef een korte titel.');
});

// ── Ratchet-verdieping (AI-19 fase C): de randen die de mutatietest aanwees. ──

test('renderVehiclesOverview: kapotte recurring-/log-rijen vallen weg; eerste geldige log wint', () => {
  const { data } = renderVehiclesOverview(
    [{ id: 'v1', name: 'Volvo' }],
    [null, { amount_cents: 1000, recur_freq: 'monthly' }, { vehicle_id: 'v1', amount_cents: 1000, recur_freq: 'monthly' }],
    [
      null,                                                              // rij null → geen crash
      { vehicle_id: 'v1', title: 42, performed_on: '2026-07-01' },       // titel geen string → weg
      { vehicle_id: 'v1', title: 'Banden', performed_on: null },         // datum geen string → weg
      { title: 'Zwevend', performed_on: '2026-07-01' },                  // geen voertuig → weg
      { vehicle_id: 'v1', title: 'Grote beurt', performed_on: '2026-06-10' },   // eerste geldige → wint
      { vehicle_id: 'v1', title: 'Kleine beurt', performed_on: '2026-05-01' },  // latere → genegeerd
    ],
  );
  assert.equal(data.vehicles[0].fixed_monthly_cents, 1000);
  assert.deepEqual(data.vehicles[0].last_maintenance, { title: 'Grote beurt', performed_on: '2026-06-10' });
});

test('renderVehiclesOverview: kaart-inhoud ligt vast (km-tekst, APK-grens inclusief, lasten, onderhoud)', () => {
  const { render } = renderVehiclesOverview(
    [{ id: 'v1', name: 'Volvo', license_plate: 'AB-12-CD', mileage: 12345, apk_expires_on: '2026-09-01' }],
    [{ vehicle_id: 'v1', amount_cents: 5000, recur_freq: 'monthly' }],
    [{ vehicle_id: 'v1', title: 'Grote beurt', performed_on: '2026-06-10' }],
    '2026-09-01',   // APK exact óp de horizon → telt als binnenkort (<=, niet <)
  );
  assert.equal(render[0].type, 'keyvalue');
  assert.deepEqual(render[0].pairs, [
    { k: 'Kenteken', v: 'AB-12-CD' },
    { k: 'Km-stand', v: '12345' },
    { k: 'APK', v: 'di 1 sep — binnenkort!' },
    { k: 'Vaste lasten', v: '€ 50,00/mnd' },
    { k: 'Laatste onderhoud', v: 'Grote beurt (wo 10 jun)' },
  ]);
  // Zonder horizon (default '') is er nooit een attentie — ook niet met een APK-datum.
  const zonder = renderVehiclesOverview([{ id: 'v1', name: 'Volvo', apk_expires_on: '2026-09-01' }]);
  assert.equal(zonder.render[0].pairs.find((p) => p.k === 'APK').v, 'di 1 sep');
});

test('voertuigen_overzicht: query-kolommen en sortering liggen vast', async () => {
  const calls = [];
  await tool.run(toolCtx({ vehicles: [], recurring_expenses: [], vehicle_log: [] }, calls));
  const vq = calls.find((c) => c.table === 'vehicles');
  assert.equal(vq.selected, 'id, name, license_plate, mileage, apk_expires_on');
  assert.deepEqual(vq.filters, [['eq', 'household_id', 'h1']]);
  assert.deepEqual(vq.order, ['name', undefined]);
  assert.equal(calls.find((c) => c.table === 'recurring_expenses').selected, 'vehicle_id, amount_cents, recur_freq, recur_interval');
  const lq = calls.find((c) => c.table === 'vehicle_log');
  assert.equal(lq.selected, 'vehicle_id, title, performed_on');
  assert.deepEqual(lq.order, ['performed_on', { ascending: false }]);
});

test('proposeLogMaintenance: exacte fouttekst per validatiepad (en ok blijft false)', () => {
  assert.deepEqual(proposeLogMaintenance(), { ok: false, error: 'Geen onderhoud om te loggen.' });
  const veel = Array.from({ length: 6 }, () => ({ vehicle_name: 'V', title: 't' }));
  assert.equal(proposeLogMaintenance({ items: veel }, {}).error, 'Maximaal 5 regels per voorstel.');
  assert.deepEqual(
    proposeLogMaintenance({ items: [null] }, { today: '2026-07-08' }),
    { ok: false, error: 'Zeg erbij om wélk voertuig het gaat.' }
  );
  assert.deepEqual(
    proposeLogMaintenance({ items: [{ vehicle_name: 'Volvo' }] }, { today: '2026-07-08' }),
    { ok: false, error: 'Wat voor onderhoud was het? Geef een korte titel.' }
  );
  // Titel-grens: precies 120 mag, 121 niet.
  assert.equal(proposeLogMaintenance({ items: [{ vehicle_name: 'V', title: 'x'.repeat(120) }] }, { today: '2026-07-08' }).ok, true);
  assert.equal(
    proposeLogMaintenance({ items: [{ vehicle_name: 'V', title: 'x'.repeat(121) }] }, { today: '2026-07-08' }).error,
    'Een onderhouds-titel mag maximaal 120 tekens zijn.'
  );
  // Ongeldige datum zónder vandaag-fallback → de vaste datumfout.
  assert.deepEqual(
    proposeLogMaintenance({ items: [{ vehicle_name: 'V', title: 't' }] }, {}),
    { ok: false, error: 'Ongeldige datum (gebruik YYYY-MM-DD).' }
  );
});

test('proposeLogMaintenance: datum-vorm strikt YYYY-MM-DD — alles ernaast valt terug op vandaag', () => {
  const today = '2026-07-08';
  const met = (performed_on) =>
    proposeLogMaintenance({ items: [{ vehicle_name: 'V', title: 't', performed_on }] }, { today }).args.items[0].performed_on;
  assert.equal(met('2026-07-10'), '2026-07-10');       // geldig → blijft
  for (const kapot of ['2026-07-101', 'x2026-07-10', '2026-07-1', '2026-7-10', '2-07-10', 'abcd-07-10', '2026-ab-10', '2026-07-ab']) {
    assert.equal(met(kapot), today);
  }
});

test('proposeLogMaintenance: trim op naam/titel, km-stand 0 telt mee, regel-tekst en enkelvouds-summary liggen vast', () => {
  const out = proposeLogMaintenance(
    { items: [{ vehicle_name: ' Volvo ', title: ' Nieuwe banden ', performed_on: '2026-07-10', mileage: 0 }] },
    { today: '2026-07-08' }
  );
  assert.deepEqual(out.args.items, [{ vehicle_name: 'Volvo', title: 'Nieuwe banden', performed_on: '2026-07-10', mileage: 0 }]);
  assert.deepEqual(out.items, ['Volvo · Nieuwe banden · vr 10 jul · 0 km']);
  assert.equal(out.summary, 'Onderhoud "Nieuwe banden" loggen (Volvo)');
  // Zonder km-stand géén "null km"-ruis in de regel.
  const zonder = proposeLogMaintenance({ items: [{ vehicle_name: 'Volvo', title: 'Wasbeurt', performed_on: '2026-07-10' }] }, {});
  assert.deepEqual(zonder.items, ['Volvo · Wasbeurt · vr 10 jul']);
});

test('voertuigen_onderhoud_loggen: naam-matching (onbekend/dubbelzinnig/trim/null-naam) en insert-payload', async () => {
  const w = VOERTUIGEN_TOOLS.find((t) => t.name === 'voertuigen_onderhoud_loggen');
  const item = { vehicle_name: ' volvo ', title: 'Nieuwe banden', performed_on: '2026-07-10', mileage: 12345 };
  await assert.rejects(
    () => w.execute(toolCtx({ vehicles: [{ id: 'v1', name: 'Fiets' }], vehicle_log: [] }, []), { items: [{ ...item, vehicle_name: 'bakfiets' }] }),
    /"bakfiets" is niet \(eenduidig\) gevonden/
  );
  await assert.rejects(
    () => w.execute(toolCtx({ vehicles: [{ id: 'v1', name: 'Volvo' }, { id: 'v2', name: 'volvo' }], vehicle_log: [] }, []), { items: [item] }),
    /niet \(eenduidig\) gevonden/
  );
  const calls = [];
  const out = await w.execute(toolCtx({
    vehicles: [{ id: 'v0', name: null }, { id: 'vX', name: 'Fiets' }, { id: 'v1', name: ' Volvo ' }],
    vehicle_log: [],
  }, calls), { items: [item] });
  assert.equal(out.summary, 'Onderhoud gelogd.');
  assert.equal(calls.find((c) => c.table === 'vehicles').selected, 'id, name');
  const ins = calls.find((c) => c.table === 'vehicle_log' && c.inserted);
  assert.deepEqual(ins.inserted[0], { vehicle_id: 'v1', created_by: 'u1', title: 'Nieuwe banden', performed_on: '2026-07-10', mileage: 12345 });
  assert.equal(ins.selected, 'id');
});

test('voertuigen_onderhoud_loggen: zonder km-stand geen mileage-kolom; twee items → meervouds-summary', async () => {
  const w = VOERTUIGEN_TOOLS.find((t) => t.name === 'voertuigen_onderhoud_loggen');
  const calls = [];
  const out = await w.execute(toolCtx({ vehicles: [{ id: 'v1', name: 'Volvo' }], vehicle_log: [] }, calls), {
    items: [
      { vehicle_name: 'Volvo', title: 'Wasbeurt', performed_on: '2026-07-10', mileage: null },
      { vehicle_name: 'Volvo', title: 'Olie', performed_on: '2026-07-11', mileage: null },
    ],
  });
  assert.equal(out.summary, '2 onderhouds-regels gelogd.');
  assert.equal(out.inserted.length, 2);
  const ins = calls.find((c) => c.table === 'vehicle_log' && c.inserted);
  assert.equal('mileage' in ins.inserted[0], false);
});
