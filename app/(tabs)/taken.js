import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { Empty, Chip } from '../../lib/ui';
import { colors, type, categoryMeta } from '../../lib/theme';

export default function Taken() {
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { members } = useHousehold();
  const router = useRouter();
  const [cat, setCat] = useState('alle');
  const [showDone, setShowDone] = useState(false);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!showDone && t.completed_at) return false;
      if (showDone && !t.completed_at) return false;
      if (cat !== 'alle' && t.category !== cat) return false;
      return true;
    });
  }, [tasks, cat, showDone]);

  const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ padding: 18, paddingBottom: 6 }}>
        <Text style={[type.h1]}>Taken</Text>
        <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>
          Alles wat er te doen is in huis.
        </Text>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label="Alle" active={cat === 'alle'} onPress={() => setCat('alle')} />
        {Object.entries(categoryMeta).map(([k, m]) => (
          <Chip key={k} label={`${m.emoji} ${m.label}`} active={cat === k}
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
          !loading && (
            <Empty emoji="📋" title={showDone ? 'Nog niets afgerond' : 'Geen open taken'}
              subtitle={showDone ? 'Afgevinkte taken verschijnen hier.' : 'Voeg een taak toe met de + knop.'} />
          )
        }
      />

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
