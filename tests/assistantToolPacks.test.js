// Contract-metatest van de assistent-tool-packs (guidelines §1) + unit-tests van
// de gedeelde helpers en de aggregator. Zoals tests/typecheckCoverage.test.js is
// dit de goedkoopste borging van conventies: elke pack die van het contract
// afwijkt (naming, annotaties, schema-vorm) faalt hier — vóór er een model of
// mutatietest aan te pas komt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_TOOLS, aggregateToolPacks } from '../supabase/functions/_shared/tools/index.js';
import { fmtEuro, nextMonth, addDays, isIsoDate, dayLabel, resolveMemberId } from '../supabase/functions/_shared/tools/helpers.js';
import { MODULES } from '../lib/modules.js';

const MODULE_KEYS = new Set(MODULES.map((m) => m.key));

// Elke object-schema in de boom moet additionalProperties:false dragen — het
// model mag geen velden verzinnen die stil worden doorgelaten (write-args gaan
// na bevestiging de database in).
function assertClosedSchemas(schema, path, toolName) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${toolName}: ${path} mist additionalProperties:false`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      assertClosedSchemas(sub, `${path}.${key}`, toolName);
    }
  }
  if (schema.type === 'array') assertClosedSchemas(schema.items, `${path}[]`, toolName);
}

test('registry: de verwachte toolset, gesorteerd op naam (cache-hygiëne)', () => {
  assert.deepEqual(ASSISTANT_TOOLS.map((t) => t.name), [
    'boodschappen_lijst',
    'boodschappen_toevoegen',
    'kosten_maandoverzicht',
    'maaltijden_plannen',
    'maaltijden_weekmenu',
    'taken_open',
    'taken_toevoegen',
    'voorraad_bijna_op',
  ]);
});

test('contract: naam = moduleKey_onderwerp, moduleKey bestaat, beschrijving en statusLabel dragen', () => {
  for (const t of ASSISTANT_TOOLS) {
    assert.ok(MODULE_KEYS.has(t.moduleKey), `${t.name}: onbekende moduleKey ${t.moduleKey}`);
    assert.ok(t.name.startsWith(`${t.moduleKey}_`), `${t.name}: naam moet met '${t.moduleKey}_' beginnen (namespacing)`);
    assert.match(t.name, /^[a-z]+(_[a-z]+)+$/, `${t.name}: alleen lowercase + underscores`);
    assert.ok(t.description.length > 40, `${t.name}: beschrijving stuurt de tool-selectie — te kort`);
    assert.ok(typeof t.statusLabel === 'string' && t.statusLabel.endsWith('…'), `${t.name}: statusLabel ontbreekt of mist …`);
  }
});

test('contract: parameter-schema’s zijn gesloten objecten (additionalProperties:false, ook genest)', () => {
  for (const t of ASSISTANT_TOOLS) {
    assert.equal(t.parameters.type, 'object', t.name);
    assertClosedSchemas(t.parameters, 'parameters', t.name);
  }
});

test('contract: read-tools hebben run; write-tools hebben propose+execute + risico-annotaties, nooit run', () => {
  for (const t of ASSISTANT_TOOLS) {
    assert.ok(['read', 'write'].includes(t.kind), `${t.name}: kind`);
    if (t.kind === 'read') {
      assert.equal(typeof t.run, 'function', `${t.name}: read-tool zonder run`);
      assert.equal(t.propose, undefined, `${t.name}: read-tool met propose`);
      assert.equal(t.execute, undefined, `${t.name}: read-tool met execute`);
    } else {
      // MCP-annotatie-vocabulaire: het HITL-beleid leest deze velden declaratief.
      assert.equal(typeof t.destructive, 'boolean', `${t.name}: write-tool zonder destructive-annotatie`);
      assert.equal(typeof t.idempotent, 'boolean', `${t.name}: write-tool zonder idempotent-annotatie`);
      assert.equal(typeof t.propose, 'function', `${t.name}: write-tool zonder propose`);
      assert.equal(typeof t.execute, 'function', `${t.name}: write-tool zonder execute`);
      assert.equal(t.run, undefined, `${t.name}: write-tool met run — de loop mag nooit zelf schrijven`);
      // Multi-edit-contract: batch onder 'items', verplicht — de per-item
      // aan/uitvink-selectie op de bevestigingskaart hangt hieraan.
      assert.equal(t.parameters.properties.items?.type, 'array', `${t.name}: write-args horen onder items[]`);
      assert.deepEqual(t.parameters.required, ['items'], `${t.name}: items is verplicht`);
    }
  }
});

test('contract: propose houdt items en args.items 1-op-1 uitgelijnd (selectie-indexen)', () => {
  const samples = {
    taken_toevoegen: { items: [{ title: 'A' }, { title: 'B', due_date: '2026-07-10' }] },
    boodschappen_toevoegen: { items: [{ name: 'Melk' }, { name: 'Kaas', quantity: '2' }] },
    maaltijden_plannen: { items: [{ date: '2026-07-10', title: 'X' }, { date: '2026-07-11', title: 'Y' }] },
  };
  for (const t of ASSISTANT_TOOLS.filter((t) => t.kind === 'write')) {
    assert.ok(samples[t.name], `${t.name}: voeg een propose-sample toe aan deze contract-test`);
    const out = t.propose(samples[t.name], { memberNames: {} });
    assert.equal(out.ok, true, `${t.name}: sample hoort geldig te zijn`);
    assert.equal(out.items.length, out.args.items.length, `${t.name}: items/args-uitlijning`);
    assert.ok(typeof out.summary === 'string' && out.summary.length > 0, `${t.name}: summary`);
  }
});

test('aggregateToolPacks: sorteert op naam (permutatie-onafhankelijk) en gooit op dubbele namen', () => {
  const a = { name: 'a_een' };
  const b = { name: 'b_twee' };
  const c = { name: 'c_drie' };
  // Meerdere invoervolgordes: een kapotte comparator kan bij één volgorde
  // toevallig goed uitpakken (insertion-sort), bij drie niet meer.
  for (const packs of [[[a], [b], [c]], [[c], [a], [b]], [[b, c], [a]], [[c, b, a]]]) {
    assert.deepEqual(aggregateToolPacks(packs).map((t) => t.name), ['a_een', 'b_twee', 'c_drie']);
  }
  assert.throws(() => aggregateToolPacks([[b], [{ name: 'b_twee' }]]), /Dubbele toolnaam.*b_twee/);
  assert.deepEqual(aggregateToolPacks([]), []);
});

// --- throwOnError: het foutcontract van elke run/execute (deze groep bewaakt helpers.js).

test('throwOnError: data door, fout gooit met message of de fallback', async () => {
  const { throwOnError } = await import('../supabase/functions/_shared/tools/helpers.js');
  assert.deepEqual(throwOnError({ data: [1, 2], error: null }), [1, 2]);
  assert.deepEqual(throwOnError({ data: null, error: null }), []); // null-data → lege lijst
  assert.throws(() => throwOnError({ data: null, error: { message: 'boem' } }), /boem/);
  assert.throws(() => throwOnError({ data: null, error: {} }), /query mislukt/);
});

test('dayLabel: alle 7 dagnamen en alle 12 maandnamen komen uit de juiste tabellen', () => {
  // Week van 2026-07-05 (zondag) t/m 2026-07-11 (zaterdag).
  const week = ['zo 5 jul', 'ma 6 jul', 'di 7 jul', 'wo 8 jul', 'do 9 jul', 'vr 10 jul', 'za 11 jul'];
  week.forEach((expected, i) => assert.equal(dayLabel(`2026-07-${String(5 + i).padStart(2, '0')}`), expected));
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  months.forEach((m, i) => assert.equal(dayLabel(`2026-${String(i + 1).padStart(2, '0')}-15`).endsWith(m), true, m));
});

test('resolveMemberId: trimt en verlaagt de OPGESLAGEN naam ook; null-namen matchen nooit', () => {
  assert.equal(resolveMemberId('erik', { u1: ' Erik ' }), 'u1');       // opgeslagen naam met spaties
  assert.equal(resolveMemberId('', { u1: '' }), null);                  // lege vraag matcht geen leeg veld
  assert.equal(resolveMemberId('   ', { u1: 'Erik' }), null);
  assert.equal(resolveMemberId('Stryker was here!', { u1: null }), null); // null-naam → '' → geen match
});

// --- Gedeelde helpers (tools/helpers.js).

test('fmtEuro: komma-notatie met twee decimalen', () => {
  assert.equal(fmtEuro(17550), '€ 175,50');
  assert.equal(fmtEuro(5), '€ 0,05');
  assert.equal(fmtEuro(0), '€ 0,00');
});

test('nextMonth: gewone maand +1, december rolt het jaar door, enkelcijferig gepad', () => {
  assert.equal(nextMonth('2026-07'), '2026-08-01');
  assert.equal(nextMonth('2026-09'), '2026-10-01');
  assert.equal(nextMonth('2026-12'), '2027-01-01');
  assert.equal(nextMonth('2026-01'), '2026-02-01');
});

test('addDays: telt via UTC, over maand- en jaargrens heen', () => {
  assert.equal(addDays('2026-07-04', 7), '2026-07-11');
  assert.equal(addDays('2026-07-28', 7), '2026-08-04');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2026-07-04', 0), '2026-07-04');
});

test('isIsoDate: alleen echte kalenderdatums in exact YYYY-MM-DD', () => {
  assert.equal(isIsoDate('2026-07-04'), true);
  assert.equal(isIsoDate('2026-02-31'), false); // rolt door naar maart → geen echte datum
  assert.equal(isIsoDate('2026-7-4'), false);
  assert.equal(isIsoDate('2026-07-04T00:00'), false);
  assert.equal(isIsoDate('morgen'), false);
  assert.equal(isIsoDate(''), false);
  assert.equal(isIsoDate(), false);
  assert.equal(isIsoDate(20260704), false);
});

test('dayLabel: NL dag- en maandafkortingen via UTC; rommel valt terug op de invoer', () => {
  assert.equal(dayLabel('2026-07-10'), 'vr 10 jul');
  assert.equal(dayLabel('2026-07-05'), 'zo 5 jul');
  assert.equal(dayLabel('2026-12-28'), 'ma 28 dec');
  assert.equal(dayLabel('2026-01-01'), 'do 1 jan');
  assert.equal(dayLabel('geen datum'), 'geen datum');
  assert.equal(dayLabel(null), '');
});

test('resolveMemberId: hele naam case-insensitief; dubbelzinnig of onbekend → null', () => {
  const names = { u1: 'Erik', u2: 'Sam' };
  assert.equal(resolveMemberId('erik', names), 'u1');
  assert.equal(resolveMemberId(' SAM ', names), 'u2');
  assert.equal(resolveMemberId('Eri', names), null);          // geen prefix-match
  assert.equal(resolveMemberId('Onbekend', names), null);
  assert.equal(resolveMemberId('', names), null);
  assert.equal(resolveMemberId(undefined, names), null);
  assert.equal(resolveMemberId('erik'), null);                // default memberNames = {}
  assert.equal(resolveMemberId('erik', { u1: 'Erik', u2: 'erik' }), null); // dubbelzinnig
});
