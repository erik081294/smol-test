import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { TaskRow } from '../../lib/TaskRow';
import { FAB, SectionHeader } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { HOME_CARDS } from '../../lib/home/cards';
import { isOverdue } from '../../lib/recurrence';
import { colors, type, space } from '../../lib/theme';
import { t, plural } from '../../lib/i18n';

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

  // De ingeschakelde modules die een Home-kaart hebben (Vandaag = dit scherm,
  // Taken zit al in de focus, dus die staan niet in HOME_CARDS).
  const cards = modules.filter((m) => HOME_CARDS[m.key]);

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

        {/* Launchpad: één kaart per ingeschakelde module. */}
        <SectionHeader title={t('home.modules.title')} />
        {cards.map((m) => {
          const Card = HOME_CARDS[m.key];
          return <Card key={m.key} tasks={tasks} members={members} />;
        })}
      </ScrollView>

      {/* Snel een taak toevoegen — de kernactie van het huishouden. */}
      <FAB accessibilityLabel={t('task.add')} onPress={() => router.push('/task/new')} />
    </SafeAreaView>
  );
}
