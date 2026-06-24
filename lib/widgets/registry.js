import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { WidgetTile } from './WidgetHost';
import {
  taskFocusSummary, taskProgressSummary, groceriesSummary, expenseBalanceSummary,
  plantsSummary, agendaSummary, pantrySummary, cleaningSummary, mealPlanSummary,
} from './summaries';
import { useGroceries } from '../useGroceries';
import { useExpenses } from '../useExpenses';
import { usePlants } from '../usePlants';
import { useMealPlan } from '../useMealPlan';
import { useActivity } from '../useActivity';
import { usePantry } from '../usePantry';
import { useAuth } from '../auth';
import { formatCents } from '../expenses';
import { dueLabel } from '../recurrence';
import { colors, type } from '../theme';
import { t, plural } from '../i18n';

// Widget-registry (VDG-1/5/7): één descriptor per widget; een module kan er meerdere
// hebben. `Render` krijgt { size, style, tasks } en rendert via het gedeelde WidgetTile-
// skelet. Anders dan de oude HOME_CARDS rendert een widget altijd (ook "alles oké"),
// want op een door de gebruiker samengestelde grid hoort een geplaatste widget niet
// stilletjes te verdwijnen.

const Mini = ({ children }) => <Text style={type.caption} numberOfLines={1}>{children}</Text>;

// "+N meer"-regel onder een gestapelde preview-lijst (alleen tonen als er écht meer is).
const MoreLine = ({ shown, total }) => (
  total > shown ? <Text style={[type.caption, { color: colors.inkFaint }]} numberOfLines={1}>{t('widget.more', { n: total - shown })}</Text> : null
);

// Dunne voortgangsbalk binnen een widget-preview (done/total). Puur visueel.
const TileBar = ({ done, total }) => (
  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
    <View style={{ width: `${Math.round((done / total) * 100)}%`, height: '100%', backgroundColor: colors.done }} />
  </View>
);

// --- Taken ---
function TakenFocus({ size, style, tasks, details }) {
  const router = useRouter();
  const s = useMemo(() => taskFocusSummary(tasks), [tasks]);
  const prog = useMemo(() => taskProgressSummary(tasks), [tasks]);
  const shown = s.items.slice(0, 3);
  const preview = (s.items[0] || prog.total > 0) ? (
    <View style={{ gap: 2 }}>
      {prog.total > 0 ? <TileBar done={prog.done} total={prog.total} /> : null}
      {/* De aankomende/achterstallige taken netjes onder elkaar, dan "+N meer". */}
      {shown.map((it) => <Mini key={it.id}>{it.title}</Mini>)}
      <MoreLine shown={shown.length} total={s.count} />
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="taken" style={style} size={size} showDetails={details} icon="tasks" title={t('tasks.title')}
      stat={s.count ? plural(s.count, 'widget.taken.todo.one', 'widget.taken.todo.other') : t('today.allDone')}
      statColor={s.overdue ? colors.danger : undefined}
      preview={preview}
      onPress={() => router.push('/(tabs)/taken')} />
  );
}

// --- Boodschappen ---
function GroceriesCount({ size, style, details }) {
  const router = useRouter();
  const { items } = useGroceries();
  const s = useMemo(() => groceriesSummary(items), [items]);
  // De eerste paar boodschappen netjes onder elkaar, dan "+N meer" (i.p.v. alles op één
  // regel met punten samen te persen).
  const preview = s.names.length ? (
    <View style={{ gap: 2 }}>
      {s.names.map((n, i) => <Mini key={i}>{n}</Mini>)}
      <MoreLine shown={s.names.length} total={s.count} />
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="boodschappen" style={style} size={size} showDetails={details} icon="shopping" title={t('groceries.title')}
      stat={s.count ? plural(s.count, 'home.card.groceries.one', 'home.card.groceries.other') : t('widget.groceries.empty')}
      preview={preview}
      onPress={() => router.push('/(tabs)/boodschappen')} />
  );
}

