// Supabase Edge Function: assistant (AI-1, plan 23) — de Huishoek Assistent.
//
// Dunne schil om de pure kern (./core.js) en de tool-registry (../_shared/assistantTools.js):
//   1. auth (verify_jwt) + rate-limit via DB-RPC `record_assistant_call` (0068, fail-closed);
//   2. agent-loop: Orq-gateway ⇄ read-tools, uitgevoerd tegen een RLS-GEBONDEN
//      supabase-client (user-JWT) — de database bepaalt wat de vrager mag zien;
//   3. antwoord: { v:1, text, tree } — de tree komt deterministisch uit tool-output
//      (lib/assistantUi.js normaliseert 'm nogmaals aan de app-kant).
//
// v1 is bewust non-streaming; SSE volgt in AI-5 (plan 24 ronde D).
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
} from './core.js';
// @ts-ignore — zie boven.
import { ASSISTANT_TOOLS } from '../_shared/assistantTools.js';
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
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag' }, 400);
  }
  const { householdId, message } = body;
  if (!householdId || typeof message !== 'string' || message.trim().length === 0) {
    return json({ error: 'householdId en message zijn verplicht' }, 400);
  }
  if (message.length > 2000) return json({ error: 'Bericht te lang' }, 413);

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

  const tools = filterTools(ASSISTANT_TOOLS, enabledKeys);
  const chatTools = toChatTools(tools);
  const snapshot = buildContextSnapshot({
    today,
    memberNames: Object.values(memberNames),
    moduleLabels: enabledKeys,
  });

  // --- Persistentie (AI-4): het gesprek leeft server-side in assistant_* (RLS,
  // creator-privé). Bestaand conversationId (uuid) → history uit de DB; anders
  // een nieuw gesprek met een deterministische titel. De client stuurt alleen
  // conversationId + het nieuwe bericht.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      .select('role, content')
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
  const toolOutputs: unknown[] = [];
  let text = '';
  let choices: string[] = [];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    let orqRes: Response;
    const orqBody = useRouter
      ? {
          model: MODEL,
          input: messages,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          thread: { id: threadId, tags: ['assistant'] },
          metadata: { feature: 'assistant', user: userHash, household: householdHash },
          tools: responsesTools,
        }
      : {
          model: MODEL,
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          tools: proxyTools,
        };
    try {
      orqRes = await fetch(useRouter ? ORQ_RESPONSES_URL : ORQ_CHAT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${ORQ_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify(orqBody),
      });
    } catch (e) {
      console.error('[assistant] Orq onbereikbaar', String(e));
      return json({ error: 'Kon de assistent-service niet bereiken.' }, 502);
    }
    if (!orqRes.ok) {
      const detail = await orqRes.text().catch(() => '');
      console.error('[assistant] Orq-fout', orqRes.status, detail.slice(0, 500));
      return json({ error: 'Dat lukte even niet — probeer het nog eens.' }, 502);
    }

    const raw = await orqRes.json().catch(() => null);
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
      } else {
        try {
          result = await tool.run(ctx, call.args);
          toolOutputs.push(result);
        } catch (e) {
          console.error(`[assistant] tool ${call.name} faalde`, String(e));
          result = { error: 'Deze gegevens konden niet worden opgehaald.' };
        }
      }
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

  return json({ conversationId, ...turn });
});
