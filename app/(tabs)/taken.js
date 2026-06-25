/* eslint-disable react-hooks/immutability -- Reanimated-worklets muteren SharedValue.value bewust (de regel ziet shared values ten onrechte als onveranderbaar). */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, SectionList, Pressable, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { format, addDays, addMonths, addYears } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useTags } from '../../lib/useTags';
import { useAuth } from '../../lib/auth';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { PeriodPicker } from '../../lib/PeriodPicker';
import {
  Empty, Chip, FAB, ScreenHeader, IconButton, SegmentedControl, SectionHeader,
  BottomSheet, ModalHeader, AvatarSelect, Button, Row, ListSkeleton, Celebrate, SwipeRow, Banner, SheetScrollView,
} from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, categoryMeta, space, type, radius } from '../../lib/theme';
import { animateNextLayout, prefersReducedMotion } from '../../lib/motion';
import { ChoreLibrarySheet } from '../../lib/ChoreLibrarySheet';
import { choreToTask } from '../../lib/choreLibrary';
import {
  groupByDay, weekDays, groupByWeek, sortDayTasks, dateKey, groupByDate,
  monthDays, yearMonths, groupByMonth, monthLabel,
  applyTaskFilters, countBy, activeFilterCount,
} from '../../lib/agenda';
import { isOverdue, snoozeDate, dueLabel } from '../../lib/recurrence';
import { useToast } from '../../lib/toast';
import { useDialog } from '../../lib/dialog';
import { dateLocale, t } from '../../lib/i18n';

const EMPTY_FILTERS = { categories: [], assigneeId: null, subgroupId: null, tagIds: [], status: 'open', audience: 'all' };

