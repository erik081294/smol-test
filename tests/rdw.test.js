// Units voor de RDW-kentekenlookup (lib/rdw.js). De pure helpers + de niet-blokkerende
// lookup met een geïnjecteerde mock-fetch (geen echt netwerk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate, isValidPlate, rdwUrl, parseRdwRecord, lookupPlate } from '../lib/rdw.js';

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

test('parseRdwRecord: mapt + title-cased, null bij geen bruikbaar record', () => {
  assert.deepEqual(
    parseRdwRecord({ merk: 'VOLKSWAGEN', handelsbenaming: 'GOLF PLUS', voertuigsoort: 'PERSONENAUTO' }),
    { make: 'Volkswagen', model: 'Golf Plus', vehicleType: 'Personenauto' },
  );
  assert.deepEqual(
    parseRdwRecord({ merk: 'TESLA' }),
    { make: 'Tesla', model: null, vehicleType: null },
  );
  assert.equal(parseRdwRecord(null), null);
  assert.equal(parseRdwRecord({}), null);                 // geen merk én geen model
  assert.equal(parseRdwRecord({ voertuigsoort: 'BROMFIETS' }), null);
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
  assert.deepEqual(out, { make: 'Volkswagen', model: 'Golf', vehicleType: 'Personenauto' });
  assert.equal(calledUrl, 'https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=12ABC3');
});

test('lookupPlate: niet-ok response, lege lijst of fout → stille null', async () => {
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => ({ ok: true, json: async () => [] }) }), null);
  assert.equal(await lookupPlate('12ABC3', { fetchImpl: async () => { throw new Error('offline'); } }), null);
});
