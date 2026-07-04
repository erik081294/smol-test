// Units voor de pure SSE-client-laag van de assistent (AI-5, ronde D).
// Zie lib/assistantStream.js; het event-protocol is gedefinieerd in
// supabase/functions/assistant/core.js (server) en hier gespiegeld.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainSse, initialStreamState, applyStreamEvent, streamStatusLabel } from '../lib/assistantStream.js';

const run = (events, start = initialStreamState()) => events.reduce(applyStreamEvent, start);

// --- drainSse ----------------------------------------------------------------

test('drainSse: compleet event wordt geparst, halve chunk blijft als rest staan', () => {
  const { events, rest } = drainSse('data: {"type":"delta","text":"hoi"}\n\ndata: {"type":"del');
  assert.deepEqual(events, [{ type: 'delta', text: 'hoi' }]);
  assert.equal(rest, 'data: {"type":"del');
});

test('drainSse: meerdere events in één chunk, in volgorde', () => {
  const buf = 'data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\n';
  const { events, rest } = drainSse(buf);
  assert.deepEqual(events.map((e) => e.text), ['a', 'b']);
  assert.equal(rest, '');
});

test('drainSse: [DONE], lege data-regels en kapotte JSON worden stil overgeslagen', () => {
  const buf = 'data: [DONE]\n\ndata:\n\ndata: {niet-json}\n\ndata: {"type":"done"}\n\n';
  assert.deepEqual(drainSse(buf).events, [{ type: 'done' }]);
});

test('drainSse: niet-data-regels (event:, comments) tellen niet mee', () => {
  const buf = 'event: message\ndata: {"type":"done"}\n\n';
  assert.deepEqual(drainSse(buf).events, [{ type: 'done' }]);
});

test('drainSse: zonder argument of niet-string → leeg en veilig', () => {
  assert.deepEqual(drainSse(undefined), { events: [], rest: '' });
});

// --- applyStreamEvent ----------------------------------------------------------

test('initialStreamState: leeg — geen tekst, niets bezig, niet klaar', () => {
  assert.deepEqual(initialStreamState(), { text: '', running: [], turn: null, error: null, done: false });
});

test('delta: tekst groeit aan in volgorde; lege of ontbrekende text verandert niets', () => {
  const s = run([
    { type: 'delta', text: 'Je hebt ' },
    { type: 'delta', text: '' },
    { type: 'delta' },
    { type: 'delta', text: '3 taken.' },
  ]);
  assert.equal(s.text, 'Je hebt 3 taken.');
});

test('tool_status: run voegt toe, done haalt weg; meerdere tools tegelijk mogelijk', () => {
  let s = run([
    { type: 'tool_status', name: 'get_open_tasks', label: 'Taken ophalen…', state: 'run' },
    { type: 'tool_status', name: 'get_groceries', label: 'Boodschappen…', state: 'run' },
  ]);
  assert.deepEqual(s.running.map((r) => r.name), ['get_open_tasks', 'get_groceries']);
  s = applyStreamEvent(s, { type: 'tool_status', name: 'get_open_tasks', state: 'done' });
  assert.deepEqual(s.running.map((r) => r.name), ['get_groceries']);
});

test('tool_status: zonder naam geen wijziging; herstart van dezelfde tool dupliceert niet', () => {
  const base = run([{ type: 'tool_status', name: 'a', label: 'A…', state: 'run' }]);
  assert.equal(applyStreamEvent(base, { type: 'tool_status', state: 'run' }), base);
  const again = applyStreamEvent(base, { type: 'tool_status', name: 'a', label: 'A…', state: 'run' });
  assert.equal(again.running.length, 1);
});

test('tree/done/error: sluiten de beurt af; onbekende events veranderen niets', () => {
  const turnEv = { type: 'tree', conversationId: 'c1', text: 'klaar', tree: [], choices: ['Ja'] };
  let s = run([turnEv, { type: 'done' }]);
  assert.equal(s.turn, turnEv);
  assert.equal(s.done, true);
  assert.equal(applyStreamEvent(initialStreamState(), { type: 'error', message: 'kapot' }).error, 'kapot');
  // error zonder message → de neutrale fallback-tekst
  assert.equal(applyStreamEvent(initialStreamState(), { type: 'error' }).error, 'Er ging iets mis.');
  const before = initialStreamState();
  assert.equal(applyStreamEvent(before, { type: 'toekomstig_event' }), before);
  assert.equal(applyStreamEvent(before, null), before);
});

// --- streamStatusLabel ---------------------------------------------------------

test('streamStatusLabel: label van de recentst gestarte tool die nog bezig is', () => {
  const s = run([
    { type: 'tool_status', name: 'a', label: 'Eerste…', state: 'run' },
    { type: 'tool_status', name: 'b', label: 'Tweede…', state: 'run' },
  ]);
  assert.equal(streamStatusLabel(s), 'Tweede…');
  assert.equal(streamStatusLabel(applyStreamEvent(s, { type: 'tool_status', name: 'b', state: 'done' })), 'Eerste…');
});

test('streamStatusLabel: leeg als er niets (meer) draait of het label ontbreekt', () => {
  assert.equal(streamStatusLabel(initialStreamState()), '');
  const s = run([{ type: 'tool_status', name: 'a', state: 'run' }]);
  assert.equal(streamStatusLabel(s), '');
});