// Eerste letter als hoofdletter (NL-datum/maandnamen komen lowercase uit date-fns).
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Sorteer een maand-/jaarbucket op datum, dan tijd, dan titel (de buckets spannen
// meerdere dagen, dus eerst op datum — sortDayTasks gaat van één dag uit).
const sortByDate = (items) => [...(items ?? [])].sort((a, b) => {
  const da = a.due_date ?? '';
  const db = b.due_date ?? '';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.due_time ?? '99:99';
  const tb = b.due_time ?? '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return (a.title ?? '').localeCompare(b.title ?? '');
});

export default function Taken() {
  const { tasks, loading, error, reload, addTask, completeTask, uncompleteTask, deleteTask, deleteTasks, updateTask } = useTasks();
  const { members, subgroups } = useHousehold();
  const { tags } = useTags();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const [hiddenIds, setHiddenIds] = useState([]);

  const [scope, setScope] = useState('week');        // 'dag' | 'week' | 'maand' | 'jaar' — week is de standaard (UX-31)
  const [cursor, setCursor] = useState(new Date());  // anker voor de actieve periode
  const [pickerOpen, setPickerOpen] = useState(false); // kalenderkiezer pas op klik (UX-30)
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const addFromLibrary = (chore) => addTask(choreToTask(chore, { startDate: new Date() }));

  // Filter-as-object naar de pure helper (assignee single-select → array van 0/1).
  const filterArg = useMemo(() => ({
    categories: filters.categories,
    assignees: filters.assigneeId ? [filters.assigneeId] : [],
    subgroupId: filters.subgroupId,
    tagIds: filters.tagIds,
    status: filters.status,
    audience: filters.audience,
    viewerId: user?.id ?? null,
  }), [filters, user]);

  // Lokaal verborgen taken (optimistisch wissen met undo) wegfilteren vóór de filters.
  const visibleTasks = useMemo(
    () => (hiddenIds.length ? tasks.filter((tk) => !hiddenIds.includes(tk.id)) : tasks),
    [tasks, hiddenIds],
  );
  const filtered = useMemo(() => applyTaskFilters(visibleTasks, filterArg), [visibleTasks, filterArg]);
  const activeCount = activeFilterCount(filterArg);

  // "Voltooide wissen": ruim de nu zichtbare afgevinkte taken op (de secties van
  // de huidige Dag/Week-weergave — niet stilletjes ook taken van andere dagen),
  // met hetzelfde undo-vangnet als boodschappen/voorraad.
  const onClearCompleted = (ids) => {
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

  // Veeg-acties (UX-17). Links = verwijderen (met undo-vangnet), rechts = uitstellen
  // (vervaldatum een dag vooruit, ook terug te draaien).
  const removeTaskWithUndo = (task) => {
    animateNextLayout();
    setHiddenIds((h) => [...h, task.id]);
    toast.show({
      message: t('tasks.deleted', { name: task.title }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => x !== task.id)); },
      onExpire: async () => {
        try { await deleteTask(task.id); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => x !== task.id)); }
      },
    });
  };

  const snoozeTaskWithUndo = (task) => {
    const prev = task.due_date ?? null;
    const next = snoozeDate(task, 1);
    animateNextLayout();
    updateTask(task.id, { due_date: next });
    toast.show({
      message: t('tasks.snoozed', { date: dueLabel({ due_date: next }) }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); updateTask(task.id, { due_date: prev }); },
    });
  };

  // Secties per scope. Dag/Week/Maand/Jaar leveren nu állemaal een lijst (UX-32):
  // de kalender is verhuisd naar de kiezer-on-klik (UX-30). Achterstallig staat
  // bovenaan voor dag/week/maand (niet in de brede Jaar-weergave).
  const sections = useMemo(() => {
    const out = [];
    if (scope !== 'jaar' && overdue.length) {
      out.push({ key: 'overdue', title: t('tasks.overdue'), data: sortDayTasks(overdue) });
    }
    if (scope === 'dag') {
      const { dated, undated } = groupByDay(filtered, cursor);
      const onDay = sortDayTasks(dated).filter((tk) => !overdue.includes(tk));
      if (onDay.length) out.push({ key: 'day', title: t('tasks.scope.onDay'), data: onDay });
      if (undated.length) out.push({ key: 'undated', title: t('tasks.scope.undated'), data: undated });
    } else if (scope === 'week') {
      const byDay = groupByWeek(filtered, cursor);
      for (const d of weekDays(cursor)) {
        const items = sortDayTasks(byDay[d.key]).filter((tk) => !overdue.includes(tk));
        if (items.length) out.push({ key: d.key, title: cap(format(d.date, 'EEEE d MMM', { locale: dateLocale() })), data: items });
      }
    } else if (scope === 'maand') {
      const byDate = groupByDate(filtered);
      for (const day of monthDays(cursor.getFullYear(), cursor.getMonth())) {
        const items = sortDayTasks(byDate[day.key]).filter((tk) => !overdue.includes(tk));
        if (items.length) out.push({ key: day.key, title: cap(format(day.date, 'EEEE d MMM', { locale: dateLocale() })), data: items });
      }
    } else if (scope === 'jaar') {
      const byMonth = groupByMonth(filtered);
      for (const mo of yearMonths(cursor.getFullYear())) {
        if (byMonth[mo.key]?.length) out.push({ key: mo.key, title: cap(mo.label), data: sortByDate(byMonth[mo.key]) });
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

  // Eén periode vooruit/terug, afhankelijk van de scope (dag/week/maand/jaar).
  const stepPeriod = (delta) => setCursor((c) => {
    if (scope === 'week') return addDays(c, delta * 7);
    if (scope === 'maand') return addMonths(c, delta);
    if (scope === 'jaar') return addYears(c, delta);
    return addDays(c, delta);
  });

  // Periode-label voor de kop.
  const week = weekDays(cursor);
  const periodLabel = scope === 'dag' ? cap(format(cursor, 'EEEE d MMMM', { locale: dateLocale() }))
    : scope === 'week' ? `${format(week[0].date, 'd')} – ${format(week[6].date, 'd MMM', { locale: dateLocale() })}`
      : scope === 'maand' ? cap(monthLabel(cursor.getFullYear(), cursor.getMonth()))
        : String(cursor.getFullYear());

  // Horizontaal vegen → vorige/volgende periode (UX-29). De content schuift nu mét de
  // vinger mee en de nieuwe periode komt van de overkant binnen, zodat het echt als
  // bladeren voelt (UX, batch 2). activeOffsetX laat 'm pas bij een duidelijk-horizontale
  // beweging aanslaan; failOffsetY laat verticaal scrollen/pull-to-refresh ongemoeid.
  const { width: SCREEN_W } = useWindowDimensions();
  const reduce = prefersReducedMotion();
  const tx = useSharedValue(0);
  const listAnim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // Wissel de periode mét slide: huidige content schuift weg in de veegrichting, de
  // nieuwe schuift van de andere kant in. Bij "verminder beweging" springt 'ie direct.
  const slidePeriod = (delta) => {
    if (reduce) { stepPeriod(delta); return; }
    const out = delta > 0 ? -SCREEN_W : SCREEN_W;
    tx.value = withTiming(out, { duration: 150 }, (finished) => {
      if (!finished) return;
      runOnJS(stepPeriod)(delta);
      tx.value = -out;                              // nieuwe content klaarzetten aan de overkant
      tx.value = withTiming(0, { duration: 200 });  // …en in laten schuiven
    });
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onUpdate((e) => { 'worklet'; if (!reduce) tx.value = e.translationX; })
    .onEnd((e) => {
      'worklet';
      if (e.translationX <= -56) runOnJS(slidePeriod)(1);
      else if (e.translationX >= 56) runOnJS(slidePeriod)(-1);
      else tx.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

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
  for (const tagId of filters.tagIds) {
    const tag = tags.find((tg) => tg.id === tagId);
    activeChips.push({ key: `tag-${tagId}`, label: tag?.name ?? t('tasks.filter.tags'), onRemove: () => setFilters((f) => ({ ...f, tagIds: f.tagIds.filter((x) => x !== tagId) })) });
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
          Geldt nu voor élke scope — ook Jaar is een gewone, gefilterde lijst (UX-32). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8, gap: 8, alignItems: 'center' }}>
        {/* "Voor mij" — snelle toggle vooraan: alleen wat aan jou is toegewezen of met
            jou gedeeld. Afspraken van anderen die met je gedeeld zijn blijven zichtbaar;
            losse huishoud-taken vallen weg (UX, batch 2). */}
        <Chip icon="person" label={t('tasks.audience.mine')} active={filters.audience === 'mine'}
          onPress={() => setFilters((f) => ({ ...f, audience: f.audience === 'mine' ? 'all' : 'mine' }))} />
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

      {/* Periode-kop: ‹ [ label 📅 ] › — de hele tekstbox is nu het tikdoel en opent
          de kalenderkiezer (UX, batch 2 — niet alleen het icoontje). Geldt voor élke
          scope, óók Jaar (een jaar-kiezer). Pijlen + horizontaal vegen bladeren mét
          slide-animatie (UX-29). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
        paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('tasks.period.prev')} onPress={() => slidePeriod(-1)} />
        <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button"
          accessibilityLabel={periodLabel} accessibilityHint={t('tasks.picker.hint')}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5,
            borderColor: colors.line, backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          })}>
          <Text style={[type.title, { fontWeight: '700' }]} numberOfLines={1}>{periodLabel}</Text>
          <Icon name="agenda" size={16} color={colors.forest} />
        </Pressable>
        <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('tasks.period.next')} onPress={() => slidePeriod(1)} />
      </View>

      {error && !loading ? (
        <Banner tone="warning" icon="warning" title={t('home.error.title')} style={{ marginHorizontal: space.lg, marginBottom: space.sm }}>
          <Pressable onPress={reload} accessibilityRole="button" hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: space.xs })}>
            <Text style={[type.label, { color: colors.forest }]}>{t('common.retry')}</Text>
          </Pressable>
        </Banner>
      ) : null}

      {/* Eén lijst voor élke scope; horizontaal vegen → vorige/volgende periode (UX-29),
          met de content die mee-/in-schuift (listAnim). */}
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ flex: 1 }, listAnim]}>
        <SectionList
          contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 40, flexGrow: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          // Virtualisatie-afstelling, gelijk aan app/catalog.js (PERF-9).
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          onRefresh={reload}
          refreshing={loading}
          ListHeaderComponent={(() => {
            if (filters.status !== 'done') return null;
            const doneIds = sections.flatMap((s) => s.data.map((tk) => tk.id));
            return doneIds.length > 0 ? (
              <Button title={t('tasks.clearDone', { n: doneIds.length })} variant="ghost" icon="delete"
                fullWidth={false} onPress={() => onClearCompleted(doneIds)} style={{ alignSelf: 'flex-start', marginBottom: space.sm }} />
            ) : null;
          })()}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length}
              tint={section.key === 'overdue' ? colors.danger : colors.inkSoft} />
          )}
          renderItem={({ item }) => (
            <SwipeRow
              left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => removeTaskWithUndo(item) }}
              right={{ icon: 'agenda', label: t('tasks.snooze'), color: colors.forest, onTrigger: () => snoozeTaskWithUndo(item) }}
            >
              <TaskRow task={item} members={members} tags={tags} onToggle={toggle} />
            </SwipeRow>
          )}
          ListEmptyComponent={
            loading ? (
              <ListSkeleton count={5} />
            ) : filters.status === 'done' ? (
              <Empty illustration="tasks" title={t('tasks.empty.done.title')}
                subtitle={t('tasks.empty.done.subtitle')} />
            ) : (
              <Empty illustration="tasks" title={t('tasks.scope.empty.title')}
                subtitle={scope === 'week' ? t('tasks.scope.empty.week')
                  : scope === 'maand' ? t('tasks.scope.empty.month')
                    : scope === 'jaar' ? t('tasks.scope.empty.year')
                      : t('tasks.scope.empty.day')}
                actionTitle={t('task.add')} onAction={() => router.push('/task/new')} />
            )
          }
        />
        </Animated.View>
      </GestureDetector>

      <FAB label={t('fab.task')} accessibilityLabel={t('task.add')}
        onPress={() => router.push(scope === 'dag' ? `/task/new?date=${dateKey(cursor)}` : '/task/new')} />

      <ChoreLibrarySheet visible={libraryOpen} onClose={() => setLibraryOpen(false)} onAdd={addFromLibrary} />

      <PeriodPicker
        visible={pickerOpen} onClose={() => setPickerOpen(false)}
        scope={scope} value={cursor} tasks={filtered} onPick={setCursor}
      />

      <TaskFilterSheet
        visible={filterOpen} onClose={() => setFilterOpen(false)}
        filters={filters} setFilters={setFilters}
        members={members} subgroups={subgroups} tags={tags} tasks={tasks} filterArg={filterArg}
      />

      <Celebrate show={celebrate} message={t('tasks.allDoneToday')} onDone={() => setCelebrate(false)} />
    </SafeAreaView>
  );
}