// --- Kosten ---
function ExpensesBalance({ size, style, details }) {
  const router = useRouter();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  const { cents } = useMemo(() => expenseBalanceSummary(expenses, user?.id), [expenses, user]);
  const stat = cents === 0 ? t('widget.kosten.even')
    : cents > 0 ? t('expenses.balance.positive', { amount: formatCents(cents) })
      : t('expenses.balance.negative', { amount: formatCents(-cents) });
  return (
    <WidgetTile moduleKey="kosten" style={style} size={size} showDetails={details} icon="expenses" title={t('expenses.title')}
      stat={stat} statColor={cents < 0 ? colors.danger : undefined}
      onPress={() => router.push('/(tabs)/kosten')} />
  );
}

// --- Planten ---
function PlantsWater({ size, style, tasks, details }) {
  const router = useRouter();
  const { plants } = usePlants();
  const s = useMemo(() => plantsSummary(plants, tasks), [plants, tasks]);
  // Dorstige planten onder elkaar; is er niets dringends, toon dan wie er als
  // volgende aan de beurt is (zodat de tegel ook in rust iets nuttigs zegt).
  const preview = s.count ? (
    <View style={{ gap: 2 }}>
      {s.names.map((n, i) => <Mini key={i}>{n}</Mini>)}
      <MoreLine shown={s.names.length} total={s.count} />
    </View>
  ) : s.next ? (
    <View style={{ gap: 2 }}>
      <Text style={[type.caption, { color: colors.inkFaint }]} numberOfLines={1}>{t('widget.plants.next')}</Text>
      <Mini>{s.next.name} · {dueLabel({ due_date: s.next.due_date })}</Mini>
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="planten" style={style} size={size} showDetails={details} icon="plants" title={t('plants.title')}
      stat={s.count ? plural(s.count, 'home.card.plants.one', 'home.card.plants.other') : t('home.card.plants.empty')}
      statColor={s.count ? colors.warning : undefined}
      preview={preview}
      onPress={() => router.push('/(tabs)/planten')} />
  );
}

// --- Agenda ---
function AgendaUpcoming({ size, style, tasks, details }) {
  const router = useRouter();
  const s = useMemo(() => agendaSummary(tasks), [tasks]);
  // De aankomende afspraken onder elkaar (ook als er vandaag niets is), dan "+N meer".
  const preview = s.items.length ? (
    <View style={{ gap: 2 }}>
      {s.items.map((it) => <Mini key={it.id}>{dueLabel(it)} · {it.title}</Mini>)}
      <MoreLine shown={s.items.length} total={s.count} />
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="agenda" style={style} size={size} showDetails={details} icon="agenda" title={t('agenda.title')}
      stat={s.count ? plural(s.count, 'home.card.agenda.one', 'home.card.agenda.other') : t('widget.agenda.empty')}
      preview={preview}
      onPress={() => router.push('/(tabs)/taken')} />
  );
}

// --- Maaltijden ---
function MealsTonight({ size, style, details }) {
  const router = useRouter();
  const { entries } = useMealPlan(new Date());
  const s = useMemo(() => mealPlanSummary(entries), [entries]);
  const tonight = s.tonight ? (s.tonight.recipe?.title || s.tonight.title || t('mealtype.' + s.tonight.meal_type)) : null;
  // Welke (komende) dagen deze week nog leeg zijn — de nuttige "nog te plannen"-lijst.
  const shown = s.emptyDays.slice(0, 3);
  const preview = s.emptyCount ? (
    <View style={{ gap: 2 }}>
      <Text style={[type.caption, { color: colors.inkFaint }]} numberOfLines={1}>{t('widget.meals.openDays')}</Text>
      {shown.map((d) => <Mini key={d}>{format(parseISO(d), 'EEE d MMM', { locale: nl })}</Mini>)}
      <MoreLine shown={shown.length} total={s.emptyCount} />
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="maaltijden" style={style} size={size} showDetails={details} icon="meals" title={t('meals.title')}
      stat={tonight || t('widget.meals.empty')}
      preview={preview}
      onPress={() => router.push('/(tabs)/maaltijden')} />
  );
}

