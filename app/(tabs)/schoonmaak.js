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
import { Empty, Card, Button, Chip, Row, ScreenHeader, SectionHeader, ModuleHelpButton, ListSkeleton, BottomSheet, SheetScrollView, SegmentedControl } from '../../lib/ui';
import { colors, type, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { visibilityPayload } from '../../lib/visibility';
import { RECUR } from '../../lib/constants';
import { CLEANING_TEMPLATES, getCleaningTemplate, planTemplate, buildCustomSchedule } from '../../lib/cleaningTemplates';
import { tally, tallyFromCounts, sinceDate, PERIODS } from '../../lib/fairness';
import { t, plural } from '../../lib/i18n';

const FAIRNESS_PERIODS = [
  { key: 'WEEK', labelKey: 'cleaning.period.week', days: PERIODS.WEEK },
  { key: 'MONTH', labelKey: 'cleaning.period.month', days: PERIODS.MONTH },
  { key: 'ALL', labelKey: 'cleaning.period.all', days: PERIODS.ALL },
];

// Cadans-keuzes voor de zelf-samengestelde rooster-builder (SCH-4). Bewust een kleine,
// herkenbare set bovenop de bestaande recurrence-velden; weekdag-fijnregelen blijft voor
// de taak-editor (daar kan het al volledig).
const CADENCES = [
  { key: 'weekly', labelKey: 'cleaning.cadence.weekly', freq: RECUR.WEEKLY, interval: 1 },
  { key: 'biweekly', labelKey: 'cleaning.cadence.biweekly', freq: RECUR.WEEKLY, interval: 2 },
  { key: 'monthly', labelKey: 'cleaning.cadence.monthly', freq: RECUR.MONTHLY, interval: 1 },
];
const norm = (s) => (s ?? '').trim().toLowerCase();

export default function Schoonmaak() {
  const dialog = useDialog();
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { completions, exactCounts } = useTaskCompletions();
  const { zones, reload: reloadZones } = useZones();
  const { members, activeId } = useHousehold();
  const { user } = useAuth();
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);      // de "Rooster opstellen"-sheet
  const [setupMode, setSetupMode] = useState('template'); // 'template' | 'custom'
  const [tplKey, setTplKey] = useState(CLEANING_TEMPLATES[0].key); // gekozen sjabloon
  const [customRooms, setCustomRooms] = useState({});     // norm(zone) -> { zone, emoji, freq, interval }
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

  const openSetup = () => { setSetupMode('template'); setTplKey(CLEANING_TEMPLATES[0].key); setCustomRooms({}); setSetupOpen(true); };
  // "Rooster bekijken" (SCH-4): deeplink naar Taken, voorgefilterd op alle schoonmaaktaken
  // (week-scope) — hergebruikt de bestaande Taken-weergaven i.p.v. een eigen rooster-view.
  const viewSchedule = () => router.push('/(tabs)/taken?cleaning=1&scope=week');

  // De zones die je in de custom-builder kunt kiezen: de sjabloon-zones (vertrouwd) plus
  // de zones die het huishouden al heeft, ontdubbeld op genormaliseerde naam.
  const zoneOptions = useMemo(() => {
    const m = new Map();
    for (const tpl of CLEANING_TEMPLATES) for (const r of tpl.rooms) {
      if (!m.has(norm(r.zone))) m.set(norm(r.zone), { zone: r.zone, emoji: r.emoji });
    }
    for (const z of zones) {
      if (!m.has(norm(z.name))) m.set(norm(z.name), { zone: z.name, emoji: z.emoji ?? '🧹' });
    }
    return [...m.values()];
  }, [zones]);

  // De door de gebruiker gekozen kamers → het rooster-payload-formaat van buildCustomSchedule.
  const customRoomList = useMemo(() => Object.values(customRooms).map((r) => ({
    zone: r.zone, emoji: r.emoji, recur_freq: r.freq, recur_interval: r.interval, recur_weekdays: null,
  })), [customRooms]);

  const toggleCustomZone = (opt) => setCustomRooms((m) => {
    const key = norm(opt.zone);
    if (m[key]) { const { [key]: _omit, ...rest } = m; return rest; }
    return { ...m, [key]: { zone: opt.zone, emoji: opt.emoji, freq: RECUR.WEEKLY, interval: 1 } };
  });
  const setCustomCadence = (opt, cad) => setCustomRooms((m) => ({
    ...m, [norm(opt.zone)]: { ...m[norm(opt.zone)], freq: cad.freq, interval: cad.interval },
  }));

  const preview = useMemo(() => {
    const opts = { existingZones: zones, startDate: new Date() };
    return setupMode === 'custom'
      ? buildCustomSchedule(customRoomList, opts)
      : planTemplate(getCleaningTemplate(tplKey), opts);
  }, [setupMode, tplKey, customRoomList, zones]);

  const canConfirm = setupMode === 'template' || customRoomList.length > 0;

  const applySchedule = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const plan = preview;
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

      const rows = plan.tasks.map((tk) => ({
        household_id: activeId,
        created_by: user.id,
        title: tk.title,
        category: tk.category,
        zone_id: byName.get(tk.zone_name.trim().toLowerCase()) ?? null,
        due_date: tk.due_date,
        recur_freq: tk.recur_freq,
        recur_interval: tk.recur_interval,
        recur_weekdays: tk.recur_weekdays,
        ...visibilityPayload({ visibility: tk.visibility }),
      }));
      await mutate(supabase.from('tasks').insert(rows), { context: 'schoonmaaktaken aanmaken' });

      setSetupOpen(false);
      setCustomRooms({});
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
      <ScreenHeader title={t('cleaning.title')} subtitle={t('cleaning.subtitle')}
        right={<ModuleHelpButton module="schoonmaak" />} />

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
          // Twee duidelijke ingangen (SCH-4): het hele rooster bekíjken (deeplink naar
          // Taken, week/maand) of een rooster opstellen/uitbreiden. De losse "Taak
          // toevoegen" zit per zone hierboven — zo blijven losse taak en rooster gescheiden.
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={t('cleaning.schedule.view')} variant="soft" icon="agenda" onPress={viewSchedule} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('cleaning.schedule.setup')} variant="accent" icon="add" onPress={openSetup} />
            </View>
          </Row>
        ) : null}
        ListEmptyComponent={
          loading && zones.length === 0 ? (
            <ListSkeleton count={4} />
          ) : !loading && zones.length === 0 ? (
            <Empty illustration="cleaning" title={t('cleaning.empty.title')}
              subtitle={t('cleaning.empty.subtitle')}
              actionTitle={t('cleaning.schedule.setup')} onAction={openSetup} />
          ) : null
        }
      />

      {/* Rooster opstellen (UX-22: gedeelde BottomSheet). Twee modi: een vast sjabloon
          kiezen, of zelf zones + cadans samenstellen (SCH-4). Beide leveren hetzelfde
          preview + dezelfde insert-flow op. */}
      <BottomSheet visible={setupOpen} onClose={() => setSetupOpen(false)} maxHeight="85%">
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.lg }}>
          <Text style={[type.h2, { marginBottom: space.sm }]}>{t('cleaning.schedule.setup')}</Text>

          <SegmentedControl
            value={setupMode} onChange={setSetupMode}
            options={[
              { value: 'template', label: t('cleaning.setup.mode.template') },
              { value: 'custom', label: t('cleaning.setup.mode.custom') },
            ]}
            style={{ marginBottom: space.md }} />

          {setupMode === 'template' ? (
            <>
              {/* Sjabloonkeuze */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
                {CLEANING_TEMPLATES.map((tpl) => (
                  <Chip key={tpl.key} label={tpl.label} active={tplKey === tpl.key} onPress={() => setTplKey(tpl.key)} />
                ))}
              </ScrollView>
              <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.sm }]}>
                {getCleaningTemplate(tplKey)?.description}
              </Text>
            </>
          ) : (
            <>
              <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.sm }]}>{t('cleaning.setup.custom.intro')}</Text>
              {zoneOptions.map((opt) => {
                const sel = customRooms[norm(opt.zone)];
                return (
                  <View key={opt.zone} style={{ paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <Chip label={`${opt.emoji} ${opt.zone}`} active={!!sel} onPress={() => toggleCustomZone(opt)} />
                    {sel ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.xs, marginLeft: space.sm }}>
                        {CADENCES.map((cad) => (
                          <Chip key={cad.key} label={t(cad.labelKey)}
                            active={sel.freq === cad.freq && sel.interval === cad.interval}
                            onPress={() => setCustomCadence(opt, cad)} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {customRoomList.length === 0 ? (
                <Text style={[type.caption, { marginTop: space.sm }]}>{t('cleaning.setup.custom.empty')}</Text>
              ) : null}
            </>
          )}

          {/* Gedeelde preview van wat er aangemaakt wordt. */}
          {canConfirm && preview.tasks.length > 0 ? (
            <View style={{ marginTop: space.sm }}>
              {preview.tasks.map((pt, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={type.body}>{pt.zone_name} · {pt.title}</Text>
                  <Text style={type.caption}>{recurrenceLabel(pt)}</Text>
                </View>
              ))}
              <Text style={[type.caption, { marginTop: space.sm }]}>
                {plural(preview.tasks.length, 'cleaning.preview.tasks.one', 'cleaning.preview.tasks.other')}
                {preview.zonesToCreate.length
                  ? t('cleaning.preview.newZones', { n: preview.zonesToCreate.length })
                  : t('cleaning.preview.existingZones')}
              </Text>
            </View>
          ) : null}

          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <View style={{ flex: 1 }}><Button title={t('common.cancelLong')} variant="ghost" onPress={() => setSetupOpen(false)} /></View>
            <View style={{ flex: 1 }}><Button title={t('cleaning.confirm')} loading={busy} disabled={!canConfirm} onPress={applySchedule} /></View>
          </Row>
        </SheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
