import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { isToday } from 'date-fns';
import { TaskRow } from './TaskRow';
import { Empty, IconButton } from './ui';
import { colors, type, space, categoryMeta } from './theme';
import { monthMatrix, groupByDate, dominantCategory, sortDayTasks, monthLabel, parseKey } from './agenda';
import { t } from './i18n';

// Gedeeld maand-overzicht: maandnavigatie + weekdag-koppen + dag-grid + de
// daglijst van de gekozen dag. Geëxtraheerd uit de Agenda-tab (TKN-1) zodat zowel
// de Agenda-tab als de Maand-scope van Taken dezelfde grid gebruiken (DRY).
//
// `selectedKey`/`onSelectDay` zijn gecontroleerd door de parent (die kent zo de
// gekozen dag, bv. voor "voeg toe op deze dag"); de maand-cursor beheert dit
// component zelf, startend op de maand van de gekozen dag.
export function MonthView({
  tasks, members, onToggle, selectedKey, onSelectDay,
  emptyIllustration = 'agenda', emptyTitle, emptySubtitle,
}) {
  // Weekdag-koppen (ma-eerst), meebewegend met de taal.
  const WD = [1, 2, 3, 4, 5, 6, 0].map((d) => t(`weekday.min.${d}`));
  const base = selectedKey ? parseKey(selectedKey) : new Date();
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const grouped = useMemo(() => groupByDate(tasks), [tasks]);
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const dayItems = useMemo(() => sortDayTasks(grouped[selectedKey]), [grouped, selectedKey]);

  const stepMonth = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Maandnavigatie */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('agenda.prevMonth')} onPress={() => stepMonth(-1)} />
        <Text style={[type.title, { textTransform: 'capitalize' }]}>{monthLabel(cursor.y, cursor.m)}</Text>
        <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('agenda.nextMonth')} onPress={() => stepMonth(1)} />
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
              const isSel = cell.key === selectedKey;
              const isTod = isToday(cell.date);
              return (
                <Pressable key={cell.key} onPress={() => onSelectDay(cell.key)}
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

      {/* Daglijst van de gekozen dag */}
      <FlatList
        style={{ marginTop: 6 }}
        contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 40 }}
        data={dayItems}
        keyExtractor={(tk) => tk.id}
        renderItem={({ item }) => <TaskRow task={item} members={members} onToggle={onToggle} />}
        ListEmptyComponent={(
          <Empty illustration={emptyIllustration}
            title={emptyTitle ?? t('agenda.empty.title')}
            subtitle={emptySubtitle ?? t('agenda.empty.subtitle')} />
        )}
      />
    </View>
  );
}
