// Unit-tests voor supabase/functions/assistant/core.js — de pure agent-loop-kern.
// Mutatie-focus: grenswaarde van het iteratie-budget (< vs <=), history-clamp op de
// exacte rand (behoudt de RECENTSTE), default-params (aanroep zonder argument), en
// null/rommel-bestendig parsen van chat-responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOOL_ITERATIONS,
  MAX_HISTORY_MESSAGES,
  SYSTEM_PROMPT,
  SUGGEST_TOOL,
  splitSuggestions,
  historyFromRows,
  titleFromMessage,
  filterTools,
  toChatTools,
  parseChatResponse,
  toolResultMessage,
  clampHistory,
  buildContextSnapshot,
  openProposalsNote,
  shouldContinueLoop,
  buildTurnResult,
  toResponsesTools,
  parseResponsesOutput,
  functionCallOutputItem,
  drainSseBuffer,
  clientEventsFromRouterEvent,
  statusLabelMap,
  sseLine,
} from '../supabase/functions/assistant/core.js';

test('SYSTEM_PROMPT: bevat de gedrags-ankers (persona, geen-tool-bij-groet, HITL, eerlijkheid)', () => {
  for (const anker of [
    'Huishoek Assistent',
    'behulpzame huisgenoot',
    'verzin nooit data',
    'groet, bedankje',
    'géén tool-call',
    'bevestiging van de gebruiker',
    'BEKNOPT',
    '1 tot 3 korte zinnen',
    'suggest_replies',
  ]) {
    assert.ok(SYSTEM_PROMPT.includes(anker), `prompt mist anker: "${anker}"`);
  }
});

const TOOLS = [
  { name: 'get_open_tasks', moduleKey: 'taken', kind: 'read', description: 'd', parameters: { type: 'object' } },
  { name: 'create_task', moduleKey: 'taken', kind: 'write', description: 'd', parameters: { type: 'object' } },
  { name: 'get_grocery_list', moduleKey: 'boodschappen', kind: 'read', description: 'd', parameters: { type: 'object' } },
];

test('filterTools: alleen ingeschakelde modules, standaard alleen read', () => {
  assert.deepEqual(filterTools(TOOLS, ['taken']).map((t) => t.name), ['get_open_tasks']);
  assert.deepEqual(filterTools(TOOLS, ['taken', 'boodschappen']).map((t) => t.name), ['get_open_tasks', 'get_grocery_list']);
});

test('filterTools: includeWrite laat write-tools toe; zonder modules niets; default-arg', () => {
  assert.deepEqual(filterTools(TOOLS, ['taken'], { includeWrite: true }).map((t) => t.name), ['get_open_tasks', 'create_task']);
  assert.deepEqual(filterTools(TOOLS, []), []);
  assert.deepEqual(filterTools(TOOLS), []);
});

test('toChatTools: mapt naar OpenAI-vorm; zonder argument leeg', () => {
  const mapped = toChatTools([TOOLS[0]]);
  assert.deepEqual(mapped, [{
    type: 'function',
    function: { name: 'get_open_tasks', description: 'd', parameters: { type: 'object' } },
  }]);
  assert.deepEqual(toChatTools(), []);
});

test('parseChatResponse: tekst + tool-calls met JSON-args', () => {
  const data = {
    choices: [{ message: {
      role: 'assistant', content: 'Even kijken…',
      tool_calls: [{ id: 'c1', function: { name: 'get_open_tasks', arguments: '{"range":"week"}' } }],
    } }],
  };
  const parsed = parseChatResponse(data);
  assert.equal(parsed.text, 'Even kijken…');
  assert.deepEqual(parsed.toolCalls, [{ id: 'c1', name: 'get_open_tasks', args: { range: 'week' } }]);
  assert.equal(parsed.message.role, 'assistant');
});

test('parseChatResponse: rommel-args → lege args; calls zonder id/naam vervallen', () => {
  const data = {
    choices: [{ message: { content: null, tool_calls: [
      { id: 'c1', function: { name: 't', arguments: 'geen json' } },
      { id: 'c2', function: { name: 't', arguments: '[1,2]' } },
      { function: { name: 'zonder-id', arguments: '{}' } },
      { id: 'c3', function: { arguments: '{}' } },
    ] } }],
  };
  const parsed = parseChatResponse(data);
  assert.equal(parsed.text, '');
  assert.deepEqual(parsed.toolCalls, [
    { id: 'c1', name: 't', args: {} },
    { id: 'c2', name: 't', args: {} },
  ]);
});

