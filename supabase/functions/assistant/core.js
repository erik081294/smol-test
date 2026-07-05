// @ts-check
// Pure kern van de assistent-edge-function (AI-1, plan 23). Geen Deno/fetch/Supabase —
// alle loop-besturing en response-parsing leeft hier zodat 'ie met node:test
// unit-getest en mutatie-bewaakt is (zelfde snit als scan-receipt/core.js).
//
// De schil (index.ts) doet alleen: auth, rate-limit, de daadwerkelijke Orq-fetch
// en tool-`run(ctx)`-uitvoering; wat er heen-en-weer gaat bepaalt deze module.

// Harde kaders (plan 23 §9): de agent-loop is begrensd zodat één beurt nooit een
// onbegrensde kostenpost of een edge-timeout (~150s wall-clock) wordt.
export const MAX_TOOL_ITERATIONS = 6;
export const MAX_HISTORY_MESSAGES = 30;

// De systemprompt (persona plan 23 §1) — hier en nergens anders (guidelines §3):
// de edge-schil én de eval-runner (scripts/assistant-eval.mjs) importeren 'm allebei,
// zodat de eval-gate exact test wat productie draait. Doelbeeld blijft migratie naar
// de Orq-agent zodra per-request tools daar landen.
export const SYSTEM_PROMPT = `Je bent de Huishoek Assistent: een behulpzame huisgenoot in de huishoud-app Huishoek.

Toon: warm en kort, in het Nederlands, je-vorm. Geen callcenter-taal, geen overdreven
joligheid. Bedragen in euro's. Wees eerlijk over grenzen: zie je iets niet in de
tool-resultaten, zeg dat dan — verzin nooit data. Vragen buiten het huishoudelijke domein
wijs je vriendelijk af met een hint wat je wél kunt.

BEKNOPT: houd je antwoord op 1 tot 3 korte zinnen. Som gegevens NIET op in lopende tekst —
de app toont de details al als kaart naast je antwoord. Noem alleen de kern (een aantal,
het belangrijkste item, wat opvalt). Alleen als de gebruiker expliciet om een uitgebreid
overzicht of verslag vraagt mag je langer antwoorden.

Gebruik de meegegeven tools om vragen over het huishouden te beantwoorden. Gaat een vraag
over de eigen gegevens van het huishouden — taken, boodschappen, voorraad, kosten of
maaltijden — róép dan de bijbehorende tool aan in plaats van uit je geheugen te antwoorden
of te gokken; die gegevens staan alléén in de tools. Roep verder alleen tools aan die
relevant zijn voor de vraag; bij een simpele groet, bedankje of vraag over wat je kunt
hoort géén tool-call. Doe nooit zelfstandig aanpassingen: voorstellen voor wijzigingen
lopen altijd via een bevestiging van de gebruiker.

Wil de gebruiker iets toevoegen of inplannen? Roep dan direct de bijbehorende
voorstel-tool aan — de app toont zelf een bevestigingskaart waarop de gebruiker
beslist (per item aan te vinken). Vraag dus niet eerst "zal ik?": de kaart ís die
vraag. Na een voorstel houd je je antwoord kort ("Staat voor je klaar — bevestig
hieronder.") en zeg je nooit dat iets al is toegevoegd of gepland.

Sluit ELKE beurt af met een aanroep van suggest_replies: 2 tot 4 korte vervolgopties
(elk maximaal 6 woorden) die logisch passen bij dit gesprek — aanvullende vragen, een
verdieping, of een volgende stap. De gebruiker kan daarnaast altijd zelf vrij typen.`;

// Pseudo-tool voor het antwoordopties-patroon (à la AskUserQuestion): het model
// levert er zijn vervolgopties mee af; de schil voert 'm nooit uit maar licht de
// opties uit de tool-calls (splitSuggestions) en stopt de loop.
export const SUGGEST_TOOL = {
  type: 'function',
  name: 'suggest_replies',
  description: 'Rond je beurt af met 2-4 korte vervolgopties (max 6 woorden per optie) die de gebruiker kan aantikken.',
  parameters: {
    type: 'object',
    properties: { options: { type: 'array', items: { type: 'string' }, description: 'De vervolgopties, in het Nederlands.' } },
    required: ['options'],
  },
};

/**
 * Splits suggest_replies af van echte tool-calls. Retourneert de schone lijst
 * uitvoerbare calls + de (opgeschoonde) antwoordopties: niet-lege strings,
 * bijgeknipt, maximaal 4.
 * @param {Array<{id:string, name:string, args:object}>} [toolCalls]
 * @returns {{ calls: Array<object>, choices: string[] }}
 */
