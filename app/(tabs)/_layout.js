import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../../lib/theme';
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

  // Edge-to-edge is sinds Expo SDK 52+ standaard aan op Android: de app tekent
  // áchter de transparante systeem-navigatiebalk. We geven de tabbalk een vaste
  // contenthoogte (iconen + label) plus de onder-inset als ademruimte — niet
  // bovenóp eigen witruimte gestapeld, anders wordt de balk onnodig hoog. Net als
  // de BottomSheet houdt `Math.max` een nette minimumrand als er geen systeem-inset
  // is (iOS zonder home-indicator / web). Het inset-gebied is rustige witruimte;
  // de iconen blijven boven de systeemknoppen (backlog UX-5).
  const insets = useSafeAreaInsets();
  const tabBottom = Math.max(insets.bottom, space.sm);

  return (
    <Tabs
      // backBehavior="history": Android-hardware-back keert terug naar de vórige
      // tab i.p.v. altijd naar de eerste (Thuis). Zo komt back vanuit een via "Meer"
      // geopende module netjes terug op Meer i.p.v. op Home (UX-12).
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        // Een bezochte tab blijft gemount (state + realtime-subscriptie behouden) en
        // wordt enkel render-bevroren als 'ie niet zichtbaar is. Terugkeren rendert
        // direct uit de behouden state i.p.v. opnieuw te mounten + een laad-skelet te
        // tonen (PERF-2). lazy (default) laten staan: nog niet bezochte tabs worden
        // niet voorbarig gemount.
        freezeOnBlur: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 56 + tabBottom,
          paddingTop: space.sm,
          paddingBottom: tabBottom,
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
