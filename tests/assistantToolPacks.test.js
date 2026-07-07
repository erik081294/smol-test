// Contract-metatest van de assistent-tool-packs (guidelines §1) + unit-tests van
// de gedeelde helpers en de aggregator. Zoals tests/typecheckCoverage.test.js is
// dit de goedkoopste borging van conventies: elke pack die van het contract
// afwijkt (naming, annotaties, schema-vorm) faalt hier — vóór er een model of
// mutatietest aan te pas komt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_TOOLS, MODULE_BRIEFS, MANIFESTS, aggregateToolPacks, aggregateBriefs } from '../supabase/functions/_shared/tools/index.js';
import { fmtEuro, nextMonth, addDays, isIsoDate, dayLabel, resolveMemberId, isHhmm, toUtcIso, localHhmm, localDate,
  weekStart,
} from '../supabase/functions/_shared/tools/helpers.js';
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
    'boodschappen_afvinken',
    'boodschappen_lijst',
    'boodschappen_toevoegen',
    'delen_reserveren',
    'delen_reserveringen',
    'huisdieren_logboek_toevoegen',
    'huisdieren_overzicht',
    'kosten_maandoverzicht',
    'maaltijden_plannen',
    'maaltijden_recept_opslaan',
    'maaltijden_recept_zoeken',
    'maaltijden_weekmenu',
    'planten_overzicht',
    'planten_toevoegen',
    'taken_open',
    'taken_toevoegen',
    'tijdlijn_plaatsen',
    'tijdlijn_recent',
    'voertuigen_onderhoud_loggen',
    'voertuigen_overzicht',
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

test('contract: elke tool draagt een risk-tier consistent met kind (voedt de capability-policy)', () => {
  // De policy-laag (lib/aiCapabilities.js) gate't writes op deze tier: 'write' vraagt
  // ai:write, 'financial' vraagt ai:spend, 'destructive' vraagt ai:destructive.
  const ALLOWED = { read: new Set(['read']), write: new Set(['write', 'financial', 'destructive']) };
  for (const t of ASSISTANT_TOOLS) {
    assert.ok(typeof t.risk === 'string', `${t.name}: risk-tier ontbreekt`);
    assert.ok(ALLOWED[t.kind]?.has(t.risk), `${t.name}: risk '${t.risk}' past niet bij kind '${t.kind}'`);
  }
});

test('manifest: één per module (moduleKey/label/brief/tools) en dekt exact ASSISTANT_TOOLS', () => {
  const seen = new Set();
  const fromManifests = [];
  for (const m of MANIFESTS) {
    assert.ok(MODULE_KEYS.has(m.moduleKey), `manifest-moduleKey onbekend: ${m.moduleKey}`);
    assert.ok(!seen.has(m.moduleKey), `dubbel manifest voor ${m.moduleKey}`);
    seen.add(m.moduleKey);
    assert.ok(typeof m.label === 'string' && m.label.length > 0, `${m.moduleKey}: label`);
    assert.ok(typeof m.brief === 'string' && m.brief.length > 0, `${m.moduleKey}: brief`);
    assert.ok(Array.isArray(m.tools) && m.tools.length > 0, `${m.moduleKey}: tools-array`);
    for (const t of m.tools) fromManifests.push(t.name);
  }
  // De afgeleide registry bevat exact de tools uit de manifests — geen tool buiten een manifest om.
  assert.deepEqual(fromManifests.sort(), ASSISTANT_TOOLS.map((t) => t.name).sort());
});

