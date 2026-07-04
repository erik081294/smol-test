// Unit-tests voor lib/assistantUi.js — de catalog-poortwachter van de assistent.
// Mutatie-gaten die we hier expliciet dichtdrukken (CLAUDE.md): grenswaarden
// (lege string vs. whitespace), default-params (aanroep zonder argument),
// null/ontbrekend veld → drop of degradatie, en de route-whitelist ('/').
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_TYPES, normalizeNode, normalizeTree, treeToText } from '../lib/assistantUi.js';

test('CATALOG_TYPES blijft de afgesproken vaste set (≤6, plan 23)', () => {
  assert.deepEqual(CATALOG_TYPES, ['text', 'card', 'list', 'keyvalue', 'confirm_action', 'link']);
});

test('normalizeNode: text vereist niet-lege tekst', () => {
  assert.deepEqual(normalizeNode({ type: 'text', text: 'hoi' }), { type: 'text', text: 'hoi' });
  assert.equal(normalizeNode({ type: 'text', text: '' }), null);
  assert.equal(normalizeNode({ type: 'text', text: '   ' }), null);
  assert.equal(normalizeNode({ type: 'text' }), null);
});

test('normalizeNode: niet-objecten en arrays vervallen', () => {
  assert.equal(normalizeNode(null), null);
  assert.equal(normalizeNode(undefined), null);
  assert.equal(normalizeNode('tekst'), null);
  assert.equal(normalizeNode([{ type: 'text', text: 'x' }]), null);
});

test('normalizeNode: card houdt titel/emoji/regels, filtert rommel-regels', () => {
  const card = normalizeNode({ type: 'card', title: 'Taken', emoji: '✅', lines: ['a', '', 7, 'b'] });
  assert.deepEqual(card, { type: 'card', title: 'Taken', emoji: '✅', lines: ['a', 'b'] });
});

test('normalizeNode: card zonder titel maar mét regels blijft; helemaal leeg → null', () => {
  const only = normalizeNode({ type: 'card', lines: ['x'] });
  assert.deepEqual(only, { type: 'card', title: null, emoji: null, lines: ['x'] });
  assert.equal(normalizeNode({ type: 'card' }), null);
  assert.equal(normalizeNode({ type: 'card', lines: [] }), null);
});

test('normalizeNode: list filtert lege items en vervalt zonder items', () => {
  const list = normalizeNode({ type: 'list', title: 'Boodschappen', items: [{ text: 'melk', emoji: '🥛' }, { text: '' }, null, { text: 'brood' }] });
  assert.deepEqual(list, {
    type: 'list',
    title: 'Boodschappen',
    items: [{ text: 'melk', emoji: '🥛' }, { text: 'brood', emoji: null }],
  });
  assert.equal(normalizeNode({ type: 'list', items: [] }), null);
  assert.equal(normalizeNode({ type: 'list' }), null);
});

test('normalizeNode: keyvalue vereist k én v per paar', () => {
  const kv = normalizeNode({ type: 'keyvalue', pairs: [{ k: 'Totaal', v: '€ 12' }, { k: 'Zonder v' }, { v: 'zonder k' }] });
  assert.deepEqual(kv, { type: 'keyvalue', title: null, pairs: [{ k: 'Totaal', v: '€ 12' }] });
  assert.equal(normalizeNode({ type: 'keyvalue', pairs: [{ k: 'x', v: '' }] }), null);
});

test('normalizeNode: confirm_action vereist actionId én summary', () => {
  const ok = normalizeNode({ type: 'confirm_action', actionId: 'a1', summary: 'Taak aanmaken' });
  assert.deepEqual(ok, { type: 'confirm_action', actionId: 'a1', summary: 'Taak aanmaken' });
  assert.equal(normalizeNode({ type: 'confirm_action', actionId: 'a1' }), null);
  assert.equal(normalizeNode({ type: 'confirm_action', summary: 's' }), null);
});

test('normalizeNode: link alleen naar interne routes (moet met "/" beginnen)', () => {
  const ok = normalizeNode({ type: 'link', label: 'Naar taken', route: '/taken' });
  assert.deepEqual(ok, { type: 'link', label: 'Naar taken', route: '/taken' });
  assert.equal(normalizeNode({ type: 'link', label: 'x', route: 'https://evil.example' }), null);
  assert.equal(normalizeNode({ type: 'link', label: 'x', route: 'taken' }), null);
  assert.equal(normalizeNode({ type: 'link', label: '', route: '/taken' }), null);
});

test('normalizeNode: onbekend type degradeert naar tekst (text vóór title), anders null', () => {
  assert.deepEqual(normalizeNode({ type: 'chart', text: 'grafiek-tekst', title: 't' }), { type: 'text', text: 'grafiek-tekst' });
  assert.deepEqual(normalizeNode({ type: 'chart', title: 'alleen titel' }), { type: 'text', text: 'alleen titel' });
  assert.equal(normalizeNode({ type: 'chart', data: [1, 2] }), null);
});

test('normalizeTree: zonder argument → lege array (default-param)', () => {
  assert.deepEqual(normalizeTree(), []);
});

test('normalizeTree: accepteert één losse node en filtert nulls', () => {
  assert.deepEqual(normalizeTree({ type: 'text', text: 'solo' }), [{ type: 'text', text: 'solo' }]);
  assert.deepEqual(normalizeTree([null, { type: 'text', text: 'a' }, { type: 'onzin' }]), [{ type: 'text', text: 'a' }]);
});

test('treeToText: zonder argument → lege string; alle node-types leesbaar', () => {
  assert.equal(treeToText(), '');
  const nodes = normalizeTree([
    { type: 'text', text: 'Hoi' },
    { type: 'card', title: 'Taken', lines: ['2 open'] },
    { type: 'list', title: 'Lijst', items: [{ text: 'melk' }, { text: 'brood' }] },
    { type: 'keyvalue', pairs: [{ k: 'Totaal', v: '€ 12' }] },
    { type: 'confirm_action', actionId: 'a', summary: 'Taak aanmaken?' },
    { type: 'link', label: 'Open taken', route: '/taken' },
  ]);
  assert.equal(
    treeToText(nodes),
    'Hoi\nTaken — 2 open\nLijst: melk, brood\nTotaal: € 12\nTaak aanmaken?\nOpen taken'
  );
});

test('treeToText: card zonder titel laat het streepje weg', () => {
  assert.equal(treeToText(normalizeTree([{ type: 'card', lines: ['alleen regel'] }])), 'alleen regel');
});
