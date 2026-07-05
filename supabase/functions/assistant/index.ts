// Supabase Edge Function: assistant (AI-1, plan 23) — de Huishoek Assistent.
//
// Dunne schil om de pure kern (./core.js) en de tool-registry (../_shared/assistantTools.js):
//   1. auth (verify_jwt) + rate-limit via DB-RPC `record_assistant_call` (0068, fail-closed);
//   2. agent-loop: Orq-gateway ⇄ read-tools, uitgevoerd tegen een RLS-GEBONDEN
//      supabase-client (user-JWT) — de database bepaalt wat de vrager mag zien;
//   3. antwoord: { v:1, text, tree } — de tree komt deterministisch uit tool-output
//      (lib/assistantUi.js normaliseert 'm nogmaals aan de app-kant).
//
// Antwoordvorm: met body.stream=true een SSE-stroom (AI-5, ronde D — protocol
// delta|tool_status|tree|done|error, zie core.js); anders één JSON-antwoord.
// LLM-route (AI-2, plan 24 ronde A): DUAL —
//   - bevat ORQ_ASSISTANT_MODEL een provider-prefix ("google/eu.claude-sonnet-5"), dan via
//     de v3-router (Responses API): dynamische tools + thread (=conversatie) + metadata
//     (GEHASHTE ids — nooit PII, guidelines §7) → rijke traces in Orq.
//     (Empirisch vastgesteld 2026-07-04: deployments/invoke en agents negeren per-request
//     tools; de v3-router is de enige route met alle drie. Prompt blijft daarom hier.)
//   - zonder prefix ("eu.claude-sonnet-5"): de OpenAI-compatibele proxy (fallback).
//
// Secrets: ORQ_API_KEY, ORQ_ASSISTANT_MODEL.

// @ts-ignore — Deno laadt de .js-buurbestanden; types via @ts-check in de bestanden zelf.
import {
  MAX_TOOL_ITERATIONS,
  SYSTEM_PROMPT,
  SUGGEST_TOOL,
  splitSuggestions,
  filterTools,
  toChatTools,
  parseChatResponse,
  toolResultMessage,
  clampHistory,
  buildContextSnapshot,
  shouldContinueLoop,
  buildTurnResult,
  toResponsesTools,
  parseResponsesOutput,
  functionCallOutputItem,
  historyFromRows,
  titleFromMessage,
  drainSseBuffer,
  clientEventsFromRouterEvent,
  statusLabelMap,
  sseLine,
  openProposalsNote,
} from './core.js';
// @ts-ignore — zie boven.
import { ASSISTANT_TOOLS, MODULE_BRIEFS } from '../_shared/tools/index.js';
// @ts-ignore — zie boven. Pure HITL-statusmachine (AI-8): de agent-loop voert
// write-tools nooit uit; de harness maakt er een voorstel van en deze module
// bepaalt wat er met een besluit (confirm/reject/undo) mag gebeuren.
import {
  ACTION_DECISIONS,
  buildActionContent,
  confirmActionNode,
  canResolve,
  contentWithStatus,
  selectItems,
  undoPlan,
  isExpired,
} from './actions.js';
// @ts-ignore — Deno-runtime-import.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ORQ_CHAT_URL = 'https://api.orq.ai/v2/proxy/chat/completions';
const ORQ_RESPONSES_URL = 'https://api.orq.ai/v3/router/responses';