// Bottom-sheet met gegroepeerde filterkeuzes (categorie/persoon/groep/status).
// Filters werken live; de sheet is enkel de editor. Categorie toont per-categorie
// tellers (countBy) op de huidige selectie minus de categorie-as.
function TaskFilterSheet({ visible, onClose, filters, setFilters, members, subgroups, tags = [], tasks, filterArg }) {
  const catCounts = useMemo(
    () => countBy(applyTaskFilters(tasks, { ...filterArg, categories: [] }), (tk) => tk.category),
    [tasks, filterArg],
  );
  const toggleCategory = (k) => setFilters((f) => ({
    ...f, categories: f.categories.includes(k) ? f.categories.filter((x) => x !== k) : [...f.categories, k],
  }));
  const toggleTag = (id) => setFilters((f) => ({
    ...f, tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id],
  }));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ModalHeader title={t('tasks.filter.title')} onClose={onClose} />
      <SheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        {/* Categorie (multi) */}
        <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.lg }}>
          {Object.entries(categoryMeta).map(([k, m]) => (
            <Chip key={k} icon={m.icon} color={m.color}
              label={catCounts[k] ? `${m.label} · ${catCounts[k]}` : m.label}
              active={filters.categories.includes(k)} onPress={() => toggleCategory(k)} />
          ))}
        </View>

        {/* Labels (multi) — alleen tonen als er tags zijn */}
        {tags.length > 0 ? (
          <>
            <Text style={[type.label, { marginBottom: space.sm }]}>{t('tasks.filter.tags')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.lg }}>
              {tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} color={tag.color}
                  active={filters.tagIds.includes(tag.id)} onPress={() => toggleTag(tag.id)} />
              ))}
            </View>
          </>
        ) : null}

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
      </SheetScrollView>
    </BottomSheet>
  );
}
