import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { usePlants, usePlantSpecies, usePlantPhotoUrl } from '../../lib/usePlants';
import { Empty, FAB, ScreenHeader } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, elevation, type } from '../../lib/theme';
import { dueLabel } from '../../lib/recurrence';

// Eén plantkaart. Eigen component zodat de foto-URL-hook per plant kan draaien.
// De bovenhelft is de foto (groot, vol-bleed); de onderhelft de info. Beide
// helften zijn flex:1 binnen een vaste kaarthoogte → de foto is precies de top-helft.
const CARD_HEIGHT = 200;
function PlantCard({ plant, speciesName, next, onPress }) {
  const photoUrl = usePlantPhotoUrl(plant.photo_path);
  return (
    <TouchableOpacity activeOpacity={0.85} style={{ flex: 1, marginBottom: 12 }} onPress={onPress}>
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
        <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          <Text style={[type.title]} numberOfLines={1}>{plant.name}</Text>
          {speciesName ? <Text style={[type.caption]} numberOfLines={1}>{speciesName}</Text> : null}
          {next ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Icon name="water" size={13} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]} numberOfLines={1}>{dueLabel(next)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function Planten() {
  const { plants, loading, reload } = usePlants();
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Planten" subtitle="Op tijd water, op maat verzorgd." />

      <FlatList
        contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 100 }}
        data={plants}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <PlantCard
            plant={item}
            speciesName={speciesName(item.species_id)}
            next={nextWaterByPlant[item.id]}
            onPress={() => router.push(`/plant/${item.id}`)}
          />
        )}
        ListEmptyComponent={!loading && (
          <Empty icon="plants" title="Nog geen planten"
            subtitle="Voeg je eerste plant toe met de + knop." />
        )}
      />

      <FAB accessibilityLabel="Plant toevoegen" onPress={() => router.push('/plant/new')} />
    </SafeAreaView>
  );
}
