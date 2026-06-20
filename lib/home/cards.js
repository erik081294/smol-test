import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { parseISO, isToday, isPast, addDays, isBefore } from 'date-fns';
import { SummaryCard } from './SummaryCard';
import { useGroceries } from '../useGroceries';
import { useExpenses } from '../useExpenses';
import { usePlants } from '../usePlants';
import { useHousehold } from '../household';
import { useAuth } from '../auth';
import { computeBalances, formatCents } from '../expenses';
import { dueLabel } from '../recurrence';
import { type } from '../theme';
import { t, plural } from '../i18n';

// ===========================================================================
// Per-module samenvattingskaarten voor het Home-dashboard. Elke kaart is een
// zelfstandige component die zélf zijn module-hook aanroept (zo blijven de Rules
// of Hooks intact wanneer Home over de ingeschakelde modules mapt) en het
// gedeelde <SummaryCard/>-skelet rendert. Taak-afgeleide kaarten (Agenda,
// Schoonmaak, Planten-water) krijgen `tasks` als prop van Home, dat useTasks al
// één keer aanroept voor de focus-sectie — zo geen dubbele realtime-subscription.
// ===========================================================================

// Compacte preview-regel onder de stat (caption, één regel).
const Preview = ({ children }) => (
  <Text style={type.caption} numberOfLines={1}>{children}</Text>
);

// Boodschappen — eigen tabel (useGroceries). "X te halen" + eerste namen.
function GroceriesCard() {
  const router = useRouter();
  const { items } = useGroceries();
  const open = useMemo(() => items.filter((i) => !i.checked), [items]);
  const empty = open.length === 0;
  return (
    <SummaryCard
      icon="shopping"
      title={t('groceries.title')}
      tone={empty ? 'positive' : 'neutral'}
      stat={empty ? t('home.card.groceries.empty') : plural(open.length, 'home.card.groceries.one', 'home.card.groceries.other')}
      preview={empty ? null : <Preview>{open.slice(0, 3).map((i) => i.name).join(' · ')}{open.length > 3 ? ' …' : ''}</Preview>}
      onPress={() => router.push('/(tabs)/boodschappen')}
    />
  );
}

// Kosten — eigen tabel (useExpenses). Jouw saldo, hergebruikt de bestaande
// balance-teksten en -berekening uit het Kosten-scherm.
function ExpensesCard() {
  const router = useRouter();
  const { expenses } = useExpenses();
  const { user } = useAuth();
  const my = useMemo(() => computeBalances(expenses)[user?.id] ?? 0, [expenses, user]);
  const stat = my > 0 ? t('expenses.balance.positive', { amount: formatCents(my) })
    : my < 0 ? t('expenses.balance.negative', { amount: formatCents(-my) })
    : t('expenses.balance.even');
  return (
    <SummaryCard
      icon="expenses"
      title={t('expenses.title')}
      tone={my > 0 ? 'positive' : my < 0 ? 'urgent' : 'neutral'}
      stat={stat}
      onPress={() => router.push('/(tabs)/kosten')}
    />
  );
}

// Planten — eigen tabel (usePlants) + taken (prop) voor de waterbeurten. Toont
// hoeveel planten vandaag of achterstallig water willen.
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
  const empty = needy.length === 0;
  return (
    <SummaryCard
      icon="plants"
      title={t('plants.title')}
      tone={empty ? 'positive' : 'urgent'}
      stat={empty ? t('home.card.plants.empty') : plural(needy.length, 'home.card.plants.one', 'home.card.plants.other')}
      preview={empty ? null : <Preview>{needy.slice(0, 3).map((p) => p.name).join(' · ')}{needy.length > 3 ? ' …' : ''}</Preview>}
      onPress={() => router.push('/(tabs)/planten')}
    />
  );
}

// Schoonmaak — taken (prop) die aan een zone hangen en nog openstaan.
function CleaningCard({ tasks = [] }) {
  const router = useRouter();
  const open = useMemo(() => tasks.filter((tk) => tk.zone_id && !tk.completed_at), [tasks]);
  const empty = open.length === 0;
  return (
    <SummaryCard
      icon="cleaning"
      title={t('cleaning.title')}
      tone={empty ? 'positive' : 'neutral'}
      stat={empty ? t('home.card.cleaning.empty') : plural(open.length, 'home.card.cleaning.one', 'home.card.cleaning.other')}
      onPress={() => router.push('/(tabs)/schoonmaak')}
    />
  );
}

// Agenda — taken (prop) met een datum in de komende week (na vandaag).
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
  const empty = upcoming.length === 0;
  return (
    <SummaryCard
      icon="agenda"
      title={t('agenda.title')}
      tone="neutral"
      stat={empty ? t('home.card.agenda.empty') : plural(upcoming.length, 'home.card.agenda.one', 'home.card.agenda.other')}
      preview={empty ? null : <Preview>{dueLabel(upcoming[0])} · {upcoming[0].title}</Preview>}
      onPress={() => router.push('/(tabs)/agenda')}
    />
  );
}

// Huishouden — lichte snelkoppeling naar het beheer. Hergebruikt de bestaande
// leden-telling.
function HouseholdCard() {
  const router = useRouter();
  const { members } = useHousehold();
  return (
    <SummaryCard
      icon="group"
      title={t('household.title')}
      tone="neutral"
      stat={plural(members.length, 'household.members.one', 'household.members.other')}
      onPress={() => router.push('/(tabs)/huishouden')}
    />
  );
}

// Registry: module-key → samenvattingskaart. `vandaag` (= Home zelf) en `taken`
// (zit al in de focus-sectie) staan er bewust niet in. Een nieuwe module die op
// Home wil verschijnen, registreert hier zijn kaart.
export const HOME_CARDS = {
  agenda: AgendaCard,
  boodschappen: GroceriesCard,
  kosten: ExpensesCard,
  planten: PlantsCard,
  schoonmaak: CleaningCard,
  huishouden: HouseholdCard,
};
