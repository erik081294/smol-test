import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { parseISO, isToday, isPast, addDays, isBefore, format } from 'date-fns';
import { SummaryCard } from './SummaryCard';
import { useGroceries } from '../useGroceries';
import { useExpenses } from '../useExpenses';
import { usePlants } from '../usePlants';
import { useMealPlan } from '../useMealPlan';
import { usePantry } from '../usePantry';
import { status, PANTRY_STATUS } from '../pantry';
import { useAuth } from '../auth';
import { computeBalances, formatCents } from '../expenses';
import { dueLabel } from '../recurrence';
import { type } from '../theme';
import { t, plural } from '../i18n';

// ===========================================================================
// Per-module samenvattingskaarten voor het Home-dashboard. Sinds de IA-ronde toont
// Thuis alléén kaarten die iets te melden hebben: heeft een module geen nieuws, dan
// rendert de kaart `null` (de volledige, gegroepeerde directory leeft in "Meer").
// Zo blijft Thuis een rustig statusoverzicht i.p.v. een tweede launchpad.
//
// Elke kaart roept zélf zijn module-hook aan (zo blijven de Rules of Hooks intact
// wanneer Home over de ingeschakelde modules mapt). Taak-afgeleide kaarten krijgen
// `tasks` als prop van Home (dat useTasks al één keer aanroept) — geen dubbele
// realtime-subscription.
// ===========================================================================

// Compacte preview-regel onder de stat (caption, één regel).
const Preview = ({ children }) => (
  <Text style={type.caption} numberOfLines={1}>{children}</Text>
);

// Boodschappen — "X te halen" + eerste namen. Niets open → geen kaart.
function GroceriesCard() {
  const router = useRouter();
  const { items } = useGroceries();
  const open = useMemo(() => items.filter((i) => !i.checked), [items]);
  if (open.length === 0) return null;
  return (
    <SummaryCard
      icon="shopping"
      title={t('groceries.title')}
      tone="neutral"
      stat={plural(open.length, 'home.card.groceries.one', 'home.card.groceries.other')}
      preview={<Preview>{open.slice(0, 3).map((i) => i.name).join(' · ')}{open.length > 3 ? ' …' : ''}</Preview>}
      onPress={() => router.push('/(tabs)/boodschappen')}
    />
  );
}

// Kosten — jouw saldo. In balans → geen kaart.
function ExpensesCard() {
  const router = useRouter();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  const my = useMemo(() => computeBalances(expenses)[user?.id] ?? 0, [expenses, user]);
  if (my === 0) return null;
  const stat = my > 0 ? t('expenses.balance.positive', { amount: formatCents(my) })
    : t('expenses.balance.negative', { amount: formatCents(-my) });
  return (
    <SummaryCard
      icon="expenses"
      title={t('expenses.title')}
      tone={my > 0 ? 'positive' : 'urgent'}
      stat={stat}
      onPress={() => router.push('/(tabs)/kosten')}
    />
  );
}

// Planten — planten die vandaag/achterstallig water willen. Niets → geen kaart.
function PlantsCard({ tasks = [] }) {
  const router = useRouter();
  const { plants } = usePlants();
  const needy = useMemo(() => {
    const ids = new Set();
    for (const tk of tasks) {
      if (!tk.plant_id || tk.completed_at || !tk.due_date) continue;
      const d = parseISO(tk.due_date);
      if (isToday(d) || isPast(d)) ids.add(tk.plant_id);
    }
    return plants.filter((p) => ids.has(p.id));
  }, [tasks, plants]);
  if (needy.length === 0) return null;
  return (
    <SummaryCard
      icon="plants"
      title={t('plants.title')}
      tone="urgent"
      stat={plural(needy.length, 'home.card.plants.one', 'home.card.plants.other')}
      preview={<Preview>{needy.slice(0, 3).map((p) => p.name).join(' · ')}{needy.length > 3 ? ' …' : ''}</Preview>}
      onPress={() => router.push('/(tabs)/planten')}
    />
  );
}

