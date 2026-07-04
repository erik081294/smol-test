// Assistent (AI-1, plan 23) — de chat met de Huishoek Assistent.
// Dunne schil: gespreksstate + edge-call in lib/useAssistant.js, render van
// server-kaarten in lib/AssistantMessageView.js. Inverted lijst (nieuwste onder),
// lege staat met suggestie-chips (plan 23 §2-flow 1/5).
import React, { useState } from 'react';
import { FlatList, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, ModuleHelpButton, Field, IconButton, Chip, T, Stack, Row, Empty, BottomSheet, ItemRow } from '../../lib/ui';
import { AssistantMessageView } from '../../lib/AssistantMessageView';
import { Icon } from '../../lib/icons';
import { useAssistant } from '../../lib/useAssistant';
import { colors, space, radius } from '../../lib/theme';
import { t } from '../../lib/i18n';

const SUGGESTIONS = ['assistant.suggest.today', 'assistant.suggest.groceries', 'assistant.suggest.pantry', 'assistant.suggest.expenses'];

function Bubble({ item }) {
  const mine = item.role === 'user';
  return (
    <View style={{
      alignSelf: mine ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      backgroundColor: mine ? colors.forest : 'transparent',
      borderRadius: radius.lg,
      paddingHorizontal: mine ? space.md : 0,
      paddingVertical: mine ? space.sm : 0,
      marginBottom: space.sm,
    }}>
      {mine
        ? <T variant="body" color={colors.bg}>{item.text}</T>
        // De tree bevat de antwoordtekst al als text-node (buildTurnResult) —
        // item.text hier óók renderen zou 'm verdubbelen.
        : <AssistantMessageView tree={item.tree} />}
    </View>
  );
}

export default function Assistent() {
  const { enabled, messages, busy, send, choices, conversations, conversationId, openConversation, newConversation } = useAssistant();
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const submit = (text) => {
    const value = (text ?? draft).trim();
    if (!value) return;
    setDraft('');
    send(value);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')}
        right={(
          <Row gap={space.xs}>
            <IconButton icon="history" accessibilityLabel={t('assistant.history')}
              onPress={() => setHistoryOpen(true)} testID="t-assistant-history" />
            <ModuleHelpButton module="assistent" />
          </Row>
        )} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.lg }}>
            <Empty emoji="💬" title={t('assistant.empty.title')} subtitle={t('assistant.empty.subtitle')} />
            <Row gap={space.xs} wrap style={{ justifyContent: 'center', marginTop: space.md }}>
              {SUGGESTIONS.map((key) => (
                <Chip key={key} label={t(key)} onPress={() => submit(t(key))} />
              ))}
            </Row>
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bubble item={item} />}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md }}
            keyboardShouldPersistTaps="handled"
          />
        )}
        {busy ? (
          <T variant="caption" color={colors.inkSoft} style={{ paddingHorizontal: space.lg, paddingBottom: space.xs }}>
            {t('assistant.thinking')}
          </T>
        ) : null}
        {choices.length > 0 ? (
          <Row gap={space.xs} wrap style={{ paddingHorizontal: space.lg, paddingBottom: space.xs }}>
            {choices.map((c) => <Chip key={c} label={c} onPress={() => submit(c)} />)}
          </Row>
        ) : null}
        <Row gap={space.sm} style={{ paddingHorizontal: space.lg, paddingBottom: space.md, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder={t('assistant.placeholder')}
              editable={enabled && !busy}
              onSubmitEditing={() => submit()}
              returnKeyType="send"
              testID="t-assistant-input"
            />
          </View>
          <IconButton icon="send" accessibilityLabel={t('assistant.send')} onPress={() => submit()}
            disabled={!enabled || busy || draft.trim().length === 0} testID="t-assistant-send" />
        </Row>
      </KeyboardAvoidingView>
      <BottomSheet visible={historyOpen} onClose={() => setHistoryOpen(false)}>
        <Stack gap={space.sm} style={{ padding: space.lg }}>
          <T variant="label">{t('assistant.history')}</T>
          <ItemRow title={t('assistant.newChat')} leading={<Icon name="add" color={colors.forest} />}
            onPress={() => { newConversation(); setHistoryOpen(false); }} />
          {conversations.length === 0 ? (
            <T variant="body" color={colors.inkSoft}>{t('assistant.history.empty')}</T>
          ) : conversations.map((c) => (
            <ItemRow key={c.id} title={c.title || t('assistant.title')}
              titleColor={c.id === conversationId ? colors.forest : undefined}
              onPress={() => { openConversation(c.id); setHistoryOpen(false); }} />
          ))}
        </Stack>
      </BottomSheet>
    </SafeAreaView>
  );
}