test('parseChatResponse: parts-array-content (deployments/invoke) wordt samengevoegd', () => {
  const data = { choices: [{ message: { role: 'assistant', content: [
    { type: 'text', text: 'Deel 1. ' },
    { type: 'image', url: 'x' },
    { type: 'text', text: 'Deel 2.' },
  ] } }] };
  assert.equal(parseChatResponse(data).text, 'Deel 1. Deel 2.');
});

test('parseChatResponse: leeg/kapot antwoord → veilige lege vorm', () => {
  assert.deepEqual(parseChatResponse(null), { text: '', toolCalls: [], message: null });
  assert.deepEqual(parseChatResponse({}), { text: '', toolCalls: [], message: null });
});

test('toolResultMessage: JSON-string content, null-bestendig', () => {
  assert.deepEqual(toolResultMessage('c1', { n: 2 }), { role: 'tool', tool_call_id: 'c1', content: '{"n":2}' });
  assert.deepEqual(toolResultMessage('c1', undefined), { role: 'tool', tool_call_id: 'c1', content: 'null' });
});

test('clampHistory: behoudt de recentste berichten, precies op de rand niets knippen', () => {
  const msgs = Array.from({ length: MAX_HISTORY_MESSAGES + 2 }, (_, i) => ({ role: 'user', content: `m${i}` }));
  const clamped = clampHistory(msgs);
  assert.equal(clamped.length, MAX_HISTORY_MESSAGES);
  assert.equal(clamped[clamped.length - 1].content, `m${MAX_HISTORY_MESSAGES + 1}`);
  assert.equal(clamped[0].content, 'm2');
  // Exact op het maximum: onaangetast.
  const exact = Array.from({ length: MAX_HISTORY_MESSAGES }, (_, i) => ({ role: 'user', content: `e${i}` }));
  assert.deepEqual(clampHistory(exact), exact);
});

test('clampHistory: filtert vreemde rollen en niet-arrays; default-arg', () => {
  const mixed = [
    { role: 'system', content: 'weg' },
    { role: 'user', content: 'blijft' },
    { role: 'tool', content: 'weg' },
    { role: 'assistant', content: 'blijft ook' },
    null,
  ];
  assert.deepEqual(clampHistory(mixed).map((m) => m.content), ['blijft', 'blijft ook']);
  assert.deepEqual(clampHistory('rommel'), []);
  assert.deepEqual(clampHistory(), []);
});

test('clampHistory: eigen max wordt gerespecteerd', () => {
  const msgs = [1, 2, 3].map((i) => ({ role: 'user', content: `m${i}` }));
  assert.deepEqual(clampHistory(msgs, 2).map((m) => m.content), ['m2', 'm3']);
});

test('buildContextSnapshot: alle delen, deel-loos leeg, default-arg', () => {
  assert.equal(
    buildContextSnapshot({ today: 'vrijdag 4 juli 2026', memberNames: ['Erik', 'Sam'], moduleLabels: ['Taken'] }),
    'Vandaag is vrijdag 4 juli 2026. Leden van het huishouden: Erik, Sam. Actieve modules: Taken.'
  );
  assert.equal(buildContextSnapshot({ memberNames: ['Erik'] }), 'Leden van het huishouden: Erik.');
  assert.equal(buildContextSnapshot({}), '');
  assert.equal(buildContextSnapshot(), '');
});

test('buildContextSnapshot: briefs verdringen de labellijst; één regel per module (AI-10)', () => {
  const out = buildContextSnapshot({
    moduleLabels: ['taken', 'maaltijden'], // hoort genegeerd te worden zodra er briefs zijn
    moduleBriefs: [
      { label: 'Taken', brief: 'open taken en klusjes' },
      { label: 'Keuken', brief: 'weekmenu en recepten' },
    ],
  });
  assert.equal(out, 'Actieve modules:\n- Taken: open taken en klusjes.\n- Keuken: weekmenu en recepten.');
});

test('buildContextSnapshot: schermregel is aanwijzing-geen-beperking; voorstellen-nota plakt achteraan', () => {
  const out = buildContextSnapshot({
    today: '2026-07-05',
    screenLabel: 'Boodschappen',
    proposalsNote: 'NOTA',
  });
  assert.equal(
    out,
    'Vandaag is 2026-07-05. De gebruiker kijkt nu naar het scherm "Boodschappen" — gebruik dit als aanwijzing waar de vraag over kan gaan, niet als beperking. NOTA'
  );
  // Zonder scherm/nota geen loze regels.
  assert.equal(buildContextSnapshot({ screenLabel: '', proposalsNote: '' }), '');
});