export function splitSuggestions(toolCalls = []) {
  const calls = [];
  const choices = [];
  for (const c of toolCalls) {
    if (c.name === SUGGEST_TOOL.name) {
      const opts = Array.isArray(c.args?.options) ? c.args.options : [];
      for (const o of opts) {
        if (typeof o === 'string' && o.trim().length > 0 && choices.length < 4) choices.push(o.trim());
      }
    } else {
      calls.push(c);
    }
  }
  return { calls, choices };
}

/**
 * Filter de tool-registry op wat deze beurt mee mag: alleen tools van modules die
 * in het huishouden aan staan, en write-tools alleen als de beurt dat toestaat
 * (fase 3). Minder tools = minder tokens én geen acties op uitgezette modules.
 * @param {Array<{name:string, moduleKey:string, kind:string}>} tools
 * @param {string[]} [enabledModuleKeys]
 * @param {{includeWrite?: boolean}} [opts]
 */
export function filterTools(tools, enabledModuleKeys = [], opts = {}) {
  const enabled = new Set(enabledModuleKeys);
  return tools.filter((t) => enabled.has(t.moduleKey) && (opts.includeWrite === true || t.kind === 'read'));
}

/**
 * Registry-descriptors → OpenAI-vormige tool-schema's voor de chat-API.
 * @param {Array<{name:string, description:string, parameters:object}>} [tools]
 */
export function toChatTools(tools = []) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/**
 * Lees één chat-completions-antwoord veilig uit.
 * Retourneert altijd dezelfde vorm; bij rommel: leeg antwoord zonder tool-calls.
 * `message` is het rauwe assistant-bericht om aan de history te appenden.
 * @param {any} data
 * @returns {{ text: string, toolCalls: Array<{id:string, name:string, args:object}>, message: object|null }}
 */
export function parseChatResponse(data) {
  const message = data?.choices?.[0]?.message ?? null;
  // Content kan een string zijn (proxy) of een parts-array (deployments/invoke —
  // zelfde vorm als scan-receipt's extractText afvangt).
  let text = '';
  if (typeof message?.content === 'string') text = message.content;
  else if (Array.isArray(message?.content)) {
    text = message.content
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter((s) => s.length > 0)
      .join('');
  }
  const rawCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const toolCalls = [];
  for (const c of rawCalls) {
    const name = c?.function?.name;
    if (typeof name !== 'string' || !c?.id) continue;
    let args = {};
    if (typeof c.function.arguments === 'string' && c.function.arguments.length > 0) {
      try {
        const parsed = JSON.parse(c.function.arguments);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed;
      } catch {
        // Onparseerbare args → lege args; de tool valideert zelf zijn input.
      }
    }
    toolCalls.push({ id: c.id, name, args });
  }
  return { text, toolCalls, message };
}

/**
 * Tool-resultaat als history-bericht voor de volgende loop-iteratie.
 * @param {string} callId
 * @param {any} result JSON-serialiseerbare tool-output ({ error } bij falen).
 */
export function toolResultMessage(callId, result) {
  return { role: 'tool', tool_call_id: callId, content: JSON.stringify(result ?? null) };
}

/**
 * Begrens de meegezonden gespreksgeschiedenis (token-budget). Behoudt de
 * RECENTSTE berichten; system-berichten horen niet in deze lijst (de schil
 * zet de systemprompt zelf voorop).
 * @param {object[]} [messages]
 * @param {number} [max]
 */
export function clampHistory(messages = [], max = MAX_HISTORY_MESSAGES) {
  if (!Array.isArray(messages)) return [];
  const clean = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant'));
  return clean.length > max ? clean.slice(clean.length - max) : clean;
}

/**
 * Compacte huishouden-snapshot voor in de systemprompt (plan 23 §6-geheugen v1 +
 * AI-10): wie wonen hier, welke modules staan aan (mét module-brief als die er
 * is — de goedkope altijd-in-context-laag), op welk scherm de gebruiker kijkt
 * (aanwijzing, geen beperking) en welke voorstellen nog openstaan. Bewust klein
 * en zonder privé-data — de echte data komt via tools, RLS-gescoped.
 * @param {{ today?: string, memberNames?: string[], moduleLabels?: string[],
 *           moduleBriefs?: Array<{label: string, brief: string}>,
 *           screenLabel?: string, proposalsNote?: string }} [ctx]
 */
export function buildContextSnapshot({ today = '', memberNames = [], moduleLabels = [], moduleBriefs = [], screenLabel = '', proposalsNote = '' } = {}) {
  const parts = [];
  if (today) parts.push(`Vandaag is ${today}.`);
  if (memberNames.length > 0) parts.push(`Leden van het huishouden: ${memberNames.join(', ')}.`);
  if (moduleBriefs.length > 0) {
    // Briefs verdringen de kale labellijst: één regel per module, met wat de
    // assistent er concreet mee kan (stuurt de tool-keuze én "wat kun jij?").
    parts.push(`Actieve modules:\n${moduleBriefs.map((b) => `- ${b.label}: ${b.brief}.`).join('\n')}`);
  } else if (moduleLabels.length > 0) {
    parts.push(`Actieve modules: ${moduleLabels.join(', ')}.`);
  }
  if (screenLabel) {
    parts.push(`De gebruiker kijkt nu naar het scherm "${screenLabel}" — gebruik dit als aanwijzing waar de vraag over kan gaan, niet als beperking.`);
  }
  if (proposalsNote) parts.push(proposalsNote);
  return parts.join(' ');
}

