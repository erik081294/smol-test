import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { isConfigured } from '../../lib/supabase';
import { Button, Field } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type } from '../../lib/theme';
import { t } from '../../lib/i18n';

export default function Welcome() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { email, password, form } — inline i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  const submit = async () => {
    if (!isConfigured) {
      Alert.alert(t('auth.supabaseMissing.title'), t('auth.supabaseMissing.body'));
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
        Alert.alert(t('auth.signup.confirm.title'), t('auth.signup.confirm.body'));
        setMode('signin');
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      }
    } catch (err) {
      setErrors({ form: err.message }); // inline foutmelding onder het formulier
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
          </View>

          <Button
            variant="ghost"
            title={mode === 'signup' ? t('auth.toggle.toSignin') : t('auth.toggle.toSignup')}
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            style={{ marginTop: 16, borderColor: 'transparent' }}
          />
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
