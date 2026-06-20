import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ModalHeader, Card, Row, Chip, Banner, SectionHeader } from '../lib/ui';
import { colors, space, type } from '../lib/theme';
import { getPrefs, setPrefs, NOTIF_DEFAULTS } from '../lib/notificationPrefs';
import { t } from '../lib/i18n';

const MEAL_TIMES = ['16:00', '16:30', '17:00', '17:30', '18:00'];
const SUMMARY_TIMES = ['07:00', '08:00', '09:00'];
const LEADS = [0, 15, 30, 60];

// Op module-niveau (niet binnen de render) zodat ze niet elke render opnieuw als
// component-type ontstaan.
function ToggleRow({ label, value, onChange, disabled }) {
  return (
    <Row justify="space-between" style={{ paddingVertical: space.sm, opacity: disabled ? 0.5 : 1 }}>
      <Text style={type.body}>{label}</Text>
      <Switch
        value={value} onValueChange={onChange} disabled={disabled}
        trackColor={{ true: colors.done, false: colors.line }} thumbColor={colors.surface}
        accessibilityLabel={label}
      />
    </Row>
  );
}

function TimeRow({ label, times, value, onChange }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.label, { marginBottom: space.xs }]}>{label}</Text>
      <Row gap={space.xs} wrap>
        {times.map((tm) => <Chip key={tm} label={tm} active={value === tm} onPress={() => onChange(tm)} />)}
      </Row>
    </View>
  );
}

export default function Instellingen() {
  const router = useRouter();
  const [prefs, setLocal] = useState(NOTIF_DEFAULTS);

  useEffect(() => { getPrefs().then(setLocal); }, []);

  // Wijziging lokaal tonen én persistent maken (de hook herplant via de subscription).
  const update = (patch) => { const next = { ...prefs, ...patch }; setLocal(next); setPrefs(next); };

  const off = !prefs.enabled;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('notif.title')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        {Platform.OS === 'web' ? (
          <Banner tone="info" style={{ marginBottom: space.lg }}>{t('notif.onlyMobile')}</Banner>
        ) : null}

        <Card style={{ marginBottom: space.lg }}>
          <ToggleRow label={t('notif.master')} value={prefs.enabled} onChange={(v) => update({ enabled: v })} />
          <Text style={type.caption}>{t('notif.subtitle')}</Text>
        </Card>

        <SectionHeader title={t('notif.domains')} />
        <Card style={{ marginBottom: space.lg }}>
          <ToggleRow label={t('notif.domain.taken')} value={prefs.taken} disabled={off} onChange={(v) => update({ taken: v })} />
          <ToggleRow label={t('notif.domain.plantzorg')} value={prefs.plantzorg} disabled={off} onChange={(v) => update({ plantzorg: v })} />
          <ToggleRow label={t('notif.domain.maaltijden')} value={prefs.maaltijden} disabled={off} onChange={(v) => update({ maaltijden: v })} />
          <ToggleRow label={t('notif.domain.voorraad')} value={prefs.voorraad} disabled={off} onChange={(v) => update({ voorraad: v })} />
        </Card>

        <SectionHeader title={t('notif.timing')} />
        <Card style={{ opacity: off ? 0.5 : 1 }}>
          <View pointerEvents={off ? 'none' : 'auto'}>
            <TimeRow label={t('notif.mealTime')} times={MEAL_TIMES} value={prefs.mealReminderTime} onChange={(v) => update({ mealReminderTime: v })} />
            <TimeRow label={t('notif.summaryTime')} times={SUMMARY_TIMES} value={prefs.dailySummaryTime} onChange={(v) => update({ dailySummaryTime: v })} />
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('notif.lead')}</Text>
            <Row gap={space.xs} wrap>
              {LEADS.map((m) => (
                <Chip key={m} label={t(`notif.lead.${m}`)} active={prefs.leadMinutes === m} onPress={() => update({ leadMinutes: m })} />
              ))}
            </Row>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
