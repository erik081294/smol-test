// Tests voor de pure formulier-validatie-runner. Draaien met:  npm test
// Deze logica vervangt het per-scherm gekopieerde validate-blok van de entity-editors
// (ARCH-1); ze hoort daarom strak vastgepind onder de mutatie-ratchet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRules, isValid, requiredText, positive, when, firstErrorField, isDirty } from '../lib/formValidation.js';

// --- runRules ---------------------------------------------------------------
test('runRules: geen regels → leeg foutobject (geen fouten)', () => {
  assert.deepEqual(runRules({ a: 1 }, []), {});
});

test('runRules: zonder argumenten → leeg foutobject (default-params)', () => {
  assert.deepEqual(runRules(), {});
});

test('runRules: verzamelt de fout per veld uit een falende regel', () => {
  const rules = [requiredText('name', 'Naam verplicht')];
  assert.deepEqual(runRules({ name: '' }, rules), { name: 'Naam verplicht' });
});

test('runRules: een geslaagde regel (null) voegt niets toe', () => {
  const rules = [requiredText('name', 'Naam verplicht')];
  assert.deepEqual(runRules({ name: 'Roos' }, rules), {});
});

test('runRules: eerste fout per veld wint — een tweede regel op hetzelfde veld stapelt niet', () => {
  const first = () => ({ field: 'x', message: 'eerste' });
  const second = () => ({ field: 'x', message: 'tweede' });
  // Volgorde-gevoelig: assert expliciet dat de EERSTE melding blijft staan.
  assert.equal(runRules({}, [first, second]).x, 'eerste');
  // En omgekeerde volgorde → dan wint die andere (anders overleeft de "first wins"-tak).
  assert.equal(runRules({}, [second, first]).x, 'tweede');
});

test('runRules: meerdere velden krijgen elk hun eigen fout', () => {
  const rules = [requiredText('name', 'N'), positive('days', 'D')];
  assert.deepEqual(runRules({ name: '', days: 0 }, rules), { name: 'N', days: 'D' });
});

test('runRules: niet-functie-items in de regellijst worden overgeslagen', () => {
  const rules = [null, undefined, 42, requiredText('name', 'N')];
  assert.deepEqual(runRules({ name: '' }, rules), { name: 'N' });
});

// --- isValid ----------------------------------------------------------------
test('isValid: leeg foutobject is geldig', () => {
  assert.equal(isValid({}), true);
});

test('isValid: een foutobject met velden is ongeldig', () => {
  assert.equal(isValid({ name: 'fout' }), false);
});

test('isValid: null/undefined telt als geldig (geen fouten)', () => {
  assert.equal(isValid(null), true);
  assert.equal(isValid(undefined), true);
});

// --- requiredText -----------------------------------------------------------
test('requiredText: gevulde tekst is geldig (null)', () => {
  assert.equal(requiredText('name', 'N')({ name: 'Roos' }), null);
});

test('requiredText: lege of whitespace-tekst faalt met de melding', () => {
  assert.deepEqual(requiredText('name', 'N')({ name: '' }), { field: 'name', message: 'N' });
  assert.deepEqual(requiredText('name', 'N')({ name: '   ' }), { field: 'name', message: 'N' });
});

test('requiredText: ontbrekend veld valt terug op de fout (?? \'\')', () => {
  assert.deepEqual(requiredText('name', 'N')({}), { field: 'name', message: 'N' });
});

// --- positive ---------------------------------------------------------------
test('positive: exact 0 faalt, exact 1 slaagt (grenswaarde > 0)', () => {
  assert.deepEqual(positive('amt', 'A')({ amt: 0 }), { field: 'amt', message: 'A' });
  assert.equal(positive('amt', 'A')({ amt: 1 }), null);
});

test('positive: negatief en NaN/ontbrekend falen, numerieke string slaagt', () => {
  assert.deepEqual(positive('amt', 'A')({ amt: -5 }), { field: 'amt', message: 'A' });
  assert.deepEqual(positive('amt', 'A')({ amt: 'x' }), { field: 'amt', message: 'A' });
  assert.deepEqual(positive('amt', 'A')({}), { field: 'amt', message: 'A' });
  assert.equal(positive('amt', 'A')({ amt: '5' }), null);
});

// --- when -------------------------------------------------------------------
test('when: predicate waar → geen fout, onwaar → fout op het opgegeven veld', () => {
  const rule = when('participants', (v) => v.selected.length > 0, 'kies iemand');
  assert.equal(rule({ selected: ['a'] }), null);
  assert.deepEqual(rule({ selected: [] }), { field: 'participants', message: 'kies iemand' });
});

test('when: de foutsleutel mag verschillen van het gelezen veld', () => {
  // leest `selected`, maar legt de fout op `participants`.
  const rule = when('participants', (v) => (v.selected ?? []).length > 0, 'leeg');
  assert.equal(rule({ selected: [] }).field, 'participants');
});

// --- firstErrorField --------------------------------------------------------
test('firstErrorField: geen fouten → null', () => {
  assert.equal(firstErrorField({}, ['title', 'date']), null);
});

test('firstErrorField: zonder argumenten → null (default-params)', () => {
  assert.equal(firstErrorField(), null);
});

test('firstErrorField: kiest het eerste veld uit de volgorde, niet uit errors-key-volgorde', () => {
  const errors = { date: 'd', title: 't' }; // errors-insertievolgorde: date eerst
  // De volgorde bepaalt de prioriteit: title staat vooraan → title wint.
  assert.equal(firstErrorField(errors, ['title', 'date']), 'title');
  // Omgekeerde volgorde → date wint (anders overleeft de volgorde-lus-mutant).
  assert.equal(firstErrorField(errors, ['date', 'title']), 'date');
});

test('firstErrorField: een naar undefined gewiste fout telt niet mee', () => {
  assert.equal(firstErrorField({ title: undefined, date: 'd' }, ['title', 'date']), 'date');
});

test('firstErrorField: lege volgorde → eerste sleutel met een fout uit errors', () => {
  assert.equal(firstErrorField({ title: undefined, date: 'd' }, []), 'date');
});

test('firstErrorField: veld in de volgorde zonder fout wordt overgeslagen', () => {
  assert.equal(firstErrorField({ date: 'd' }, ['title', 'date']), 'date');
});

// --- isDirty ----------------------------------------------------------------
test('isDirty: gelijke waarden → niet gewijzigd (false)', () => {
  assert.equal(isDirty({ a: 1, b: 'x' }, { a: 1, b: 'x' }), false);
});

test('isDirty: verschillende waarden → gewijzigd (true)', () => {
  assert.equal(isDirty({ a: 1 }, { a: 2 }), true);
});

test('isDirty: default serialize is JSON.stringify (aanroep zonder derde arg)', () => {
  // Datums serialiseren via JSON naar dezelfde ISO-string → niet gewijzigd.
  const d1 = new Date('2026-07-01T00:00:00Z');
  const d2 = new Date('2026-07-01T00:00:00Z');
  assert.equal(isDirty({ due: d1 }, { due: d2 }), false);
});

test('isDirty: een genormaliseerde serialize negeert cosmetische verschillen', () => {
  const norm = (v) => JSON.stringify({ title: String(v.title).trim() });
  // "Afwas " vs "Afwas" is met de norm-serialize niet gewijzigd, maar met JSON wél.
  assert.equal(isDirty({ title: 'Afwas ' }, { title: 'Afwas' }, norm), false);
  assert.equal(isDirty({ title: 'Afwas ' }, { title: 'Afwas' }), true);
});
