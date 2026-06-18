import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { isConfigured } from '../../lib/supabase';
import { Button, Field } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type } from '../../lib/theme';

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
      Alert.alert('Supabase ontbreekt', 'Vul je Supabase-gegevens in .env in. Zie README.');
      return;
    }
    const e = {};
    if (!email) e.email = 'Vul je e-mail in';
    if (!password) e.password = 'Vul je wachtwoord in';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email.trim(), password, name.trim() || 'Naamloos');
        if (error) throw error;
        Alert.alert('Bijna klaar', 'Check je mail om je account te bevestigen, en log daarna in.');
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
              Eén plek voor het hele huishouden.{'\n'}Klusjes, boodschappen en planten — samen geregeld.
            </Text>
          </View>

          {/* Form */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 20 }}>
            {mode === 'signup' && (
              <Field label="Je naam" value={name} onChangeText={setName} placeholder="Bijv. Erik" />
            )}
            <Field label="E-mail" value={email} onChangeText={(v) => { setEmail(v); clearErr('email'); }}
              autoCapitalize="none" keyboardType="email-address" placeholder="jij@voorbeeld.nl" error={errors.email} />
            <Field label="Wachtwoord" value={password} onChangeText={(v) => { setPassword(v); clearErr('password'); }}
              secureTextEntry placeholder="••••••••" error={errors.password} />
            {errors.form ? (
              <Text style={[type.caption, { color: colors.danger, marginBottom: 8 }]} accessibilityLiveRegion="polite">
                {errors.form}
              </Text>
            ) : null}
            <Button
              title={mode === 'signup' ? 'Account aanmaken' : 'Inloggen'}
              onPress={submit} loading={busy} style={{ marginTop: 6 }}
            />
          </View>

          <Button
            variant="ghost"
            title={mode === 'signup' ? 'Heb je al een account? Inloggen' : 'Nieuw hier? Maak een account'}
            onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            style={{ marginTop: 16, borderColor: 'transparent' }}
          />
          {!isConfigured && (
            <Text style={{ color: colors.ocherSoft, textAlign: 'center', marginTop: 12, fontSize: 13 }}>
              ⚠︎ Supabase nog niet ingesteld — zie README.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
