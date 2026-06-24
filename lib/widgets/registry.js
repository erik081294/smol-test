import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { WidgetTile } from './WidgetHost';
import {
  taskFocusSummary, taskProgressSummary, groceriesSummary, expenseBalanceSummary,
  plantsSummary, agendaSummary, pantrySummary, cleaningSummary,
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
const join = (names, total) => `${names.join(' · ')}${total > names.length ? ' …' : ''}`;

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
  const preview = (s.items[0] || prog.total > 0) ? (
    <View style={{ gap: 4 }}>
      {prog.total > 0 ? (
        <>
          <TileBar done={prog.done} total={prog.total} />
          <Mini>{t('widget.taken.progress.stat', { done: prog.done, total: prog.total })}</Mini>
        </>
      ) : null}
      {/* In de brede side-by-side-tegel is er ruimte voor een paar taakregels. */}
      {s.items.slice(0, 3).map((it) => <Mini key={it.id}>{it.title}</Mini>)}
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
  return (
    <WidgetTile moduleKey="boodschappen" style={style} size={size} showDetails={details} icon="shopping" title={t('groceries.title')}
      stat={s.count ? plural(s.count, 'home.card.groceries.one', 'home.card.groceries.other') : t('widget.groceries.empty')}
      preview={s.names.length ? <Mini>{join(s.names, s.count)}</Mini> : null}
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
  return (
    <WidgetTile moduleKey="planten" style={style} size={size} showDetails={details} icon="plants" title={t('plants.title')}
      stat={s.count ? plural(s.count, 'home.card.plants.one', 'home.card.plants.other') : t('home.card.plants.empty')}
      statColor={s.count ? colors.warning : undefined}
      preview={s.names.length ? <Mini>{join(s.names, s.count)}</Mini> : null}
      onPress={() => router.push('/(tabs)/planten')} />
  );
}

// --- Agenda ---
function AgendaUpcoming({ size, style, tasks, details }) {
  const router = useRouter();
  const s = useMemo(() => agendaSummary(tasks), [tasks]);
  return (
    <WidgetTile moduleKey="agenda" style={style} size={size} showDetails={details} icon="agenda" title={t('agenda.title')}
      stat={s.count ? plural(s.count, 'home.card.agenda.one', 'home.card.agenda.other') : t('widget.agenda.empty')}
      preview={s.next ? <Mini>{dueLabel(s.next)} · {s.next.title}</Mini> : null}
      onPress={() => router.push('/(tabs)/taken')} />
  );
}

// --- Maaltijden ---
function MealsTonight({ size, style, details }) {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { entries } = useMealPlan(new Date());
  const diner = useMemo(() => {
    const todays = (entries ?? []).filter((e) => e.plan_date === today);
    return todays.find((e) => e.meal_type === 'diner') ?? todays[0] ?? null;
  }, [entries, today]);
  return (
    <WidgetTile moduleKey="maaltijden" style={style} size={size} showDetails={details} icon="meals" title={t('meals.title')}
      stat={diner ? (diner.recipe?.title || diner.title || t('mealtype.' + diner.meal_type)) : t('widget.meals.empty')}
      onPress={() => router.push('/(tabs)/maaltijden')} />
  );
}

// --- Voorraad ---
function PantryUrgent({ size, style, details }) {
  const router = useRouter();
  const { items } = usePantry();
  const s = useMemo(() => pantrySummary(items), [items]);
  return (
    <WidgetTile moduleKey="voorraad" style={style} size={size} showDetails={details} icon="pantry" title={t('pantry.title')}
      stat={s.count ? plural(s.count, 'home.card.pantry.one', 'home.card.pantry.other') : t('widget.pantry.empty')}
      statColor={s.count ? colors.warning : undefined}
      preview={s.names.length ? <Mini>{join(s.names, s.count)}</Mini> : null}
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
