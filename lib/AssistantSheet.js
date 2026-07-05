// De assistent als volledig-scherm chat-overlay (AI-10 "assistent overal",
// herzien AI-15 na device-feedback). Eerder een BottomSheet met swipe-to-dismiss:
// die swipe botste met het scrollen (de drawer "sprong alle kanten op"), de vaste
// hoogte liet het toetsenbord over de invoer vallen, en de tab-bar schemerde eronder
// door. Nu een opaque full-screen Modal die de hele hoogte gebruikt, met een
// kruisje om te sluiten en nette keyboard-avoiding — de invoer blijft altijd boven
// het toetsenbord. "Zelf invoeren" blijft de altijd-zichtbare uitwijk naar de
// klassieke editor van de module (controle bij de gebruiker).
import React from 'react';
import { Modal, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Button, T, Row } from './ui';
import { AssistantChat } from './AssistantChat';
import { useAssistantHub } from './assistantProvider';
import { colors, space } from './theme';
import { t } from './i18n';

export function AssistantSheet() {
  const { assistant, sheet, closeAssistant } = useAssistantHub();
  if (!sheet || !assistant?.enabled) return null;

  const manual = () => {
    const go = sheet.onManual;
    closeAssistant();
    // Eerst de overlay dicht, dan pas de editor openen — anders stapelen de modals.
    if (typeof go === 'function') setTimeout(go, 0);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={closeAssistant}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Row style={{ paddingHorizontal: space.sm, paddingVertical: space.xs, alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={closeAssistant} testID="t-assistant-close" />
            <T variant="label">{t('assistant.title')}</T>
            {sheet.onManual ? (
              <Button title={t('assistant.sheet.manual')} variant="ghost" fullWidth={false}
                onPress={manual} accessibilityHint={t('assistant.sheet.manualHint')} />
            ) : (
              // Spacer zodat de titel gecentreerd blijft (zelfde breedte als de kruisje-knop).
              <View style={{ width: 44 }} />
            )}
          </Row>
          <AssistantChat assistant={assistant} autoFocus />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
