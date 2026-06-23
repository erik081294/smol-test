import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format, isToday, isSameMonth, isSameYear } from 'date-fns';
import { BottomSheet, ModalHeader, IconButton } from './ui';
import { colors, type, space, radius, categoryMeta } from './theme';
import {
  monthMatrix, monthLabel, yearMonths, groupByDate, dominantCategory, dateKey,
} from './agenda';
import { dateLocale, t } from './i18n';

// PeriodPicker — een kalenderkiezer die pas verschijnt als je op het periode-label
// tikt (UX-30). Het schaalniveau volgt de actieve scope:
//   • dag/week → een maandgrid; tik een dag (week-scope kiest díe week);
//   • maand    → een raster van 12 maanden, met jaar-navigatie.
// Jaar-scope heeft géén kiezer (de pijlen/veeg volstaan) — dan tonen we 'm niet.
//
// `markedKeys` (optioneel) is een verzameling 'yyyy-MM-dd'-sleutels met taken,
// zodat de kiezer per dag een stip kan tonen — net als de oude maandkalender.
export function PeriodPicker({ visible, onClose, scope, value, onPick, tasks = [] }) {
  const isMonthScope = scope === 'maand';

  // Interne navigatie-cursor (los van de gekozen waarde): start op de maand/het
  // jaar van de huidige waarde, telkens als de sheet opent.
  const [cursor, setCursor] = useState(() => ({ y: value.getFullYear(), m: value.getMonth() }));
  useEffect(() => {
    if (visible) setCursor({ y: value.getFullYear(), m: value.getMonth() });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => groupByDate(tasks), [tasks]);
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const months = useMemo(() => yearMonths(cursor.y), [cursor.y]);

  const WD = [1, 2, 3, 4, 5, 6, 0].map((d) => t(`weekday.min.${d}`));

  const pick = (date) => { onPick(date); onClose(); };
  const stepMonth = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const stepYear = (delta) => setCursor((c) => ({ ...c, y: c.y + delta }));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ModalHeader title={isMonthScope ? t('tasks.picker.month') : t('tasks.picker.day')} onClose={onClose} />

      {isMonthScope ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          {/* Jaar-navigatie */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
            <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('tasks.year.prev')} onPress={() => stepYear(-1)} />
            <Text style={type.h2}>{cursor.y}</Text>
            <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('tasks.year.next')} onPress={() => stepYear(1)} />
          </View>
          {/* 12 maanden, 3 per rij */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {months.map((mo) => {
              const sel = isMonthScope && isSameMonth(mo.date, value) && isSameYear(mo.date, value);
              const tod = isSameMonth(mo.date, new Date()) && isSameYear(mo.date, new Date());
              const short = format(mo.date, 'LLL', { locale: dateLocale() });
              return (
                <Pressable key={mo.key} onPress={() => pick(mo.date)}
                  accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={mo.label}
                  style={({ pressed }) => ({
                    flexGrow: 1, flexBasis: '30%', minHeight: 52, borderRadius: radius.md,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: sel ? colors.forest : (pressed ? colors.surfaceAlt : colors.surface),
                    borderWidth: 1.5, borderColor: sel ? colors.forest : (tod ? colors.ocher : colors.line),
                  })}>
                  <Text style={{ textTransform: 'capitalize', fontWeight: '700', fontSize: 15,
                    color: sel ? colors.onDark : colors.ink }}>{short}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.lg }}>
          {/* Maand-navigatie */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
            <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('agenda.prevMonth')} onPress={() => stepMonth(-1)} />
            <Text style={[type.title, { textTransform: 'capitalize' }]}>{monthLabel(cursor.y, cursor.m)}</Text>
            <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('agenda.nextMonth')} onPress={() => stepMonth(1)} />
          </View>
          {/* Weekdag-koppen */}
          <View style={{ flexDirection: 'row' }}>
            {WD.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.inkFaint, fontWeight: '600' }}>{d}</Text>
            ))}
          </View>
          {/* Daggrid */}
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((cell) => {
                const dayTasks = grouped[cell.key];
                const dotColor = (categoryMeta[dominantCategory(dayTasks)] ?? categoryMeta.overig)?.color;
                const sel = cell.key === dateKey(value);
                const tod = isToday(cell.date);
                return (
                  <Pressable key={cell.key} onPress={() => pick(cell.date)}
                    accessibilityRole="button" accessibilityState={{ selected: sel }}
                    style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: sel ? colors.forest : tod ? colors.ocherSoft : 'transparent',
                    }}>
                      <Text style={{
                        fontSize: 14, fontWeight: tod || sel ? '700' : '500',
                        color: sel ? colors.onDark : cell.inMonth ? colors.ink : colors.inkFaint,
                      }}>{cell.date.getDate()}</Text>
                    </View>
                    <View style={{ height: 6, marginTop: 1 }}>
                      {dayTasks?.length ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