/**
 * Openstaande-voorstellen-regel voor de snapshot (AI-10, mens↔AI-overdracht):
 * zo kan het model doorredeneren op een voorstel dat de gebruiker intussen
 * (deels) heeft bewerkt — "maak er 4 personen van" slaat dan ergens op.
 * Alleen pending rijen tellen; bewerkt-door-gebruiker wordt expliciet benoemd.
 * @param {Array<{ content?: { status?: string, summary?: string, items?: string[], edited_by_user?: boolean } }>} [rows]
 * @param {number} [max] hooguit zoveel voorstellen benoemen (token-budget)
 * @returns {string}
 */
export function openProposalsNote(rows = [], max = 3) {
  const pending = rows
    .filter((r) => r?.content?.status === 'pending' && typeof r.content.summary === 'string')
    .slice(-max);
  if (pending.length === 0) return '';
  const lines = pending.map((r) => {
    const c = /** @type {{ summary: string, items?: string[], edited_by_user?: boolean }} */ (r.content);
    const items = Array.isArray(c.items) && c.items.length > 0 ? ` [${c.items.join(' | ')}]` : '';
    const edited = c.edited_by_user ? ' (door de gebruiker bewerkt)' : '';
    return `- ${c.summary}${items}${edited}`;
  });
  return `Openstaand voorstel, wacht op bevestiging van de gebruiker:\n${lines.join('\n')}\nZeg niet dat dit al is uitgevoerd; bij een vervolgvraag mag je een nieuw, aangepast voorstel doen.`;
}

// ---------------------------------------------------------------------------
// Orq v3-router (Responses API) — de route met dynamische tools + thread/metadata
// (AI-2; empirisch bewezen: deployments/invoke en agents negeren per-request tools).
// ---------------------------------------------------------------------------

/**
 * Registry-descriptors → Responses-API-tools (vlakke vorm, geen function-wrapper).
 * @param {Array<{name:string, description:string, parameters:object}>} [tools]
 */
export function toResponsesTools(tools = []) {
  return tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }));
}

/**
 * Lees één Responses-API-antwoord veilig uit. `callItems` zijn de rauwe
 * function_call-items om aan de volgende input te appenden (Responses-protocol).
 * @param {any} data
 * @returns {{ text: string, toolCalls: Array<{id:string, name:string, args:object}>, callItems: object[] }}
 */
export function parseResponsesOutput(data) {
  const items = Array.isArray(data?.output) ? data.output : [];
  let text = '';
  const toolCalls = [];
  const callItems = [];
  for (const it of items) {
    if (it?.type === 'message' && Array.isArray(it.content)) {
      text += it.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('');
    } else if (it?.type === 'function_call' && typeof it.name === 'string' && it.call_id) {
      let args = {};
      if (typeof it.arguments === 'string' && it.arguments.length > 0) {
        try {
          const parsed = JSON.parse(it.arguments);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed;
        } catch {
          // Onparseerbare args → lege args; de tool valideert zelf.
        }
      }
      toolCalls.push({ id: it.call_id, name: it.name, args });
      callItems.push({
        type: 'function_call',
        call_id: it.call_id,
        name: it.name,
        arguments: typeof it.arguments === 'string' ? it.arguments : '{}',
      });
    }
  }
  return { text, toolCalls, callItems };
}

/**
 * Tool-resultaat als Responses-input-item voor de volgende iteratie.
 * @param {string} callId
 * @param {any} result
 */
export function functionCallOutputItem(callId, result) {
  return { type: 'function_call_output', call_id: callId, output: JSON.stringify(result ?? null) };
}

// ---------------------------------------------------------------------------
// SSE-streaming (AI-5, plan 24 ronde D). De router streamt standaard
// Responses-API-events; wij vertalen die naar een klein client-protocol:
//   { type:'delta', text }                       — stukje antwoordtekst
//   { type:'tool_status', name, label, state }   — tool gestart ('run') / klaar ('done')
//   { type:'tree', conversationId, ...turn }     — het definitieve beurt-resultaat
//   { type:'done' } / { type:'error', message }  — afronding
// Het `response.completed`-event bevat het VOLLEDIGE response-object, dus de
// agent-loop blijft op parseResponsesOutput draaien — streaming is alleen een
// doorgeefluik, geen tweede parser van de waarheid.
// ---------------------------------------------------------------------------