test('contract: propose houdt items en args.items 1-op-1 uitgelijnd (selectie-indexen)', () => {
  const samples = {
    taken_toevoegen: { items: [{ title: 'A' }, { title: 'B', due_date: '2026-07-10' }] },
    boodschappen_afvinken: { items: [{ name: 'Melk' }, { name: 'Brood' }] },
    boodschappen_toevoegen: { items: [{ name: 'Melk' }, { name: 'Kaas', quantity: '2' }] },
    maaltijden_plannen: { items: [{ date: '2026-07-10', title: 'X' }, { date: '2026-07-11', title: 'Y' }] },
    maaltijden_recept_opslaan: { items: [{ title: 'Pesto', ingredients: [{ name: 'Basilicum' }] }, { title: 'Soep', ingredients: [{ name: 'Ui' }] }] },
    // AI-19 fase B.
    planten_toevoegen: { items: [{ name: 'Monstera' }, { name: 'Ficus', water_days: 7 }] },
    huisdieren_logboek_toevoegen: { items: [{ pet_name: 'Nala', weight_grams: 12500 }, { pet_name: 'Rex', note: 'alles goed' }] },
    voertuigen_onderhoud_loggen: { items: [{ vehicle_name: 'Volvo', title: 'Grote beurt' }, { vehicle_name: 'Bakfiets', title: 'Ketting', performed_on: '2026-07-01' }] },
    tijdlijn_plaatsen: { items: [{ body: 'De cv-monteur komt dinsdag' }] },
    delen_reserveren: { items: [{ resource_name: 'Deelauto', date: '2026-07-11', from: '14:00', to: '16:00' }, { resource_name: 'Aanhanger', date: '2026-07-12', from: '10:00', to: '11:00' }] },
  };
  for (const t of ASSISTANT_TOOLS.filter((t) => t.kind === 'write')) {
    assert.ok(samples[t.name], `${t.name}: voeg een propose-sample toe aan deze contract-test`);
    const out = t.propose(samples[t.name], { memberNames: {}, today: '2026-07-06', tzOffsetMinutes: 120 });
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

// --- Module-briefs (AI-10): de altijd-in-context-laag per module.

test('briefs-contract: elke module met tools heeft een brief, met label en zinnige lengte', () => {
  const toolModules = [...new Set(ASSISTANT_TOOLS.map((t) => t.moduleKey))];
  for (const key of toolModules) {
    const b = MODULE_BRIEFS[key];
    assert.ok(b, `module ${key} heeft tools maar geen brief`);
    assert.ok(MODULE_KEYS.has(key), `brief-moduleKey onbekend: ${key}`);
    assert.ok(typeof b.label === 'string' && b.label.length > 0, `${key}: label`);
    assert.ok(b.brief.length >= 20 && b.brief.length <= 140, `${key}: brief hoort 20-140 tekens te zijn (nu ${b.brief.length})`);
  }
  // En andersom: geen briefs voor modules zonder tools (dode context kost tokens).
  assert.deepEqual(Object.keys(MODULE_BRIEFS).sort(), toolModules.sort());
});

test('aggregateBriefs: bouwt de map en gooit op dubbele moduleKeys', () => {
  const map = aggregateBriefs([{ moduleKey: 'a', label: 'A', brief: 'x' }]);
  assert.deepEqual(map, { a: { label: 'A', brief: 'x' } });
  assert.throws(
    () => aggregateBriefs([{ moduleKey: 'a', label: 'A', brief: 'x' }, { moduleKey: 'a', label: 'B', brief: 'y' }]),
    /Dubbele module-brief.*a/
  );
  assert.deepEqual(aggregateBriefs([]), {});
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

// --- Tijd-helpers (AI-19 fase B): lokale tijden ↔ UTC-instants via de client-offset.

test('isHhmm: 24-uurs grenzen exact', () => {
  assert.equal(isHhmm('00:00'), true);
  assert.equal(isHhmm('23:59'), true);
  assert.equal(isHhmm('24:00'), false);
  assert.equal(isHhmm('9:00'), false);      // altijd twee cijfers
  assert.equal(isHhmm('12:60'), false);
  assert.equal(isHhmm(''), false);
  assert.equal(isHhmm(), false);
  assert.equal(isHhmm('x14:00'), false);   // ^-anker
  assert.equal(isHhmm('14:00x'), false);   // $-anker
});

test('toUtcIso: NL-zomertijd (+120) schuift terug naar UTC; over de dagrens heen; rommel → null', () => {
  assert.equal(toUtcIso('2026-07-11', '14:00', 120), '2026-07-11T12:00:00.000Z');
  assert.equal(toUtcIso('2026-07-11', '01:00', 120), '2026-07-10T23:00:00.000Z');  // dagrens
  assert.equal(toUtcIso('2026-07-11', '14:00', 0), '2026-07-11T14:00:00.000Z');
  assert.equal(toUtcIso('2026-07-11', '14:00', 9999), '2026-07-11T14:00:00.000Z'); // kapotte offset → 0
  assert.equal(toUtcIso('2026-02-31', '14:00', 120), null);                        // geen echte datum
  assert.equal(toUtcIso('2026-07-11', '25:00', 120), null);
  // Precies op de offset-grens (±14 uur bestaat echt: Kiribati).
  assert.equal(toUtcIso('2026-07-11', '14:00', 840), '2026-07-11T00:00:00.000Z');
  assert.equal(toUtcIso('2026-07-11', '14:00', -840), '2026-07-12T04:00:00.000Z');
  assert.equal(toUtcIso('2026-07-11', '14:00', 841), '2026-07-11T14:00:00.000Z'); // net erover → 0
});

test('weekStart: maandag van de week — elke weekdag-tak, maandag blijft zichzelf', () => {
  assert.equal(weekStart('2026-06-29'), '2026-06-29');   // maandag → zelfde dag (offset 0)
  assert.equal(weekStart('2026-07-01'), '2026-06-29');   // woensdag → -2
  assert.equal(weekStart('2026-07-04'), '2026-06-29');   // zaterdag → -5
  assert.equal(weekStart('2026-07-05'), '2026-06-29');   // zondag (dow 0) → -6, niet +1
  assert.equal(weekStart('2026-07-06'), '2026-07-06');   // de maandag erna
  assert.equal(weekStart('2026-01-01'), '2025-12-29');   // over de jaargrens
  assert.equal(weekStart('rommel'), null);
  assert.equal(weekStart('2026-02-31'), null);           // geen echte kalenderdag
  assert.equal(weekStart(), null);
});

test('localHhmm/localDate: round-trip met toUtcIso; onleesbaar → lege string', () => {
  const iso = toUtcIso('2026-07-11', '14:00', 120);
  assert.equal(localHhmm(iso, 120), '14:00');
  assert.equal(localDate(iso, 120), '2026-07-11');
  assert.equal(localHhmm(iso, 0), '12:00');           // zelfde instant, andere bril
  const nacht = toUtcIso('2026-07-11', '01:00', 120); // UTC valt op 10 juli…
  assert.equal(localDate(nacht, 120), '2026-07-11');  // …maar lokaal blijft het de 11e
  assert.equal(localHhmm('rommel', 120), '');
  assert.equal(localDate(null, 120), '');
  // Kapotte of niet-gehele offsets vallen ook hier terug op 0 (UTC-bril).
  assert.equal(localHhmm(iso, 9999), '12:00');
  assert.equal(localHhmm(iso, 1.5), '12:00');
  assert.equal(localDate(nacht, 9999), '2026-07-10');
  assert.equal(localHhmm(iso, 840), '02:00');   // precies op de grens telt mee
  assert.equal(localDate(iso, -840), '2026-07-10');
});
