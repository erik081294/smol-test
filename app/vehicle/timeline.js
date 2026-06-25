import React, { useMemo } from 'react';
import { View, Text, SectionList, Image, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useVehicles, useVehicleTimeline, useVehiclePhotoUrl } from '../../lib/useVehicles';
import { groupVehicleTimelineByDay, relativeDayLabel, buildLogbookText } from '../../lib/vehicleTimeline';
import { Empty, ModalHeader, SectionHeader, Row, ListSkeleton, IconButton } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { parseKey } from '../../lib/agenda';
import { formatCents } from '../../lib/expenses';
import { t, dateLocale } from '../../lib/i18n';

// 'today'/'yesterday' is in plantTimeline een hergebruikbare helper, maar de vehicle-
// variant draait op de entry.date (performed_on), dus we leunen op relativeDayLabel hier.
const KIND_ICON = { onderhoud: 'klus', km: 'voertuig', taak: 'check', mijlpaal: 'season', note: 'note' };

function TimelineCard({ entry }) {
  const url = useVehiclePhotoUrl(entry.photo_path);
  const sub = [
    entry.mileage != null ? `${entry.mileage} km` : null,
    entry.cost_cents != null ? formatCents(entry.cost_cents) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.md,
      backgroundColor: colors.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.line, padding: space.sm, marginBottom: space.sm,
    }}>
      <View style={{
        width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden',
        backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
      }}>
        {entry.photo_path && url
          ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} resizeMode="cover" />
          : <Icon name={KIND_ICON[entry.kind] ?? 'note'} size={22} color={colors.forest} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.title, { fontSize: 15 }]} numberOfLines={1}>
          {entry.title || t(`vehicle.kind.${entry.kind}`)}
        </Text>
        {sub ? <Text style={[type.caption, { marginTop: 2 }]}>{sub}</Text> : null}
        {entry.note ? (
          <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]} numberOfLines={2}>{entry.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function VehicleTimelineScreen() {
  const { v } = useLocalSearchParams();
  const router = useRouter();
  const { vehicles } = useVehicles();
  const vehicle = useMemo(() => vehicles.find((x) => x.id === v) ?? null, [vehicles, v]);
  const { entries, loading, reload } = useVehicleTimeline(v, vehicle);

  const sections = useMemo(() => groupVehicleTimelineByDay(entries).map((g) => {
    const rel = relativeDayLabel(g.key);
    const title = rel === 'today' ? t('common.today')
      : rel === 'yesterday' ? t('common.yesterday')
        : g.key === 'onbekend' ? t('vehicle.timeline.title')
          : format(parseKey(g.key), 'd MMMM yyyy', { locale: dateLocale() });
    return { key: g.key, title, data: g.entries };
  }), [entries]);

  const onExport = async () => {
    if (!vehicle) return;
    try {
      await Share.share({
        title: t('vehicle.timeline.shareSubject', { name: vehicle.name }),
        message: buildLogbookText(vehicle, entries),
      });
    } catch { /* gebruiker annuleerde het deelvenster */ }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={vehicle ? t('vehicle.timeline.titleOf', { name: vehicle.name }) : t('vehicle.timeline.title')}
        onClose={() => router.back()} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        ListHeaderComponent={entries.length > 0 ? (
          <Row justify="flex-end" style={{ marginBottom: space.sm }}>
            <IconButton icon="share" tint={colors.forest} accessibilityLabel={t('vehicle.timeline.export')} onPress={onExport} />
          </Row>
        ) : null}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.data.length} />}
        renderItem={({ item }) => <TimelineCard entry={item} />}
        ListEmptyComponent={loading ? (
          <ListSkeleton count={4} />
        ) : (
          <Empty icon="timeline" title={t('vehicle.timeline.empty.title')} subtitle={t('vehicle.timeline.empty.subtitle')} />
        )}
      />
    </SafeAreaView>
  );
}
