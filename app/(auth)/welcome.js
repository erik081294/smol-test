import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { isConfigured } from '../../lib/supabase';
import { useDialog } from '../../lib/dialog';
import { Button, Field } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type } from '../../lib/theme';
import { t, authErrorMessage } from '../../lib/i18n';

export default function Welcome() {
  const { signIn, signUp, resetPassword } = useAuth();
  const dialog = useDialog();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { email, password, form } — inline i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const submit = async () => {
    if (!isConfigured) {
      dialog.alert({ title: t('auth.supabaseMissing.title'), body: t('auth.supabaseMissing.body') });
      return;
    }
    const e = {};
    if (!email) e.email = t('auth.error.email');
    if (!password) e.password = t('auth.error.password');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email.trim(), password, name.trim() || t('auth.defaultName'));
        if (error) throw error;
        dialog.alert({ title: t('auth.signup.confirm.title'), body: t('auth.signup.confirm.body') });
        setMode('signin');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err) {
      setErrors({ form: authErrorMessage(err) }); // inline, in NL i.p.v. kale Engelse Supabase-tekst
    } finally {
      setBusy(false);
    }
  };

  // Wachtwoord vergeten: stuur een herstelmail. We bevestigen altijd neutraal
  // ("als dit adres bekend is") zodat de flow niet verklapt of een e-mail bestaat.
  const forgotPassword = async () => {
    if (!isConfigured) {
      dialog.alert({ title: t('auth.supabaseMissing.title'), body: t('auth.supabaseMissing.body') });
      return;
    }
    const addr = email.trim();
    if (!addr) { setErrors((e) => ({ ...e, email: t('auth.forgot.needEmail') })); return; }
    setBusy(true);
    try {
      const { error } = await resetPassword(addr);
      if (error) throw error;
      dialog.alert({ title: t('auth.forgot.sent.title'), body: t('auth.forgot.sent.body', { email: addr }) });
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.forest }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, justifyContent: 'center' }}>
          {/* Merk */}
          <View style={{ marginBottom: 36 }}>
            <Icon name="home" size={52} color={colors.ocher} weight="fill" />
            <Text style={{ fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 8 }}>
              Huishoek
            </Text>
            <Text style={{ fontSize: 17, color: colors.ocherSoft, marginTop: 6, lineHeight: 24 }}>
              {t('auth.tagline')}
            </Text>
          </View>

          {/* Form */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 20 }}>
            {mode === 'signup' && (
              <Field label={t('auth.field.name')} value={name} onChangeText={setName} placeholder={t('auth.field.name.placeholder')} />
            )}
            <Field label={t('auth.field.email')} value={email} onChangeText={(v) => { setEmail(v); clearErr('email'); }}
              autoCapitalize="none" keyboardType="email-address" placeholder={t('auth.field.email.placeholder')} error={errors.email} />
            <Field label={t('auth.field.password')} value={password} onChangeText={(v) => { setPassword(v); clearErr('password'); }}
              secureTextEntry placeholder="••••••••" error={errors.password} />
            {errors.form ? (
              <Text style={[type.caption, { color: colors.danger, marginBottom: 8 }]} accessibilityLiveRegion="polite">
                {errors.form}
              </Text>
            ) : null}
            <Button
              title={mode === 'signup' ? t('auth.submit.signup') : t('auth.submit.signin')}
              onPress={submit} loading={busy} style={{ marginTop: 6 }}
            />
            {mode === 'signin' && (
              <Pressable
                onPress={forgotPassword}
                disabled={busy}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({ marginTop: 14, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[type.caption, { color: colors.forest, fontWeight: '700' }]}>
                  {t('auth.forgot.link')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Secundaire actie (inloggen ↔ account maken) als duidelijk zichtbare link:
              wit (onDark) + onderstreping leest ruim AA op de forest-achtergrond in béíde
              thema's — de oude ghost-knop gaf donkere ink-tekst op donkergroen (vrijwel
              onzichtbaar), en ocherSoft zou in donkere modus onder AA zakken. */}
          <Pressable
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ marginTop: 20, paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: colors.onDark, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }}>
              {mode === 'signup' ? t('auth.toggle.toSignin') : t('auth.toggle.toSignup')}
            </Text>
          </Pressable>
          {!isConfigured && (
            <Text style={{ color: colors.ocherSoft, textAlign: 'center', marginTop: 12, fontSize: 13 }}>
              {t('auth.notConfigured')}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
