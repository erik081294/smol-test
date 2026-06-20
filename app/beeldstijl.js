import React, { useEffect, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ModalHeader, Card, Row, Chip, Banner } from '../lib/ui';
import { colors, space, type } from '../lib/theme';
import { getThemePrefs, setThemePrefs, THEME_MODES, THEME_DEFAULTS } from '../lib/themePrefs';
import { t } from '../lib/i18n';

// Beeldstijl. De modus-keuze wordt al bewaard; het toepassen (echte donkere modus)
// volgt zodra het palet via een theme-context loopt — vandaar de "binnenkort"-banner.
export default function Beeldstijl() {
  const router = useRouter();
  const [prefs, setLocal] = useState(THEME_DEFAULTS);

  useEffect(() => { getThemePrefs().then(setLocal); }, []);

  const choose = (mode) => { const next = { ...prefs, mode }; setLocal(next); setThemePrefs(next); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('appearance.title')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Banner tone="info" style={{ marginBottom: space.lg }}>{t('appearance.soon')}</Banner>

        <Text style={[type.label, { marginBottom: space.xs }]}>{t('appearance.theme')}</Text>
        <Card>
          <Row gap={space.xs} wrap>
            {THEME_MODES.map((m) => (
              <Chip key={m} label={t('appearance.mode.' + m)} active={prefs.mode === m} onPress={() => choose(m)} />
            ))}
          </Row>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
