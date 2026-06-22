import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { MonthView } from '../../lib/MonthView';
import {
  Empty, Chip, FAB, ScreenHeader, IconButton, SegmentedControl, SectionHeader, DateStepper,
} from '../../lib/ui';
import { colors, categoryMeta, space, type } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { ChoreLibrarySheet } from '../../lib/ChoreLibrarySheet';
import { choreToTask } from '../../lib/choreLibrary';
import {
  groupByDay, weekDays, groupByWeek, sortDayTasks, dateKey,
} from '../../lib/agenda';
import { isOverdue } from '../../lib/recurrence';
import { dateLocale, t } from '../../lib/i18n';

export default function Taken() {
  const { tasks, loading, reload, addTask, completeTask, uncompleteTask } = useTasks();
  const { members } = useHousehold();
  const router = useRouter();

  const [scope, setScope] = useState('dag');         // 'dag' | 'week' | 'maand'
  const [cursor, setCursor] = useState(new Date());  // anker voor Dag/Week
  const [selected, setSelected] = useState(dateKey(new Date())); // gekozen dag in Maand
  const [cat, setCat] = useState('alle');
  const [showDone, setShowDone] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const addFromLibrary = (chore) => addTask(choreToTask(chore, { startDate: new Date() }));

  // Categorie/status-filter (orthogonaal aan de scope).
  const filtered = useMemo(() => tasks.filter((tk) => {
    if (!showDone && tk.completed_at) return false;
    if (showDone && !tk.completed_at) return false;
    if (cat !== 'alle' && tk.category !== cat) return false;
    return true;
  }), [tasks, cat, showDone]);

  // Achterstallig staat altijd bovenaan (Dag/Week), los van de cursor; niet in af-modus.
  const overdue = useMemo(() => (showDone ? [] : filtered.filter(isOverdue)), [filtered, showDone]);

  const toggle = (tk) => {
    animateNextLayout();
    return tk.completed_at ? uncompleteTask(tk.id) : completeTask(tk);
  };

  // Secties per scope (Dag/Week). Maand rendert los via MonthView.
  const sections = useMemo(() => {
    const out = [];
    if (overdue.length) out.push({ key: 'overdue', title: t('tasks.overdue'), data: sortDayTasks(overdue) });
    if (scope === 'dag') {
      const { dated, undated } = groupByDay(filtered, cursor);
      const onDay = sortDayTasks(dated).filter((tk) => !overdue.includes(tk));
      if (onDay.length) out.push({ key: 'day', title: t('tasks.scope.onDay'), data: onDay });
      if (undated.length) out.push({ key: 'undated', title: t('tasks.scope.undated'), data: undated });
    } else if (scope === 'week') {
      const byDay = groupByWeek(filtered, cursor);
      for (const d of weekDays(cursor)) {
        const items = sortDayTasks(byDay[d.key]).filter((tk) => !overdue.includes(tk));
        if (items.length) {
          const label = format(d.date, 'EEEE d MMM', { locale: dateLocale() });
          out.push({ key: d.key, title: label, data: items });
        }
      }
    }
    return out;
  }, [scope, filtered, overdue, cursor]);

  const stepCursor = (delta) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + (scope === 'week' ? delta * 7 : delta));
    setCursor(d);
  };

  const week = weekDays(cursor);
  const weekLabel = `${format(week[0].date, 'd')} – ${format(week[6].date, 'd MMM', { locale: dateLocale() })}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')}
        right={<IconButton icon="library" accessibilityLabel={t('chores.library')}
          tint={colors.forest} onPress={() => setLibraryOpen(true)} />} />

      {/* Tijdscope-switcher (TKN-1) */}
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <SegmentedControl
          value={scope}
          onChange={setScope}
          options={[
            { value: 'dag', label: t('tasks.scope.day') },
            { value: 'week', label: t('tasks.scope.week') },
            { value: 'maand', label: t('tasks.scope.month') },
          ]}
        />
      </View>

      {/* Categorie-filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8 }}>
        <Chip label={t('common.all')} active={cat === 'alle'} onPress={() => setCat('alle')} />
        {Object.entries(categoryMeta).map(([k, m]) => (
          <Chip key={k} icon={m.icon} label={m.label} active={cat === k} color={m.color} onPress={() => setCat(k)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 6, gap: 8 }}>
        <Chip label={t('tasks.filter.open')} active={!showDone} onPress={() => setShowDone(false)} />
        <Chip label={t('tasks.filter.done')} active={showDone} color={colors.done} onPress={() => setShowDone(true)} />
      </View>

      {/* Dag/Week-cursor */}
      {scope === 'dag' ? (
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <DateStepper date={cursor} onChange={setCursor} />
        </View>
      ) : scope === 'week' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('tasks.week.prev')} onPress={() => stepCursor(-1)} />
          <Text style={[type.title, { fontWeight: '700' }]}>{weekLabel}</Text>
          <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('tasks.week.next')} onPress={() => stepCursor(1)} />
        </View>
      ) : null}

      {/* Scope-inhoud */}
      {scope === 'maand' ? (
        <MonthView tasks={filtered} members={members} onToggle={toggle}
          selectedKey={selected} onSelectDay={setSelected}
          emptyIllustration="tasks" emptyTitle={t('tasks.scope.empty.title')} emptySubtitle={t('tasks.scope.empty.day')} />
      ) : (
        <SectionList
          contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 40, flexGrow: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          onRefresh={reload}
          refreshing={loading}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length}
              tint={section.key === 'overdue' ? colors.danger : colors.inkSoft} />
          )}
          renderItem={({ item }) => <TaskRow task={item} members={members} onToggle={toggle} />}
          ListEmptyComponent={!loading ? (
            <Empty illustration="tasks"
              title={showDone ? t('tasks.empty.done.title') : t('tasks.scope.empty.title')}
              subtitle={showDone ? t('tasks.empty.done.subtitle') : (scope === 'week' ? t('tasks.scope.empty.week') : t('tasks.scope.empty.day'))} />
          ) : null}
        />
      )}

      <FAB label={t('fab.task')} accessibilityLabel={t('task.add')} onPress={() => router.push('/task/new')} />

      <ChoreLibrarySheet visible={libraryOpen} onClose={() => setLibraryOpen(false)} onAdd={addFromLibrary} />
    </SafeAreaView>
  );
}
