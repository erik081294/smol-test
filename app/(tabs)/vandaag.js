import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { TaskRow } from '../../lib/TaskRow';
import { FAB, SectionHeader, ItemRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { deriveDefaultLayout, packGrid } from '../../lib/widgets/grid';
import { WIDGET_BY_KEY, DEFAULTS_BY_MODULE } from '../../lib/widgets/registry';
import { useHomeLayout } from '../../lib/useHomeLayout';
import { isOverdue } from '../../lib/recurrence';
import { colors, type, space } from '../../lib/theme';
import { t, plural } from '../../lib/i18n';

const SCREEN_PAD = 18;
const GRID_GAP = space.md;

// Hoeveel focus-taken we bovenaan tonen voordat we doorverwijzen naar Taken.
// Houdt het startscherm rustig: de focus is een overzicht, niet de volledige lijst.
const FOCUS_CAP = 6;

// Home-dashboard ("Thuis"). Twee taken: (1) focus — de achterstallige en
// vandaag-taken bovenaan, afvinkbaar; (2) launchpad — per ingeschakelde module
// een samenvattingskaart die naar die module-omgeving navigeert. Zo is alles wat
// telt direct zichtbaar en elke module één tik weg.
export default function Home() {
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { active, members, modules } = useHousehold();
  const { profile } = useAuth();
  const router = useRouter();

  const { overdue, today } = useMemo(() => {
    const open = tasks.filter((tk) => !tk.completed_at);
    return {
      overdue: open.filter(isOverdue),
      today: open.filter((tk) => tk.due_date && isToday(parseISO(tk.due_date)) && !isOverdue(tk)),
    };
  }, [tasks]);

  const focus = useMemo(() => [...overdue, ...today], [overdue, today]);
  const visibleFocus = focus.slice(0, FOCUS_CAP);
  const extraFocus = focus.length - visibleFocus.length;

  const toggle = (tk) => (tk.completed_at ? uncompleteTask(tk.id) : completeTask(tk));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return t('greeting.night');
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  })();

  // Widget-grid (VDG-1/2): de default-layout volgt de ingeschakelde modules; elke
  // module levert zijn default-widget. packGrid berekent de cel-posities; we renderen
  // 2-koloms met exacte celbreedtes (geen percentage-afronding). De stijl/layout
  // wordt bewerkbaar in Fase C/D; hier de speelse default.
  const { width } = useWindowDimensions();
  const contentW = width - SCREEN_PAD * 2;
  const colW = (contentW - GRID_GAP) / 2;
  const widgetStyle = 'playful';

  const moduleKeys = useMemo(() => modules.map((m) => m.key), [modules]);
  const defaultLayout = useMemo(() => deriveDefaultLayout(moduleKeys, DEFAULTS_BY_MODULE), [moduleKeys]);
  // Bewaarde layout (gesynct per gebruiker/huishouden) met val-terug op de default.
  const { layout } = useHomeLayout(defaultLayout);
  const cells = useMemo(() => packGrid(layout, { cols: 2 }), [layout]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
      >
        {/* Kop: huishouden + persoonlijke groet + stand van zaken vandaag */}
        <View style={{ marginBottom: space.lg }}>
          <Text style={[type.caption, { textTransform: 'uppercase', letterSpacing: 1 }]}>
            {active?.emoji} {active?.name}
          </Text>
          <Text style={[type.h1, { marginTop: 2 }]}>
            {greeting}, {profile?.display_name?.split(' ')[0] ?? ''}
          </Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: 4 }]}>
            {focus.length === 0
              ? t('today.allDone')
              : plural(focus.length, 'today.remaining.one', 'today.remaining.other')}
          </Text>
        </View>

        {/* Focus: achterstallig + vandaag, afvinkbaar. Leeg → overslaan (de kop
            zegt al dat er niets te doen is), zodat het dashboard rustig blijft. */}
        {focus.length > 0 && (
          <View style={{ marginBottom: space.lg }}>
            <SectionHeader
              title={t('home.focus.title')}
              count={focus.length}
              tint={overdue.length ? colors.danger : colors.forest}
            />
            {visibleFocus.map((tk) => (
              <TaskRow key={tk.id} task={tk} members={members} onToggle={toggle} />
            ))}
            {extraFocus > 0 && (
              <Pressable
                onPress={() => router.push('/(tabs)/taken')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: space.xs, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[type.label, { color: colors.forest }]}>
                  {t('home.focus.more', { n: extraFocus })}
                </Text>
                <Icon name="chevron" size={16} color={colors.forest} />
              </Pressable>
            )}
          </View>
        )}

        {/* Widget-grid: per ingeschakelde module een widget, modulair en kleurrijk.
            Elke widget toont altijd een stand (ook "alles oké"). */}
        {cells.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: space.lg }}>
            {cells.map((cell) => {
              const descriptor = WIDGET_BY_KEY[cell.key];
              if (!descriptor) return null;
              const Widget = descriptor.Render;
              return (
                <View key={cell.key} style={{ width: cell.w === 2 ? contentW : colW }}>
                  <Widget size={cell.size} style={widgetStyle} tasks={tasks} members={members} />
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Eén rustige ingang naar alle onderdelen i.p.v. een tweede launchpad. */}
        <ItemRow
          leading={<Icon name="more" size={24} color={colors.forest} />}
          title={t('home.allModules')}
          chevron
          onPress={() => router.push('/(tabs)/meer')}
        />
      </ScrollView>

      {/* Snel een taak toevoegen — de kernactie van het huishouden. */}
      <FAB label={t('fab.task')} accessibilityLabel={t('task.add')} onPress={() => router.push('/task/new')} />
    </SafeAreaView>
  );
}
