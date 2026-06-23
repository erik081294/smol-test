import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, SectionList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { MonthView } from '../../lib/MonthView';
import {
  Empty, Chip, FAB, ScreenHeader, IconButton, SegmentedControl, SectionHeader,
  DateStepper, BottomSheet, ModalHeader, AvatarSelect, Button, Row, ListSkeleton, Celebrate,
} from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, categoryMeta, space, type, radius } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { ChoreLibrarySheet } from '../../lib/ChoreLibrarySheet';
import { YearActivity } from '../../lib/YearActivity';
import { choreToTask } from '../../lib/choreLibrary';
import {
  groupByDay, weekDays, groupByWeek, sortDayTasks, dateKey,
  applyTaskFilters, countBy, activeFilterCount,
} from '../../lib/agenda';
import { isOverdue } from '../../lib/recurrence';
import { useToast } from '../../lib/toast';
import { useDialog } from '../../lib/dialog';
import { dateLocale, t } from '../../lib/i18n';

const EMPTY_FILTERS = { categories: [], assigneeId: null, subgroupId: null, status: 'open' };

export default function Taken() {
  const { tasks, loading, reload, addTask, completeTask, uncompleteTask, deleteTasks } = useTasks();
  const { members, subgroups } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [hiddenIds, setHiddenIds] = useState([]);

  const [scope, setScope] = useState('dag');         // 'dag' | 'week' | 'maand' | 'jaar'
  const [cursor, setCursor] = useState(new Date());  // anker voor Dag/Week
  const [selected, setSelected] = useState(dateKey(new Date())); // gekozen dag in Maand
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const addFromLibrary = (chore) => addTask(choreToTask(chore, { startDate: new Date() }));

  // Filter-as-object naar de pure helper (assignee single-select → array van 0/1).
  const filterArg = useMemo(() => ({
    categories: filters.categories,
    assignees: filters.assigneeId ? [filters.assigneeId] : [],
    subgroupId: filters.subgroupId,
    status: filters.status,
  }), [filters]);

  // Lokaal verborgen taken (optimistisch wissen met undo) wegfilteren vóór de filters.
  const visibleTasks = useMemo(
    () => (hiddenIds.length ? tasks.filter((tk) => !hiddenIds.includes(tk.id)) : tasks),
    [tasks, hiddenIds],
  );
  const filtered = useMemo(() => applyTaskFilters(visibleTasks, filterArg), [visibleTasks, filterArg]);
  const activeCount = activeFilterCount(filterArg);

  // "Voltooide wissen": ruim alle nu getoonde afgevinkte taken in één keer op,
  // met hetzelfde undo-vangnet als boodschappen/voorraad.
  const onClearCompleted = () => {
    const ids = filtered.map((tk) => tk.id);
    if (!ids.length) return;
    animateNextLayout();
    setHiddenIds((h) => [...h, ...ids]);
    toast.show({
      message: t('tasks.clearedDone', { n: ids.length }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => !ids.includes(x))); },
      onExpire: async () => {
        try { await deleteTasks(ids); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }
      },
    });
  };

  // Achterstallig altijd bovenaan (Dag/Week), los van de cursor; niet in af-modus.
  const overdue = useMemo(() => (filters.status === 'done' ? [] : filtered.filter(isOverdue)), [filtered, filters.status]);

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
          out.push({ key: d.key, title: format(d.date, 'EEEE d MMM', { locale: dateLocale() }), data: items });
        }
      }
    }
    return out;
  }, [scope, filtered, overdue, cursor]);

  // "Alles af vandaag"-viering: vier het moment dat de laatste open taak van vandaag
  // afgevinkt wordt (alleen in de Dag-weergave van vandaag, open-filter).
  const isTodayOpenView = scope === 'dag' && filters.status === 'open' && dateKey(cursor) === dateKey(new Date());
  const openTodayCount = isTodayOpenView ? sections.reduce((n, s) => n + s.data.length, 0) : null;
  const prevOpenToday = useRef(null);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (openTodayCount === 0 && prevOpenToday.current > 0) setCelebrate(true);
    prevOpenToday.current = openTodayCount;
  }, [openTodayCount]);

  const stepCursor = (delta) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + (scope === 'week' ? delta * 7 : delta));
    setCursor(d);
  };

  const week = weekDays(cursor);
  const weekLabel = `${format(week[0].date, 'd')} – ${format(week[6].date, 'd MMM', { locale: dateLocale() })}`;

  // Actieve-filter-chips boven de lijst (elk verwijderbaar).
  const activeChips = [];
  for (const c of filters.categories) {
    activeChips.push({ key: `c-${c}`, label: categoryMeta[c]?.label ?? c, onRemove: () => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) })) });
  }
  if (filters.assigneeId) {
    const name = members.find((m) => m.id === filters.assigneeId)?.display_name?.split(' ')[0] ?? t('common.someone');
    activeChips.push({ key: 'assignee', label: name, onRemove: () => setFilters((f) => ({ ...f, assigneeId: null })) });
  }
  if (filters.subgroupId) {
    const g = subgroups.find((s) => s.id === filters.subgroupId);
    activeChips.push({ key: 'subgroup', label: g ? `${g.emoji} ${g.name}` : t('tasks.filter.group'), onRemove: () => setFilters((f) => ({ ...f, subgroupId: null })) });
  }
  if (filters.status !== 'open') {
    activeChips.push({ key: 'status', label: filters.status === 'done' ? t('tasks.filter.done') : t('tasks.filter.status.all'), onRemove: () => setFilters((f) => ({ ...f, status: 'open' })) });
  }

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
            { value: 'jaar', label: t('tasks.scope.year') },
          ]}
        />
      </View>

      {/* Filterbalk (TKN-3): knop met teller + actieve-filter-chips + wis-alles.
          Niet in Jaar-scope: die kijkt naar de voltooiingen-log met een eigen
          lid-selector, niet naar de open/geplande taken die deze filters sturen. */}
      {scope !== 'jaar' ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8, gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => setFilterOpen(true)} accessibilityRole="button"
          accessibilityLabel={t('tasks.filter.title')}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, height: 38,
            paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5,
            borderColor: activeCount ? colors.forest : colors.lineStrong,
            backgroundColor: activeCount ? colors.forest : (pressed ? colors.surfaceAlt : 'transparent'),
          })}>
          <Icon name="filter" size={16} color={activeCount ? colors.onDark : colors.ink} />
          <Text style={[type.button, { fontSize: 14, color: activeCount ? colors.onDark : colors.ink }]}>
            {t('tasks.filter.button')}{activeCount ? ` · ${activeCount}` : ''}
          </Text>
        </Pressable>
        {activeChips.map((chip) => (
          <Chip key={chip.key} label={`${chip.label}  ✕`} active onPress={chip.onRemove} />
        ))}
        {activeCount > 0 ? (
          <Pressable onPress={() => setFilters(EMPTY_FILTERS)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('tasks.filter.clear')}>
            <Text style={[type.caption, { color: colors.forest, fontWeight: '700' }]}>{t('tasks.filter.clear')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      ) : null}

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
      {scope === 'jaar' ? (
        <YearActivity members={members} />
      ) : scope === 'maand' ? (
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
          ListHeaderComponent={
            filters.status === 'done' && filtered.length > 0 ? (
              <Button title={t('tasks.clearDone', { n: filtered.length })} variant="ghost" icon="delete"
                fullWidth={false} onPress={onClearCompleted} style={{ alignSelf: 'flex-start', marginBottom: space.sm }} />
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length}
              tint={section.key === 'overdue' ? colors.danger : colors.inkSoft} />
          )}
          renderItem={({ item }) => <TaskRow task={item} members={members} onToggle={toggle} />}
          ListEmptyComponent={
            loading ? (
              <ListSkeleton count={5} />
            ) : filters.status === 'done' ? (
              <Empty illustration="tasks" title={t('tasks.empty.done.title')}
                subtitle={t('tasks.empty.done.subtitle')} />
            ) : (
              <Empty illustration="tasks" title={t('tasks.scope.empty.title')}
                subtitle={scope === 'week' ? t('tasks.scope.empty.week') : t('tasks.scope.empty.day')}
                actionTitle={t('task.add')} onAction={() => router.push('/task/new')} />
            )
          }
        />
      )}

      <FAB label={t('fab.task')} accessibilityLabel={t('task.add')} onPress={() => router.push('/task/new')} />

      <ChoreLibrarySheet visible={libraryOpen} onClose={() => setLibraryOpen(false)} onAdd={addFromLibrary} />

      <TaskFilterSheet
        visible={filterOpen} onClose={() => setFilterOpen(false)}
        filters={filters} setFilters={setFilters}
        members={members} subgroups={subgroups} tasks={tasks} filterArg={filterArg}
      />

      <Celebrate show={celebrate} message={t('tasks.allDoneToday')} onDone={() => setCelebrate(false)} />
    </SafeAreaView>
  );
}

