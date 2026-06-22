import React, { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { Chip, FAB, ScreenHeader } from '../../lib/ui';
import { MonthView } from '../../lib/MonthView';
import { colors } from '../../lib/theme';
import { filterBySubgroup, dateKey } from '../../lib/agenda';
import { t } from '../../lib/i18n';

export default function Agenda() {
  const { tasks, completeTask, uncompleteTask } = useTasks();
  const { members, subgroups } = useHousehold();
  const router = useRouter();

  const [selected, setSelected] = useState(dateKey(new Date()));
  const [subgroupId, setSubgroupId] = useState(null); // null = Iedereen

  const visible = useMemo(() => filterBySubgroup(tasks, subgroupId), [tasks, subgroupId]);
  const toggle = (tk) => (tk.completed_at ? uncompleteTask(tk.id) : completeTask(tk));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('agenda.title')} subtitle={t('agenda.subtitle')} />

      {/* Subgroep-filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label={t('common.everyone')} active={!subgroupId} onPress={() => setSubgroupId(null)} />
        {subgroups.map((g) => (
          <Chip key={g.id} label={`${g.emoji} ${g.name}`} active={subgroupId === g.id}
            onPress={() => setSubgroupId(g.id)} />
        ))}
      </ScrollView>

      {/* Gedeeld maand-overzicht (grid + daglijst) */}
      <MonthView tasks={visible} members={members} onToggle={toggle}
        selectedKey={selected} onSelectDay={setSelected} />

      <FAB label={t('fab.appointment')} accessibilityLabel={t('agenda.addOnDay')}
        onPress={() => router.push(`/task/new?date=${selected}`)} />
    </SafeAreaView>
  );
}
