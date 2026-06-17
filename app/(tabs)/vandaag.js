import React, { useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { TaskRow } from '../../lib/TaskRow';
import { Empty } from '../../lib/ui';
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
              {greeting}, {profile?.display_name?.split(' ')[0] ?? ''} 👋
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
            <Text style={{ ...type.label, color: section.tint, marginBottom: 10, marginTop: 6 }}>
              {section.title} · {section.data.length}
            </Text>
            {section.data.map((t) => (
              <TaskRow key={t.id} task={t} members={members} onToggle={toggle} />
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading && (
            <Empty emoji="🌤️" title="Een rustige dag"
              subtitle="Geen taken voor vandaag. Voeg er een toe via het tabblad Taken." />
          )
        }
      />

      {/* Snelle toevoeg-knop */}
      <TouchableOpacity
        onPress={() => router.push('/task/new')}
        style={{
          position: 'absolute', right: 20, bottom: 24,
          width: 58, height: 58, borderRadius: 29,
          backgroundColor: colors.ocher, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }}>
        <Text style={{ fontSize: 30, color: colors.forest, fontWeight: '300', marginTop: -2 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
