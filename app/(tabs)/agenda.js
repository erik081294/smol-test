import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isToday } from 'date-fns';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { TaskRow } from '../../lib/TaskRow';
import { Empty, Chip, FAB, ScreenHeader, IconButton } from '../../lib/ui';
import { colors, type, space, categoryMeta } from '../../lib/theme';
import {
  monthMatrix, groupByDate, filterBySubgroup, dominantCategory,
  sortDayTasks, monthLabel, dateKey, parseKey,
} from '../../lib/agenda';

const WD = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

export default function Agenda() {
  const { tasks, loading, completeTask, uncompleteTask } = useTasks();
  const { members, subgroups } = useHousehold();
  const router = useRouter();

  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(dateKey(today));
  const [subgroupId, setSubgroupId] = useState(null); // null = Iedereen

  const visible = useMemo(() => filterBySubgroup(tasks, subgroupId), [tasks, subgroupId]);
  const grouped = useMemo(() => groupByDate(visible), [visible]);
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const dayItems = useMemo(() => sortDayTasks(grouped[selected]), [grouped, selected]);

  const stepMonth = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));
  const selectedDate = parseKey(selected);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Agenda" subtitle="Je taken op de kalender — per groep te filteren." />

      {/* Subgroep-filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label="Iedereen" active={!subgroupId} onPress={() => setSubgroupId(null)} />
        {subgroups.map((g) => (
          <Chip key={g.id} label={`${g.emoji} ${g.name}`} active={subgroupId === g.id}
            onPress={() => setSubgroupId(g.id)} />
        ))}
      </ScrollView>

      {/* Maandnavigatie */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <IconButton icon="back" tint={colors.forest} accessibilityLabel="Vorige maand" onPress={() => stepMonth(-1)} />
        <Text style={[type.title, { textTransform: 'capitalize' }]}>{monthLabel(cursor.y, cursor.m)}</Text>
        <IconButton icon="forward" tint={colors.forest} accessibilityLabel="Volgende maand" onPress={() => stepMonth(1)} />
      </View>

      {/* Weekdag-koppen */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
        {WD.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.inkFaint, fontWeight: '600' }}>
            {d}
          </Text>
        ))}
      </View>

      {/* Maandgrid */}
      <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((cell) => {
              const dayTasks = grouped[cell.key];
              const cat = dominantCategory(dayTasks);
              const dotColor = (categoryMeta[cat] ?? categoryMeta.overig)?.color;
              const isSel = cell.key === selected;
              const isTod = isToday(cell.date);
              return (
                <Pressable key={cell.key} onPress={() => setSelected(cell.key)}
                  accessibilityRole="button" accessibilityState={{ selected: isSel }}
                  style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    width: 34, height: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSel ? colors.forest : isTod ? colors.ocherSoft : 'transparent',
                  }}>
                    <Text style={{
                      fontSize: 14,
                      color: isSel ? colors.onDark : cell.inMonth ? colors.ink : colors.inkFaint,
                      fontWeight: isTod || isSel ? '700' : '500',
                    }}>{cell.date.getDate()}</Text>
                  </View>
                  <View style={{ height: 6, marginTop: 1 }}>
                    {dayTasks?.length ? (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Dag-agenda */}
      <FlatList
        style={{ marginTop: 6 }}
        contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 40 }}
        data={dayItems}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TaskRow task={item} members={members} onToggle={toggle} />}
        ListEmptyComponent={!loading && (
          <Empty illustration="agenda" title="Niets op deze dag"
            subtitle="Tik op + om iets toe te voegen." />
        )}
      />

      <FAB accessibilityLabel="Toevoegen op deze dag" onPress={() => router.push(`/task/new?date=${selected}`)} />
    </SafeAreaView>
  );
}
