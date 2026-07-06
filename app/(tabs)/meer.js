import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { MODULE_GROUPS } from '../../lib/modules';
import { ScreenHeader, SectionHeader, ItemRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, space } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Overflow-scherm: alle effectieve modules die niet als eigen tab-icoon staan
// (de niet-primaire), gegroepeerd per thema (Eten · Huis · Geld & delen · Beheer)
// zodat de groeiende moduleset scanbaar blijft en samenhang zichtbaar is. Modules
// met group:null (bijv. Huishouden) verschijnen hier niet — die zijn bereikbaar via
// hun hub (Instellingen).
export default function Meer() {
  const { modules } = useHousehold();
  const router = useRouter();

  const groups = useMemo(() => {
    const visible = modules.filter((m) => !m.primary && m.group);
    return MODULE_GROUPS
      .map((key) => ({ key, items: visible.filter((m) => m.group === key) }))
      .filter((g) => g.items.length > 0);
  }, [modules]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('more.title')} subtitle={t('more.subtitle')} />

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
        {/* Globaal zoeken (PLT-3): één ingang naar het zoekscherm over alle
            modules heen — bovenaan, vóór de module-groepen. */}
        <ItemRow
          leading={<Icon name="search" size={26} color={colors.forest} />}
          title={t('search.title')}
          chevron
          onPress={() => router.push('/zoeken')}
        />

        {groups.map((g) => (
          <View key={g.key} style={{ marginTop: space.sm }}>
            <SectionHeader title={t(`more.group.${g.key}`)} />
            {g.items.map((m) => (
              <ItemRow key={m.key}
                leading={<Icon name={m.icon} size={26} color={colors.forest} />}
                title={m.label}
                chevron
                onPress={() => router.push(`/(tabs)/${m.route}`)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
