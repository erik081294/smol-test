import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseISO, isToday } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useDialog } from '../../lib/dialog';
import { TaskRow } from '../../lib/TaskRow';
import { HomeHero } from '../../lib/HomeHero';
import { PendingInviteBanner } from '../../lib/PendingInviteBanner';
import { dayProgress } from '../../lib/widgets/summaries';
import { FAB, SectionHeader, ItemRow, SegmentedControl, Button, Banner, ListSkeleton, SwipeRow, IconButton } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import {
  deriveDefaultLayout, moveWidget, removeWidget, resizeWidget, addWidget,
  toggleWidgetDetails, widgetShowsDetails,
} from '../../lib/widgets/grid';
import { WIDGET_BY_KEY, DEFAULTS_BY_MODULE, WIDGETS } from '../../lib/widgets/registry';
import { WidgetGrid } from '../../lib/widgets/WidgetGrid';
import { useHomeLayout } from '../../lib/useHomeLayout';
import { isOverdue, snoozeDate, dueLabel } from '../../lib/recurrence';
import { useToast } from '../../lib/toast';
import { animateNextLayout } from '../../lib/motion';
import { colors, type, space, radius } from '../../lib/theme';
import { t } from '../../lib/i18n';
import { useAssistantHub } from '../../lib/assistantProvider';

