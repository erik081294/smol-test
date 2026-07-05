// Units voor de assistent-markdown-subset (AI-5, ronde D). Zie lib/markdownLite.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseBlocks } from '../lib/markdownLite.js';

// --- parseInline -----------------------------------------------------------

test('parseInline: platte tekst wordt één span zonder stijlen', () => {
  assert.deepEqual(parseInline('gewoon een zin'), [{ text: 'gewoon een zin' }]);
});

test('parseInline: **bold** stylet precies het stuk tussen de markers', () => {
  assert.deepEqual(parseInline('je hebt **3 taken** open'), [
    { text: 'je hebt ' },
    { text: '3 taken', bold: true },
    { text: ' open' },
  ]);
});

test('parseInline: *cursief* en `code` naast elkaar, met exacte grenzen', () => {
  assert.deepEqual(parseInline('*nu* en `npm test`'), [
    { text: 'nu', italic: true },
    { text: ' en ' },
    { text: 'npm test', code: true },
  ]);
});

test('parseInline: binnen `code` telt ** niet als marker', () => {
  assert.deepEqual(parseInline('`a ** b`'), [{ text: 'a ** b', code: true }]);
});

test('parseInline: ongesloten ** stylet de rest van de regel (streaming-chunk)', () => {
  assert.deepEqual(parseInline('dit is **belangrij'), [
    { text: 'dit is ' },
    { text: 'belangrij', bold: true },
  ]);
});

test('parseInline: genest — bold binnen italic houdt beide vlaggen', () => {
  assert.deepEqual(parseInline('*een **twee** drie*'), [
    { text: 'een ', italic: true },
    { text: 'twee', bold: true, italic: true },
    { text: ' drie', italic: true },
  ]);
});

test('parseInline: lege string en zonder argument → geen spans', () => {
  assert.deepEqual(parseInline(''), []);
  // @ts-expect-error bewust zonder argument (default-pad)
  assert.deepEqual(parseInline(), []);
});

// --- parseBlocks -----------------------------------------------------------

test('parseBlocks: alinea, kopje en bullets in volgorde, lege regels weg', () => {
  const blocks = parseBlocks('## Vandaag\n\nJe hebt 2 taken:\n- afwas\n- was **draaien**');
  assert.deepEqual(blocks, [
    { type: 'heading', spans: [{ text: 'Vandaag' }] },
    { type: 'paragraph', spans: [{ text: 'Je hebt 2 taken:' }] },
    { type: 'bullet', marker: '•', spans: [{ text: 'afwas' }] },
    { type: 'bullet', marker: '•', spans: [{ text: 'was ' }, { text: 'draaien', bold: true }] },
  ]);
});

test('parseBlocks: genummerde lijst houdt het eigen nummer als marker', () => {
  assert.deepEqual(parseBlocks('1. eerst\n2) daarna'), [
    { type: 'bullet', marker: '1.', spans: [{ text: 'eerst' }] },
    { type: 'bullet', marker: '2.', spans: [{ text: 'daarna' }] },
  ]);
});

test('parseBlocks: * als bullet, maar een regel die met **bold opent blijft alinea', () => {
  assert.deepEqual(parseBlocks('* een punt'), [
    { type: 'bullet', marker: '•', spans: [{ text: 'een punt' }] },
  ]);
  assert.deepEqual(parseBlocks('**Let op:** morgen'), [
    { type: 'paragraph', spans: [{ text: 'Let op:', bold: true }, { text: ' morgen' }] },
  ]);
});

test('parseBlocks: kopje mag t/m 6 hekjes, 7 is gewoon tekst', () => {
  assert.equal(parseBlocks('###### diep')[0].type, 'heading');
  assert.equal(parseBlocks('####### te diep')[0].type, 'paragraph');
});

test('parseBlocks: lege string en zonder argument → geen blokken', () => {
  assert.deepEqual(parseBlocks(''), []);
  // @ts-expect-error bewust zonder argument (default-pad)
  assert.deepEqual(parseBlocks(), []);
});

test('parseBlocks: bullet met inspringing en •-marker wordt herkend', () => {
  assert.deepEqual(parseBlocks('  - ingesprongen\n• dikke punt'), [
    { type: 'bullet', marker: '•', spans: [{ text: 'ingesprongen' }] },
    { type: 'bullet', marker: '•', spans: [{ text: 'dikke punt' }] },
  ]);
});
