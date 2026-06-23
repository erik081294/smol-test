import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useDialog } from '../../lib/dialog';
import { TaskRow } from '../../lib/TaskRow';
import { HomeHero } from '../../lib/HomeHero';
import { dayProgress } from '../../lib/widgets/summaries';
import { FAB, SectionHeader, ItemRow, SegmentedControl, Button, Row } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import {
  deriveDefaultLayout, moveWidget, removeWidget, resizeWidget, addWidget,
} from '../../lib/widgets/grid';
import { WIDGET_BY_KEY, DEFAULTS_BY_MODULE, WIDGETS } from '../../lib/widgets/registry';
import { WidgetGrid } from '../../lib/widgets/WidgetGrid';
import { useHomeLayout } from '../../lib/useHomeLayout';
import { isOverdue } from '../../lib/recurrence';
import { animateNextLayout } from '../../lib/motion';
import { colors, type, space, radius } from '../../lib/theme';
import { t } from '../../lib/i18n';

const SCREEN_PAD = 18;
const GRID_GAP = space.md;
const TILE_H = 132;       // uniforme tegelhoogte (1×1 en 2×1 even hoog → strakke grid)
const CONTROL_H = 48;     // bewerk-controlebalk onder de tegel
const FOCUS_CAP = 6;
const STYLE_KEY = 'huishoek.widgetStyle';

// Kleine bewerk-knop in de tegel-controlebalk (kleiner dan IconButton zodat er vier
// naast elkaar passen in een halve-breedte tegel; hitSlop houdt het ≥48dp-toegankelijk).
function EditBtn({ icon, label, tint = colors.ink, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: radius.sm,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}>
      <Icon name={icon} size={18} color={tint} />
    </Pressable>
  );
}

