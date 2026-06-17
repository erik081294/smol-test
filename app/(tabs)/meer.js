import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { Card, ScreenHeader } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type } from '../../lib/theme';

// Overflow-scherm: alle effectieve modules die niet als eigen tab-icoon staan
// (de niet-primaire). Houdt de tabbalk kort terwijl elke module één tik weg blijft.
export default function Meer() {
  const { modules } = useHousehold();
  const router = useRouter();
  const items = modules.filter((m) => !m.primary);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Meer" subtitle="De overige modules van je huishouden." />

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8 }}>
        {items.map((m) => (
          <TouchableOpacity key={m.key} activeOpacity={0.7}
            onPress={() => router.push(`/(tabs)/${m.route}`)}>
            <Card style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Icon name={m.icon} size={26} color={colors.forest} />
              <Text style={[type.title, { flex: 1 }]}>{m.label}</Text>
              <Icon name="forward" size={22} color={colors.inkFaint} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