// Bottom-sheet met gegroepeerde filterkeuzes (categorie/persoon/groep/status).
// Filters werken live; de sheet is enkel de editor. Categorie toont per-categorie
// tellers (countBy) op de huidige selectie minus de categorie-as.
function TaskFilterSheet({ visible, onClose, filters, setFilters, members, subgroups, tasks, filterArg }) {
  const catCounts = useMemo(
    () => countBy(applyTaskFilters(tasks, { ...filterArg, categories: [] }), (tk) => tk.category),
    [tasks, filterArg],
  );
  const toggleCategory = (k) => setFilters((f) => ({
    ...f, categories: f.categories.includes(k) ? f.categories.filter((x) => x !== k) : [...f.categories, k],
  }));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ModalHeader title={t('tasks.filter.title')} onClose={onClose} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        {/* Categorie (multi) */}
        <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.lg }}>
          {Object.entries(categoryMeta).map(([k, m]) => (
            <Chip key={k} icon={m.icon} color={m.color}
              label={catCounts[k] ? `${m.label} · ${catCounts[k]}` : m.label}
              active={filters.categories.includes(k)} onPress={() => toggleCategory(k)} />
          ))}
        </View>

        {/* Toegewezen aan (single) */}
        <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.assignee')}</Text>
        <AvatarSelect members={members} includeEveryone everyoneLabel={t('common.everyone')}
          selectedId={filters.assigneeId} onSelect={(id) => setFilters((f) => ({ ...f, assigneeId: id }))}
          style={{ marginBottom: space.lg }} />

        {/* Groep (single) */}
        {subgroups.length > 0 ? (
          <>
            <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.group')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.lg }}>
              <Chip label={t('common.everyone')} active={!filters.subgroupId}
                onPress={() => setFilters((f) => ({ ...f, subgroupId: null }))} />
              {subgroups.map((g) => (
                <Chip key={g.id} label={`${g.emoji} ${g.name}`} active={filters.subgroupId === g.id}
                  onPress={() => setFilters((f) => ({ ...f, subgroupId: g.id }))} />
              ))}
            </View>
          </>
        ) : null}

        {/* Status */}
        <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.status')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.lg }}>
          {[['open', t('tasks.filter.open')], ['done', t('tasks.filter.done')], ['all', t('tasks.filter.status.all')]].map(([v, lbl]) => (
            <Chip key={v} label={lbl} active={filters.status === v}
              onPress={() => setFilters((f) => ({ ...f, status: v }))} />
          ))}
        </View>

        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Button title={t('tasks.filter.clear')} variant="ghost" onPress={() => setFilters(EMPTY_FILTERS)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('tasks.filter.apply')} onPress={onClose} />
          </View>
        </Row>
      </ScrollView>
    </BottomSheet>
  );
}
