// Units voor de pure export-/deel-formatters (PLT-4). Zie lib/export.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groceriesAsText, balancesAsCsv } from '../lib/export.js';

test('groceriesAsText: alleen open items, met hoeveelheid; titel bovenaan', () => {
  const out = groceriesAsText([
    { name: 'Melk', quantity: '2 pak', checked: false },
    { name: 'Brood', quantity: '', checked: false },
    { name: 'Kaas', quantity: '1', checked: true },     // afgevinkt → weg
    { name: '   ', quantity: 'x' },                       // lege naam → overslaan
    null,                                                 // kapot → overslaan
  ]);
  assert.equal(out, 'Boodschappen\n- Melk (2 pak)\n- Brood');
});

test('groceriesAsText: includeChecked toont ook afgevinkte; eigen titel', () => {
  const out = groceriesAsText(
    [{ name: 'Melk', checked: false }, { name: 'Kaas', checked: true }],
    { title: 'Lijst', includeChecked: true },
  );
  assert.equal(out, 'Lijst\n- Melk\n- Kaas');
});

test('groceriesAsText: lege/alleen-afgevinkte lijst → rustige melding, geen kale titel', () => {
  assert.equal(groceriesAsText([]), 'Boodschappen\nDe lijst is leeg.');
  assert.equal(groceriesAsText([{ name: 'Kaas', checked: true }]), 'Boodschappen\nDe lijst is leeg.');
  assert.equal(groceriesAsText(), 'Boodschappen\nDe lijst is leeg.');
  assert.equal(groceriesAsText([], { emptyLabel: 'Niets meer nodig.' }), 'Boodschappen\nNiets meer nodig.');
});

test('groceriesAsText: whitespace in naam/hoeveelheid wordt getrimd', () => {
  assert.equal(groceriesAsText([{ name: '  Appels ', quantity: '  3 stuks ' }]), 'Boodschappen\n- Appels (3 stuks)');
});

test('balancesAsCsv: puntkomma + komma-decimaal, header, op naam gesorteerd', () => {
  const out = balancesAsCsv([
    { name: 'Sam', cents: -1250 },
    { name: 'Erik', cents: 1250 },
  ]);
  assert.equal(out, 'Naam;Saldo\nErik;12,50\nSam;-12,50');
});

test('balancesAsCsv: centen-notatie — nul, enkele cent, grote bedragen, ontbrekend veld', () => {
  const out = balancesAsCsv([
    { name: 'A', cents: 0 },
    { name: 'B', cents: 5 },
    { name: 'C', cents: 100000 },
    { name: 'D' },                    // cents ontbreekt → 0
  ]);
  assert.equal(out, 'Naam;Saldo\nA;0,00\nB;0,05\nC;1000,00\nD;0,00');
});

test('balancesAsCsv: CSV-escaping van namen met puntkomma/quote; kapotte rijen weg', () => {
  const out = balancesAsCsv([
    { name: 'Jan; de Vries', cents: 100 },
    { name: 'Say "hi"', cents: -100 },
    { name: '  ', cents: 5 },          // lege naam → weg
    null,                              // kapot → weg
  ]);
  // localeCompare('nl'): "Jan..." vóór "Say..."
  assert.equal(out, 'Naam;Saldo\n"Jan; de Vries";1,00\n"Say ""hi""";-1,00');
});

test('balancesAsCsv: lege invoer → alleen de header; eigen kop', () => {
  assert.equal(balancesAsCsv([]), 'Naam;Saldo');
  assert.equal(balancesAsCsv(), 'Naam;Saldo');
  assert.equal(balancesAsCsv([{ name: 'A', cents: 100 }], { header: ['Lid', 'Bedrag'] }), 'Lid;Bedrag\nA;1,00');
});