// Pseudonimiseer ids voor trace-metadata (guidelines §7): SHA-256, eerste 16 hex-tekens.
async function hashId(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
const CALL_MAX_PER_WINDOW = 20;   // burst per gebruiker per uur
const CALL_WINDOW_SECONDS = 3600;
const CALL_MAX_PER_DAY = 60;      // per gebruiker per 24u
const CALL_HH_MAX_PER_DAY = 150;  // per huishouden per 24u (gedeeld plafond)
const CALL_GLOBAL_DAILY_MAX = 10000;
const MAX_OUTPUT_TOKENS = 1500;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Persona/toon: plan 23 §1 — de prompt zelf leeft in core.js (één bron, gedeeld
// met de eval-runner; guidelines §3).

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Methode niet toegestaan' }, 405);

  const ORQ_API_KEY = Deno.env.get('ORQ_API_KEY');
  const MODEL = Deno.env.get('ORQ_ASSISTANT_MODEL');
  if (!ORQ_API_KEY || !MODEL) return json({ error: 'De assistent is niet geconfigureerd.' }, 503);
  const useRouter = MODEL.includes('/'); // provider/model → v3-router (Responses API)

  let body: {
    householdId?: string;
    conversationId?: string;
    message?: string;
    enabledModuleKeys?: string[];
    memberNames?: Record<string, string>;
    today?: string;
    stream?: boolean;
    // Scherm-context (AI-10): moduleKey van het scherm waar de assistent is
    // geopend — een aanwijzing voor het model, nooit een beperking.
    screen?: string;
    // HITL-besluit op een eerder voorstel (AI-8): los van message — een besluit
    // is geen chatbeurt en kost geen LLM-call. decision 'edit' (AI-10) draagt
    // de door de GEBRUIKER bewerkte args (gaat door dezelfde propose-validatie).
    action?: { id?: string; decision?: string; selected?: number[]; args?: object; memberNames?: Record<string, string> };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag' }, 400);
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader) {
    // Zonder deze drie is er geen RLS-context én geen rate-limit → fail-closed.
    console.error('[assistant] config/auth ontbreekt — fail-closed');
    return json({ error: 'De assistent is tijdelijk niet beschikbaar.' }, 503);
  }

  // RLS-gebonden client: elke tool-query draait als de ingelogde gebruiker.
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // --- HITL-besluit op een eerder voorstel (AI-8, plan 23 §4). Geen LLM-call:
  // alleen het OPGESLAGEN voorstel valideren en (bij confirm) de opgeslagen args
  // uitvoeren — de client stuurt uitsluitend een voorstel-ID + besluit + welke
  // items aangevinkt bleven, nooit args. Telt daarom niet mee in
  // record_assistant_call (dat bewaakt betaalde LLM-beurten); RLS (creator-privé)
  // bepaalt of de vrager dit voorstel überhaupt ziet.
  if (body.action) {
    const actionId = typeof body.action.id === 'string' ? body.action.id : '';
    const decision = typeof body.action.decision === 'string' ? body.action.decision : '';
    if (!UUID_RE.test(actionId) || !ACTION_DECISIONS.includes(decision)) {
      return json({ error: 'Ongeldig besluit.' }, 400);
    }
    const { data: actionUser } = await db.auth.getUser();
    const actionUserId = actionUser?.user?.id ?? '';
    const nowIso = new Date().toISOString();
    const { data: row } = await db
      .from('assistant_messages')
      .select('id, household_id, conversation_id, content, created_at')
      .eq('id', actionId)
      .eq('role', 'action')
      .maybeSingle();
    if (!row) return json({ error: 'Dit voorstel is niet gevonden.' }, 404);
    const allowed = canResolve(row, decision, nowIso);
    if (!allowed.ok) return json({ error: allowed.error }, 409);

    // Conditionele status-update = het claim-slot tegen dubbeltik/races: alleen
    // de aanroep die de verwachte status aantreft wint; de rest krijgt een 409.
    const finish = async (status: string, extra: object = {}, expectStatus = 'pending') => {
      const { data: updated } = await db
        .from('assistant_messages')
        .update({ content: contentWithStatus(row.content, status, extra) })
        .eq('id', actionId)
        .eq('content->>status', expectStatus)
        .select('id');
      return (updated ?? []).length > 0;
    };

    if (decision === 'reject') {
      if (!(await finish('rejected'))) return json({ error: 'Dit voorstel is al verwerkt.' }, 409);
      return json({ ok: true, status: 'rejected' });
    }

    // edit (AI-10, mens↔AI-overdracht): de gebruiker nam het voorstel over en
    // bewerkte de items. Zijn args gaan door DEZELFDE pure propose()-validatie
    // als model-args en vervangen de opgeslagen args; status blijft pending —
    // bevestigen blijft een aparte, bewuste stap. edited_by_user gaat mee in het
    // audit-spoor én in de openstaand-voorstel-context van de volgende beurt.
    if (decision === 'edit') {
      const editTool = ASSISTANT_TOOLS.find((t) => t.name === row.content?.tool && t.kind === 'write');
      if (!editTool) return json({ error: 'Dit voorstel wordt niet meer ondersteund.' }, 409);
      const editMembers = body.action.memberNames && typeof body.action.memberNames === 'object' ? body.action.memberNames : {};
      const proposal = editTool.propose(body.action.args ?? {}, { today: nowIso.slice(0, 10), memberNames: editMembers });
      if (!proposal.ok) return json({ error: proposal.error }, 400);
      const edited = contentWithStatus(row.content, 'pending', {
        summary: proposal.summary,
        items: proposal.items,
        args: proposal.args,
        edited_by_user: true,
      });
      const { data: updated } = await db
        .from('assistant_messages')
        .update({ content: edited })
        .eq('id', actionId)
        .eq('content->>status', 'pending')
        .select('id');
      if ((updated ?? []).length === 0) return json({ error: 'Dit voorstel is al verwerkt.' }, 409);
      return json({
        ok: true,
        status: 'pending',
        summary: proposal.summary,
        items: proposal.items.map((text: string, i: number) => ({ id: i, text })),
      });
    }

    if (decision === 'undo') {
      const plan = undoPlan(row.content?.result?.inserted);
      if (!plan.ok) return json({ error: plan.error }, 409);
      // Eerst claimen (done → undone, conditioneel), dan pas verwijderen:
      // een dubbeltik verwijdert zo nooit twee keer.
      if (!(await finish('undone', {}, 'done'))) return json({ error: 'Er is niets om ongedaan te maken.' }, 409);
      for (const [table, ids] of Object.entries(plan.byTable)) {
        const { error } = await db.from(table).delete().in('id', ids);
        if (error) console.error('[assistant] undo faalde', table, error.message);
      }
      return json({ ok: true, status: 'undone' });
    }

    // confirm: tool moet nog bestaan én een write-tool zijn; args zijn de
    // opgeslagen, genormaliseerde args, gefilterd op de aangevinkte items.
    const tool = ASSISTANT_TOOLS.find((t) => t.name === row.content?.tool && t.kind === 'write');
    if (!tool) return json({ error: 'Dit voorstel wordt niet meer ondersteund.' }, 409);
    const sel = selectItems(row.content?.args, body.action.selected);
    if (!sel.ok) return json({ error: sel.error }, 400);
    if (!(await finish('executing'))) return json({ error: 'Dit voorstel is al verwerkt.' }, 409);
    try {
      const executeCtx = {
        db,
        householdId: row.household_id,
        userId: actionUserId,
        today: nowIso.slice(0, 10),
      };
      const result = await tool.execute(executeCtx, sel.args);
      await finish('done', { result }, 'executing');
      return json({ ok: true, status: 'done', summary: result.summary, undoable: (result.inserted ?? []).length > 0 });
    } catch (e) {
      console.error('[assistant] voorstel uitvoeren faalde', String(e));
      await finish('failed', {}, 'executing');
      return json({ error: 'Dat lukte even niet — het voorstel is niet uitgevoerd.' }, 500);
    }
  }

  // --- Chatbeurt: vanaf hier is message verplicht.
  const { householdId, message } = body;
  if (!householdId || typeof message !== 'string' || message.trim().length === 0) {
    return json({ error: 'householdId en message zijn verplicht' }, 400);
  }
  if (message.length > 2000) return json({ error: 'Bericht te lang' }, 413);

  // Rate-limit vóór de betaalde call (fail-closed; zelfde discipline als scan-receipt).
  try {
    const { data: allowed, error } = await db.rpc('record_assistant_call', {
      p_household: householdId,
      p_max: CALL_MAX_PER_WINDOW,
      p_window_seconds: CALL_WINDOW_SECONDS,
      p_daily_max: CALL_MAX_PER_DAY,
      p_household_daily_max: CALL_HH_MAX_PER_DAY,
      p_global_daily_max: CALL_GLOBAL_DAILY_MAX,
    });
    if (error) {
      console.error('[assistant] rate-limit-RPC-fout', error.message);
      return json({ error: 'De assistent is tijdelijk niet beschikbaar.' }, 503);
    }
    if (allowed === false) {
      return json({ error: 'Je hebt de assistent even veel gevraagd — probeer het over een uurtje weer.' }, 429);
    }
    if (allowed !== true) {
      console.error('[assistant] onverwacht rate-limit-antwoord', JSON.stringify(allowed)?.slice(0, 200));
      return json({ error: 'De assistent is tijdelijk niet beschikbaar.' }, 503);
    }
  } catch (e) {
    console.error('[assistant] rate-limit-check faalde (fail-closed)', String(e));
    return json({ error: 'De assistent is tijdelijk niet beschikbaar.' }, 503);
  }

  // Tool-context. `today` komt van de client (device-tijdzone is leidend voor
  // "vandaag"); valt terug op servertijd. memberNames is alleen weergave-suiker.
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? '') ? body.today! : new Date().toISOString().slice(0, 10);
  const memberNames = body.memberNames && typeof body.memberNames === 'object' ? body.memberNames : {};
  const enabledKeys = Array.isArray(body.enabledModuleKeys) ? body.enabledModuleKeys : [];
  // userId uit het (door verify_jwt al gevalideerde) token — voor tools als
  // get_open_tasks(only_mine).
  const { data: userData } = await db.auth.getUser();
  const userId = userData?.user?.id ?? '';
  const ctx = { db, householdId, userId, today, memberNames };

  // Write-tools doen mee (AI-8): de loop voert ze nooit uit — de interceptie
  // hieronder maakt er een bevestigingsvoorstel van (HITL).
  const tools = filterTools(ASSISTANT_TOOLS, enabledKeys, { includeWrite: true });
  const chatTools = toChatTools(tools);

  // --- Persistentie (AI-4): het gesprek leeft server-side in assistant_* (RLS,
  // creator-privé). Bestaand conversationId (uuid) → history uit de DB; anders
  // een nieuw gesprek met een deterministische titel. De client stuurt alleen
  // conversationId + het nieuwe bericht.
  let conversationId = typeof body.conversationId === 'string' && UUID_RE.test(body.conversationId)
    ? body.conversationId
    : null;
  let historyRows: unknown[] = [];
  if (conversationId) {
    const { data: convo } = await db
      .from('assistant_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!convo) return json({ error: 'Gesprek niet gevonden.' }, 404);
    const { data: rows, error: histErr } = await db
      .from('assistant_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(60);
    if (histErr) console.error('[assistant] history laden faalde', histErr.message);
    historyRows = rows ?? [];
  } else {
    const { data: convo, error: convErr } = await db
      .from('assistant_conversations')
      .insert({ household_id: householdId, created_by: userId, title: titleFromMessage(message) })
      .select('id')
      .single();
    if (convErr || !convo) {
      console.error('[assistant] gesprek aanmaken faalde', convErr?.message);
      return json({ error: 'De assistent is tijdelijk niet beschikbaar.' }, 503);
    }
    conversationId = convo.id;
  }
  // User-bericht meteen persisteren (vóór de LLM-call: bij een gateway-fout is de
  // vraag niet kwijt).
  await db.from('assistant_messages').insert({
    conversation_id: conversationId,
    household_id: householdId,
    created_by: userId,
    role: 'user',
    content: { v: 1, text: message },
  });

  // Snapshot ná de history-load (AI-10): briefs van de actieve modules, het
  // scherm waar de assistent is geopend (aanwijzing, geen beperking) en de nog
  // openstaande — mogelijk door de gebruiker bewerkte — voorstellen.
  const nowIsoTurn = new Date().toISOString();
  const actionRows = (historyRows as Array<{ role?: string }>).filter(
    (r) => r?.role === 'action' && !isExpired(r, nowIsoTurn)
  );
  const snapshot = buildContextSnapshot({
    today,
    memberNames: Object.values(memberNames),
    moduleLabels: enabledKeys,
    moduleBriefs: enabledKeys.map((k) => MODULE_BRIEFS[k]).filter(Boolean),
    screenLabel: typeof body.screen === 'string' ? (MODULE_BRIEFS[body.screen]?.label ?? '') : '',
    proposalsNote: openProposalsNote(actionRows),
  });
  const systemText = snapshot ? `${SYSTEM_PROMPT}\n\n${snapshot}` : SYSTEM_PROMPT;
  // Beide routes: system + geklemde history (uit de DB) + nieuwe vraag. De
  // Responses API accepteert dezelfde {role, content}-berichtvorm als input-items.
  const messages: unknown[] = [
    { role: 'system', content: systemText },
    ...clampHistory(historyFromRows(historyRows)),
    { role: 'user', content: message },
  ];

  // Observability (guidelines §7): thread = conversatie, ids gehasht — nooit PII.
  const threadId = conversationId as string;
  const [userHash, householdHash] = await Promise.all([hashId(userId || 'anon'), hashId(householdId)]);

  // suggest_replies (antwoordopties-patroon) gaat als pseudo-tool mee; de loop
  // voert 'm nooit uit maar oogst de opties (splitSuggestions).
  const responsesTools = [...toResponsesTools(tools), SUGGEST_TOOL];
  const proxyTools = [...chatTools, { type: 'function', function: { name: SUGGEST_TOOL.name, description: SUGGEST_TOOL.description, parameters: SUGGEST_TOOL.parameters } }];
  const statusLabels = statusLabelMap(tools);

  // Fout die veilig aan de gebruiker getoond mag worden (de details staan in de log).
  class TurnError extends Error {
    status: number;
    constructor(userMessage: string, status: number) { super(userMessage); this.status = status; }
  }

  // Eén upstream-call. Non-streaming: gewoon json. Streaming (alleen de router):
  // SSE consumeren, delta/tool_status doorgeven via `emit`, en het VOLLEDIGE
  // response-object uit `response.completed` teruggeven — de loop parseert dus
  // altijd dezelfde vorm (parseResponsesOutput blijft de bron van waarheid).
  async function callOrq(emit: ((ev: object) => void) | null): Promise<unknown> {
    const streamUpstream = emit !== null && useRouter;
    const orqBody = useRouter
      ? {
          model: MODEL,
          input: messages,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          thread: { id: threadId, tags: ['assistant'] },
          metadata: { feature: 'assistant', user: userHash, household: householdHash },
          tools: responsesTools,
          ...(streamUpstream ? { stream: true } : {}),
        }
      : {
          model: MODEL,
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          tools: proxyTools,
        };
    let orqRes: Response;
    try {
      orqRes = await fetch(useRouter ? ORQ_RESPONSES_URL : ORQ_CHAT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${ORQ_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify(orqBody),
      });
    } catch (e) {
      console.error('[assistant] Orq onbereikbaar', String(e));
      throw new TurnError('Kon de assistent-service niet bereiken.', 502);
    }
    if (!orqRes.ok) {
      const detail = await orqRes.text().catch(() => '');
      console.error('[assistant] Orq-fout', orqRes.status, detail.slice(0, 500));
      throw new TurnError('Dat lukte even niet — probeer het nog eens.', 502);
    }
    if (!streamUpstream) return await orqRes.json().catch(() => null);

    const reader = orqRes.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let completed: unknown = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { events, rest } = drainSseBuffer(buf);
      buf = rest;
      for (const ev of events) {
        for (const clientEv of clientEventsFromRouterEvent(ev, statusLabels)) emit!(clientEv);
        if (ev?.type === 'response.completed') completed = ev.response;
        if (ev?.type === 'response.failed' || ev?.type === 'error') {
          console.error('[assistant] Orq-stream-fout', JSON.stringify(ev).slice(0, 500));
        }
      }
    }
    if (!completed) throw new TurnError('Dat lukte even niet — probeer het nog eens.', 502);
    return completed;
  }

  // De agent-loop (identiek voor beide antwoordvormen) + persistentie van de beurt.
  async function runTurn(emit: ((ev: object) => void) | null) {
    const toolOutputs: unknown[] = [];
    let text = '';
    let choices: string[] = [];

    for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      const raw = await callOrq(emit);
      const parsed = useRouter ? parseResponsesOutput(raw) : parseChatResponse(raw);
      text = parsed.text;

      // Antwoordopties (suggest_replies) afsplitsen; alleen échte calls sturen de loop.
      const split = splitSuggestions(parsed.toolCalls);
      if (split.choices.length > 0) choices = split.choices;

      if (!shouldContinueLoop({ toolCalls: split.calls }, iteration)) break;

      // Tool-calls uitvoeren tegen de RLS-client; fouten worden een {error}-resultaat
      // zodat het model netjes kan reageren i.p.v. de beurt te laten klappen.
      // NB: alle callItems (incl. suggest_replies) gaan terug in de history — de
      // Responses API eist een output-item per call; suggest_replies krijgt {ok:true}.
      if (useRouter) messages.push(...(parsed as { callItems: unknown[] }).callItems);
      else messages.push((parsed as { message: unknown }).message);
      for (const sug of parsed.toolCalls.filter((c: { name: string }) => c.name === SUGGEST_TOOL.name)) {
        messages.push(useRouter ? functionCallOutputItem(sug.id, { ok: true }) : toolResultMessage(sug.id, { ok: true }));
      }
      for (const call of split.calls) {
        const tool = tools.find((t) => t.name === call.name);
        let result: unknown;
        if (!tool) {
          result = { error: `Onbekende tool: ${call.name}` };
        } else if (tool.kind === 'write') {
          // HITL-interceptie (AI-8): een write-call wordt NOOIT uitgevoerd. De
          // tool bouwt puur een voorstel (propose), dat als role='action'-rij
          // wordt opgeslagen; de gebruiker beslist op de bevestigingskaart en
          // pas dán draait tool.execute — met de hier opgeslagen args.
          const proposal = tool.propose(call.args, { today, memberNames });
          if (!proposal.ok) {
            result = { error: proposal.error };
          } else {
            const content = buildActionContent(tool, proposal);
            const { data: actionRow, error: actionErr } = await db
              .from('assistant_messages')
              .insert({
                conversation_id: conversationId,
                household_id: householdId,
                created_by: userId,
                role: 'action',
                content,
              })
              .select('id')
              .single();
            if (actionErr || !actionRow) {
              console.error('[assistant] voorstel opslaan faalde', actionErr?.message);
              result = { error: 'Het voorstel kon niet worden klaargezet.' };
            } else {
              // Render-tree: eventuele preview-kaarten uit propose (bv. de rijke
              // recept-kaart, AI-11) + de bevestigingskaart (server-deterministisch);
              // het model krijgt alleen het feit dat er een voorstel klaarstaat.
              const preview = Array.isArray((proposal as { preview?: object[] }).preview)
                ? (proposal as { preview: object[] }).preview
                : [];
              toolOutputs.push({ render: [...preview, confirmActionNode(actionRow.id, content)] });
              result = {
                data: {
                  proposed: true,
                  awaiting_user_confirmation: true,
                  summary: proposal.summary,
                },
              };
            }
          }
        } else {
          try {
            result = await tool.run(ctx, call.args);
            toolOutputs.push(result);
          } catch (e) {
            console.error(`[assistant] tool ${call.name} faalde`, String(e));
            result = { error: 'Deze gegevens konden niet worden opgehaald.' };
          }
        }
        emit?.({ type: 'tool_status', name: call.name, label: statusLabels[call.name] ?? '', state: 'done' });
        // Alleen de data (niet de render-tree) terug naar het model: compact, en de
        // UI-vorm blijft server-deterministisch.
        const forModel = result && typeof result === 'object' && 'data' in (result as object)
          ? (result as { data: unknown }).data
          : result;
        messages.push(useRouter ? functionCallOutputItem(call.id, forModel) : toolResultMessage(call.id, forModel));
      }
    }

    const turn = buildTurnResult(text, toolOutputs as { render?: object[] }[], choices);
    // Assistent-beurt persisteren + gesprek naar boven in de lijst (updated_at).
    await db.from('assistant_messages').insert({
      conversation_id: conversationId,
      household_id: householdId,
      created_by: userId,
      role: 'assistant',
      content: turn,
    });
    await db.from('assistant_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    return turn;
  }

  // --- Antwoordvorm 1: SSE (AI-5, ronde D). De client vraagt erom met stream:true;
  // events volgen het protocol delta|tool_status|tree|done|error (core.js). De
  // Response gaat direct terug terwijl de beurt in de stream-start doorloopt.
  if (body.stream === true) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (ev: object) => {
          try {
            controller.enqueue(encoder.encode(sseLine(ev)));
          } catch {
            // Client weg (abort/stop-knop): stil stoppen met schrijven; de beurt
            // rondt server-side af zodat het bericht wél persistent is.
          }
        };
        try {
          const turn = await runTurn(emit);
          emit({ type: 'tree', conversationId, ...turn });
          emit({ type: 'done' });
        } catch (e) {
          const msg = e instanceof TurnError ? e.message : 'Dat lukte even niet — probeer het nog eens.';
          if (!(e instanceof TurnError)) console.error('[assistant] beurt faalde', String(e));
          emit({ type: 'error', message: msg });
        } finally {
          try { controller.close(); } catch { /* al gesloten */ }
        }
      },
    });
    return new Response(stream, {
      headers: { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
    });
  }

  // --- Antwoordvorm 2: één JSON-antwoord (fallback en web).
  try {
    const turn = await runTurn(null);
    return json({ conversationId, ...turn });
  } catch (e) {
    if (e instanceof TurnError) return json({ error: e.message }, e.status);
    console.error('[assistant] beurt faalde', String(e));
    return json({ error: 'Dat lukte even niet — probeer het nog eens.' }, 500);
  }
});
