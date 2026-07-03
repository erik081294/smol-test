import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useDialog } from '../../lib/dialog';
import { Button, Card } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type, space, radius } from '../../lib/theme';
import { normalizeToken } from '../../lib/invites';
import { t } from '../../lib/i18n';

// --- Presentatie-bouwstenen (module-niveau: niet opnieuw aangemaakt per render) -------
function Centered({ children }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Brand() {
  return (
    <View style={{ alignItems: 'center', marginBottom: space.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.forest,
        alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="home" size={32} color={colors.ocher} weight="fill" />
      </View>
      <Text style={[type.label, { color: colors.inkFaint, marginTop: space.sm, letterSpacing: 1 }]}>HUISHOEK</Text>
    </View>
  );
}

function StoreBadge({ label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1, backgroundColor: pressed ? colors.forestSoft : colors.forest,
        borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center',
      })}>
      <Text style={{ color: colors.onDark, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function Problem({ title, body, onClose, onRetry }) {
  return (
    <Centered>
      <Brand />
      <Card style={{ alignItems: 'center' }}>
        <Text style={[type.h2, { textAlign: 'center', marginBottom: space.sm }]}>{title}</Text>
        <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center' }]}>{body}</Text>
        {onRetry ? (
          <Button title={t('common.retry')} onPress={onRetry} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
        ) : null}
      </Card>
      <Button title={t('common.close')} variant="ghost" onPress={onClose}
        style={{ marginTop: space.lg, borderColor: 'transparent' }} />
    </Centered>
  );
}

// Join-scherm (PLT-7). De link (web/WhatsApp/e-mail) komt hier uit. Werkt web-first &
// account-gebonden: peek toont een gepersonaliseerde preview, daarna logt de ontvanger
// in/registreert en accepteert. Het token wordt als pending bewaard zodat de melding de
// login-round-trip (incl. e-mailbevestiging) overleeft. Het scherm regelt zijn eigen
// auth-staat — de Gate laat de 'join'-groep met rust.
export default function JoinInvite() {
  const params = useLocalSearchParams();
  const token = normalizeToken(params.token);
  const router = useRouter();
  const dialog = useDialog();
  const { user } = useAuth();
  const { peekInvite, acceptInvite, setPendingInvite, clearPendingInvite } = useHousehold();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // netwerk-/serverfout, ≠ ongeldig token
  const [attempt, setAttempt] = useState(0); // ophogen = opnieuw proberen
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) { setPreview(null); setLoadError(false); setLoading(false); return undefined; }
    setLoading(true);
    setLoadError(false);
    peekInvite(token)
      .then((p) => {
        if (!active) return;
        setPreview(p);
        // Alleen een geldige uitnodiging onthouden voor de melding na inloggen.
        if (p && p.status === 'valid') setPendingInvite(token);
      })
      // peekInvite gooit alléén bij een mislukte call (offline/server) — een geldig
      // "niet gevonden"-antwoord komt als preview=null terug. Zo onderscheiden we een
      // netwerkfout (met retry) van een écht ongeldige link.
      .catch(() => { if (active) { setPreview(null); setLoadError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const onAccept = useCallback(async () => {
    setBusy(true);
    try {
      await acceptInvite(token);
      setAccepted(true);
    } catch (e) {
      dialog.alert({ title: t('common.failed'), body: e.message });
    } finally {
      setBusy(false);
    }
  }, [token, acceptInvite, dialog]);

  const goLogin = useCallback(() => router.push('/(auth)/welcome'), [router]);
  const goApp = useCallback(() => router.replace('/(tabs)/vandaag'), [router]);
  const dismiss = useCallback(() => { clearPendingInvite(); router.replace('/'); }, [clearPendingInvite, router]);
  const showDownloadSoon = useCallback(
    () => dialog.alert({ title: t('join.download.title'), body: t('join.download.soon') }), [dialog]);

  // --- States ----------------------------------------------------------------
  if (loading) {
    return (
      <Centered>
        <Brand />
        <ActivityIndicator color={colors.forest} />
        <Text style={[type.caption, { textAlign: 'center', marginTop: space.md }]}>{t('join.loading')}</Text>
      </Centered>
    );
  }

  if (accepted) {
    const household = preview ? `${preview.household_emoji} ${preview.household_name}` : '';
    return (
      <Centered>
        <Brand />
        <Card>
          <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: space.sm }}>🎉</Text>
          <Text style={[type.h2, { textAlign: 'center' }]}>{t('join.accepted.title')}</Text>
          <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center', marginTop: space.xs }]}>
            {t('join.accepted.body', { household })}
          </Text>

          {/* Download-prompt — placeholders; echte store-links bestaan nog niet. */}
          <View style={{ marginTop: space.xl, padding: space.lg, backgroundColor: colors.ocherSoft, borderRadius: radius.md }}>
            <Text style={[type.title, { marginBottom: space.xs }]}>{t('join.download.title')}</Text>
            <Text style={[type.caption, { color: colors.inkSoft, marginBottom: space.md }]}>{t('join.download.body')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StoreBadge label={t('join.download.ios')} onPress={showDownloadSoon} />
              <StoreBadge label={t('join.download.android')} onPress={showDownloadSoon} />
            </View>
          </View>

          <Button title={t('join.continue')} onPress={goApp} style={{ marginTop: space.lg }} />
        </Card>
      </Centered>
    );
  }

  // Netwerk-/serverfout: geen kale "ongeldig", maar een retry-actie.
  if (loadError) {
    return <Problem title={t('join.network.title')} body={t('join.network.body')} onClose={dismiss} onRetry={retry} />;
  }
  if (!token || !preview) {
    return <Problem title={t('join.invalid.title')} body={t('join.invalid.body')} onClose={dismiss} />;
  }
  if (preview.status === 'revoked') {
    return <Problem title={t('join.revoked.title')} body={t('join.revoked.body')} onClose={dismiss} />;
  }
  if (preview.status === 'expired' || preview.status === 'accepted') {
    return <Problem title={t('join.expired.title')} body={t('join.expired.body')} onClose={dismiss} />;
  }

  // status === 'valid'
  const household = `${preview.household_emoji} ${preview.household_name}`;
  return (
    <Centered>
      <Brand />
      <Card>
        <Text style={{ fontSize: 52, textAlign: 'center', marginBottom: space.sm }}>{preview.household_emoji}</Text>
        <Text style={[type.h2, { textAlign: 'center' }]}>
          {t('join.invite.heading', { inviter: preview.inviter_name })}
        </Text>
        <Text style={[type.bodyLg, { color: colors.inkSoft, textAlign: 'center', marginTop: space.xs }]}>
          {t('join.invite.sub', { household })}
        </Text>
        {preview.role === 'owner' ? (
          <Text style={[type.caption, { color: colors.inkFaint, textAlign: 'center', marginTop: space.sm }]}>
            {t('join.role.ownerNote')}
          </Text>
        ) : null}

        {user ? (
          <Button title={t('join.accept')} onPress={onAccept} loading={busy} style={{ marginTop: space.xl }} />
        ) : (
          <>
            <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center', marginTop: space.xl, marginBottom: space.md }]}>
              {t('join.signedout.cta')}
            </Text>
            <Button title={t('join.signedout.button')} variant="accent" onPress={goLogin} />
          </>
        )}
      </Card>
      <Button title={t('common.close')} variant="ghost" onPress={dismiss}
        style={{ marginTop: space.lg, borderColor: 'transparent' }} />
    </Centered>
  );
}
