import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../lib/household';
import { useAuth } from '../lib/auth';
import { Button, Field, Card, EmojiPicker } from '../lib/ui';
import { PendingInviteBanner } from '../lib/PendingInviteBanner';
import { colors, type, space } from '../lib/theme';
import { t } from '../lib/i18n';

export default function Onboarding() {
  const { createHousehold } = useHousehold();
  const { signOut } = useAuth();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏡');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { name } — inline i.p.v. Alert

  const doCreate = async () => {
    if (!name.trim()) { setErrors({ name: t('onboarding.error.name') }); return; }
    setErrors({});
    setBusy(true);
    try { await createHousehold(name.trim(), emoji); }
    catch (e) { setErrors({ name: e.message }); }
    finally { setBusy(false); }
  };

  const emojis = ['🏡', '🏠', '🏢', '👨‍👩‍👧', '🌿', '☕️', '🐾'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[type.h1, { marginTop: 12 }]}>{t('onboarding.title')}</Text>
        <Text style={[type.body, { color: colors.inkSoft, marginTop: 6, marginBottom: 24 }]}>
          {t('onboarding.subtitle')}
        </Text>

        {/* Melding van een openstaande uitnodiging (PLT-7) — de invitee landt hier. */}
        <PendingInviteBanner />

        <Card>
          <Field label={t('onboarding.field.name')} value={name}
            onChangeText={(v) => { setName(v); setErrors({}); }}
            placeholder={t('onboarding.field.name.placeholder')} error={errors.name} />
          <Text style={[type.label, { marginBottom: space.sm }]}>{t('onboarding.chooseIcon')}</Text>
          <EmojiPicker options={emojis} value={emoji} onChange={setEmoji} style={{ marginBottom: space.lg }} />
          <Button title={t('onboarding.create.submit')} onPress={doCreate} loading={busy} />
        </Card>

        {/* Toetreden gaat sinds PLT-7 via een persoonlijke uitnodigingslink (0053),
            niet meer via een gedeelde code. De invitee opent de link → /join/[token]. */}
        <Text style={[type.caption, { color: colors.inkSoft, marginTop: space.lg, textAlign: 'center' }]}>
          {t('onboarding.invited.hint')}
        </Text>

        <Button title={t('common.signOut')} variant="ghost" onPress={signOut}
          style={{ marginTop: 28, borderColor: 'transparent' }} />
      </ScrollView>
    </SafeAreaView>
  );
}
