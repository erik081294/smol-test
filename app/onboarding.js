import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../lib/household';
import { useAuth } from '../lib/auth';
import { Button, Field, Card, EmojiPicker } from '../lib/ui';
import { colors, type, space } from '../lib/theme';

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
    if (!name.trim()) { setErrors({ name: 'Geef je huishouden een naam' }); return; }
    setErrors({});
    setBusy(true);
    try { await createHousehold(name.trim(), emoji); }
    catch (e) { setErrors({ name: e.message }); }
    finally { setBusy(false); }
  };

  const doJoin = async () => {
    if (!code.trim()) { setErrors({ code: 'Vul de code in' }); return; }
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
        <Text style={[type.h1, { marginTop: 12 }]}>Welkom!</Text>
        <Text style={[type.body, { color: colors.inkSoft, marginTop: 6, marginBottom: 24 }]}>
          Start een nieuw huishouden, of sluit je aan bij een bestaand met een code.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <Button title="Nieuw" variant={tab === 'create' ? 'primary' : 'soft'}
            onPress={() => setTab('create')} style={{ flex: 1 }} />
          <Button title="Aansluiten" variant={tab === 'join' ? 'primary' : 'soft'}
            onPress={() => setTab('join')} style={{ flex: 1 }} />
        </View>

        {tab === 'create' ? (
          <Card>
            <Field label="Naam van het huishouden" value={name}
              onChangeText={(v) => { setName(v); setErrors({}); }}
              placeholder="Bijv. Familie de Vries" error={errors.name} />
            <Text style={[type.label, { marginBottom: space.sm }]}>Kies een icoon</Text>
            <EmojiPicker options={emojis} value={emoji} onChange={setEmoji} style={{ marginBottom: space.lg }} />
            <Button title="Huishouden aanmaken" onPress={doCreate} loading={busy} />
          </Card>
        ) : (
          <Card>
            <Field label="Uitnodigingscode" value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setErrors({}); }}
              autoCapitalize="characters" placeholder="Bijv. 4F9K2A" maxLength={6} error={errors.code} />
            <Button title="Aansluiten" variant="accent" onPress={doJoin} loading={busy} />
          </Card>
        )}

        <Button title="Uitloggen" variant="ghost" onPress={signOut}
          style={{ marginTop: 28, borderColor: 'transparent' }} />
      </ScrollView>
    </SafeAreaView>
  );
}
