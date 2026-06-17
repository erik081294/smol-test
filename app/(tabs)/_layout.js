import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../lib/theme';

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 70 }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
      <Text style={{
        fontSize: 11, marginTop: 2, fontWeight: focused ? '700' : '500',
        color: focused ? colors.forest : colors.inkFaint,
      }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 86,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="vandaag" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="☀️" label="Vandaag" focused={focused} /> }} />
      <Tabs.Screen name="taken" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="✅" label="Taken" focused={focused} /> }} />
      <Tabs.Screen name="boodschappen" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Boodschappen" focused={focused} /> }} />
      <Tabs.Screen name="huishouden" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" label="Huishouden" focused={focused} /> }} />
    </Tabs>
  );
}
