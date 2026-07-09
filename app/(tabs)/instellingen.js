import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { ScreenHeader, SectionHeader, ItemRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, space, type } from '../../lib/theme';
import { t, plural } from '../../lib/i18n';

// Centrale Instellingen-hub (Beheer). Eén plek waar je je huishouden beheert,
// herinneringen instelt en (binnenkort) de beeldstijl kiest. Huishouden is hierin
// gevouwen i.p.v. een los Meer-item.
export default function Instellingen() {
  const router = useRouter();
  const { active, members } = useHousehold();

  const Leading = ({ icon }) => (
    <View style={{
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forestTint,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={22} color={colors.forest} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
        <ItemRow
          leading={<Leading icon="group" />}
          title={t('settings.row.household')}
          meta={
            <Text style={type.caption}>
              {active?.emoji} {active?.name} · {plural(members.length, 'household.members.one', 'household.members.other')}
            </Text>
          }
          chevron
          onPress={() => router.push('/(tabs)/huishouden')}
        />
        <ItemRow
          leading={<Leading icon="bell" />}
          title={t('settings.row.reminders')}
          meta={<Text style={type.caption}>{t('settings.row.reminders.meta')}</Text>}
          chevron
          onPress={() => router.push('/herinneringen')}
        />
        <ItemRow
          leading={<Leading icon="appearance" />}
          title={t('settings.row.appearance')}
          meta={<Text style={type.caption}>{t('settings.row.appearance.meta')}</Text>}
          chevron
          onPress={() => router.push('/beeldstijl')}
        />

        <SectionHeader title={t('settings.danger')} />
        <ItemRow
          leading={
            <View style={{
              width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="delete" size={22} color={colors.danger} />
            </View>
          }
          title={t('settings.row.deleteAccount')}
          titleColor={colors.danger}
          meta={<Text style={type.caption}>{t('settings.row.deleteAccount.meta')}</Text>}
          chevron
          onPress={() => router.push('/account-verwijderen')}
        />

        <SectionHeader title={t('settings.about')} />
        <Text style={[type.caption, { textAlign: 'center', marginTop: space.sm }]}>Huishoek · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
