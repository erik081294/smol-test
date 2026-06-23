import React, { useMemo } from 'react';
import { View, Text, SectionList, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useHouseholdPetTimeline, usePetPhotoUrl } from '../../lib/usePets';
import { groupTimelineByDay, relativeDayLabel } from '../../lib/plantTimeline';
import { petType } from '../../lib/petCare';
import { backLabelFor } from '../../lib/navMeta';
import { Empty, ModalHeader, SectionHeader, Row } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { parseKey } from '../../lib/agenda';
import { t, dateLocale } from '../../lib/i18n';

// Eén tijdlijn-post in de cross-pet feed: diernaam vooraan, thumbnail van de foto of
// een glyph (notitie/gewicht), en de tekst. Tikken opent het betreffende dier.
function PetTimelineCard({ entry, onPress }) {
  const isPhoto = !!entry.photo_path;
  const url = usePetPhotoUrl(entry.photo_path);
  const petName = entry.pet?.name ?? t('pets.timeline.unknownPet');
  const time = format(parseISO(entry.created_at), 'HH:mm', { locale: dateLocale() });
  const glyph = isPhoto ? null : (entry.weight_grams != null ? 'weight' : 'note');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('pets.timeline.entry', { pet: petName, when: time })}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.line, padding: space.sm,
        marginBottom: space.sm, opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden',
        backgroundColor: isPhoto ? colors.surfaceAlt : colors.forestSoft,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {isPhoto
          ? (url ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} resizeMode="cover" />
            : <Text style={{ fontSize: 22 }}>{petType(entry.pet?.type).emoji}</Text>)
          : <Icon name={glyph} size={22} color={colors.forest} />}
      </View>
      <View style={{ flex: 1 }}>
        <Row justify="space-between" align="center" gap={space.sm}>
          <Text style={[type.title, { fontSize: 15, flex: 1 }]} numberOfLines={1}>{petName}</Text>
          <Text style={type.caption}>{time}</Text>
        </Row>
        {entry.weight_grams != null
          ? <Text style={[type.body, { color: colors.forest, marginTop: 2 }]}>{t('pet.weight.value', { kg: (entry.weight_grams / 1000).toFixed(2).replace('.', ',') })}</Text>
          : null}
        {entry.note
          ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]} numberOfLines={2}>{entry.note}</Text>
          : (entry.weight_grams == null
            ? <Text style={[type.caption, { marginTop: 2 }]}>{isPhoto ? t('pet.timeline.photo') : t('pet.timeline.note')}</Text>
            : null)}
      </View>
      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

export default function PetTimelineScreen() {
  const router = useRouter();
  const { entries, loading, reload } = useHouseholdPetTimeline();

  const sections = useMemo(() => groupTimelineByDay(entries).map((g) => {
    const rel = relativeDayLabel(g.key);
    const title = rel === 'today' ? t('common.today')
      : rel === 'yesterday' ? t('common.yesterday')
        : g.key === 'onbekend' ? t('pets.timeline.title')
          : format(parseKey(g.key), 'd MMMM yyyy', { locale: dateLocale() });
    return { key: g.key, title, data: g.entries };
  }), [entries]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('pets.timeline.title')} onClose={() => router.back()} backLabel={backLabelFor('pet')} />
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
          <PetTimelineCard entry={item} onPress={() => item.pet?.id && router.push(`/pet/${item.pet.id}`)} />
        )}
        ListEmptyComponent={!loading && (
          <Empty illustration="pets" title={t('pets.timeline.empty.title')}
            subtitle={t('pets.timeline.empty.subtitle')} />
        )}
      />
    </SafeAreaView>
  );
}