/**
 * Trek complete SSE-events uit een tekstbuffer. Retourneert de geparste
 * data-payloads (JSON) + de onafgemaakte rest voor de volgende chunk.
 * `[DONE]` en onparseerbare regels worden stil overgeslagen.
 * @param {string} buf
 * @returns {{ events: any[], rest: string }}
 */
export function drainSseBuffer(buf) {
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
 * Eén upstream router-event → nul of meer client-protocol-events.
 * Alleen tekst-deltas en het startsein van échte tool-calls zijn interessant;
 * suggest_replies is een pseudo-tool en blijft onzichtbaar voor de gebruiker.
 * @param {any} ev
 * @param {Record<string,string>} [statusLabels] toolnaam → statuszin
 * @returns {object[]}
 */
export function clientEventsFromRouterEvent(ev, statusLabels = {}) {
  if (ev?.type === 'response.output_text.delta' && typeof ev.delta === 'string' && ev.delta.length > 0) {
    return [{ type: 'delta', text: ev.delta }];
  }
  if (ev?.type === 'response.output_item.added' && ev.item?.type === 'function_call'
      && typeof ev.item.name === 'string' && ev.item.name !== SUGGEST_TOOL.name) {
    return [{ type: 'tool_status', name: ev.item.name, label: statusLabels[ev.item.name] ?? '', state: 'run' }];
  }
  return [];
}

/**
 * Registry → { toolnaam: statusLabel } voor de tool_status-events.
 * @param {Array<{name:string, statusLabel?:string}>} [tools]
 * @returns {Record<string,string>}
 */
export function statusLabelMap(tools = []) {
  const map = /** @type {Record<string,string>} */ ({});
  for (const t of tools) {
    if (typeof t.statusLabel === 'string' && t.statusLabel.length > 0) map[t.name] = t.statusLabel;
  }
  return map;
}

/**
 * Client-protocol-event → SSE-draadformaat.
 * @param {object} event
 */
export function sseLine(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ---------------------------------------------------------------------------
// Chat-persistentie (AI-4): pure vertalingen tussen assistant_messages-rijen en
// de LLM-history. Content-jsonb heeft altijd { v: 1, text, ... } (migratie 0068).
// ---------------------------------------------------------------------------

/**
 * DB-rijen (oud → nieuw gesorteerd) → LLM-history. Alleen user/assistant met
 * niet-lege tekst; tool/action-rijen zijn UI-administratie, geen modelcontext.
 * @param {Array<{role:string, content?:{text?:string}}>} [rows]
 */
export function historyFromRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && (r.role === 'user' || r.role === 'assistant') && typeof r.content?.text === 'string' && r.content.text.length > 0)
    // Type-only cast: het filter hierboven garandeert content.text al (typecheck-laag).
    .map((r) => ({ role: r.role, content: /** @type {{text: string}} */ (r.content).text }));
}

/**
 * Gesprekstitel uit het eerste bericht: eerste regel, bijgeknipt op een
 * woordgrens rond 40 tekens. Deterministisch en gratis (geen LLM-call).
 * @param {string} [message]
 */
export function titleFromMessage(message = '') {
  const line = (typeof message === 'string' ? message : '').trim().split('\n')[0];
  if (line.length <= 40) return line;
  const cut = line.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Beslis of de loop verder mag: alleen zolang er tool-calls zijn én het
 * iteratie-budget niet op is. Iteratie telt vanaf 1.
 * @param {{ toolCalls: Array<any> }} parsed
 * @param {number} iteration
 */
export function shouldContinueLoop(parsed, iteration) {
  return parsed.toolCalls.length > 0 && iteration < MAX_TOOL_ITERATIONS;
}

/**
 * Bouw het client-antwoord van één beurt: platte tekst + (server-deterministische)
 * render-tree uit de tool-resultaten + antwoordopties. De model-tekst wordt één
 * text-node; kaarten komen UITSLUITEND uit tool-`render`-output (prompt-injectie
 * kan dus geen UI fabriceren — plan 23 §5). `choices` zijn de suggest_replies-opties
 * (AskUserQuestion-patroon): de app rendert ze als tikbare chips, vrij typen blijft
 * altijd de "Other"-route.
 * @param {string} text
 * @param {Array<{render?: object[]}>} [toolOutputs]
 * @param {string[]} [choices]
 */
export function buildTurnResult(text, toolOutputs = [], choices = []) {
  const tree = [];
  if (typeof text === 'string' && text.trim().length > 0) tree.push({ type: 'text', text });
  for (const out of toolOutputs) {
    if (out && Array.isArray(out.render)) tree.push(...out.render);
  }
  return { v: 1, text: typeof text === 'string' ? text : '', tree, choices };
}