// Home-dashboard ("Thuis"): (1) focus — achterstallige/vandaag-taken bovenaan,
// afvinkbaar; (2) een modulaire, kleurrijke widget-grid die je zelf samenstelt
// (toevoegen/herschikken/grootte/stijl), gesynct per gebruiker/huishouden.
export default function Home() {
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { active, members, modules } = useHousehold();
  const { profile } = useAuth();
  const dialog = useDialog();
  const router = useRouter();

  const { overdue, today } = useMemo(() => {
    const open = tasks.filter((tk) => !tk.completed_at);
    return {
      overdue: open.filter(isOverdue),
      today: open.filter((tk) => tk.due_date && isToday(parseISO(tk.due_date)) && !isOverdue(tk)),
    };
  }, [tasks]);

  const focus = useMemo(() => [...overdue, ...today], [overdue, today]);
  const visibleFocus = focus.slice(0, FOCUS_CAP);
  const extraFocus = focus.length - visibleFocus.length;
  const progress = useMemo(() => dayProgress(tasks), [tasks]);

  const toggle = (tk) => (tk.completed_at ? uncompleteTask(tk.id) : completeTask(tk));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return t('greeting.night');
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  })();

  // Widget-grid. Default-layout volgt de ingeschakelde modules; de bewaarde (gesyncte)
  // layout heeft voorrang. packGrid berekent exacte celbreedtes (2 koloms).
  const { width } = useWindowDimensions();
  const contentW = width - SCREEN_PAD * 2;
  const colW = (contentW - GRID_GAP) / 2;

  const moduleKeys = useMemo(() => modules.map((m) => m.key), [modules]);
  const defaultLayout = useMemo(() => deriveDefaultLayout(moduleKeys, DEFAULTS_BY_MODULE), [moduleKeys]);
  const { layout, save } = useHomeLayout(defaultLayout);

  // Bewerkmodus + stijl (VDG-3/5). Stijl is een lichte lokale pref (AsyncStorage).
  const [editing, setEditing] = useState(false);
  const [widgetStyle, setWidgetStyle] = useState('playful');
  useEffect(() => {
    let on = true;
    AsyncStorage.getItem(STYLE_KEY).then((v) => { if (on && (v === 'playful' || v === 'neutral')) setWidgetStyle(v); });
    return () => { on = false; };
  }, []);
  const changeStyle = (s) => { setWidgetStyle(s); AsyncStorage.setItem(STYLE_KEY, s).catch(() => {}); };

  // Layout-mutaties (puur + gesynct). animateNextLayout is no-op bij reduced motion.
  const applyLayout = (next) => { animateNextLayout(); save(next); };
  const onMove = (key, delta) => {
    const i = layout.findIndex((p) => p.key === key);
    if (i !== -1) applyLayout(moveWidget(layout, key, i + delta));
  };
  const onResize = (key) => applyLayout(resizeWidget(layout, key, WIDGET_BY_KEY[key]?.sizes ?? ['1x1']));
  const onRemove = (key) => applyLayout(removeWidget(layout, key));
  const onAdd = async () => {
    const placed = new Set(layout.map((p) => p.key));
    const avail = WIDGETS.filter((w) => moduleKeys.includes(w.module) && !placed.has(w.key));
    if (!avail.length) { dialog.alert({ title: t('widget.add.none') }); return; }
    const idx = await dialog.menu({ title: t('widget.add.title'), options: avail.map((w) => ({ label: w.title, icon: w.icon })) });
    if (idx == null) return;
    applyLayout(addWidget(layout, avail[idx].key, avail[idx].defaultSize));
  };

  // Toegankelijke controlebalk per tegel (naast de vinger-drag): herschikken,
  // grootte en verwijderen — ook bruikbaar met een screenreader.
  const renderControls = (key) => {
    const descriptor = WIDGET_BY_KEY[key];
    return (
      <View style={{
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        height: CONTROL_H - 4, marginTop: 4, backgroundColor: colors.surface,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
      }}>
        <EditBtn icon="back" label={t('widget.move.back')} tint={colors.forest} onPress={() => onMove(key, -1)} />
        <EditBtn icon="forward" label={t('widget.move.forward')} tint={colors.forest} onPress={() => onMove(key, 1)} />
        {descriptor?.sizes.length > 1 ? (
          <EditBtn icon="repeat" label={t('widget.resize')} tint={colors.inkSoft} onPress={() => onResize(key)} />
        ) : null}
        <EditBtn icon="delete" label={t('widget.remove')} tint={colors.danger} onPress={() => onRemove(key)} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SCREEN_PAD, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
      >
        {/* Hero: huishouden + persoonlijke groet + voortgangsring (stand van vandaag). */}
        <HomeHero
          householdName={active?.name}
          householdEmoji={active?.emoji}
          greeting={greeting}
          firstName={profile?.display_name?.split(' ')[0] ?? ''}
          progress={progress}
          remaining={focus.length}
        />

        {/* Focus: achterstallig + vandaag, afvinkbaar. Leeg → overslaan. In bewerkmodus
            bewust verborgen zodat de aandacht op het samenstellen van de grid ligt. */}
        {!editing && focus.length > 0 && (
          <View style={{ marginBottom: space.lg }}>
            <SectionHeader
              title={t('home.focus.title')}
              count={focus.length}
              tint={overdue.length ? colors.danger : colors.forest}
            />
            {visibleFocus.map((tk) => (
              <TaskRow key={tk.id} task={tk} members={members} onToggle={toggle} />
            ))}
            {extraFocus > 0 && (
              <Pressable
                onPress={() => router.push('/(tabs)/taken')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: space.xs, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[type.label, { color: colors.forest }]}>
                  {t('home.focus.more', { n: extraFocus })}
                </Text>
                <Icon name="chevron" size={16} color={colors.forest} />
              </Pressable>
            )}
          </View>
        )}

        {/* Grid-kop: titel + bewerk-toggle. */}
        <Row justify="space-between" align="center" style={{ marginBottom: space.sm }}>
          <Text style={type.label}>{t('home.widgets.title')}</Text>
          <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={editing ? t('widget.edit.done') : t('widget.edit')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
            <Icon name={editing ? 'check' : 'appearance'} size={16} color={colors.forest} />
            <Text style={[type.label, { color: colors.forest }]}>{editing ? t('widget.edit.done') : t('widget.edit')}</Text>
          </Pressable>
        </Row>

        {/* Stijl-keuze + drag-hint (alleen in bewerkmodus). */}
        {editing ? (
          <>
            <SegmentedControl
              style={{ marginBottom: space.sm }}
              value={widgetStyle}
              onChange={changeStyle}
              options={[
                { value: 'playful', label: t('widget.style.playful') },
                { value: 'neutral', label: t('widget.style.neutral') },
              ]}
            />
            <Text style={[type.caption, { marginBottom: space.md }]}>{t('widget.dragHint')}</Text>
          </>
        ) : null}

        {/* Widget-grid: absoluut gepositioneerd, met vinger-drag-herschikking in
            bewerkmodus (long-press → optillen → realtime door de widgets schuiven). */}
        {layout.length > 0 ? (
          <WidgetGrid
            layout={layout}
            editing={editing}
            widgetStyle={widgetStyle}
            tasks={tasks}
            members={members}
            colW={colW}
            contentW={contentW}
            gap={GRID_GAP}
            tileH={TILE_H}
            controlH={CONTROL_H}
            onReorder={(next) => save(next)}
            renderControls={renderControls}
          />
        ) : null}

        {/* Widget toevoegen (alleen in bewerkmodus). */}
        {editing ? (
          <Button title={t('widget.add')} icon="add" variant="ghost" onPress={onAdd} style={{ marginBottom: space.lg }} />
        ) : null}

        {/* Eén rustige ingang naar alle onderdelen i.p.v. een tweede launchpad. */}
        {!editing ? (
          <ItemRow
            leading={<Icon name="more" size={24} color={colors.forest} />}
            title={t('home.allModules')}
            chevron
            onPress={() => router.push('/(tabs)/meer')}
          />
        ) : null}
      </ScrollView>

      {/* Snel een taak toevoegen — verborgen in bewerkmodus. */}
      {!editing ? (
        <FAB label={t('fab.task')} accessibilityLabel={t('task.add')} onPress={() => router.push('/task/new')} />
      ) : null}
    </SafeAreaView>
  );
}