test('openProposalsNote: alleen pending, met items en bewerkt-markering', () => {
  const rows = [
    { content: { status: 'done', summary: 'oud voorstel' } },
    { content: { status: 'pending', summary: 'Voorstel A', items: ['een', 'twee'] } },
    { content: { status: 'pending', summary: 'Voorstel B', items: [], edited_by_user: true } },
  ];
  const note = openProposalsNote(rows);
  assert.match(note, /^Openstaand voorstel, wacht op bevestiging/);
  assert.match(note, /- Voorstel A \[een \| twee\]\n/);
  assert.match(note, /- Voorstel B \(door de gebruiker bewerkt\)/);
  assert.doesNotMatch(note, /oud voorstel/);
  assert.match(note, /Zeg niet dat dit al is uitgevoerd/);
});

test('openProposalsNote: leeg bij geen pending; max klemt op de recentste; default-args', () => {
  assert.equal(openProposalsNote([]), '');
  assert.equal(openProposalsNote(), '');
  assert.equal(openProposalsNote([{ content: { status: 'rejected', summary: 'x' } }]), '');
  const veel = Array.from({ length: 5 }, (_, i) => ({ content: { status: 'pending', summary: `V${i}` } }));
  const note = openProposalsNote(veel, 2);
  assert.doesNotMatch(note, /V2\b/); // alleen de laatste twee (V3, V4)
  assert.match(note, /V3/);
  assert.match(note, /V4/);
});

test('historyFromRows: alleen user/assistant met tekst, in volgorde; rommel-bestendig; default-arg', () => {
  const rows = [
    { role: 'user', content: { v: 1, text: 'Vraag 1' } },
    { role: 'tool', content: { v: 1, text: 'tool-ruis' } },
    { role: 'assistant', content: { v: 1, text: 'Antwoord 1' } },
    { role: 'assistant', content: { v: 1, text: '' } },
    { role: 'action', content: { v: 1, text: 'pending' } },
    { role: 'user', content: {} },
    null,
  ];
  assert.deepEqual(historyFromRows(rows), [
    { role: 'user', content: 'Vraag 1' },
    { role: 'assistant', content: 'Antwoord 1' },
  ]);
  assert.deepEqual(historyFromRows(), []);
  assert.deepEqual(historyFromRows('rommel'), []);
});

test('titleFromMessage: korte titel blijft heel, lange knipt op woordgrens met …, alleen de eerste regel', () => {
  assert.equal(titleFromMessage('Hoeveel open taken heb ik?'), 'Hoeveel open taken heb ik?');
  assert.equal(titleFromMessage('Wat staat er deze week allemaal op de planning voor het hele gezin?'), 'Wat staat er deze week allemaal op de…');
  assert.equal(titleFromMessage('Eerste regel\nTweede regel'), 'Eerste regel');
  assert.equal(titleFromMessage('  spaties  '), 'spaties');
  assert.equal(titleFromMessage(), '');
  // Precies 40 tekens: geen knip.
  const exact = 'a'.repeat(40);
  assert.equal(titleFromMessage(exact), exact);
  // 41 tekens zonder spatie vóór positie 20: harde knip + ….
  assert.equal(titleFromMessage('b'.repeat(41)), `${'b'.repeat(40)}…`);
});

test('shouldContinueLoop: alleen bij tool-calls én binnen budget (exacte rand)', () => {
  const withCalls = { toolCalls: [{}] };
  assert.equal(shouldContinueLoop(withCalls, 1), true);
  assert.equal(shouldContinueLoop(withCalls, MAX_TOOL_ITERATIONS - 1), true);
  assert.equal(shouldContinueLoop(withCalls, MAX_TOOL_ITERATIONS), false);
  assert.equal(shouldContinueLoop({ toolCalls: [] }, 1), false);
});

test('buildTurnResult: model-tekst als text-node + alleen tool-render-nodes + choices', () => {
  const out = buildTurnResult('Klaar!', [
    { data: { n: 1 }, render: [{ type: 'card', title: 'Taken', lines: ['1 open'] }] },
    { data: {} }, // geen render → niets
    null,
  ], ['Laat de boodschappen zien']);
  assert.deepEqual(out, {
    v: 1,
    text: 'Klaar!',
    tree: [
      { type: 'text', text: 'Klaar!' },
      { type: 'card', title: 'Taken', lines: ['1 open'] },
    ],
    choices: ['Laat de boodschappen zien'],
  });
  assert.deepEqual(buildTurnResult('x', []).choices, []);
});

