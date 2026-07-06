// Unit-tests voor lib/assistantUi.js — de catalog-poortwachter van de assistent.
// Mutatie-gaten die we hier expliciet dichtdrukken (CLAUDE.md): grenswaarden
// (lege string vs. whitespace), default-params (aanroep zonder argument),
// null/ontbrekend veld → drop of degradatie, en de route-whitelist ('/').
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_TYPES, ACTION_UI_STATES, normalizeNode, normalizeTree, treeToText, pendingActionIds } from '../lib/assistantUi.js';

test('CATALOG_TYPES blijft de afgesproken vaste set (plan 23, +recipe AI-12, +chart/schedule/choice AI-16)', () => {
  assert.deepEqual(CATALOG_TYPES, ['text', 'card', 'list', 'keyvalue', 'confirm_action', 'link', 'recipe', 'chart', 'schedule', 'choice']);
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

test('normalizeNode: confirm_action vereist actionId én summary; defaults voor items/status', () => {
  const ok = normalizeNode({ type: 'confirm_action', actionId: 'a1', summary: 'Taak aanmaken' });
  assert.deepEqual(ok, { type: 'confirm_action', actionId: 'a1', summary: 'Taak aanmaken', items: [], status: 'pending' });
  assert.equal(normalizeNode({ type: 'confirm_action', actionId: 'a1' }), null);
  assert.equal(normalizeNode({ type: 'confirm_action', summary: 's' }), null);
});

test('normalizeNode: confirm_action multi-edit — alleen items met integer-id ≥ 0 én tekst blijven', () => {
  const node = normalizeNode({
    type: 'confirm_action',
    actionId: 'a1',
    summary: '3 dingen',
    items: [
      { id: 0, text: 'Melk' },
      { id: 1, text: '' },        // lege tekst → weg
      { id: -1, text: 'X' },      // negatieve id → weg
      { id: '2', text: 'Y' },     // string-id → weg (id's zijn server-args-indexen)
      { id: 2, text: 'Kaas' },
    ],
    status: 'done',
  });
  assert.deepEqual(node.items, [{ id: 0, text: 'Melk' }, { id: 2, text: 'Kaas' }]);
  assert.equal(node.status, 'done');
});

test('normalizeNode: confirm_action met onbekende status valt terug op pending', () => {
  const node = normalizeNode({ type: 'confirm_action', actionId: 'a1', summary: 's', status: 'geheim' });
  assert.equal(node.status, 'pending');
  assert.equal(normalizeNode({ type: 'confirm_action', actionId: 'a1', summary: 's', items: 'rommel' }).items.length, 0);
});

test('ACTION_UI_STATES: vocabulaire ligt exact vast en elke staat passeert de poortwachter', () => {
  assert.deepEqual(ACTION_UI_STATES, ['pending', 'executing', 'done', 'failed', 'rejected', 'undone', 'expired']);
  for (const status of ACTION_UI_STATES) {
    const node = normalizeNode({ type: 'confirm_action', actionId: 'a1', summary: 's', status });
    assert.equal(node.status, status);
  }
});

test('normalizeNode: confirm_action overleeft null/rommel-items zonder crash', () => {
  const node = normalizeNode({
    type: 'confirm_action', actionId: 'a1', summary: 's',
    items: [null, 'tekst', { id: 0, text: 'ok' }, {}],
  });
  assert.deepEqual(node.items, [{ id: 0, text: 'ok' }]);
});

test('normalizeNode: link alleen naar interne routes (moet met "/" beginnen)', () => {
  const ok = normalizeNode({ type: 'link', label: 'Naar taken', route: '/taken' });
  assert.deepEqual(ok, { type: 'link', label: 'Naar taken', route: '/taken' });
  assert.equal(normalizeNode({ type: 'link', label: 'x', route: 'https://evil.example' }), null);
  assert.equal(normalizeNode({ type: 'link', label: 'x', route: 'taken' }), null);
  assert.equal(normalizeNode({ type: 'link', label: '', route: '/taken' }), null);
});

test('normalizeNode: onbekend type degradeert naar tekst (text vóór title), anders null', () => {
  // 'gauge' bestaat (nog) niet — precies de oude-client-route waarop nieuwe
  // server-nodes met een text-fallback leesbaar blijven (plan 26).
  assert.deepEqual(normalizeNode({ type: 'gauge', text: 'meter-tekst', title: 't' }), { type: 'text', text: 'meter-tekst' });
  assert.deepEqual(normalizeNode({ type: 'gauge', title: 'alleen titel' }), { type: 'text', text: 'alleen titel' });
  assert.equal(normalizeNode({ type: 'gauge', data: [1, 2] }), null);
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

test('treeToText: lijst zonder titel geeft alleen de items (geen losse dubbele punt)', () => {
  assert.equal(
    treeToText(normalizeTree([{ type: 'list', items: [{ text: 'melk' }, { text: 'brood' }] }])),
    'melk, brood'
  );
});

test('normalizeNode: keyvalue overleeft null-paren en niet-array-pairs', () => {
  assert.deepEqual(
    normalizeNode({ type: 'keyvalue', pairs: [null, { k: 'A', v: '1' }, { k: '', v: 'x' }] }),
    { type: 'keyvalue', title: null, pairs: [{ k: 'A', v: '1' }] }
  );
  assert.equal(normalizeNode({ type: 'keyvalue', pairs: 'rommel' }), null);
});

// --- Recept-kaart (AI-12): het nieuwe node-type + de "Akkoord met alles"-selector.

test('normalizeNode: recipe normaliseert titel/porties/ingrediënten/stappen veilig', () => {
  assert.deepEqual(
    normalizeNode({
      type: 'recipe', title: 'Pesto', servings: 4,
      ingredients: [{ text: 'Penne · 400 gram' }, { text: '' }, 'rommel'],
      steps: ['Kook', '', 42, 'Meng'],
    }),
    { type: 'recipe', title: 'Pesto', servings: 4, ingredients: [{ text: 'Penne · 400 gram' }], steps: ['Kook', 'Meng'] }
  );
});

test('normalizeNode: recipe met ongeldige servings → null; zonder titel én ingrediënten → drop', () => {
  assert.equal(normalizeNode({ type: 'recipe', title: 'X', servings: 0 }).servings, null);
  assert.equal(normalizeNode({ type: 'recipe', title: 'X', servings: 2.5 }).servings, null);
  assert.equal(normalizeNode({ type: 'recipe', ingredients: [] }), null);
  // Titel zonder ingrediënten mag: een kale recept-kaart blijft geldig.
  assert.equal(normalizeNode({ type: 'recipe', title: 'X' }).type, 'recipe');
});

test('treeToText: recipe geeft titel + ingrediënten (a11y/preview)', () => {
  const [node] = normalizeTree([{ type: 'recipe', title: 'Pesto', ingredients: [{ text: 'Penne' }, { text: 'Pesto' }] }]);
  assert.equal(treeToText([node]), 'Pesto: Penne, Pesto');
});

// --- Interactieve gen-UI (AI-16, plan 26): chart, schedule, choice + de
// --- gestructureerde recept-ingrediënten voor de porties-stepper.

test('normalizeNode: chart vereist geldige punten; kapotte punten vervallen; cap op 12', () => {
  const node = normalizeNode({
    type: 'chart', title: 'Uitgaven per week', unit: 'euro', text: 'fallback voor oude clients',
    points: [
      { label: '1–7', value: 12300 },
      { label: '8–14', value: 0 },          // nul mag (lege week is informatie)
      { label: '', value: 5 },              // leeg label → weg
      { label: 'x', value: -3 },            // negatief → weg
      { label: 'y', value: Number.NaN },    // NaN → weg
      { label: 'z' },                       // geen value → weg
    ],
  });
  assert.deepEqual(node, {
    type: 'chart', title: 'Uitgaven per week', unit: 'euro',
    points: [{ label: '1–7', value: 12300 }, { label: '8–14', value: 0 }],
  });
  // Zonder één geldig punt is er niets te tekenen.
  assert.equal(normalizeNode({ type: 'chart', points: [] }), null);
  assert.equal(normalizeNode({ type: 'chart', points: 'rommel' }), null);
  // Cap: precies MAX_CHART_POINTS staven blijven over.
  const many = normalizeNode({ type: 'chart', points: Array.from({ length: 20 }, (_, i) => ({ label: `p${i}`, value: i + 1 })) });
  assert.equal(many.points.length, 12);
});

test('normalizeNode: chart-unit is alleen "euro" of null (geen verzonnen eenheden)', () => {
  assert.equal(normalizeNode({ type: 'chart', points: [{ label: 'a', value: 1 }], unit: 'euro' }).unit, 'euro');
  assert.equal(normalizeNode({ type: 'chart', points: [{ label: 'a', value: 1 }], unit: 'dollar' }).unit, null);
  assert.equal(normalizeNode({ type: 'chart', points: [{ label: 'a', value: 1 }] }).unit, null);
});

test('normalizeNode: schedule houdt lege dagen (gaten zijn informatie); navigatie via link-nodes', () => {
  const node = normalizeNode({
    type: 'schedule', title: 'Weekmenu', text: 'fallback',
    days: [
      { label: 'ma 6 jul', today: true, entries: [{ text: 'Lasagne', emoji: '🍝' }, { text: '' }] },
      { label: 'di 7 jul', entries: [] },
      { label: '', entries: [{ text: 'weg' }] },   // zonder daglabel → weg
      { label: 'wo 8 jul' },                        // zonder entries-array → lege dag
    ],
  });
  assert.deepEqual(node, {
    type: 'schedule', title: 'Weekmenu',
    days: [
      { label: 'ma 6 jul', today: true, entries: [{ text: 'Lasagne', emoji: '🍝' }] },
      { label: 'di 7 jul', today: false, entries: [] },
      { label: 'wo 8 jul', today: false, entries: [] },
    ],
  });
  assert.equal(normalizeNode({ type: 'schedule', days: [] }), null);
  // Cap: nooit meer dan MAX_SCHEDULE_DAYS rijen.
  const many = normalizeNode({ type: 'schedule', days: Array.from({ length: 20 }, (_, i) => ({ label: `dag ${i}` })) });
  assert.equal(many.days.length, 14);
});

test('normalizeNode: choice vereist prompt én minstens één optie met label+reply; cap op 6', () => {
  const node = normalizeNode({
    type: 'choice', prompt: 'Welke bedoel je?', text: 'fallback',
    options: [
      { label: 'Lasagne', description: '4 porties', reply: 'Gebruik het recept "Lasagne"' },
      { label: 'Zonder reply' },
      { label: '', reply: 'x' },
      { label: 'Pasta pesto', reply: 'Gebruik het recept "Pasta pesto"' },
    ],
  });
  assert.deepEqual(node, {
    type: 'choice', prompt: 'Welke bedoel je?',
    options: [
      { label: 'Lasagne', description: '4 porties', reply: 'Gebruik het recept "Lasagne"' },
      { label: 'Pasta pesto', description: null, reply: 'Gebruik het recept "Pasta pesto"' },
    ],
  });
  assert.equal(normalizeNode({ type: 'choice', options: [{ label: 'x', reply: 'y' }] }), null); // geen prompt
  assert.equal(normalizeNode({ type: 'choice', prompt: 'p', options: [] }), null);
  const many = normalizeNode({ type: 'choice', prompt: 'p', options: Array.from({ length: 9 }, (_, i) => ({ label: `o${i}`, reply: `r${i}` })) });
  assert.equal(many.options.length, 6);
});

test('normalizeNode: recipe houdt gestructureerde ingrediëntvelden alleen compleet (naam+hoeveelheid)', () => {
  const node = normalizeNode({
    type: 'recipe', title: 'Pesto', servings: 4,
    ingredients: [
      { text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' },
      { text: 'Zout naar smaak', name: 'Zout' },                    // geen quantity → alleen tekst
      { text: 'Basilicum · 1 bos', quantity: 1, unit: 'bos' },      // geen naam → alleen tekst
      { text: 'Olie · x', name: 'Olie', quantity: Number.NaN },     // kapotte quantity → alleen tekst
    ],
  });
  assert.deepEqual(node.ingredients, [
    { text: 'Penne · 400 gram', name: 'Penne', quantity: 400, unit: 'gram' },
    { text: 'Zout naar smaak' },
    { text: 'Basilicum · 1 bos' },
    { text: 'Olie · x' },
  ]);
});

test('treeToText: chart/schedule/choice blijven leesbaar (a11y/tabelvorm)', () => {
  const nodes = normalizeTree([
    { type: 'chart', title: 'Uitgaven', points: [{ label: 'wk1', value: 100 }, { label: 'wk2', value: 250 }] },
    { type: 'schedule', title: 'Weekmenu', days: [
      { label: 'ma', entries: [{ text: 'Lasagne' }] },
      { label: 'di', entries: [] },
    ] },
    { type: 'choice', prompt: 'Welke?', options: [{ label: 'A', reply: 'a' }, { label: 'B', reply: 'b' }] },
  ]);
  assert.equal(
    treeToText(nodes),
    'Uitgaven: wk1 100, wk2 250\nWeekmenu — ma: Lasagne; di: —\nWelke? A / B'
  );
});

test('pendingActionIds: alleen openstaande confirm_action-nodes, ≥2 stuurt de bundel-knop', () => {
  const tree = [
    { type: 'text', text: 'hoi' },
    { type: 'confirm_action', actionId: 'a1', summary: 's', items: [], status: 'pending' },
    { type: 'confirm_action', actionId: 'a2', summary: 's', items: [], status: 'done' },      // al verwerkt → niet mee
    { type: 'confirm_action', actionId: 'a3', summary: 's', items: [] },                       // geen status = pending
  ];
  assert.deepEqual(pendingActionIds(tree), ['a1', 'a3']);
  assert.deepEqual(pendingActionIds([]), []);
  assert.deepEqual(pendingActionIds(), []);
});