// Schoonmaak — open zone-taken. Niets → geen kaart.
function CleaningCard({ tasks = [] }) {
  const router = useRouter();
  const open = useMemo(() => tasks.filter((tk) => tk.zone_id && !tk.completed_at), [tasks]);
  if (open.length === 0) return null;
  return (
    <SummaryCard
      icon="cleaning"
      title={t('cleaning.title')}
      tone="neutral"
      stat={plural(open.length, 'home.card.cleaning.one', 'home.card.cleaning.other')}
      onPress={() => router.push('/(tabs)/schoonmaak')}
    />
  );
}

// Agenda — taken met een datum in de komende week (na vandaag). Niets → geen kaart.
function AgendaCard({ tasks = [] }) {
  const router = useRouter();
  const upcoming = useMemo(() => {
    const horizon = addDays(new Date(), 8); // t/m 7 dagen vooruit
    return tasks
      .filter((tk) => !tk.completed_at && tk.due_date)
      .map((tk) => ({ tk, d: parseISO(tk.due_date) }))
      .filter(({ d }) => !isToday(d) && !isPast(d) && isBefore(d, horizon))
      .sort((a, b) => a.d - b.d)
      .map(({ tk }) => tk);
  }, [tasks]);
  if (upcoming.length === 0) return null;
  return (
    <SummaryCard
      icon="agenda"
      title={t('agenda.title')}
      tone="neutral"
      stat={plural(upcoming.length, 'home.card.agenda.one', 'home.card.agenda.other')}
      preview={<Preview>{dueLabel(upcoming[0])} · {upcoming[0].title}</Preview>}
      onPress={() => router.push('/(tabs)/agenda')}
    />
  );
}

// Maaltijden — wat eten we vandaag. Niets gepland → geen kaart.
function MealsCard() {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { entries } = useMealPlan(new Date());
  const todays = useMemo(() => entries.filter((e) => e.plan_date === today), [entries, today]);
  const diner = todays.find((e) => e.meal_type === 'diner') ?? todays[0];
  if (!diner) return null;
  return (
    <SummaryCard
      icon="meals"
      title={t('meals.title')}
      tone="neutral"
      stat={diner.recipe?.title || diner.title || t('mealtype.' + diner.meal_type)}
      preview={<Preview>{t('recipe.tonight')}</Preview>}
      onPress={() => router.push('/(tabs)/maaltijden')}
    />
  );
}

// Voorraad — producten die bijna op / over datum zijn. Alles oké → geen kaart.
function PantryCard() {
  const router = useRouter();
  const { items } = usePantry();
  const urgent = useMemo(
    () => items.filter((i) => [PANTRY_STATUS.EXPIRED, PANTRY_STATUS.SOON, PANTRY_STATUS.LOW].includes(status(i))),
    [items]
  );
  if (urgent.length === 0) return null;
  return (
    <SummaryCard
      icon="pantry"
      title={t('pantry.title')}
      tone="urgent"
      stat={plural(urgent.length, 'home.card.pantry.one', 'home.card.pantry.other')}
      preview={<Preview>{urgent.slice(0, 3).map((p) => p.name).join(' · ')}{urgent.length > 3 ? ' …' : ''}</Preview>}
      onPress={() => router.push('/(tabs)/voorraad')}
    />
  );
}

// Registry: module-key → samenvattingskaart. Alleen modules met een statuswaardige
// kaart staan erin; `vandaag`/`taken` (focus-sectie) en beheer (Huishouden/Instellingen,
// nu in de Instellingen-hub) bewust niet. De volledige directory leeft in "Meer".
export const HOME_CARDS = {
  agenda: AgendaCard,
  boodschappen: GroceriesCard,
  kosten: ExpensesCard,
  planten: PlantsCard,
  schoonmaak: CleaningCard,
  maaltijden: MealsCard,
  voorraad: PantryCard,
};
