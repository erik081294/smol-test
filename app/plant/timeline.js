import React, { useMemo } from 'react';
import { View, Text, SectionList, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useHouseholdPlantTimeline, usePlantPhotoUrl } from '../../lib/usePlants';
import { groupTimelineByDay, relativeDayLabel } from '../../lib/plantTimeline';
import { backLabelFor } from '../../lib/navMeta';
import { Empty, ModalHeader, SectionHeader, Row, ListSkeleton } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { parseKey } from '../../lib/agenda';
import { t, dateLocale } from '../../lib/i18n';

// Eén tijdlijn-post in de cross-plant feed: plantnaam vooraan (de sleutelinfo als
// je álle planten door elkaar ziet), thumbnail van de foto of een notitie-glyph,
// en de tekst. Tikken opent de betreffende plant. Eigen component zodat de
// foto-URL-hook per item kan draaien.
function PlantTimelineCard({ entry, onPress }) {
  const isNote = !entry.photo_path;
  const url = usePlantPhotoUrl(entry.photo_path);
  const plantName = entry.plant?.name ?? t('plants.timeline.unknownPlant');
  const time = format(parseISO(entry.created_at), 'HH:mm', { locale: dateLocale() });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('plants.timeline.entry', { plant: plantName, when: time })}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.line, padding: space.sm,
        marginBottom: space.sm, opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden',
        backgroundColor: isNote ? colors.forestPressed : colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {isNote
          ? <Icon name="note" size={22} color={colors.forest} />
          : url ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} resizeMode="cover" />
            : <Icon name="plants" size={20} color={colors.inkSoft} />}
      </View>
      <View style={{ flex: 1 }}>
        <Row justify="space-between" align="center" gap={space.sm}>
          <Text style={[type.title, { fontSize: 15, flex: 1 }]} numberOfLines={1}>{plantName}</Text>
          <Text style={type.caption}>{time}</Text>
        </Row>
        {entry.note
          ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]} numberOfLines={2}>{entry.note}</Text>
          : <Text style={[type.caption, { marginTop: 2 }]}>{isNote ? t('plant.timeline.note') : t('plant.timeline.photo')}</Text>}
      </View>
      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

export default function PlantTimelineScreen() {
  const router = useRouter();
  const { entries, loading, reload } = useHouseholdPlantTimeline();

  // Dag-secties (nieuwste eerst). Titel: "Vandaag"/"Gisteren" of de absolute datum.
  const sections = useMemo(() => groupTimelineByDay(entries).map((g) => {
    const rel = relativeDayLabel(g.key);
    const title = rel === 'today' ? t('common.today')
      : rel === 'yesterday' ? t('common.yesterday')
        : g.key === 'onbekend' ? t('plants.timeline.title')
          : format(parseKey(g.key), 'd MMMM yyyy', { locale: dateLocale() });
    return { key: g.key, title, data: g.entries };
  }), [entries]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('plants.timeline.title')} onClose={() => router.back()} backLabel={backLabelFor('plant')} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.data.length} />
        )}
        renderItem={({ item }) => (
          <PlantTimelineCard entry={item} onPress={() => item.plant?.id && router.push(`/plant/${item.plant.id}`)} />
        )}
        ListEmptyComponent={loading ? (
          <ListSkeleton count={5} />
        ) : (
          <Empty illustration="plants" title={t('plants.timeline.empty.title')}
            subtitle={t('plants.timeline.empty.subtitle')} />
        )}
      />
    </SafeAreaView>
  );
}
