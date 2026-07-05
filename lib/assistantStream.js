// @ts-check
// Pure client-kant van de assistent-SSE (AI-5, plan 24 ronde D): het parsen van
// de event-stroom en het opbouwen van de tussenstand. Geen fetch/React hier —
// de hook (useAssistant) leest chunks en voert ze door deze reducer, zodat de
// hele protocol-logica met node:test unit-getest en mutatie-bewaakt is.
//
// Het protocol (gedefinieerd in supabase/functions/assistant/core.js):
//   { type:'delta', text }                      — stukje antwoordtekst
//   { type:'tool_status', name, label, state }  — 'run' bij start, 'done' bij klaar
//   { type:'tree', conversationId, ...turn }    — het definitieve beurt-resultaat
//   { type:'done' } / { type:'error', message } — afronding
// De server- en clientparser zijn bewust twee kleine kopieën: edge en app zijn
// gescheiden deploy-eenheden (Metro bundelt geen supabase/functions en andersom).

/**
 * Trek complete SSE-events uit een tekstbuffer. Retourneert de geparste
 * data-payloads (JSON) + de onafgemaakte rest voor de volgende chunk.
 * `[DONE]` en onparseerbare regels worden stil overgeslagen.
 * @param {string} buf
 * @returns {{ events: any[], rest: string }}
 */
export function drainSse(buf) {
  const events = [];
  let rest = typeof buf === 'string' ? buf : '';
  let idx;
  while ((idx = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw.length === 0 || raw === '[DONE]') continue;
      try {
        events.push(JSON.parse(raw));
      } catch {
        // half of kapot event — overslaan, de stroom gaat door
      }
    }
  }
  return { events, rest };
}

/**
 * @typedef {{ text: string,
 *             running: Array<{name:string, label:string}>,
 *             turn: object|null,
 *             error: string|null,
 *             done: boolean }} StreamState
 */

/** De lege tussenstand van één streamende beurt. @returns {StreamState} */
export function initialStreamState() {
  return { text: '', running: [], turn: null, error: null, done: false };
}

/**
 * Reducer over de client-protocol-events: bouwt de zichtbare tussenstand op.
 * Tekst groeit per delta; `running` volgt welke tools nu bezig zijn (meerdere
 * tegelijk mogelijk); `turn`/`error`/`done` sluiten de beurt af. Onbekende
 * events veranderen niets — een oudere app blijft werken op een nieuwer protocol.
 * @param {StreamState} state
 * @param {any} ev
 * @returns {StreamState}
 */
export function applyStreamEvent(state, ev) {
  switch (ev?.type) {
    case 'delta':
      return typeof ev.text === 'string' && ev.text.length > 0
        ? { ...state, text: state.text + ev.text }
        : state;
    case 'tool_status': {
      if (typeof ev.name !== 'string') return state;
      const others = state.running.filter((r) => r.name !== ev.name);
      const running = ev.state === 'run'
        ? [...others, { name: ev.name, label: typeof ev.label === 'string' ? ev.label : '' }]
        : others;
      return { ...state, running };
    }
    case 'tree':
      return { ...state, turn: ev };
    case 'done':
      return { ...state, done: true };
    case 'error':
      return { ...state, error: typeof ev.message === 'string' && ev.message ? ev.message : 'Er ging iets mis.' };
    default:
      return state;
  }
}

/**
 * De statuszin die de app onder de streamende tekst toont: het label van de
 * recentst gestarte tool die nog bezig is, anders niets.
 * @param {StreamState} state
 * @returns {string}
 */
export function streamStatusLabel(state) {
  const last = state.running[state.running.length - 1];
  return last && last.label ? last.label : '';
}
