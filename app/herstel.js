import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useDialog } from '../lib/dialog';
import { supabase } from '../lib/supabase';
import { Button, Field } from '../lib/ui';
import { Icon } from '../lib/icons';
import { colors, type, font } from '../lib/theme';
import { t, authErrorMessage } from '../lib/i18n';

// Wachtwoord-herstel (UX-P5). Bereikt via de herstellink uit de reset-mail
// (redirectTo → /herstel). Op WEB detecteert supabase-js de recovery-sessie uit de
// URL (detectSessionInUrl) en vuurt een PASSWORD_RECOVERY-event; daarna is er een
// (tijdelijke) sessie waarmee we het nieuwe wachtwoord kunnen zetten.
//
// TODO (device/dashboard-verificatie vereist — niet zonder toestel te bevestigen):
//   1. NATIVE deep-link: `detectSessionInUrl` staat op native uit en de universal-link
//      in app.config.js dekt alleen /join. Om deze flow óók in de app (i.p.v. de
//      web-fallback) te laten landen, moet /herstel aan de app-links + een expliciete
//      URL→sessie-afhandeling worden toegevoegd. Nu werkt herstel op WEB (huishoek.app/herstel).
//   2. Supabase-dashboard: `${WEB_BASE_URL}/herstel` moet in de redirect-allowlist
//      staan (net als de bevestigings-URL bij INF-13), anders weigert Supabase de redirect.
export default function Herstel() {
  const router = useRouter();
  const dialog = useDialog();
  const { user, updatePassword } = useAuth();
  const [recovered, setRecovered] = useState(false);
  const ready = Boolean(user) || recovered; // recovery-sessie aanwezig?
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Vang het PASSWORD_RECOVERY-event af zodat we het formulier tonen zodra de
  // recovery-sessie tot stand komt (web: uit de URL). Een bestaande sessie (user)
  // telt ook — dan is de link al verwerkt vóór dit scherm mountte en is `ready` al waar.
  useEffect(() => {
    if (user) return undefined; // sessie is er al, niets af te wachten
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setRecovered(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [user]);

  const submit = async () => {
    if (password.length < 6) { setError(t('auth.recover.short')); return; }
    setBusy(true);
    try {
      const { error: err } = await updatePassword(password);
      if (err) throw err;
      await dialog.alert({ title: t('auth.recover.done.title'), body: t('auth.recover.done.body') });
      router.replace('/(tabs)/vandaag');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.forest }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, justifyContent: 'center' }}>
          <View style={{ marginBottom: 28 }}>
            <Icon name="home" size={44} color={colors.ocher} weight="fill" />
            <Text style={{ fontSize: 28, fontFamily: font.display, color: '#fff', letterSpacing: -0.5, marginTop: 8 }}>
              {t('auth.recover.title')}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 20 }}>
            {ready ? (
              <>
                <Text style={[type.body, { color: colors.inkSoft, marginBottom: 14 }]}>
                  {t('auth.recover.subtitle')}
                </Text>
                <Field
                  label={t('auth.recover.field')}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                  error={error}
                />
                <Button title={t('auth.recover.submit')} onPress={submit} loading={busy} style={{ marginTop: 6 }} />
              </>
            ) : (
              <>
                <Text style={[type.title, { marginBottom: 8 }]}>{t('auth.recover.waiting.title')}</Text>
                <Text style={[type.body, { color: colors.inkSoft }]}>{t('auth.recover.waiting.body')}</Text>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
