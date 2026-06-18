import React, { useMemo } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { TaskRow } from '../../lib/TaskRow';
import { Empty, FAB, SectionHeader } from '../../lib/ui';
import { isOverdue } from '../../lib/recurrence';
import { colors, type } from '../../lib/theme';

export default function Vandaag() {
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { active, members } = useHousehold();
  const { profile } = useAuth();
  const router = useRouter();

  const { overdue, today, done } = useMemo(() => {
    const open = tasks.filter((t) => !t.completed_at);
    return {
      overdue: open.filter(isOverdue),
      today: open.filter((t) => t.due_date && isToday(parseISO(t.due_date)) && !isOverdue(t)),
      done: tasks.filter((t) => t.completed_at && t.due_date && isToday(parseISO(t.completed_at))),
    };
  }, [tasks]);

  const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Goedenacht';
    if (h < 12) return 'Goedemorgen';
    if (h < 18) return 'Goedemiddag';
    return 'Goedenavond';
  })();

  const sections = [
    ...(overdue.length ? [{ key: 'over', title: 'Achterstallig', tint: colors.danger, data: overdue }] : []),
    { key: 'today', title: 'Voor vandaag', tint: colors.forest, data: today },
    ...(done.length ? [{ key: 'done', title: 'Afgerond vandaag', tint: colors.done, data: done }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <Text style={[type.caption, { textTransform: 'uppercase', letterSpacing: 1 }]}>
              {active?.emoji} {active?.name}
            </Text>
            <Text style={[type.h1, { marginTop: 2 }]}>
              {greeting}, {profile?.display_name?.split(' ')[0] ?? ''}
            </Text>
            <Text style={[type.body, { color: colors.inkSoft, marginTop: 4 }]}>
              {today.length + overdue.length === 0
                ? 'Niets meer te doen vandaag. Lekker bezig!'
                : `${today.length + overdue.length} ${today.length + overdue.length === 1 ? 'taak' : 'taken'} te gaan.`}
            </Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View style={{ marginBottom: 8 }}>
            <SectionHeader title={section.title} count={section.data.length} tint={section.tint} />
            {section.data.map((t) => (
              <TaskRow key={t.id} task={t} members={members} onToggle={toggle} />
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading && (
            <Empty illustration="today" title="Een rustige dag"
              subtitle="Geen taken voor vandaag. Voeg er een toe via het tabblad Taken." />
          )
        }
      />

      {/* Snelle toevoeg-knop */}
      <FAB accessibilityLabel="Taak toevoegen" onPress={() => router.push('/task/new')} />
    </SafeAreaView>
  );
}
