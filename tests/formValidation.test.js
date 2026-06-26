// Tests voor de pure formulier-validatie-runner. Draaien met:  npm test
// Deze logica vervangt het per-scherm gekopieerde validate-blok van de entity-editors
// (ARCH-1); ze hoort daarom strak vastgepind onder de mutatie-ratchet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRules, isValid, requiredText, positive, when } from '../lib/formValidation.js';

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
