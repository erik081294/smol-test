import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../lib/household';
import { useAuth } from '../lib/auth';
import { Button, Field, Card } from '../lib/ui';
import { colors, type } from '../lib/theme';

export default function Onboarding() {
  const { createHousehold, joinHousehold } = useHousehold();
  const { signOut } = useAuth();
  const [tab, setTab] = useState('create');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏡');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const doCreate = async () => {
    if (!name.trim()) { Alert.alert('Geef je huishouden een naam'); return; }
    setBusy(true);
    try { await createHousehold(name.trim(), emoji); }
    catch (e) { Alert.alert('Mislukt', e.message); }
    finally { setBusy(false); }
  };

  const doJoin = async () => {
    if (!code.trim()) { Alert.alert('Vul de code in'); return; }
    setBusy(true);
    try { await joinHousehold(code.trim()); }
    catch (e) { Alert.alert('Mislukt', e.message); }
    finally { setBusy(false); }
  };

  const emojis = ['🏡', '🏠', '🏢', '👨‍👩‍👧', '🌿', '☕️', '🐾'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[type.h1, { marginTop: 12 }]}>Welkom! 👋</Text>
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
            <Field label="Naam van het huishouden" value={name} onChangeText={setName}
              placeholder="Bijv. Familie de Vries" />
            <Text style={[type.label, { marginBottom: 8 }]}>Kies een icoon</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {emojis.map((e) => (
                <Text key={e} onPress={() => setEmoji(e)}
                  style={{
                    fontSize: 28, padding: 8, borderRadius: 12,
                    backgroundColor: emoji === e ? colors.ocherSoft : colors.surfaceAlt,
                    overflow: 'hidden',
                  }}>{e}</Text>
              ))}
            </View>
            <Button title="Huishouden aanmaken" onPress={doCreate} loading={busy} />
          </Card>
        ) : (
          <Card>
            <Field label="Uitnodigingscode" value={code} onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters" placeholder="Bijv. 4F9K2A" maxLength={6} />
            <Button title="Aansluiten" variant="accent" onPress={doJoin} loading={busy} />
          </Card>
        )}

        <Button title="Uitloggen" variant="ghost" onPress={signOut}
          style={{ marginTop: 28, borderColor: 'transparent' }} />
      </ScrollView>
    </SafeAreaView>
  );
}
