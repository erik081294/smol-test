import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { usePlants, usePlantSpecies, usePlantPhotoUrl } from '../../lib/usePlants';
import { Empty, FAB, ScreenHeader, ModuleHelpButton, ListSkeleton, Banner } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, elevation, type, space } from '../../lib/theme';
import { dueLabel } from '../../lib/recurrence';
import { t } from '../../lib/i18n';

// Eén plantkaart. Eigen component zodat de foto-URL-hook per plant kan draaien.
// De bovenhelft is de foto (groot, vol-bleed); de onderhelft de info. Beide
// helften zijn flex:1 binnen een vaste kaarthoogte → de foto is precies de top-helft.
const CARD_HEIGHT = 200;
function PlantCard({ plant, speciesName, next, onPress }) {
  const photoUrl = usePlantPhotoUrl(plant.photo_path);
  return (
    <Pressable style={{ flex: 1, marginBottom: space.md }} onPress={onPress}
      accessibilityRole="button" accessibilityLabel={plant.name}>
      <View style={{
        height: CARD_HEIGHT, borderRadius: radius.lg, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...elevation.e1,
      }}>
        {/* Bovenhelft: foto (of een zachte placeholder) */}
        <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl
            ? <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Icon name="plants" size={44} color={colors.inkFaint} />}
        </View>
        {/* Onderhelft: info */}
        <View style={{ flex: 1, padding: space.md, justifyContent: 'center' }}>
          <Text style={type.title} numberOfLines={1}>{plant.name}</Text>
          {speciesName ? <Text style={type.caption} numberOfLines={1}>{speciesName}</Text> : null}
          {next ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
              <Icon name="water" size={13} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]} numberOfLines={1}>{dueLabel(next)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function Planten() {
  const { plants, loading, error, reload } = usePlants();
  const { species } = usePlantSpecies();
  const { tasks } = useTasks();
  const router = useRouter();

  // Eerstvolgende waterbeurt per plant (uit de gekoppelde, open taken).
  const nextWaterByPlant = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!t.plant_id || t.completed_at || !t.due_date) continue;
      if (!m[t.plant_id] || t.due_date < m[t.plant_id].due_date) m[t.plant_id] = t;
    }
    return m;
  }, [tasks]);

  const speciesName = (id) => species.find((s) => s.id === id)?.common_name;

  // Bij een oneven aantal vult een onzichtbare 'ghost' de laatste kolom, zodat de
  // laatste kaart op halve breedte blijft i.p.v. de hele rij vol te rekken (flex:1).
  const gridData = plants.length % 2 === 1
    ? [...plants, { id: '__ghost__', __ghost: true }]
    : plants;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader module="planten" title={t('plants.title')} subtitle={t('plants.subtitle')}
        right={
          <ModuleHelpButton
            module="planten"
            actions={plants.length > 0
              ? [{ label: t('plants.timeline.open'), icon: 'timeline', onPress: () => router.push('/plant/timeline') }]
              : undefined}
          />
        } />

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
        data={gridData}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) =>
          item.__ghost ? (
            <View style={{ flex: 1, marginBottom: space.md }} />
          ) : (
            <PlantCard
              plant={item}
              speciesName={speciesName(item.species_id)}
              next={nextWaterByPlant[item.id]}
              onPress={() => router.push(`/plant/${item.id}`)}
            />
          )
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton count={4} />
          ) : (
            <Empty illustration="plants" title={t('plants.empty.title')}
              subtitle={t('plants.empty.subtitle')}
              actionTitle={t('plant.add')} onAction={() => router.push('/plant/new')} />
          )
        }
      />

      <FAB label={t('fab.plant')} accessibilityLabel={t('plant.add')} onPress={() => router.push('/plant/new')} />
    </SafeAreaView>
  );
}
