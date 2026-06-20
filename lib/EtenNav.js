import React from 'react';
import { useRouter } from 'expo-router';
import { Row, Chip } from './ui';
import { space } from './theme';
import { t } from './i18n';

// Verbindt de drie schermen van het keuken-vliegwiel (Boodschappen · Weekmenu ·
// Voorraad) tot één ontdekbaar "Eten"-gebied, zonder een extra tab. Render 'm direct
// onder de ScreenHeader van elk van de drie schermen; `active` markeert het huidige.
const ITEMS = [
  { key: 'boodschappen', route: '/(tabs)/boodschappen', labelKey: 'eten.nav.boodschappen' },
  { key: 'maaltijden', route: '/(tabs)/maaltijden', labelKey: 'eten.nav.weekmenu' },
  { key: 'voorraad', route: '/(tabs)/voorraad', labelKey: 'eten.nav.voorraad' },
];

export function EtenNav({ active }) {
  const router = useRouter();
  return (
    <Row gap={space.xs} style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
      {ITEMS.map((i) => (
        <Chip
          key={i.key}
          label={t(i.labelKey)}
          active={active === i.key}
          onPress={() => { if (active !== i.key) router.replace(i.route); }}
        />
      ))}
    </Row>
  );
}
