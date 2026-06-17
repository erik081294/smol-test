import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { computeBalances, settle, formatCents } from '../../lib/expenses';
import { Empty, Card, Chip, FAB, ScreenHeader } from '../../lib/ui';
import { colors, type } from '../../lib/theme';

export default function Kosten() {
  const { expenses, loading, reload } = useExpenses();
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();
  const router = useRouter();
  const [subgroupId, setSubgroupId] = useState(null);
  const [showSettle, setShowSettle] = useState(false);

  const nameOf = (id) => members.find((m) => m.id === id)?.display_name ?? 'Iemand';
  const emojiOf = (id) => members.find((m) => m.id === id)?.avatar_emoji ?? '🙂';

  const filtered = useMemo(
    () => (subgroupId ? expenses.filter((e) => e.share_subgroup_id === subgroupId) : expenses),
    [expenses, subgroupId]
  );
  const balances = useMemo(() => computeBalances(filtered), [filtered]);
  const payments = useMemo(() => settle(balances), [balances]);

  const myBalance = balances[user?.id] ?? 0;
  const balanceText = myBalance > 0 ? `Jij krijgt nog ${formatCents(myBalance)}`
    : myBalance < 0 ? `Jij bent nog ${formatCents(-myBalance)} schuldig`
    : 'Je staat gelijk';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Kosten" subtitle="Wie betaalt wat — eerlijk verdeeld." />

      {/* Subgroep-scope */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Chip label="Iedereen" active={!subgroupId} onPress={() => setSubgroupId(null)} />
        {subgroups.map((g) => (
          <Chip key={g.id} label={`${g.emoji} ${g.name}`} active={subgroupId === g.id}
            onPress={() => setSubgroupId(g.id)} />
        ))}
      </ScrollView>

      {/* Saldo-balk */}
      <View style={{ paddingHorizontal: 18 }}>
        <Card style={{ backgroundColor: colors.forest }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{balanceText}</Text>
          {payments.length > 0 && (
            <TouchableOpacity onPress={() => setShowSettle((s) => !s)} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.ocher, fontWeight: '700' }}>
                {showSettle ? 'Verberg' : 'Bekijk'} vereffening ({payments.length})
              </Text>
            </TouchableOpacity>
          )}
          {showSettle && payments.map((p, i) => (
            <Text key={i} style={{ color: '#fff', marginTop: 6 }}>
              {emojiOf(p.from)} {nameOf(p.from)} → {nameOf(p.to)} {emojiOf(p.to)}: {formatCents(p.amountCents)}
            </Text>
          ))}
        </Card>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 18, paddingTop: 12, paddingBottom: 120 }}
        data={filtered}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/expense/${item.id}`)}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[type.title]} numberOfLines={1}>{item.description}</Text>
                <Text style={[type.title, { color: colors.forest }]}>{formatCents(item.amount_cents)}</Text>
              </View>
              <Text style={[type.caption, { marginTop: 4 }]}>
                {emojiOf(item.paid_by)} {nameOf(item.paid_by)} betaalde · {item.participantIds.length} deelnemers
                · {format(parseISO(item.spent_on), 'd MMM', { locale: nl })}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading && (
          <Empty icon="expenses" title="Nog geen uitgaven"
            subtitle="Voeg een gedeelde uitgave toe met de + knop." />
        )}
      />

      <FAB accessibilityLabel="Uitgave toevoegen" onPress={() => router.push('/expense/new')} />
    </SafeAreaView>
  );
}