test('splitSuggestions: haalt suggest_replies eruit, knipt/limiteert opties tot 4, houdt echte calls over', () => {
  const { calls, choices } = splitSuggestions([
    { id: 'c1', name: 'get_open_tasks', args: {} },
    { id: 'c2', name: SUGGEST_TOOL.name, args: { options: ['  Optie één  ', '', 42, 'Twee', 'Drie', 'Vier', 'Vijf'] } },
  ]);
  assert.deepEqual(calls.map((c) => c.name), ['get_open_tasks']);
  assert.deepEqual(choices, ['Optie één', 'Twee', 'Drie', 'Vier']);
});

test('SUGGEST_TOOL: het exacte schema is het contract richting het model', () => {
  assert.deepEqual(SUGGEST_TOOL, {
    type: 'function',
    name: 'suggest_replies',
    description: 'Rond je beurt af met 2-4 korte vervolgopties (max 6 woorden per optie) die de gebruiker kan aantikken.',
    parameters: {
      type: 'object',
      properties: { options: { type: 'array', items: { type: 'string' }, description: 'De vervolgopties, in het Nederlands.' } },
      required: ['options'],
    },
  });
});

test('splitSuggestions: zonder suggestions of zonder argument → lege choices', () => {
  const { calls, choices } = splitSuggestions([{ id: 'c1', name: 'get_grocery_list', args: {} }]);
  assert.equal(calls.length, 1);
  assert.deepEqual(choices, []);
  assert.deepEqual(splitSuggestions(), { calls: [], choices: [] });
  assert.deepEqual(splitSuggestions([{ id: 'x', name: SUGGEST_TOOL.name, args: {} }]).choices, []);
});

test('toResponsesTools: vlakke Responses-vorm (geen function-wrapper); default-arg leeg', () => {
  assert.deepEqual(toResponsesTools([TOOLS[0]]), [{
    type: 'function', name: 'get_open_tasks', description: 'd', parameters: { type: 'object' },
  }]);
  assert.deepEqual(toResponsesTools(), []);
});

test('parseResponsesOutput: message-tekst + function_calls met JSON-args en rauwe callItems', () => {
  const data = { output: [
    { type: 'reasoning', content: [] },
    { type: 'message', content: [{ type: 'output_text', text: 'Even ' }, { type: 'output_text', text: 'kijken…' }] },
    { type: 'function_call', call_id: 'c1', name: 'get_open_tasks', arguments: '{"only_mine":true}' },
  ] };
  const parsed = parseResponsesOutput(data);
  assert.equal(parsed.text, 'Even kijken…');
  assert.deepEqual(parsed.toolCalls, [{ id: 'c1', name: 'get_open_tasks', args: { only_mine: true } }]);
  assert.deepEqual(parsed.callItems, [{ type: 'function_call', call_id: 'c1', name: 'get_open_tasks', arguments: '{"only_mine":true}' }]);
});

test('parseResponsesOutput: rommel-args → lege args maar rauwe arguments blijven; kapotte items vervallen', () => {
  const data = { output: [
    { type: 'function_call', call_id: 'c1', name: 't', arguments: 'geen json' },
    { type: 'function_call', name: 'zonder-call-id', arguments: '{}' },
    { type: 'function_call', call_id: 'c2', arguments: '{}' },
    null,
  ] };
  const parsed = parseResponsesOutput(data);
  assert.deepEqual(parsed.toolCalls, [{ id: 'c1', name: 't', args: {} }]);
  assert.equal(parsed.callItems[0].arguments, 'geen json');
  // Ontbrekende arguments-string → '{}' in het rauwe item (Responses vereist een string).
  const noArgs = parseResponsesOutput({ output: [{ type: 'function_call', call_id: 'c3', name: 't' }] });
  assert.equal(noArgs.callItems[0].arguments, '{}');
});

test('parseResponsesOutput: leeg/kapot → veilige lege vorm', () => {
  assert.deepEqual(parseResponsesOutput(null), { text: '', toolCalls: [], callItems: [] });
  assert.deepEqual(parseResponsesOutput({}), { text: '', toolCalls: [], callItems: [] });
});

