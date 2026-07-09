/* eslint-disable react-hooks/immutability -- Reanimated-worklets muteren SharedValue.value bewust. */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { format, isToday, isSameMonth, isSameYear } from 'date-fns';
import { BottomSheet, ModalHeader, IconButton } from './ui';
import { colors, type, space, radius, categoryMeta, font } from './theme';
import { prefersReducedMotion } from './motion';
import {
  monthMatrix, monthLabel, yearMonths, groupByDate, dominantCategory, dateKey,
} from './agenda';
import { dateLocale, t } from './i18n';

// PeriodPicker — een kalenderkiezer die pas verschijnt als je op het periode-label
// tikt (UX-30). Het schaalniveau volgt de actieve scope:
//   • dag/week → een maandgrid; tik een dag (week-scope kiest díe week);
//   • maand    → een raster van 12 maanden, met jaar-navigatie;
//   • jaar     → een raster van 12 jaren, met decennium-navigatie (UX, batch 2).
//
// `markedKeys` (optioneel) is een verzameling 'yyyy-MM-dd'-sleutels met taken,
// zodat de kiezer per dag een stip kan tonen — net als de oude maandkalender.
export function PeriodPicker({ visible, onClose, scope, value, onPick, tasks = [] }) {
  const isMonthScope = scope === 'maand';
  const isYearScope = scope === 'jaar';

  // Interne navigatie-cursor (los van de gekozen waarde): start op de maand/het
  // jaar van de huidige waarde, telkens als de sheet opent.
  const [cursor, setCursor] = useState(() => ({ y: value.getFullYear(), m: value.getMonth() }));
  useEffect(() => {
    if (visible) setCursor({ y: value.getFullYear(), m: value.getMonth() });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => groupByDate(tasks), [tasks]);
  const weeks = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const months = useMemo(() => yearMonths(cursor.y), [cursor.y]);
  // Jaar-pagina: 12 jaren met het ankerjaar ongeveer gecentreerd.
  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => cursor.y - 5 + i), [cursor.y]);

  const WD = [1, 2, 3, 4, 5, 6, 0].map((d) => t(`weekday.min.${d}`));

  const pick = (date) => { onPick(date); onClose(); };
  const stepMonth = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const stepYear = (delta) => setCursor((c) => ({ ...c, y: c.y + delta }));
  const stepYearPage = (delta) => setCursor((c) => ({ ...c, y: c.y + delta * 12 }));

  const title = isMonthScope ? t('tasks.picker.month')
    : isYearScope ? t('tasks.picker.year') : t('tasks.picker.day');

  // Horizontaal vegen door de kalender (UX, batch 2): dag/week-grid → maand-naar-maand,
  // maand-grid → jaar-naar-jaar, jaar-grid → pagina van 12 jaar. De content schuift mee
  // en de nieuwe komt van de overkant binnen — net als de periode-swipe op Taken. De
  // ‹ › knoppen blijven als betrouwbare bediening. activeOffsetX laat 'm pas bij een
  // horizontale beweging aanslaan, failOffsetY laat de swipe-omlaag-sluiten ongemoeid.
  const { width } = useWindowDimensions();
  const reduce = prefersReducedMotion();
  const cx = useSharedValue(0);
  const calAnim = useAnimatedStyle(() => ({ transform: [{ translateX: cx.value }] }));
  const stepScope = (delta) => {
    if (isYearScope) stepYearPage(delta);
    else if (isMonthScope) stepYear(delta);
    else stepMonth(delta);
  };
  const slideScope = (delta) => {
    if (reduce) { stepScope(delta); return; }
    const out = delta > 0 ? -width : width;
    cx.value = withTiming(out, { duration: 130 }, (fin) => {
      if (!fin) return;
      runOnJS(stepScope)(delta);
      cx.value = -out;
      cx.value = withTiming(0, { duration: 180 });
    });
  };
  const calPan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-24, 24])
    .onUpdate((e) => { 'worklet'; if (!reduce) cx.value = e.translationX; })
    .onEnd((e) => {
      'worklet';
      if (e.translationX <= -50) runOnJS(slideScope)(1);
      else if (e.translationX >= 50) runOnJS(slideScope)(-1);
      else cx.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ModalHeader title={title} onClose={onClose} />
      <GestureDetector gesture={calPan}>
      <Animated.View style={calAnim}>

      {isYearScope ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          {/* Decennium-navigatie (12 jaar per pagina) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
            <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('tasks.year.prev')} onPress={() => stepYearPage(-1)} />
            <Text style={type.h2}>{years[0]} – {years[years.length - 1]}</Text>
            <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('tasks.year.next')} onPress={() => stepYearPage(1)} />
          </View>
          {/* 12 jaren, 3 per rij */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {years.map((yr) => {
              const sel = yr === value.getFullYear();
              const tod = yr === new Date().getFullYear();
              return (
                <Pressable key={yr} onPress={() => pick(new Date(yr, 0, 1))}
                  accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={String(yr)}
                  style={({ pressed }) => ({
                    flexGrow: 1, flexBasis: '30%', minHeight: 52, borderRadius: radius.md,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: sel ? colors.forest : (pressed ? colors.surfaceAlt : colors.surface),
                    borderWidth: 1.5, borderColor: sel ? colors.forest : (tod ? colors.ocher : colors.line),
                  })}>
                  <Text style={{ fontFamily: font.semi, fontSize: 15, color: sel ? colors.onDark : colors.ink }}>{yr}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : isMonthScope ? (
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
                  <Text style={{ textTransform: 'capitalize', fontFamily: font.semi, fontSize: 15,
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
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.inkFaint, fontFamily: font.semi }}>{d}</Text>
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
                        fontSize: 14, fontFamily: tod || sel ? font.semi : font.medium,
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
      </Animated.View>
      </GestureDetector>
    </BottomSheet>
  );
}
