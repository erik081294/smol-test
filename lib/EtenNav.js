import React from 'react';
import { useRouter } from 'expo-router';
import { Row, Chip } from './ui';
import { space } from './theme';
import { t } from './i18n';

// Verbindt de schermen van het keuken-vliegwiel (Boodschappen · Weekmenu) tot één
// ontdekbaar "Eten"-gebied, zonder een extra tab. Render 'm direct onder de ScreenHeader;
// `active` markeert het huidige. Voorraad is bewust uit de Eten-flow gehaald (declutter,
// UXR-3) — de route bestaat nog en blijft bereikbaar via "Meer".
const ITEMS = [
  { key: 'boodschappen', route: '/(tabs)/boodschappen', labelKey: 'eten.nav.boodschappen' },
  { key: 'maaltijden', route: '/(tabs)/maaltijden', labelKey: 'eten.nav.weekmenu' },
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
