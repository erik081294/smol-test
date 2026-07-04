// React-schil van de Huishoek Assistent (AI-1/AI-4, plannen 23/24). Dun: alle
// vorm-logica leeft in de pure lagen; deze hook beheert het actieve gesprek, de
// gesprekkenlijst en de call naar de edge function `assistant`.
//
// Persistentie (AI-4): gesprekken leven server-side in assistant_conversations/
// -messages (creator-privé RLS). De edge function schrijft beide beurten; de hook
// leest de lijst + berichten en stuurt per beurt alleen conversationId + de vraag.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useHousehold, useGatedHouseholdId } from './household';
import { effectiveModules } from './modules';
import { normalizeTree } from './assistantUi';
import { run } from './db';
import { t } from './i18n';

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
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]); // nieuwste eerst (inverted list)
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);

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
  // inverted lijst). Alleen user/assistant-rijen zijn zichtbare chat-inhoud.
  const openConversation = useCallback(async (id) => {
    setConversationId(id);
    setMessages([]);
    if (!id) return;
    const data = await run(
      supabase
        .from('assistant_messages')
        .select('id, role, content')
        .eq('conversation_id', id)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(100),
      { fallback: [], context: 'gesprek laden' }
    );
    setMessages((data ?? []).map(rowToMessage).reverse());
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
    try {
      const enabled = effectiveModules({ householdDisabled, userDisabled }).map((m) => m.key);
      // members zijn platgeslagen profielen (lib/household.js): { id, display_name, role }.
      const memberNames = Object.fromEntries(
        (members ?? []).map((m) => [m.id, m.display_name ?? '']).filter(([, v]) => v)
      );
      const { data, error } = await supabase.functions.invoke('assistant', {
        body: {
          householdId,
          conversationId,
          message: clean,
          enabledModuleKeys: enabled,
          memberNames,
          today: new Date().toISOString().slice(0, 10),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
    } catch (e) {
      setMessages((prev) => [{
        id: `local-${++idRef.current}`,
        role: 'assistant',
        text: '',
        error: true,
        choices: [],
        tree: normalizeTree([{ type: 'text', text: t('assistant.error') }]),
      }, ...prev]);
      if (__DEV__) console.warn('[assistant]', e?.message ?? e);
    } finally {
      setBusy(false);
    }
  }, [busy, householdId, conversationId, members, householdDisabled, userDisabled, loadConversations]);

  // De antwoordopties van de nieuwste assistent-beurt (alleen als die bovenaan staat:
  // na een nieuwe gebruikersvraag zijn oude opties niet meer actueel).
  const choices = !busy && messages[0]?.role === 'assistant' ? messages[0].choices ?? [] : [];

  return {
    enabled: Boolean(householdId),
    userId: user?.id ?? null,
    conversationId,
    conversations,
    messages,
    busy,
    choices,
    send,
    openConversation,
    newConversation,
  };
}
