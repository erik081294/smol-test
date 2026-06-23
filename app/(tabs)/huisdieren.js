import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTasks } from '../../lib/useTasks';
import { usePets, usePetPhotoUrl } from '../../lib/usePets';
import { petType } from '../../lib/petCare';
import { Empty, FAB, ScreenHeader, IconButton, ListSkeleton } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, elevation, type, space } from '../../lib/theme';
import { dueLabel } from '../../lib/recurrence';
import { t } from '../../lib/i18n';

// Eén dierkaart. Eigen component zodat de foto-URL-hook per dier kan draaien.
// Bovenhelft = foto (vol-bleed), onderhelft = info — net als de plantkaart.
const CARD_HEIGHT = 200;
function PetCard({ pet, next, onPress }) {
  const photoUrl = usePetPhotoUrl(pet.photo_path);
  const tp = petType(pet.type);
  return (
    <Pressable style={{ flex: 1, marginBottom: space.md }} onPress={onPress}
      accessibilityRole="button" accessibilityLabel={pet.name}>
      <View style={{
        height: CARD_HEIGHT, borderRadius: radius.lg, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...elevation.e1,
      }}>
        <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl
            ? <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Text style={{ fontSize: 44 }}>{tp.emoji}</Text>}
        </View>
        <View style={{ flex: 1, padding: space.md, justifyContent: 'center' }}>
          <Text style={type.title} numberOfLines={1}>{pet.name}</Text>
          <Text style={type.caption} numberOfLines={1}>{tp.label}</Text>
          {next ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
              <Icon name="huisdier" size={13} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]} numberOfLines={1}>{dueLabel(next)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function Huisdieren() {
  const { pets, loading, reload } = usePets();
  const { tasks } = useTasks();
  const router = useRouter();

  // Eerstvolgende verzorgingstaak per dier (uit de gekoppelde, open taken).
  const nextByPet = useMemo(() => {
    const m = {};
    for (const task of tasks) {
      if (!task.pet_id || task.completed_at || !task.due_date) continue;
      if (!m[task.pet_id] || task.due_date < m[task.pet_id].due_date) m[task.pet_id] = task;
    }
    return m;
  }, [tasks]);

  // Bij een oneven aantal vult een onzichtbare 'ghost' de laatste kolom.
  const gridData = pets.length % 2 === 1
    ? [...pets, { id: '__ghost__', __ghost: true }]
    : pets;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('pets.title')} subtitle={t('pets.subtitle')}
        right={pets.length > 0 ? (
          <IconButton icon="timeline" tint={colors.forest}
            accessibilityLabel={t('pets.timeline.open')}
            onPress={() => router.push('/pet/timeline')} />
        ) : null} />

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
            <PetCard
              pet={item}
              next={nextByPet[item.id]}
              onPress={() => router.push(`/pet/${item.id}`)}
            />
          )
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton count={4} />
          ) : (
            <Empty illustration="pets" title={t('pets.empty.title')}
              subtitle={t('pets.empty.subtitle')}
              actionTitle={t('pet.add')} onAction={() => router.push('/pet/new')} />
          )
        }
      />

      <FAB label={t('fab.pet')} accessibilityLabel={t('pet.add')} onPress={() => router.push('/pet/new')} />
    </SafeAreaView>
  );
}
