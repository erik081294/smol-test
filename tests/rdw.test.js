// Units voor de RDW-kentekenlookup (lib/rdw.js). De pure helpers + de niet-blokkerende
// lookup met een geïnjecteerde mock-fetch (geen echt netwerk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate, isValidPlate, rdwUrl, parseRdwDate, parseRdwRecord, lookupPlate } from '../lib/rdw.js';

// Verrijkingsvelden zijn null als ze in het record ontbreken — handig basisobject voor de asserts.
const NO_ENRICH = { color: null, bodyType: null, apkExpiry: null, firstRegistration: null, catalogPriceCents: null, curbWeightKg: null };

test('normalizePlate: hoofdletters, alleen alfanumeriek, null-veilig', () => {
  assert.equal(normalizePlate('12-ab-3'), '12AB3');
  assert.equal(normalizePlate(' xy-99-z '), 'XY99Z');
  assert.equal(normalizePlate('12·ABC/3'), '12ABC3');
  assert.equal(normalizePlate(null), '');
  assert.equal(normalizePlate(undefined), '');
});

test('isValidPlate: 6 alfanumeriek mét letter én cijfer', () => {
  assert.equal(isValidPlate('12-ABC-3'), true);   // 6 na normaliseren
  assert.equal(isValidPlate('1ABC23'), true);
  assert.equal(isValidPlate('123456'), false);    // geen letter
  assert.equal(isValidPlate('ABCDEF'), false);    // geen cijfer
  assert.equal(isValidPlate('12AB3'), false);     // te kort (5)
  assert.equal(isValidPlate('12ABC34'), false);   // te lang (7)
  assert.equal(isValidPlate(''), false);
  assert.equal(isValidPlate(null), false);
});

test('rdwUrl: query op het genormaliseerde kenteken', () => {
  assert.equal(rdwUrl('12-ab-3'), 'https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=12AB3');
});

test('parseRdwDate: YYYYMMDD → ISO, onzin → null', () => {
  assert.equal(parseRdwDate('20251231'), '2025-12-31');
  assert.equal(parseRdwDate(20180704), '2018-07-04');     // ook een getal mag
  assert.equal(parseRdwDate('20251331'), null);           // maand 13
  assert.equal(parseRdwDate('20250100'), null);           // dag 00
  assert.equal(parseRdwDate('2025-12-31'), null);         // niet het RDW-formaat
  assert.equal(parseRdwDate(''), null);
  assert.equal(parseRdwDate(null), null);
});

test('parseRdwRecord: mapt + title-cased, null bij geen bruikbaar record', () => {
  assert.deepEqual(
    parseRdwRecord({ merk: 'VOLKSWAGEN', handelsbenaming: 'GOLF PLUS', voertuigsoort: 'PERSONENAUTO' }),
    { make: 'Volkswagen', model: 'Golf Plus', vehicleType: 'Personenauto', ...NO_ENRICH },
  );
  assert.deepEqual(
    parseRdwRecord({ merk: 'TESLA' }),
    { make: 'Tesla', model: null, vehicleType: null, ...NO_ENRICH },
  );
  assert.equal(parseRdwRecord(null), null);
  assert.equal(parseRdwRecord({}), null);                 // geen merk én geen model
  assert.equal(parseRdwRecord({ voertuigsoort: 'BROMFIETS' }), null);
});

test('parseRdwRecord: verrijking — kleur/carrosserie/APK/eerste-toelating/prijs/massa', () => {
  assert.deepEqual(
    parseRdwRecord({
      merk: 'VOLKSWAGEN', handelsbenaming: 'GOLF', voertuigsoort: 'PERSONENAUTO',
      eerste_kleur: 'BLAUW', inrichting: 'HATCHBACK', vervaldatum_apk: '20251231',
      datum_eerste_toelating: '20180704', catalogusprijs: '25750', massa_ledig_voertuig: '1180',
    }),
    {
      make: 'Volkswagen', model: 'Golf', vehicleType: 'Personenauto',
      color: 'Blauw', bodyType: 'Hatchback', apkExpiry: '2025-12-31',
      firstRegistration: '2018-07-04', catalogPriceCents: 2575000, curbWeightKg: 1180,
    },
  );
});

test('lookupPlate: ongeldig kenteken → null, géén fetch-call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, json: async () => [] }; };
  assert.equal(await lookupPlate('123', { fetchImpl }), null);
  assert.equal(called, false, 'geen request bij evident ongeldige invoer');
});

test('lookupPlate: geldig kenteken + record → gemapt object, juiste URL', async () => {
  let calledUrl = null;
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => [{ merk: 'VOLKSWAGEN', handelsbenaming: 'GOLF', voertuigsoort: 'PERSONENAUTO' }] };
  };
  const out = await lookupPlate('12-ABC-3', { fetchImpl });
  assert.deepEqual(out, { make: 'Volkswagen', model: 'Golf', vehicleType: 'Personenauto', ...NO_ENRICH });
  assert.equal(calledUrl, 'https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=12ABC3');
});

test('lookupPlate: niet-ok response, lege lijst of fout → stille null', async () => {
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => ({ ok: true, json: async () => [] }) }), null);
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => { throw new Error('offline'); } }), null);
});
