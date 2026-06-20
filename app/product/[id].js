import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useProducts } from '../../lib/useProducts';
import { useProductPrices } from '../../lib/usePurchases';
import { ModalHeader, Row, SectionHeader, Empty, Sparkline } from '../../lib/ui';
import { colors, type, space, radius } from '../../lib/theme';
import { formatCents } from '../../lib/expenses';
import { series, latestPerStore, stats, trendPct } from '../../lib/priceTrack';
import { t, dateLocale } from '../../lib/i18n';

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { products } = useProducts();
  const { items, loading } = useProductPrices(id);

  const product = products.find((p) => p.id === id) ?? null;
  const points = useMemo(() => series(items), [items]);
  const st = useMemo(() => stats(items), [items]);
  const perStore = useMemo(() => latestPerStore(items), [items]);
  const trend = useMemo(() => trendPct(items), [items]);

  const trendColor = trend == null ? colors.inkSoft : trend > 0 ? colors.danger : colors.success;
  const trendArrow = trend == null ? '' : trend > 0 ? '▲' : trend < 0 ? '▼' : '→';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={product?.name ?? t('product.title')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
        {st.count === 0 ? (
          loading ? null : (
            <Empty illustration="groceries" title={t('product.empty.title')} subtitle={t('product.empty.subtitle')} />
          )
        ) : (
          <>
            {/* Stats-kaart */}
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg }}>
              <Row justify="space-between">
                <View>
                  <Text style={type.caption}>{t('product.latest')}</Text>
                  <Text style={[type.h2, { color: colors.forest }]}>{formatCents(st.latest)}</Text>
                </View>
                {trend != null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={type.caption}>{t('product.trend')}</Text>
                    <Text style={[type.title, { color: trendColor, fontWeight: '800' }]}>
                      {trendArrow} {Math.abs(trend).toFixed(0)}%
                    </Text>
                  </View>
                ) : null}
              </Row>
              <View style={{ marginTop: space.md }}>
                <Sparkline data={points} />
              </View>
              <Row justify="space-between" style={{ marginTop: space.sm }}>
                <Text style={type.caption}>{t('product.min')}: {formatCents(st.min)}</Text>
                <Text style={type.caption}>{t('product.max')}: {formatCents(st.max)}</Text>
                <Text style={type.caption}>{t('product.count', { n: st.count })}</Text>
              </Row>
            </View>

            {/* Laatste prijs per winkel */}
            <SectionHeader title={t('product.perStore')} />
            {Object.entries(perStore).map(([store, info]) => (
              <Row key={store || '—'} justify="space-between" style={{ paddingVertical: space.sm }}>
                <Text style={type.body}>{store || t('product.noStore')}</Text>
                <Text style={type.body}>
                  {formatCents(info.cents)}
                  <Text style={type.caption}>  · {format(info.date, 'd MMM yyyy', { locale: dateLocale() })}</Text>
                </Text>
              </Row>
            ))}

            {/* Losse aankopen (nieuwste eerst) */}
            <SectionHeader title={t('product.history')} count={st.count} />
            {[...points].reverse().map((p, i) => (
              <Row key={i} justify="space-between" style={{ paddingVertical: space.xs }}>
                <Text style={type.caption}>
                  {format(p.date, 'd MMM yyyy', { locale: dateLocale() })}{p.store ? ` · ${p.store}` : ''}
                </Text>
                <Text style={type.body}>{formatCents(p.cents)}</Text>
              </Row>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
