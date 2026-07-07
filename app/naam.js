import React, { useState } from 'react';
import { ScrollView, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Button, Field, Card } from '../lib/ui';
import { colors, type, space } from '../lib/theme';
import { t, authErrorMessage } from '../lib/i18n';

// Naam-scherm na de allereerste code-login (PLT-8). Een account dat via
// signInWithOtp is ontstaan heeft nog geen user_metadata.display_name (de
// profiles-trigger vulde het e-mail-lokaaldeel in); de Gate (app/_layout.js,
// needsDisplayName in lib/otp.js) stuurt zo'n gebruiker éérst hierheen vóór
// onboarding/app. Opslaan zet de naam op beide plekken (auth-metadata +
// profiles-rij, zie updateDisplayName in lib/auth.js); daarna routeert de Gate
// vanzelf verder omdat de metadata-check dan slaagt.
export default function Naam() {
  const router = useRouter();
  const { updateDisplayName, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError(t('auth.name.error')); return; }
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await updateDisplayName(trimmed);
      if (err) throw err;
      await refreshProfile();
      // Terug naar de root: de Gate beslist (onboarding of app) — de metadata is
      // nu gezet, dus de naam-check kaatst niet meer terug.
      router.replace('/');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={[type.h1, { marginBottom: space.xs }]}>{t('auth.name.title')}</Text>
          <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.xl }]}>
            {t('auth.name.subtitle')}
          </Text>
          <Card>
            <Field label={t('auth.field.name')} value={name}
              onChangeText={(v) => { setName(v); setError(null); }}
              placeholder={t('auth.field.name.placeholder')} error={error}
              autoFocus autoComplete="name" />
            <Button title={t('auth.name.submit')} onPress={save} loading={busy} />
          </Card>
          <Button title={t('common.signOut')} variant="ghost" onPress={signOut}
            style={{ marginTop: space.xl, borderColor: 'transparent' }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
