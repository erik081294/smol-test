import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { Empty, Chip, FAB, ScreenHeader, IconButton, ListSkeleton } from '../../lib/ui';
import { colors, categoryMeta } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { ChoreLibrarySheet } from '../../lib/ChoreLibrarySheet';
import { choreToTask } from '../../lib/choreLibrary';

export default function Taken() {
  const { tasks, loading, reload, addTask, completeTask, uncompleteTask } = useTasks();
  const { members } = useHousehold();
  const router = useRouter();
  const [cat, setCat] = useState('alle');
  const [showDone, setShowDone] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Eén tik in de bibliotheek → meteen een taak met passend ritme, vandaag startend.
  const addFromLibrary = (chore) => addTask(choreToTask(chore, { startDate: new Date() }));

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!showDone && t.completed_at) return false;
      if (showDone && !t.completed_at) return false;
      if (cat !== 'alle' && t.category !== cat) return false;
      return true;
    });
  }, [tasks, cat, showDone]);

  const toggle = (t) => {
    animateNextLayout(); // de taak glijdt zacht uit de lijst bij afvinken
    return t.completed_at ? uncompleteTask(t.id) : completeTask(t);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Taken" subtitle="Alles wat er te doen is in huis."
        right={<IconButton icon="library" accessibilityLabel="Klus-bibliotheek"
          tint={colors.forest} onPress={() => setLibraryOpen(true)} />} />

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label="Alle" active={cat === 'alle'} onPress={() => setCat('alle')} />
        {Object.entries(categoryMeta).map(([k, m]) => (
          <Chip key={k} icon={m.icon} label={m.label} active={cat === k}
            color={m.color} onPress={() => setCat(k)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 6, gap: 8 }}>
        <Chip label="Open" active={!showDone} onPress={() => setShowDone(false)} />
        <Chip label="Afgerond" active={showDone} color={colors.done} onPress={() => setShowDone(true)} />
      </View>

      <FlatList
        contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 40 }}
        data={filtered}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => <TaskRow task={item} members={members} onToggle={toggle} />}
        ListEmptyComponent={
          loading && tasks.length === 0 ? (
            <ListSkeleton count={6} />
          ) : !loading ? (
            <Empty illustration="tasks" title={showDone ? 'Nog niets afgerond' : 'Geen open taken'}
              subtitle={showDone ? 'Afgevinkte taken verschijnen hier.' : 'Voeg een taak toe met de + knop.'} />
          ) : null
        }
      />

      <FAB accessibilityLabel="Taak toevoegen" onPress={() => router.push('/task/new')} />

      <ChoreLibrarySheet
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={addFromLibrary}
      />
    </SafeAreaView>
  );
}