const SCREEN_PAD = 18;
const GRID_GAP = space.md;
const TILE_H = 148;       // uniforme tegelhoogte (1×1 en 2×1 even hoog → strakke grid);
                          // ruim genoeg dat een 2×1-preview (balk + 2 regels) past (UX-24)
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
  const { tasks, loading, error, reload, completeTask, uncompleteTask, updateTask } = useTasks();
  const { active, members, modules } = useHousehold();
  const { profile } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openAssistant } = useAssistantHub();

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

  const toggle = (tk) => {
    animateNextLayout();
    const p = tk.completed_at ? uncompleteTask(tk.id) : completeTask(tk);
    return Promise.resolve(p).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };

  // Veeg-actie op de focuslijst — app-brede conventie (UX-43): LINKS = verwijderen
  // (destructief), RECHTS = de neutrale/positieve actie. Vandaag is bewust een focus-
  // overzicht zónder verwijderen, dus links blijft hier leeg; rechts = uitstellen (een
  // dag vooruit, mét undo-vangnet). Afvinken gaat via het vinkje in de rij — net als op
  // Taken — zodat dezelfde veegrichting nergens het ene scherm wist en het andere niet.
  const snoozeFromHome = (task) => {
    const prev = task.due_date ?? null;
    const next = snoozeDate(task, 1);
    const fail = (e) => dialog.alert({ title: t('common.failed'), body: e.message });
    animateNextLayout();
    Promise.resolve(updateTask(task.id, { due_date: next })).catch(fail);
    toast.show({
      message: t('tasks.snoozed', { date: dueLabel({ due_date: next }) }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); Promise.resolve(updateTask(task.id, { due_date: prev })).catch(fail); },
    });
  };

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

  // Auto-scroll tijdens het slepen van een widget (UX): houd je een tegel tegen de
  // boven-/onderrand, dan scrollt de pagina mee zodat je 'm voorbij de huidige view kunt
  // plaatsen. scrollY (JS, scroll-doel) + scrollSV (worklet, voor de tegel-compensatie in
  // WidgetGrid). De edge-loop draait alleen zolang de vinger in de rand-zone is.
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const scrollSV = useSharedValue(0);
  const edgeDir = useRef(0);
  const edgeTimer = useRef(null);

  const stopEdgeScroll = useCallback(() => {
    edgeDir.current = 0;
    if (edgeTimer.current) { clearInterval(edgeTimer.current); edgeTimer.current = null; }
  }, []);
  const onEdgeScroll = useCallback((absoluteY) => {
    const vh = viewportH.current || 0;
    const ZONE = 110;            // rand-zone (incl. ~tabbar/sticky-balk onderaan)
    let dir = 0;
    if (absoluteY < insets.top + ZONE) dir = -1;
    else if (absoluteY > insets.top + vh - ZONE) dir = 1;
    edgeDir.current = dir;
    if (dir && !edgeTimer.current) {
      edgeTimer.current = setInterval(() => {
        if (!edgeDir.current) return;
        const max = Math.max(0, contentH.current - (viewportH.current || 0));
        const next = Math.min(max, Math.max(0, scrollY.current + edgeDir.current * 24));
        if (next !== scrollY.current) { scrollY.current = next; scrollRef.current?.scrollTo({ y: next, animated: false }); }
      }, 16);
    }
    if (!dir) stopEdgeScroll();
  }, [insets.top, stopEdgeScroll]);
  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

  // Layout-mutaties (puur + gesynct). animateNextLayout is no-op bij reduced motion.
  const applyLayout = (next) => { animateNextLayout(); save(next); };
  const onMove = (key, delta) => {
    const i = layout.findIndex((p) => p.key === key);
    if (i !== -1) applyLayout(moveWidget(layout, key, i + delta));
  };
  const onResize = (key) => applyLayout(resizeWidget(layout, key, WIDGET_BY_KEY[key]?.sizes ?? ['1x1']));
  const onToggleDetails = (key) => applyLayout(toggleWidgetDetails(layout, key));
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
    const placement = layout.find((p) => p.key === key);
    const wide = placement?.size && placement.size !== '1x1';
    const shows = widgetShowsDetails(placement);
    return (
      <View style={{
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        height: CONTROL_H - 4, marginTop: 4, backgroundColor: colors.surface,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
      }}>
        <EditBtn icon="back" label={t('widget.move.back')} tint={colors.forest} onPress={() => onMove(key, -1)} />
        <EditBtn icon="forward" label={t('widget.move.forward')} tint={colors.forest} onPress={() => onMove(key, 1)} />
        {/* Breedte-knop met een richtinggevoelig icoon (UX, batch 2): een smalle tegel
            toont "verbreden", een brede tegel "versmallen" — duidelijker dan één ⟳. */}
        {descriptor?.sizes.length > 1 ? (
          <EditBtn icon={wide ? 'narrow' : 'widen'}
            label={wide ? t('widget.width.narrow') : t('widget.width.widen')}
            tint={colors.inkSoft} onPress={() => onResize(key)} />
        ) : null}
        {/* Details aan/uit — alleen zinvol op een brede tegel (UX, batch 2): de smalle
            1×1-tegel heeft geen ruimte voor een preview, dus dan tonen we 'm niet. */}
        {wide ? (
          <EditBtn icon="catalog" label={shows ? t('widget.details.hide') : t('widget.details.show')}
            tint={shows ? colors.forest : colors.inkFaint} onPress={() => onToggleDetails(key)} />
        ) : null}
        <EditBtn icon="delete" label={t('widget.remove')} tint={colors.danger} onPress={() => onRemove(key)} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={(e) => { const y = e.nativeEvent.contentOffset.y; scrollY.current = y; scrollSV.value = y; }}
        onContentSizeChange={(_, h) => { contentH.current = h; }}
        onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}
        contentContainerStyle={{ padding: SCREEN_PAD, paddingBottom: editing ? 132 : 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
      >
        {/* Globaal zoeken (PLT-3): een onopvallende zoekknop in de kop-rechts-zone —
            Thuis heeft geen ScreenHeader (de hero ís de kop), dus de knop staat als
            rustige rij erboven, zoals de ModuleHelpButton rechtsboven in de modules. */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: space.xs }}>
          <IconButton icon="search" accessibilityLabel={t('search.open')} tint={colors.inkSoft}
            onPress={() => router.push('/zoeken')} />
        </View>

        {/* Hero: huishouden + persoonlijke groet + voortgangsring (stand van vandaag).
            Ring is tikbaar → Taken (UX-22); `loading` voorkomt de misleidende
            "rustige dag" tijdens het koud laden (UX-23). */}
        <HomeHero
          householdName={active?.name}
          householdEmoji={active?.emoji}
          greeting={greeting}
          firstName={profile?.display_name?.split(' ')[0] ?? ''}
          progress={progress}
          remaining={focus.length}
          loading={loading}
          onPress={() => router.push('/(tabs)/taken')}
        />

        {/* Melding van een openstaande uitnodiging (PLT-7) — voor wie al een huishouden
            heeft en naar een tweede wordt uitgenodigd; landt hier i.p.v. op onboarding. */}
        <PendingInviteBanner />

        {/* Foutstaat (UX-23): een mislukte (her)laadbeurt — bv. offline — toont een
            nette banner met opnieuw-proberen i.p.v. een stil leeg scherm. */}
        {error && !loading ? (
          <Banner tone="warning" icon="warning" title={t('home.error.title')} style={{ marginBottom: space.lg }}>
            <Pressable onPress={reload} accessibilityRole="button" hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: space.xs })}>
              <Text style={[type.label, { color: colors.forest }]}>{t('common.retry')}</Text>
            </Pressable>
          </Banner>
        ) : null}

        {/* Focus: achterstallig + vandaag, afvinkbaar. Leeg → overslaan. In bewerkmodus
            bewust verborgen zodat de aandacht op het samenstellen van de grid ligt.
            Koud laden zonder data → skeleton i.p.v. blanco (UX-23). */}
        {!editing && loading && tasks.length === 0 ? (
          <View style={{ marginBottom: space.lg }}>
            <ListSkeleton count={3} />
          </View>
        ) : !editing && focus.length > 0 ? (
          <View style={{ marginBottom: space.lg }}>
            <SectionHeader
              title={t('home.focus.title')}
              count={focus.length}
              tint={overdue.length ? colors.danger : colors.forest}
            />
            {visibleFocus.map((tk) => (
              <SwipeRow
                key={tk.id}
                right={{ icon: 'agenda', label: t('tasks.snooze'), color: colors.ocher, onTrigger: () => snoozeFromHome(tk) }}
              >
                <TaskRow task={tk} members={members} onToggle={toggle} />
              </SwipeRow>
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
        ) : null}

        {/* Widget-grid: absoluut gepositioneerd, met long-press-drag-herschikking in
            béíde modi (UX-25); de tegels tonen hun preview binnen hun ruimte (UX-24). */}
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
            scrollSV={scrollSV}
            onEdgeScroll={onEdgeScroll}
            onEdgeScrollEnd={stopEdgeScroll}
            // Slepen schakelt automatisch bewerkmodus in (UX) — daarna sluit je af via de
            // sticky "Klaar"-balk. Stop ook de auto-scroll-lus zodra je loslaat.
            onReorder={(next) => { save(next); stopEdgeScroll(); setEditing(true); }}
            renderControls={renderControls}
          />
        ) : null}

        {/* In bewerkmodus tonen we ónder de tegels enkel "widget toevoegen" — stijl en
            "Klaar" wonen in de sticky balk onderin. Buiten bewerkmodus: de rustige ingang
            naar alle modules, met de "Aanpassen"-link gecentreerd onderaan de pagina. */}
        {editing ? (
          <Button title={t('widget.add')} icon="add" variant="ghost" onPress={onAdd} style={{ marginTop: space.sm }} />
        ) : (
          <>
            <ItemRow
              leading={<Icon name="more" size={24} color={colors.forest} />}
              title={t('home.allModules')}
              chevron
              onPress={() => router.push('/(tabs)/meer')}
            />
            <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={t('widget.edit')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                alignSelf: 'center', marginTop: space.lg, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1,
              })}>
              <Icon name="appearance" size={16} color={colors.inkSoft} />
              <Text style={[type.label, { color: colors.inkSoft }]}>{t('widget.edit')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Sticky bewerk-balk: in bewerkmodus altijd in beeld — stijl-keuze + de
          onmiskenbare "Klaar"-afsluitknop, ook na het scrollen langs de tegels. */}
      {editing ? (
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          flexDirection: 'row', alignItems: 'center', gap: space.sm,
          paddingHorizontal: SCREEN_PAD, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm,
          backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line,
        }}>
          <View style={{ flex: 1 }}>
            <SegmentedControl
              value={widgetStyle}
              onChange={changeStyle}
              options={[
                { value: 'playful', label: t('widget.style.playful') },
                { value: 'neutral', label: t('widget.style.neutral') },
              ]}
            />
          </View>
          <Button title={t('widget.edit.done')} icon="check" fullWidth={false}
            onPress={() => setEditing(false)} />
        </View>
      ) : (
        /* Snel een taak toevoegen — verborgen in bewerkmodus. AI-first (AI-10):
           de assistent-sheet eerst, "Zelf invoeren" als uitwijk. */
        <FAB label={t('fab.task')} accessibilityLabel={t('task.add')}
          onPress={() => openAssistant({ moduleKey: 'taken', onManual: () => router.push('/task/new') })} />
      )}
    </SafeAreaView>
  );
}
