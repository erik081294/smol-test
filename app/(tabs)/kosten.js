import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useExpenses } from '../../lib/useExpenses';
import { useRecurringExpenses } from '../../lib/useRecurringExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { computeBalances, balancesFromTotals, settle, formatCents } from '../../lib/expenses';
import { Empty, Card, Chip, FAB, ScreenHeader, ItemRow, ModuleHelpButton, ModalHeader, Button, ListSkeleton, BottomSheet, SheetScrollView } from '../../lib/ui';
import { colors, type, space } from '../../lib/theme';
import { t, plural, dateLocale } from '../../lib/i18n';

export default function Kosten() {
  const { expenses, loading, reload, exactTotals } = useExpenses();
  const { templates } = useRecurringExpenses(); // laadt + materialiseert verschuldigde occurrences
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();
  const router = useRouter();
  const [subgroupId, setSubgroupId] = useState(null);
  const [showSettle, setShowSettle] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const nameOf = (id) => members.find((m) => m.id === id)?.display_name ?? t('common.someone');
  const emojiOf = (id) => members.find((m) => m.id === id)?.avatar_emoji ?? '🙂';

  const filtered = useMemo(
    () => (subgroupId ? expenses.filter((e) => e.share_subgroup_id === subgroupId) : expenses),
    [expenses, subgroupId]
  );
  // Saldo uit de zichtbare rijen — behalve op de ongefilterde "iedereen"-weergave
  // wanneer het laad-venster vol is (>2000 uitgaven): dan rekenen we exact uit de
  // server-side aggregaat-totalen (PERF-1) i.p.v. uit het afgekapte venster. Een
  // subgroep-filter kan de RPC niet toepassen, dus daar blijft de client-berekening.
  const balances = useMemo(
    () => (!subgroupId && exactTotals ? balancesFromTotals(exactTotals) : computeBalances(filtered)),
    [filtered, subgroupId, exactTotals]
  );
  const payments = useMemo(() => settle(balances), [balances]);

  const myBalance = balances[user?.id] ?? 0;
  const balanceText = myBalance > 0 ? t('expenses.balance.positive', { amount: formatCents(myBalance) })
    : myBalance < 0 ? t('expenses.balance.negative', { amount: formatCents(-myBalance) })
    : t('expenses.balance.even');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')}
        right={
          <ModuleHelpButton
            module="kosten"
            actions={[
              { label: t('insights.title'), icon: 'insights', onPress: () => router.push('/kosten-inzichten') },
              { label: t('recurring.title'), icon: 'repeat', onPress: () => setRecurringOpen(true) },
            ]}
          />
        } />

      {/* Subgroep-scope */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label={t('common.everyone')} active={!subgroupId} onPress={() => setSubgroupId(null)} />
        {subgroups.map((g) => (
          <Chip key={g.id} label={`${g.emoji} ${g.name}`} active={subgroupId === g.id}
            onPress={() => setSubgroupId(g.id)} />
        ))}
      </ScrollView>

      {/* Saldo-balk */}
      <View style={{ paddingHorizontal: space.lg }}>
        <Card style={{ backgroundColor: colors.forest }}>
          <Text style={{ color: colors.onDark, fontSize: 18, fontWeight: '700' }}>{balanceText}</Text>
          {payments.length > 0 && (
            <Pressable onPress={() => setShowSettle((s) => !s)} style={{ marginTop: space.sm }}
              accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: colors.ocher, fontWeight: '700' }}>
                {showSettle ? t('expenses.settle.hide', { n: payments.length }) : t('expenses.settle.show', { n: payments.length })}
              </Text>
            </Pressable>
          )}
          {showSettle && payments.map((p, i) => (
            <Text key={i} style={{ color: colors.onDark, marginTop: space.xs }}>
              {emojiOf(p.from)} {nameOf(p.from)} → {nameOf(p.to)} {emojiOf(p.to)}: {formatCents(p.amountCents)}
            </Text>
          ))}
        </Card>
      </View>

      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.md, paddingBottom: 120 }}
        data={filtered}
        keyExtractor={(e) => e.id}
        // Virtualisatie-afstelling, gelijk aan app/catalog.js (PERF-9).
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => {
          const n = item.participantIds.length;
          return (
            <ItemRow
              title={item.description}
              trailing={<Text style={[type.title, { color: colors.forest }]}>{formatCents(item.amount_cents)}</Text>}
              meta={
                <Text style={type.caption}>
                  {emojiOf(item.paid_by)} {t('expenses.row.paid', { name: nameOf(item.paid_by) })}
                  {' · '}{plural(n, 'expenses.participants.one', 'expenses.participants.other')}
                  {' · '}{format(parseISO(item.spent_on), 'd MMM', { locale: dateLocale() })}
                </Text>
              }
              onPress={() => router.push(`/expense/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          loading && filtered.length === 0 ? (
            <ListSkeleton count={5} />
          ) : !loading && filtered.length === 0 ? (
            <Empty illustration="expenses" title={t('expenses.empty.title')}
              subtitle={t('expenses.empty.subtitle')}
              actionTitle={t('expense.add')} onAction={() => router.push('/expense/new')} />
          ) : null
        }
      />

      {/* Lege-staat dedupe (DESIGN.md principe 4): bij een lege lijst draagt de
          Empty-CTA de primaire actie; de FAB komt terug zodra er uitgaven zijn. */}
      {filtered.length > 0 ? (
        <FAB label={t('fab.expense')} accessibilityLabel={t('expense.add')} onPress={() => router.push('/expense/new')} />
      ) : null}

      {/* Terugkerende uitgaven beheren (UX-22: gedeelde BottomSheet — sluitbaar via
          veeg-omlaag, backdrop-tik én kruisje, conform het sheet-contract). */}
      <BottomSheet visible={recurringOpen} onClose={() => setRecurringOpen(false)} maxHeight="85%">
        <ModalHeader title={t('recurring.title')} onClose={() => setRecurringOpen(false)} />
        <SheetScrollView contentContainerStyle={{ padding: space.lg }}>
          {templates.length === 0 ? (
            <Empty icon="repeat" title={t('recurring.empty.title')} subtitle={t('recurring.empty.subtitle')} />
          ) : templates.map((item) => (
            <ItemRow
              key={item.id}
              title={item.description}
              titleColor={item.active ? undefined : colors.inkFaint}
              meta={
                <Text style={type.caption}>
                  {formatCents(item.amount_cents)} · {t('recur.' + item.recur_freq + '.one')}
                  {' · '}{t('recurring.next', { date: format(parseISO(item.next_date), 'd MMM', { locale: dateLocale() }) })}
                </Text>
              }
              chevron
              onPress={() => { setRecurringOpen(false); router.push(`/recurring-expense/${item.id}`); }}
            />
          ))}
          <Button title={t('recurring.new')} icon="add" variant="soft" style={{ marginTop: space.md }}
            onPress={() => { setRecurringOpen(false); router.push('/recurring-expense/new'); }} />
        </SheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
