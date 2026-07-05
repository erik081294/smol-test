// De assistent als overlay (AI-10, "assistent overal"): dezelfde chat als het
// tab-scherm, maar als BottomSheet óver het huidige scherm — prominent, niet
// blokkerend (swipe-down weg, het scherm eronder blijft context). Geopend via
// de AI-first FAB's; "Zelf invoeren" is de altijd-zichtbare uitwijk naar de
// klassieke editor van de module (controle bij de gebruiker).
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BottomSheet, Button, T, Row } from './ui';
import { AssistantChat } from './AssistantChat';
import { useAssistantHub } from './assistantProvider';
import { space } from './theme';
import { t } from './i18n';

export function AssistantSheet() {
  const { assistant, sheet, closeAssistant } = useAssistantHub();
  const { height } = useWindowDimensions();
  if (!sheet || !assistant?.enabled) return null;

  const manual = () => {
    const go = sheet.onManual;
    closeAssistant();
    // Eerst de sheet dicht, dan pas de editor openen — anders stapelen de modals.
    if (typeof go === 'function') setTimeout(go, 0);
  };

  return (
    <BottomSheet visible onClose={closeAssistant} avoidKeyboard>
      <View style={{ height: Math.round(height * 0.78) }}>
        <Row justify="space-between" style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs }}>
          <T variant="label">{t('assistant.title')}</T>
          {sheet.onManual ? (
            <Button title={t('assistant.sheet.manual')} variant="ghost" fullWidth={false}
              onPress={manual} accessibilityHint={t('assistant.sheet.manualHint')} />
          ) : null}
        </Row>
        <AssistantChat assistant={assistant} autoFocus />
      </View>
    </BottomSheet>
  );
}
