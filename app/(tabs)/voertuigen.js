import React, { useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { useVehicles } from '../../lib/useVehicles';
import { Empty, FAB, ScreenHeader, ItemRow, ModuleHelpButton, ListSkeleton, Badge, Row, Banner } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { CarGlyph } from '../../lib/CarGlyph';
import { colors, type, space } from '../../lib/theme';
import { dueLabel } from '../../lib/recurrence';
import { t } from '../../lib/i18n';

// Korte ondertitel: merk/model + bouwjaar, met het kenteken als losse badge ernaast.
function subtitleFor(v) {
  const bits = [v.make, v.model].filter(Boolean).join(' ');
  return [bits, v.year].filter(Boolean).join(' · ');
}

export default function Voertuigen() {
  const { vehicles, loading, error, reload } = useVehicles();
  const { tasks } = useTasks();
  const router = useRouter();

  // Eerstvolgende (open) onderhoudstaak per voertuig — net als bij huisdieren.
  const nextByVehicle = useMemo(() => {
    const m = {};
    for (const task of tasks) {
      if (!task.vehicle_id || task.completed_at || !task.due_date) continue;
      if (!m[task.vehicle_id] || task.due_date < m[task.vehicle_id].due_date) m[task.vehicle_id] = task;
    }
    return m;
  }, [tasks]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader module="voertuigen" title={t('voertuigen.title')} subtitle={t('voertuigen.subtitle')}
        right={<ModuleHelpButton module="voertuigen" />} />

      {/* Foutstaat (UX-23): een mislukte (her)laadbeurt toont een nette banner met
          opnieuw-proberen i.p.v. een stille lege lijst. */}
      {error && !loading ? (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
          <Banner tone="warning" icon="warning" title={t('common.loadError')}>
            <Pressable onPress={reload} accessibilityRole="button" hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: space.xs })}>
              <Text style={[type.label, { color: colors.forest }]}>{t('common.retry')}</Text>
            </Pressable>
          </Banner>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: 100 }}
        data={vehicles}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => {
          const next = nextByVehicle[item.id];
          const sub = subtitleFor(item);
          const hasAppearance = item.color != null || item.body_type != null;
          return (
            <ItemRow
              leading={hasAppearance
                ? <CarGlyph color={item.color} bodyType={item.body_type} size={44} />
                : <Icon name="voertuig" size={24} color={colors.catVoertuig ?? colors.forest} weight="fill" />}
              title={item.name}
              meta={
                <Row gap={space.sm} wrap>
                  {sub ? <Text style={type.caption}>{sub}</Text> : null}
                  {item.license_plate ? <Badge label={item.license_plate} tone="plate" /> : null}
                  {next ? (
                    <Text style={[type.caption, { color: colors.forest }]} numberOfLines={1}>
                      {t('vehicle.next', { label: dueLabel(next) })}
                    </Text>
                  ) : null}
                </Row>
              }
              chevron
              onPress={() => router.push(`/vehicle/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton count={4} />
          ) : (
            <Empty icon="voertuig" title={t('voertuigen.empty.title')}
              subtitle={t('voertuigen.empty.subtitle')}
              actionTitle={t('vehicle.add')} onAction={() => router.push('/vehicle/new')} />
          )
        }
      />

      {/* Lege-staat dedupe (DESIGN.md principe 4): de Empty-CTA draagt de primaire
          actie bij een lege lijst; de FAB verschijnt pas zodra er voertuigen zijn. */}
      {vehicles.length > 0 ? (
        <FAB label={t('fab.vehicle')} accessibilityLabel={t('vehicle.add')} testID="t-fab-vehicle" onPress={() => router.push('/vehicle/new')} />
      ) : null}
    </SafeAreaView>
  );
}
