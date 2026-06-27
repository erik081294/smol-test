import React from 'react';
import { Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { usePurchases } from '../lib/usePurchases';
import { backLabelFor } from '../lib/navMeta';
import { formatCents } from '../lib/expenses';
import { ModalHeader, ItemRow, Empty, Button, ListSkeleton } from '../lib/ui';
import { colors, type, space } from '../lib/theme';
import { dateLocale, t } from '../lib/i18n';

// Bonnenlijst (BOO-10): het ontbrekende entry-point naar bestaande bonnen. Vanuit
// Boodschappen → hier → tik een bon → app/purchase/[id] (de read-only "Bewerken"-tak,
// die zonder deze lijst onbereikbaar was). Een bon invoeren kan vanaf hier of de lege staat.
export default function Purchases() {
  const router = useRouter();
  const { purchases, loading } = usePurchases();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('purchases.title')} onClose={() => router.back()} backLabel={backLabelFor('purchases')} />
      <FlatList
        data={purchases}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        renderItem={({ item }) => {
          const n = item.purchase_items?.length ?? 0;
          return (
            <ItemRow
              title={item.store || t('purchase.untitled')}
              meta={(
                <Text style={type.caption}>
                  {item.purchased_on ? format(parseISO(item.purchased_on), 'd MMM yyyy', { locale: dateLocale() }) : ''}
                  {n ? ` · ${t('purchases.items', { n })}` : ''}
                  {item.total_cents != null ? ` · ${formatCents(item.total_cents)}` : ''}
                </Text>
              )}
              chevron
              onPress={() => router.push(`/purchase/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={loading ? <ListSkeleton count={4} /> : (
          <Empty icon="receipt" title={t('purchases.empty.title')} subtitle={t('purchases.empty.subtitle')}
            actionTitle={t('groceries.receipt')} onAction={() => router.push('/purchase/new')} />
        )}
        ListFooterComponent={purchases.length ? (
          <Button title={t('groceries.receipt')} icon="add" variant="soft" style={{ marginTop: space.md }}
            onPress={() => router.push('/purchase/new')} />
        ) : null}
      />
    </SafeAreaView>
  );
}
