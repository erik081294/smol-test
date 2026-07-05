// Assistent (AI-1/AI-10, plan 23) — het volledige-scherm-instappunt van de chat.
// Dun: de chat-UI leeft in lib/AssistantChat.js en de gespreksstate app-breed in
// lib/assistantProvider.js (één gesprek, gedeeld met de overlay-sheet — een
// remount of tab-wissel begint dus niet meer leeg). Hier alleen de kop + de
// gesprekkenlijst-sheet.
import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ScreenHeader, ModuleHelpButton, IconButton, T, Stack, Row, BottomSheet, ItemRow } from '../../lib/ui';
import { AssistantChat } from '../../lib/AssistantChat';
import { useAssistantHub } from '../../lib/assistantProvider';
import { Icon } from '../../lib/icons';
import { colors, space } from '../../lib/theme';
import { t } from '../../lib/i18n';

export default function Assistent() {
  const { assistant } = useAssistantHub();
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!assistant) return null;
  const { conversations, conversationId, openConversation, newConversation } = assistant;

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
      {/* Android edge-to-edge duwt de composer niet vanzelf boven het toetsenbord;
          'height' krimpt de KAV tot het zichtbare gebied zodat het invoerveld zichtbaar
          blijft (zelfde patroon als de Editor/BottomSheet in lib/ui.js). iOS: 'padding'. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1 }}>
          <AssistantChat assistant={assistant} />
        </View>
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
