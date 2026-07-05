// React-schil van de Huishoek Assistent (AI-1/AI-4, plannen 23/24). Dun: alle
// vorm-logica leeft in de pure lagen; deze hook beheert het actieve gesprek, de
// gesprekkenlijst en de call naar de edge function `assistant`.
//
// Persistentie (AI-4): gesprekken leven server-side in assistant_conversations/
// -messages (creator-privé RLS). De edge function schrijft beide beurten; de hook
// leest de lijst + berichten en stuurt per beurt alleen conversationId + de vraag.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetch as streamFetch } from 'expo/fetch';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { useAuth } from './auth';
import { useHousehold, useGatedHouseholdId } from './household';
import { effectiveModules } from './modules';
import { normalizeTree } from './assistantUi';
import { buildResolveBody, actionStatusMap, stampActionStatus, patchActionNode } from './assistantActions';
import { drainSse, initialStreamState, applyStreamEvent, streamStatusLabel } from './assistantStream';
import { run } from './db';
import { t } from './i18n';
import { useToast } from './toast';
import * as haptics from './haptics';

// SSE-beurt (AI-5, ronde D): POST met stream:true rechtstreeks naar de edge
// function (functions.invoke geeft geen ReadableStream terug) en de chunks door
// de pure reducer (lib/assistantStream.js) voeren. `onState` krijgt elke
// tussenstand; het resultaat is de eindstand (turn bij succes, error-tekst bij
// een server-fout). Gooit vóór de eerste byte → de aanroeper valt terug op de
// non-streaming route (de rate-limit telt per geaccepteerde request, dus alleen
// terugvallen als de request de server niet bereikte).
async function streamTurn(body, token, onState, signal) {
  let res;
  try {
    res = await streamFetch(`${supabaseUrl}/functions/v1/assistant`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch {
    // Transportfout vóór de eerste byte: de server heeft niets gezien —
    // de aanroeper mag veilig de non-streaming route proberen.
    // (Een abort vóór de eerste byte valt hier ook; de aanroeper checkt signal.)
    return null;
  }
  if (!res.ok || !res.body) {
    // De server heeft de request al geteld (rate-limit) — niet nogmaals sturen.
    const detail = await res.json().catch(() => null);
    return { ...initialStreamState(), error: detail?.error ?? 'Dat lukte even niet.' };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let state = initialStreamState();
  let buf = '';
  try {
    while (!state.done && !state.error) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { events, rest } = drainSse(buf);
      buf = rest;
      for (const ev of events) state = applyStreamEvent(state, ev);
      onState(state);
    }
  } catch {
    // Abort (stop-knop) of wegvallende verbinding halverwege: geef de partial
    // terug — de server rondt de beurt zelf af en persisteert 'm (zie index.ts).
  }
  return state;
}

const rowToMessage = (row) => ({
  id: row.id,
  role: row.role,
  text: row.content?.text ?? '',
  tree: normalizeTree(row.content?.tree),
  choices: Array.isArray(row.content?.choices) ? row.content.choices.filter((c) => typeof c === 'string' && c) : [],
});

export function useAssistant() {
  const householdId = useGatedHouseholdId('assistent');
  const { user } = useAuth();
  const { members, householdDisabled, userDisabled } = useHousehold();
  const toast = useToast();
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]); // nieuwste eerst (inverted list)
  const [busy, setBusy] = useState(false);
  // Tussenstand van de streamende beurt: { text, status } of null (geen stream).
  const [stream, setStream] = useState(null);
  const idRef = useRef(0);
  const abortRef = useRef(null);   // AbortController van de lopende beurt (stop-knop)
  const lastSentRef = useRef('');  // laatste vraag, voor de retry op een foutbubble
  // Scherm-context (AI-10): moduleKey van het scherm waar de assistent is
  // geopend — gaat als aanwijzing (nooit beperking) mee met elke beurt.
  const screenRef = useRef(null);
  const setScreenContext = useCallback((key) => { screenRef.current = typeof key === 'string' && key ? key : null; }, []);

  const loadConversations = useCallback(async () => {
    if (!householdId) { setConversations([]); return; }
    const data = await run(
      supabase
        .from('assistant_conversations')
        .select('id, title, updated_at')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false })
        .limit(20),
      { fallback: [], context: 'gesprekken laden' }
    );
    setConversations(data ?? []);
  }, [householdId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Gesprek hervatten: berichten laden (oud → nieuw uit de DB, gespiegeld voor de
  // inverted lijst). user/assistant-rijen zijn de zichtbare chat-inhoud; de
  // role='action'-rijen liften mee om de bevestigingskaarten hun actuele status
  // te stempelen (bevestigd/geweigerd/verlopen — AI-8).
  const openConversation = useCallback(async (id) => {
    setConversationId(id);
    setMessages([]);
    if (!id) return;
    const data = await run(
      supabase
        .from('assistant_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', id)
        .in('role', ['user', 'assistant', 'action'])
        .order('created_at', { ascending: true })
        .limit(150),
      { fallback: [], context: 'gesprek laden' }
    );
    const rows = data ?? [];
    const statusById = actionStatusMap(rows.filter((r) => r.role === 'action'), new Date().toISOString());
    setMessages(
      rows
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .map(rowToMessage)
        .map((m) => ({ ...m, tree: stampActionStatus(m.tree, statusById) }))
        .reverse()
    );
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const send = useCallback(async (text) => {
    const clean = (text ?? '').trim();
    if (!clean || busy || !householdId) return;

    const userMsg = { id: `local-${++idRef.current}`, role: 'user', text: clean, tree: [], choices: [] };
    setMessages((prev) => [userMsg, ...prev]);
    setBusy(true);
    lastSentRef.current = clean;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const enabled = effectiveModules({ householdDisabled, userDisabled }).map((m) => m.key);
      // members zijn platgeslagen profielen (lib/household.js): { id, display_name, role }.
      const memberNames = Object.fromEntries(
        (members ?? []).map((m) => [m.id, m.display_name ?? '']).filter(([, v]) => v)
      );
      const body = {
        householdId,
        conversationId,
        message: clean,
        enabledModuleKeys: enabled,
        memberNames,
        today: new Date().toISOString().slice(0, 10),
        ...(screenRef.current ? { screen: screenRef.current } : {}),
      };

      // Eerst streamend (SSE); bereikt de request de server niet (transportfout,
      // geen token), dan de bestaande non-streaming route als terugval.
      let data = null;
      let reachedServer = false;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token && supabaseUrl) {
        try {
          const end = await streamTurn(body, token, (s) => {
            setStream({ text: s.text, status: streamStatusLabel(s) });
          }, controller.signal);
          if (end) {
            // De server heeft de beurt geteld en (deels) verwerkt: hier niet
            // meer opnieuw versturen — dat zou de vraag dupliceren.
            reachedServer = true;
            if (end.turn) {
              data = end.turn;
            } else if (controller.signal.aborted) {
              // Stop-knop: bewaar wat er al gestreamd was als bericht (de server
              // rondt de beurt af en persisteert de volledige versie in de DB).
              data = {
                conversationId,
                text: end.text,
                tree: end.text ? [{ type: 'text', text: end.text }] : [{ type: 'text', text: t('assistant.stopped') }],
                choices: [],
              };
            } else if (end.error) {
              throw new Error(end.error);
            } else {
              throw new Error(t('assistant.error'));
            }
          } else if (controller.signal.aborted) {
            // Gestopt vóór de eerste byte: niets tonen, niets opnieuw sturen.
            reachedServer = true;
            data = { conversationId, text: '', tree: [{ type: 'text', text: t('assistant.stopped') }], choices: [] };
          }
        } finally {
          setStream(null);
        }
      }
      if (!data && !reachedServer) {
        const { data: invoked, error } = await supabase.functions.invoke('assistant', { body });
        if (error) throw error;
        if (invoked?.error) throw new Error(invoked.error);
        data = invoked;
      }
      if (data?.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        loadConversations();
      }
      setMessages((prev) => [{
        id: `local-${++idRef.current}`,
        role: 'assistant',
        text: data?.text ?? '',
        tree: normalizeTree(data?.tree),
        // Antwoordopties (AskUserQuestion-patroon): tikbare vervolgopties bij de
        // nieuwste assistent-beurt; vrij typen blijft altijd mogelijk ("Other").
        choices: Array.isArray(data?.choices) ? data.choices.filter((c) => typeof c === 'string' && c) : [],
      }, ...prev]);
      haptics.tapLight();
    } catch (e) {
      setMessages((prev) => [{
        id: `local-${++idRef.current}`,
        role: 'assistant',
        text: '',
        error: true,
        choices: [],
        tree: normalizeTree([{ type: 'text', text: t('assistant.error') }]),
      }, ...prev]);
      haptics.error();
      if (__DEV__) console.warn('[assistant]', e?.message ?? e);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, householdId, conversationId, members, householdDisabled, userDisabled, loadConversations]);

  // Besluit op een HITL-voorstel (AI-8): de client stuurt alleen het voorstel-ID
  // + besluit + aangevinkte item-indexen — de server voert de dáár opgeslagen
  // args uit. De kaartstatus wordt lokaal gestempeld; bij succes een toast met
  // "Ongedaan maken" (plan 23 §4 — vergevingsgezind tot het eind).
  const resolveRef = useRef(/** @type {any} */ (null));
  const resolveAction = useCallback(async (actionId, decision, selected, extra = {}) => {
    // Voor 'edit' gaan de ledennamen mee: propose() vertaalt assignee_name → id.
    const editExtra = decision === 'edit'
      ? { ...extra, memberNames: Object.fromEntries((members ?? []).map((m) => [m.id, m.display_name ?? '']).filter(([, v]) => v)) }
      : extra;
    const body = buildResolveBody(actionId, decision, selected, editExtra);
    if (!body) return;
    try {
      const { data, error } = await supabase.functions.invoke('assistant', { body });
      if (error) {
        // 409 (verlopen/al verwerkt) draagt een leesbare uitleg — die tonen we.
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? t('assistant.error'));
      }
      if (data?.error) throw new Error(data.error);
      const status = typeof data?.status === 'string' ? data.status : 'done';
      if (decision === 'edit') {
        // Bewerkt voorstel: kaart patchen met de hervalideerde summary/items —
        // status blijft pending, bevestigen blijft een bewuste aparte stap.
        setMessages((prev) => prev.map((m) => ({ ...m, tree: patchActionNode(m.tree, actionId, { summary: data?.summary, items: data?.items }) })));
        haptics.tapLight();
        toast.show({ message: t('assistant.action.edited') });
        return;
      }
      setMessages((prev) => prev.map((m) => ({ ...m, tree: stampActionStatus(m.tree, { [actionId]: status }) })));
      if (status === 'done') {
        haptics.tapLight();
        toast.show({
          message: data?.summary ?? t('assistant.action.done'),
          ...(data?.undoable
            ? { actionLabel: t('assistant.action.undo'), onAction: () => resolveRef.current?.(actionId, 'undo') }
            : {}),
        });
      } else if (status === 'undone') {
        toast.show({ message: t('assistant.action.undone') });
      }
    } catch (e) {
      haptics.error();
      toast.show({ message: e?.message || t('assistant.error') });
    }
  }, [toast, members]);
  // Ref-koppeling ná de render (react-hooks/refs): de undo-toast wijst altijd
  // naar de nieuwste resolveAction zonder tijdens de render te schrijven.
  useEffect(() => { resolveRef.current = resolveAction; }, [resolveAction]);

  // Opgeslagen voorstel-args ophalen voor de edit-sheet (AI-10): de kaart toont
  // alleen weergaveteksten; de bewerkbare velden komen uit de action-rij zelf
  // (RLS: alleen de eigenaar kan 'm lezen).
  const loadProposal = useCallback(async (actionId) => {
    const data = await run(
      supabase
        .from('assistant_messages')
        .select('content')
        .eq('id', actionId)
        .eq('role', 'action')
        .maybeSingle(),
      { fallback: null, context: 'voorstel laden' }
    );
    const c = data?.content;
    return c && c.kind === 'proposal' ? { tool: c.tool, args: c.args ?? { items: [] } } : null;
  }, []);

  // Stop-knop (ronde E): breekt de lopende SSE-beurt af; wat er al gestreamd was
  // blijft staan als bericht. De server maakt de beurt zelf af (persistentie).
  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  // Retry op de foutbubble: stuur de laatste vraag nogmaals.
  const retry = useCallback(() => {
    if (lastSentRef.current && !busy) send(lastSentRef.current);
  }, [busy, send]);

  // De antwoordopties van de nieuwste assistent-beurt (alleen als die bovenaan staat:
  // na een nieuwe gebruikersvraag zijn oude opties niet meer actueel).
  const choices = !busy && messages[0]?.role === 'assistant' ? messages[0].choices ?? [] : [];

  return {
    enabled: Boolean(householdId),
    userId: user?.id ?? null,
    // Weergavenamen voor de edit-sheet (assignee-veld) — zelfde vorm als send().
    memberNames: Object.fromEntries((members ?? []).map((m) => [m.id, m.display_name ?? '']).filter(([, v]) => v)),
    conversationId,
    conversations,
    messages,
    busy,
    stream,
    choices,
    send,
    stop,
    retry,
    resolveAction,
    loadProposal,
    setScreenContext,
    // Retry alleen aanbieden op een vers gestrande beurt (foutbubble bovenaan);
    // een foutbubble impliceert een eerdere send, dus lastSentRef is dan gevuld.
    canRetry: !busy && messages[0]?.error === true,
    openConversation,
    newConversation,
  };
}
