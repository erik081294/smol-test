import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { ScreenHeader, ItemRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, space } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Overflow-scherm: alle effectieve modules die niet als eigen tab-icoon staan
// (de niet-primaire). Houdt de tabbalk kort terwijl elke module één tik weg blijft.
export default function Meer() {
  const { modules } = useHousehold();
  const router = useRouter();
  const items = modules.filter((m) => !m.primary);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('more.title')} subtitle={t('more.subtitle')} />

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
        {items.map((m) => (
          <ItemRow key={m.key}
            leading={<Icon name={m.icon} size={26} color={colors.forest} />}
            title={m.label}
            chevron
            onPress={() => router.push(`/(tabs)/${m.route}`)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
