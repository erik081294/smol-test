import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { Icon } from '../../lib/icons';
import { MODULES, MORE_TAB } from '../../lib/modules';
import { useHousehold } from '../../lib/household';

function TabIcon({ icon, label, focused }) {
  const tint = focused ? colors.forest : colors.inkFaint;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 86, gap: 3 }}>
      <Icon name={icon} size={24} weight={focused ? 'fill' : 'regular'} color={tint} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ fontSize: 11, fontWeight: focused ? '700' : '500', color: tint }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  // De effectieve module-set (kern + niet-uitgezet) bepaalt wat bereikbaar is.
  // We declareren álle route-schermen — expo-router vereist dat — maar tonen
  // alléén de primaire modules als eigen tab-icoon. Effectieve niet-primaire
  // modules krijgen href:null: hun route blijft bestaan en is bereikbaar via de
  // "Meer"-tab, maar staat niet in de balk. Zo blijft de tabbalk leesbaar.
  const { modules } = useHousehold();
  const visible = new Set(modules.map((m) => m.key));
  const hasMore = modules.some((m) => !m.primary);

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
          href: visible.has(m.key) && m.primary ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon icon={m.icon} label={m.label} focused={focused} /> }} />
      ))}
      <Tabs.Screen name={MORE_TAB.route} options={{
        href: hasMore ? undefined : null,
        tabBarIcon: ({ focused }) => <TabIcon icon={MORE_TAB.icon} label={MORE_TAB.label} focused={focused} /> }} />
    </Tabs>
  );
}
