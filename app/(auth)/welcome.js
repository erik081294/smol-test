import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { isConfigured } from '../../lib/supabase';
import { useDialog } from '../../lib/dialog';
import { Button, Field } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type } from '../../lib/theme';
import { t, authErrorMessage } from '../../lib/i18n';
import { normalizeOtpCode, isValidOtpCode, resendRemainingSeconds, canResend } from '../../lib/otp';

// Gedeelde tekstlink op het formulier-oppervlak (forest op surface): opnieuw
// sturen, ander e-mailadres, wachtwoord vergeten. Module-niveau (niet per render
// aangemaakt); minHeight houdt het tikvlak ≥48.
function FormLink({ label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: 48, marginTop: 2, alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : disabled ? 0.5 : 1,
      })}
    >
      <Text style={[type.caption, { color: colors.forest, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

// Welkom/loginscherm. Sinds PLT-8 is de wachtwoordloze e-mailcode (OTP) het
// primaire pad: e-mail invullen → "Stuur mij een inlogcode" → 6 cijfers uit de
// mail overtypen → klaar (de Gate in app/_layout.js routeert verder, en vraagt
// bij een allereerste login eerst een naam op /naam). Wachtwoord-login en
// -registratie blijven volledig bestaan als secundaire modus. Alle pure logica
// (code-validatie, resend-afkoeltijd) leeft in lib/otp.js; dit scherm is schil.
export default function Welcome() {
  const { signIn, signUp, resetPassword, signInWithOtp, verifyOtp } = useAuth();
  const dialog = useDialog();
  const params = useLocalSearchParams();
  // mode: 'otp' (primair) | 'signin' | 'signup'. Het join-scherm (PLT-7) stuurt
  // nieuwe genodigden expliciet met ?mode=otp hierheen; dat is óók de default.
  const [mode, setMode] = useState(params.mode === 'wachtwoord' ? 'signin' : 'otp');
  const [otpStage, setOtpStage] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(null); // epoch-ms van de laatst gestuurde code
  const [resendIn, setResendIn] = useState(0); // seconden tot "opnieuw sturen" weer mag
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { email, password, code, form } — inline i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] || e.form ? { ...e, [key]: undefined, form: undefined } : e));

  // Afkoeltijd-teller voor "opnieuw sturen" (30 s, lib/otp.js). Tikt per seconde
  // zolang de code-invoerstaat zichtbaar is; stopt vanzelf zodra 'ie op 0 staat.
  useEffect(() => {
    if (otpStage !== 'code' || sentAt == null) return undefined;
    const tick = () => setResendIn(resendRemainingSeconds(sentAt, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpStage, sentAt]);

  const guardConfigured = () => {
    if (isConfigured) return true;
    dialog.alert({ title: t('auth.supabaseMissing.title'), body: t('auth.supabaseMissing.body') });
    return false;
  };

  // Stap 1 van het OTP-pad: stuur de 6-cijferige code. `shouldCreateUser: true`
  // (lib/auth.js) maakt impliciet een account voor een nieuwe genodigde.
  const sendCode = async () => {
    if (!guardConfigured()) return;
    const addr = email.trim();
    if (!addr) { setErrors({ email: t('auth.error.email') }); return; }
    setBusy(true);
    try {
      const { error } = await signInWithOtp(addr);
      if (error) throw error;
      setCode('');
      setErrors({});
      setSentAt(Date.now());
      setOtpStage('code');
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  // Opnieuw sturen — pas nadat de afkoeltijd om is (de knop is tot die tijd inert).
  const resendCode = async () => {
    if (!canResend(sentAt, Date.now()) || busy) return;
    setBusy(true);
    try {
      const { error } = await signInWithOtp(email.trim());
      if (error) throw error;
      setSentAt(Date.now());
      setErrors({});
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  // Stap 2: verzilver de code. Bij succes zet supabase-js de sessie en routeert
  // de Gate verder — dit scherm hoeft zelf niet te navigeren.
  const verifyCode = async () => {
    const cleaned = normalizeOtpCode(code);
    if (!isValidOtpCode(cleaned)) { setErrors({ code: t('auth.otp.error.code') }); return; }
    setBusy(true);
    try {
      const { error } = await verifyOtp(email.trim(), cleaned);
      if (error) throw error;
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  // Wachtwoord-pad (secundair): ongewijzigd t.o.v. vóór PLT-8.
  const submitPassword = async () => {
    if (!guardConfigured()) return;
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
    if (!guardConfigured()) return;
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

  const switchMode = (next) => {
    setMode(next);
    setOtpStage('email');
    setCode('');
    setErrors({});
  };

  const formError = errors.form ? (
    <Text style={[type.caption, { color: colors.danger, marginBottom: 8 }]} accessibilityLiveRegion="polite">
      {errors.form}
    </Text>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.forest }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 28, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
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
            {mode === 'otp' && otpStage === 'email' && (
              <>
                <Field label={t('auth.field.email')} value={email} onChangeText={(v) => { setEmail(v); clearErr('email'); }}
                  autoCapitalize="none" keyboardType="email-address" autoComplete="email"
                  placeholder={t('auth.field.email.placeholder')} error={errors.email}
                  helper={t('auth.otp.hint')} />
                {formError}
                <Button title={t('auth.otp.send')} onPress={sendCode} loading={busy} style={{ marginTop: 6 }} />
              </>
            )}

            {mode === 'otp' && otpStage === 'code' && (
              <>
                <Text style={[type.body, { color: colors.inkSoft, marginBottom: 14 }]}>
                  {t('auth.otp.sent.hint', { email: email.trim() })}
                </Text>
                <Field label={t('auth.otp.field.code')} value={code}
                  onChangeText={(v) => { setCode(normalizeOtpCode(v)); clearErr('code'); }}
                  keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode"
                  placeholder={t('auth.otp.field.code.placeholder')} error={errors.code} />
                {formError}
                <Button title={t('auth.otp.verify')} onPress={verifyCode} loading={busy} style={{ marginTop: 6 }} />
                <FormLink
                  label={resendIn > 0 ? t('auth.otp.resend.wait', { s: resendIn }) : t('auth.otp.resend')}
                  onPress={resendCode} disabled={busy || resendIn > 0}
                />
                <FormLink label={t('auth.otp.changeEmail')} disabled={busy}
                  onPress={() => { setOtpStage('email'); setCode(''); setErrors({}); }} />
              </>
            )}

            {mode !== 'otp' && (
              <>
                {mode === 'signup' && (
                  <Field label={t('auth.field.name')} value={name} onChangeText={setName} placeholder={t('auth.field.name.placeholder')} />
                )}
                <Field label={t('auth.field.email')} value={email} onChangeText={(v) => { setEmail(v); clearErr('email'); }}
                  autoCapitalize="none" keyboardType="email-address" placeholder={t('auth.field.email.placeholder')} error={errors.email} />
                <Field label={t('auth.field.password')} value={password} onChangeText={(v) => { setPassword(v); clearErr('password'); }}
                  secureTextEntry placeholder="••••••••" error={errors.password} />
                {formError}
                <Button
                  title={mode === 'signup' ? t('auth.submit.signup') : t('auth.submit.signin')}
                  onPress={submitPassword} loading={busy} style={{ marginTop: 6 }}
                />
                {mode === 'signin' && <FormLink label={t('auth.forgot.link')} onPress={forgotPassword} disabled={busy} />}
              </>
            )}
          </View>

          {/* Secundaire acties (OTP ↔ wachtwoord, inloggen ↔ account maken) als duidelijk
              zichtbare links: wit (onDark) + onderstreping leest ruim AA op de forest-
              achtergrond in béíde thema's — de oude ghost-knop gaf donkere ink-tekst op
              donkergroen (vrijwel onzichtbaar), en ocherSoft zou in donkere modus onder
              AA zakken. minHeight houdt het tikvlak ≥48. */}
          {(mode === 'otp'
            ? [{ key: 'toPassword', label: t('auth.otp.toPassword'), onPress: () => switchMode('signin') }]
            : [
              {
                key: 'togglePw',
                label: mode === 'signup' ? t('auth.toggle.toSignin') : t('auth.toggle.toSignup'),
                onPress: () => switchMode(mode === 'signup' ? 'signin' : 'signup'),
              },
              { key: 'toOtp', label: t('auth.otp.toOtp'), onPress: () => switchMode('otp') },
            ]
          ).map(({ key, label, onPress }) => (
            <Pressable
              key={key}
              onPress={onPress}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => ({ minHeight: 48, marginTop: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: colors.onDark, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline', textAlign: 'center' }}>
                {label}
              </Text>
            </Pressable>
          ))}
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
