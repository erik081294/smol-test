import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { MODULES } from '../../lib/modules';

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
      {MODULES.map((m) => (
        <Tabs.Screen key={m.key} name={m.route} options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji={m.emoji} label={m.label} focused={focused} /> }} />
      ))}
    </Tabs>
  );
}
