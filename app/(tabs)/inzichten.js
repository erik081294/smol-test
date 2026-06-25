import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../../lib/household';
import { ScreenHeader } from '../../lib/ui';
import { YearActivity } from '../../lib/YearActivity';
import { colors } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Inzichten — de vriendelijke, rustige plek voor de jaar-activiteit (wie-deed-wat
// over een kalenderjaar: heatmap + streaks). Verhuisd uit de Jaar-scope van Taken
// (UX-32/33), die nu een gewone takenlijst is. Bereikbaar via de "Meer"-tab.
export default function Inzichten() {
  const { members } = useHousehold();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('insights.title')} subtitle={t('insights.subtitle')} />
      <YearActivity members={members} />
    </SafeAreaView>
  );
}