// --- Voorraad ---
function PantryUrgent({ size, style, details }) {
  const router = useRouter();
  const { items } = usePantry();
  const s = useMemo(() => pantrySummary(items), [items]);
  // Wát er op voorraad ligt (urgente items eerst), met "+N meer" voor de rest.
  const preview = s.stock.length ? (
    <View style={{ gap: 2 }}>
      {s.stock.slice(0, 3).map((n, i) => <Mini key={i}>{n}</Mini>)}
      <MoreLine shown={Math.min(3, s.stock.length)} total={s.total} />
    </View>
  ) : null;
  return (
    <WidgetTile moduleKey="voorraad" style={style} size={size} showDetails={details} icon="pantry" title={t('pantry.title')}
      stat={s.count ? plural(s.count, 'home.card.pantry.one', 'home.card.pantry.other') : t('widget.pantry.empty')}
      statColor={s.count ? colors.warning : undefined}
      preview={preview}
      onPress={() => router.push('/(tabs)/voorraad')} />
  );
}

// --- Schoonmaak ---
function CleaningOpen({ size, style, tasks, details }) {
  const router = useRouter();
  const s = useMemo(() => cleaningSummary(tasks), [tasks]);
  return (
    <WidgetTile moduleKey="schoonmaak" style={style} size={size} showDetails={details} icon="cleaning" title={t('cleaning.title')}
      stat={s.count ? plural(s.count, 'home.card.cleaning.one', 'home.card.cleaning.other') : t('widget.cleaning.empty')}
      onPress={() => router.push('/(tabs)/schoonmaak')} />
  );
}

// --- Activiteit ---
function ActivityFeed({ size, style, details }) {
  const router = useRouter();
  const { feed } = useActivity();
  const first = feed?.[0] ?? null;
  const more = (feed ?? []).slice(1, 3);
  return (
    <WidgetTile moduleKey="activiteit" style={style} size={size} showDetails={details} icon="feed" title={t('home.card.activity.title')}
      stat={first ? first.text : t('widget.activity.empty')}
      preview={more.length ? <View>{more.map((it) => <Text key={it.id} style={type.caption} numberOfLines={1}>{it.text}</Text>)}</View> : null}
      onPress={() => router.push('/(tabs)/activiteit')} />
  );
}

// Eén (resizebare) widget per module. Elke widget kan zowel 1×1 (half) als 2×1
// (full-width) — geen tegel zit vast op één grootte. `defaultSize` bepaalt enkel de
// startgrootte in de default-layout; `isDefault` welke widget die module levert.
const SIZES = ['1x1', '2x1'];
export const WIDGETS = [
  { key: 'taken.focus', module: 'taken', title: t('tasks.title'), icon: 'tasks', sizes: SIZES, defaultSize: '2x1', isDefault: true, Render: TakenFocus },
  { key: 'boodschappen.count', module: 'boodschappen', title: t('groceries.title'), icon: 'shopping', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: GroceriesCount },
  { key: 'kosten.balance', module: 'kosten', title: t('expenses.title'), icon: 'expenses', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: ExpensesBalance },
  { key: 'planten.water', module: 'planten', title: t('plants.title'), icon: 'plants', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: PlantsWater },
  // "Aankomend"-widget hoort sinds de samenvoeging (UX-27) bij Taken; niet langer
  // default geplaatst (taken.focus is de default-taken-tegel), maar toe te voegen.
  { key: 'agenda.upcoming', module: 'taken', title: t('agenda.title'), icon: 'agenda', sizes: SIZES, defaultSize: '2x1', isDefault: false, Render: AgendaUpcoming },
  { key: 'maaltijden.tonight', module: 'maaltijden', title: t('meals.title'), icon: 'meals', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: MealsTonight },
  { key: 'voorraad.urgent', module: 'voorraad', title: t('pantry.title'), icon: 'pantry', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: PantryUrgent },
  { key: 'schoonmaak.open', module: 'schoonmaak', title: t('cleaning.title'), icon: 'cleaning', sizes: SIZES, defaultSize: '1x1', isDefault: true, Render: CleaningOpen },
  { key: 'activiteit.feed', module: 'activiteit', title: t('home.card.activity.title'), icon: 'feed', sizes: SIZES, defaultSize: '2x1', isDefault: true, Render: ActivityFeed },
];

export const WIDGET_BY_KEY = Object.fromEntries(WIDGETS.map((w) => [w.key, w]));

// module-key → de default-widget-descriptor (voor deriveDefaultLayout).
export const DEFAULTS_BY_MODULE = Object.fromEntries(
  WIDGETS.filter((w) => w.isDefault).map((w) => [w.module, w]),
);
