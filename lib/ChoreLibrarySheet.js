import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { t, dateLocale } from './i18n';
import { colors, radius, type, space, touchTarget } from './theme';
import { Icon } from './icons';
import { BottomSheet, SheetScrollView } from './ui';
import { recurrenceLabel } from './recurrence';
import { seasonalChores, groupedChores } from './choreLibrary';

// Klus-bibliotheek (KLU-2) + seizoenssuggesties (KLU-3) als bottom-sheet. Eén tik
// op een klus voegt 'm toe via onAdd; de sheet blijft open zodat je er meerdere
// achter elkaar kiest. Toegevoegde klussen krijgen een vinkje en zijn niet
// nogmaals tikbaar (voorkomt dubbelen in één sessie).
//
// onAdd(chore) → Promise. De parent maakt de taak (choreToTask + addTask).
export function ChoreLibrarySheet({ visible, onClose, onAdd }) {
  const [added, setAdded] = useState({});   // key -> true
  const [busyKey, setBusyKey] = useState(null);

  const month = new Date().getMonth() + 1; // 1..12
  const seasonal = useMemo(() => seasonalChores(month), [month]);
  const groups = useMemo(() => groupedChores(), []);
  const monthName = format(new Date(), 'MMMM', { locale: dateLocale() });

  const handleAdd = async (chore) => {
    if (added[chore.key] || busyKey) return;
    setBusyKey(chore.key);
    try {
      await onAdd(chore);
      setAdded((a) => ({ ...a, [chore.key]: true }));
    } finally {
      setBusyKey(null);
    }
  };

  // Sluiten reset de "toegevoegd"-markeringen, zodat een volgende keer schoon begint.
  const close = () => { setAdded({}); onClose(); };

  return (
    <BottomSheet visible={visible} onClose={close} maxHeight="85%">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs, paddingHorizontal: space.lg }}>
        <Text style={type.h2}>Klus-bibliotheek</Text>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Icon name="close" size={24} color={colors.inkSoft} />
        </Pressable>
      </View>
      <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.md, paddingHorizontal: space.lg }]}>
        Tik om een veelvoorkomende klus toe te voegen — met een passend ritme.
      </Text>

      <SheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
        {seasonal.length > 0 && (
          <Section
            title={`Past bij ${monthName}`}
            icon="season"
            chores={seasonal}
            added={added}
            busyKey={busyKey}
            onAdd={handleAdd}
          />
        )}
        {groups.map((g) => (
          <Section
            key={g.group}
            title={g.group}
            chores={g.chores}
            added={added}
            busyKey={busyKey}
            onAdd={handleAdd}
          />
        ))}
        <View style={{ height: space.md }} />
      </SheetScrollView>
    </BottomSheet>
  );
}

function Section({ title, icon, chores, added, busyKey, onAdd }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm, marginTop: space.xs }}>
        {icon ? <Icon name={icon} size={15} color={colors.inkSoft} /> : null}
        <Text style={type.label}>{title}</Text>
      </View>
      {chores.map((chore) => {
        const isAdded = !!added[chore.key];
        const isBusy = busyKey === chore.key;
        return (
          <Pressable
            key={chore.key}
            onPress={() => onAdd(chore)}
            disabled={isAdded || !!busyKey}
            accessibilityRole="button"
            accessibilityLabel={`${chore.title} toevoegen`}
            accessibilityState={{ disabled: isAdded, busy: isBusy }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space.md,
              minHeight: touchTarget, paddingHorizontal: space.md, paddingVertical: space.sm,
              marginBottom: space.sm, borderRadius: radius.md,
              backgroundColor: pressed && !isAdded ? colors.surfaceAlt : colors.surface,
              borderWidth: 1, borderColor: isAdded ? colors.done : colors.line,
              opacity: isAdded ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 22 }}>{chore.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { fontSize: 16 }]} numberOfLines={1}>{chore.title}</Text>
              <Text style={type.caption} numberOfLines={1}>{recurrenceLabel(chore)}</Text>
            </View>
            {isAdded
              ? <Icon name="check" size={22} color={colors.done} weight="bold" />
              : <Icon name="add" size={22} color={colors.forest} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}
