import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../lib/household';
import { useAuth } from '../lib/auth';
import { Button, Field, Card, EmojiPicker } from '../lib/ui';
import { colors, type, space } from '../lib/theme';
import { t } from '../lib/i18n';

export default function Onboarding() {
  const { createHousehold, joinHousehold } = useHousehold();
  const { signOut } = useAuth();
  const [tab, setTab] = useState('create');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏡');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { name, code } — inline i.p.v. Alert

  const doCreate = async () => {
    if (!name.trim()) { setErrors({ name: t('onboarding.error.name') }); return; }
    setErrors({});
    setBusy(true);
    try { await createHousehold(name.trim(), emoji); }
    catch (e) { setErrors({ name: e.message }); }
    finally { setBusy(false); }
  };

  const doJoin = async () => {
    if (!code.trim()) { setErrors({ code: t('onboarding.error.code') }); return; }
    setErrors({});
    setBusy(true);
    try { await joinHousehold(code.trim()); }
    catch (e) { setErrors({ code: e.message }); }
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

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <Button title={t('onboarding.tab.create')} variant={tab === 'create' ? 'primary' : 'soft'}
            onPress={() => setTab('create')} style={{ flex: 1 }} />
          <Button title={t('onboarding.tab.join')} variant={tab === 'join' ? 'primary' : 'soft'}
            onPress={() => setTab('join')} style={{ flex: 1 }} />
        </View>

        {tab === 'create' ? (
          <Card>
            <Field label={t('onboarding.field.name')} value={name}
              onChangeText={(v) => { setName(v); setErrors({}); }}
              placeholder={t('onboarding.field.name.placeholder')} error={errors.name} />
            <Text style={[type.label, { marginBottom: space.sm }]}>{t('onboarding.chooseIcon')}</Text>
            <EmojiPicker options={emojis} value={emoji} onChange={setEmoji} style={{ marginBottom: space.lg }} />
            <Button title={t('onboarding.create.submit')} onPress={doCreate} loading={busy} />
          </Card>
        ) : (
          <Card>
            <Field label={t('onboarding.field.code')} value={code}
              onChangeText={(v) => { setCode(v.toUpperCase()); setErrors({}); }}
              autoCapitalize="characters" placeholder={t('onboarding.field.code.placeholder')} maxLength={6} error={errors.code} />
            <Button title={t('onboarding.tab.join')} variant="accent" onPress={doJoin} loading={busy} />
          </Card>
        )}

        <Button title={t('common.signOut')} variant="ghost" onPress={signOut}
          style={{ marginTop: 28, borderColor: 'transparent' }} />
      </ScrollView>
    </SafeAreaView>
  );
}
