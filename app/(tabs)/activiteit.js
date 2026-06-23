import React from 'react';
import { FlatList, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivity } from '../../lib/useActivity';
import { ScreenHeader, ItemRow, Empty, ListSkeleton } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type, space } from '../../lib/theme';
import { t } from '../../lib/i18n';

// Activiteitenfeed (PLT-6): wat er in het huishouden gebeurt, afgeleid uit de
// voltooiingen-log (RLS-gescopet). Leesgericht — geen acties, alleen een tijdlijn.
export default function Activiteit() {
  const { feed, loading, reload } = useActivity();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('activity.title')} subtitle={t('activity.subtitle')} />
      <FlatList
        data={feed}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <ItemRow
            leading={<Icon name={item.icon} size={22} color={colors.forest} />}
            title={item.text}
            trailing={<Text style={type.caption}>{item.when}</Text>}
          />
        )}
        ListEmptyComponent={loading ? (
          <ListSkeleton count={5} />
        ) : (
          <Empty illustration="today" title={t('activity.empty.title')} subtitle={t('activity.empty.subtitle')} />
        )}
      />
    </SafeAreaView>
  );
}