test('functionCallOutputItem: JSON-output, null-bestendig', () => {
  assert.deepEqual(functionCallOutputItem('c1', { n: 2 }), { type: 'function_call_output', call_id: 'c1', output: '{"n":2}' });
  assert.deepEqual(functionCallOutputItem('c1', undefined), { type: 'function_call_output', call_id: 'c1', output: 'null' });
});

test('buildTurnResult: lege/whitespace-tekst geeft geen lege text-node; default-arg', () => {
  assert.deepEqual(buildTurnResult('   '), { v: 1, text: '   ', tree: [], choices: [] });
  assert.deepEqual(buildTurnResult(null), { v: 1, text: '', tree: [], choices: [] });
});

// ---------------------------------------------------------------------------
// SSE-streaming (AI-5, ronde D)
// ---------------------------------------------------------------------------

test('drainSseBuffer: complete events eruit, onafgemaakte rest blijft staan', () => {
  const chunk = 'data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"half":';
  const { events, rest } = drainSseBuffer(chunk);
  assert.deepEqual(events, [{ a: 1 }, { b: 2 }]);
  assert.equal(rest, 'data: {"half":');
  // De rest + het vervolg leveren samen alsnog het derde event op.
  const round2 = drainSseBuffer(`${rest}3}\n\n`);
  assert.deepEqual(round2.events, [{ half: 3 }]);
  assert.equal(round2.rest, '');
});

test('drainSseBuffer: [DONE], event:-regels, kapotte JSON en niet-strings vallen stil weg', () => {
  const chunk = 'event: response.completed\ndata: {"ok":true}\n\ndata: [DONE]\n\ndata: {kapot\n\n';
  const { events, rest } = drainSseBuffer(chunk);
  assert.deepEqual(events, [{ ok: true }]);
  assert.equal(rest, '');
  assert.deepEqual(drainSseBuffer(null), { events: [], rest: '' });
});

test('drainSseBuffer: buffer zonder compleet event blijft integraal de rest', () => {
  const { events, rest } = drainSseBuffer('data: {"a":1}\n');
  assert.deepEqual(events, []);
  assert.equal(rest, 'data: {"a":1}\n');
});

test('clientEventsFromRouterEvent: tekst-delta wordt delta-event; lege delta niet', () => {
  assert.deepEqual(
    clientEventsFromRouterEvent({ type: 'response.output_text.delta', delta: 'Hoi' }),
    [{ type: 'delta', text: 'Hoi' }]
  );
  assert.deepEqual(clientEventsFromRouterEvent({ type: 'response.output_text.delta', delta: '' }), []);
  assert.deepEqual(clientEventsFromRouterEvent({ type: 'response.output_text.delta' }), []);
});

test('clientEventsFromRouterEvent: function_call-start wordt tool_status(run) met label', () => {
  const ev = { type: 'response.output_item.added', item: { type: 'function_call', name: 'get_open_tasks' } };
  assert.deepEqual(
    clientEventsFromRouterEvent(ev, { get_open_tasks: 'Even in de taken kijken…' }),
    [{ type: 'tool_status', name: 'get_open_tasks', label: 'Even in de taken kijken…', state: 'run' }]
  );
  // Zonder label-map: leeg label, geen crash (default-arg).
  assert.deepEqual(
    clientEventsFromRouterEvent(ev),
    [{ type: 'tool_status', name: 'get_open_tasks', label: '', state: 'run' }]
  );
});

test('clientEventsFromRouterEvent: suggest_replies en overige events blijven onzichtbaar', () => {
  assert.deepEqual(
    clientEventsFromRouterEvent({ type: 'response.output_item.added', item: { type: 'function_call', name: SUGGEST_TOOL.name } }),
    []
  );
  assert.deepEqual(clientEventsFromRouterEvent({ type: 'response.completed', response: {} }), []);
  assert.deepEqual(clientEventsFromRouterEvent({ type: 'response.output_item.added', item: { type: 'reasoning' } }), []);
  assert.deepEqual(clientEventsFromRouterEvent(null), []);
});

test('statusLabelMap: alleen tools met een niet-lege statusLabel; default-arg leeg', () => {
  assert.deepEqual(
    statusLabelMap([
      { name: 'a', statusLabel: 'Even kijken…' },
      { name: 'b', statusLabel: '' },
      { name: 'c' },
    ]),
    { a: 'Even kijken…' }
  );
  assert.deepEqual(statusLabelMap(), {});
});

test('sseLine: exact draadformaat data: {json}\\n\\n', () => {
  assert.equal(sseLine({ type: 'done' }), 'data: {"type":"done"}\n\n');
});
