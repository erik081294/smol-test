import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, RefreshControl } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { useTaskCompletions } from '../../lib/useTaskCompletions';
import { useZones } from '../../lib/useZones';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { mutate } from '../../lib/db';
import { TaskRow } from '../../lib/TaskRow';
import { FairnessBars } from '../../lib/FairnessBars';
import { Empty, Card, Button, Chip, Row, ScreenHeader, SectionHeader, ListSkeleton, BottomSheet, SheetScrollView } from '../../lib/ui';
import { colors, type, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { visibilityPayload } from '../../lib/visibility';
import { CLEANING_TEMPLATES, planTemplate } from '../../lib/cleaningTemplates';
import { tally, tallyFromCounts, sinceDate, PERIODS } from '../../lib/fairness';
import { t, plural } from '../../lib/i18n';

const FAIRNESS_PERIODS = [
  { key: 'WEEK', labelKey: 'cleaning.period.week', days: PERIODS.WEEK },
  { key: 'MONTH', labelKey: 'cleaning.period.month', days: PERIODS.MONTH },
  { key: 'ALL', labelKey: 'cleaning.period.all', days: PERIODS.ALL },
];

export default function Schoonmaak() {
  const dialog = useDialog();
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { completions, exactCounts } = useTaskCompletions();
  const { zones, reload: reloadZones } = useZones();
  const { members, activeId } = useHousehold();
  const { user } = useAuth();
  const router = useRouter();
  const [picker, setPicker] = useState(null); // het gekozen sjabloon in de preview
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState('WEEK'); // eerlijkheidsoverzicht-periode

  // "Wie deed hoeveel": tel alleen schoonmaakvoltooiingen (taak hangt aan een zone).
  // Bij de "alle tijd"-periode én een vol laad-venster (>2000 voltooiingen) rekenen
  // we exact uit de server-side aggregaat-tellingen (PERF-1) i.p.v. uit het venster;
  // week/maand blijven uit het venster (de RPC is all-time).
  const fairnessRows = useMemo(() => {
    const days = FAIRNESS_PERIODS.find((p) => p.key === period)?.days ?? null;
    if (days == null && exactCounts) return tallyFromCounts(exactCounts, members, 'cleaning_completions');
    const cleaning = completions.filter((c) => c.task?.zone_id != null);
    return tally(cleaning, members, sinceDate(days));
  }, [completions, exactCounts, members, period]);
  const periodTotal = fairnessRows.reduce((s, r) => s + r.count, 0);
  const hasAnyCompletion = periodTotal > 0;

  // Schoonmaaktaken = taken die aan een zone hangen.
  const byZone = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!t.zone_id || t.completed_at) continue;
      (m[t.zone_id] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));

  const preview = useMemo(
    () => (picker ? planTemplate(picker, { existingZones: zones, startDate: new Date() }) : null),
    [picker, zones]
  );

  const applyTemplate = async () => {
    if (!picker) return;
    setBusy(true);
    try {
      const plan = planTemplate(picker, { existingZones: zones, startDate: new Date() });
      let created = [];
      if (plan.zonesToCreate.length) {
        created = await mutate(
          supabase.from('zones')
            .insert(plan.zonesToCreate.map((z) => ({ ...z, household_id: activeId })))
            .select(),
          { context: 'zones aanmaken' }
        );
      }
      const byName = new Map();
      for (const z of [...zones, ...(created ?? [])]) byName.set(z.name.trim().toLowerCase(), z.id);

      const rows = plan.tasks.map((t) => ({
        household_id: activeId,
        created_by: user.id,
        title: t.title,
        category: t.category,
        zone_id: byName.get(t.zone_name.trim().toLowerCase()) ?? null,
        due_date: t.due_date,
        recur_freq: t.recur_freq,
        recur_interval: t.recur_interval,
        recur_weekdays: t.recur_weekdays,
        ...visibilityPayload({ visibility: t.visibility }),
      }));
      await mutate(supabase.from('tasks').insert(rows), { context: 'schoonmaaktaken aanmaken' });

      setPicker(null);
      reloadZones();
      reload();
    } catch (e) {
      dialog.alert({ title: t('cleaning.error.setup'), body: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('cleaning.title')} subtitle={t('cleaning.subtitle')} />

      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl }}
        data={zones}
        keyExtractor={(z) => z.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        ListHeaderComponent={members.length > 1 ? (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeader title={t('cleaning.fairness.title')} />
            <Text style={[type.caption, { marginTop: -6, marginBottom: 12 }]}>{t('cleaning.fairness.subtitle')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {FAIRNESS_PERIODS.map((p) => (
                <Chip key={p.key} label={t(p.labelKey)} active={period === p.key} onPress={() => setPeriod(p.key)} />
              ))}
            </View>
            {hasAnyCompletion ? (
              <>
                {/* Periode-transparantie: hoeveel voltooiingen de balken beslaan. */}
                <Text style={[type.caption, { marginBottom: 12 }]}>
                  {plural(periodTotal, 'cleaning.fairness.count.one', 'cleaning.fairness.count.other')}
                </Text>
                <FairnessBars rows={fairnessRows} />
              </>
            ) : (
              <Text style={[type.caption]}>
                {t('cleaning.fairness.empty')}
              </Text>
            )}
          </Card>
        ) : null}
        renderItem={({ item: zone }) => {
          const zt = byZone[zone.id] ?? [];
          return (
            <Card style={{ marginBottom: 14 }}>
              <Text style={[type.title, { marginBottom: 8 }]}>{zone.emoji} {zone.name}</Text>
              {zt.length === 0 ? (
                <Text style={[type.caption]}>{t('cleaning.zone.empty')}</Text>
              ) : zt.map((task) => (
                <View key={task.id} style={{ marginBottom: 4 }}>
                  {/* Binnen de Schoonmaak-module opent een zone-taak de editor (hier
                      hoort 'ie thuis); vanaf Taken/Vandaag linkt 'ie hierheen (UX-28). */}
                  <TaskRow task={task} members={members} onToggle={toggle}
                    onPress={() => router.push(`/task/${task.id}`)} />
                </View>
              ))}
              {/* Zelfde editor als overal — alleen met deze zone voorgevuld. */}
              <Button title={t('task.add')} icon="add" variant="ghost" fullWidth={false}
                onPress={() => router.push(`/task/new?zone=${zone.id}`)}
                style={{ marginTop: 8 }} />
            </Card>
          );
        }}
        ListFooterComponent={zones.length > 0 ? (
          <Button title={t('cleaning.setup')} variant="accent" icon="add"
            onPress={() => setPicker(CLEANING_TEMPLATES[0])}
            style={{ marginTop: space.sm }} />
        ) : null}
        ListEmptyComponent={
          loading && zones.length === 0 ? (
            <ListSkeleton count={4} />
          ) : !loading && zones.length === 0 ? (
            <Empty illustration="cleaning" title={t('cleaning.empty.title')}
              subtitle={t('cleaning.empty.subtitle')}
              actionTitle={t('cleaning.setup')} onAction={() => setPicker(CLEANING_TEMPLATES[0])} />
          ) : null
        }
      />

      {/* Sjabloon-preview (UX-22: gedeelde BottomSheet). */}
      <BottomSheet visible={!!picker} onClose={() => setPicker(null)} maxHeight="85%">
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.lg }}>
          <Text style={[type.h2, { marginBottom: space.sm }]}>{t('cleaning.setup')}</Text>

          {/* Sjabloonkeuze */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
            {CLEANING_TEMPLATES.map((tpl) => (
              <Chip key={tpl.key} label={tpl.label} active={picker?.key === tpl.key} onPress={() => setPicker(tpl)} />
            ))}
          </ScrollView>

          {picker && (
            <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.sm }]}>{picker.description}</Text>
          )}

          {preview?.tasks.map((pt, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
              paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Text style={type.body}>{pt.zone_name} · {pt.title}</Text>
              <Text style={type.caption}>{recurrenceLabel(pt)}</Text>
            </View>
          ))}

          {preview && (
            <Text style={[type.caption, { marginTop: space.sm }]}>
              {plural(preview.tasks.length, 'cleaning.preview.tasks.one', 'cleaning.preview.tasks.other')}
              {preview.zonesToCreate.length
                ? t('cleaning.preview.newZones', { n: preview.zonesToCreate.length })
                : t('cleaning.preview.existingZones')}
            </Text>
          )}

          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <View style={{ flex: 1 }}><Button title={t('common.cancelLong')} variant="ghost" onPress={() => setPicker(null)} /></View>
            <View style={{ flex: 1 }}><Button title={t('cleaning.confirm')} loading={busy} onPress={applyTemplate} /></View>
          </Row>
        </SheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
