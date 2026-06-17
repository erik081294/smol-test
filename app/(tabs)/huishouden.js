import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Share, Platform, Modal, KeyboardAvoidingView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Card, Button, Avatar, Field, Chip } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type } from '../../lib/theme';
import { TOGGLEABLE_MODULES } from '../../lib/modules';

export default function HuishoudenTab() {
  const { active, households, members, subgroups, selectHousehold, leaveHousehold,
          createSubgroup, updateSubgroupMembers, deleteSubgroup,
          householdDisabled, userDisabled, setHouseholdModule, setUserModule } = useHousehold();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const isOwner = active?.role === 'owner';

  const toggleHouseholdModule = (key, enabled) =>
    setHouseholdModule(key, enabled).catch((e) => Alert.alert('Mislukt', e.message));
  const toggleUserModule = (key, enabled) =>
    setUserModule(key, enabled).catch((e) => Alert.alert('Mislukt', e.message));

  // Subgroep-editor (inline modal)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState(null);          // null = nieuw
  const [sgName, setSgName] = useState('');
  const [sgEmoji, setSgEmoji] = useState('👥');
  const [sgMembers, setSgMembers] = useState([]);
  const [sgBusy, setSgBusy] = useState(false);

  const openNewSubgroup = () => {
    setEditId(null); setSgName(''); setSgEmoji('👥'); setSgMembers([]); setEditorOpen(true);
  };
  const openEditSubgroup = (g) => {
    setEditId(g.id); setSgName(g.name); setSgEmoji(g.emoji);
    setSgMembers(g.memberIds ?? []); setEditorOpen(true);
  };
  const toggleSgMember = (pid) =>
    setSgMembers((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  const saveSubgroup = async () => {
    if (!sgName.trim()) { Alert.alert('Geef de groep een naam'); return; }
    if (sgMembers.length === 0) { Alert.alert('Kies minstens één persoon'); return; }
    setSgBusy(true);
    try {
      if (editId) await updateSubgroupMembers(editId, sgMembers);
      else await createSubgroup(sgName.trim(), sgEmoji, sgMembers);
      setEditorOpen(false);
    } catch (e) { Alert.alert('Mislukt', e.message); }
    finally { setSgBusy(false); }
  };

  const confirmDeleteSubgroup = (g) => {
    Alert.alert('Groep verwijderen?', `"${g.name}" wordt verwijderd. Taken die ermee gedeeld waren blijven bestaan, maar verliezen deze groep.`,
      [{ text: 'Annuleer', style: 'cancel' },
       { text: 'Verwijder', style: 'destructive', onPress: () => deleteSubgroup(g.id) }]);
  };

  const sgEmojis = ['👥', '👩‍❤️‍👨', '⚽', '🎓', '🏠', '🧒', '🎸', '🐾'];

  const shareCode = async () => {
    if (!active) return;
    try {
      await Share.share({
        message: `Doe mee in "${active.name}" op Huishoek! Gebruik deze code in de app: ${active.invite_code}`,
      });
    } catch {}
  };

  const confirmLeave = () => {
    Alert.alert('Huishouden verlaten?', `Je verlaat "${active.name}". Je kunt later opnieuw toetreden met de code.`,
      [{ text: 'Annuleer', style: 'cancel' },
       { text: 'Verlaten', style: 'destructive', onPress: () => leaveHousehold(active.id) }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={[type.h1, { marginBottom: 16 }]}>Huishouden</Text>

        {/* Actief huishouden */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginRight: 12 }}>{active?.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2]}>{active?.name}</Text>
              <Text style={[type.caption]}>{members.length} {members.length === 1 ? 'lid' : 'leden'}</Text>
            </View>
          </View>

          {/* Invite code */}
          <TouchableOpacity onPress={shareCode}
            style={{
              marginTop: 16, backgroundColor: colors.forest, borderRadius: radius.md,
              padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <View>
              <Text style={{ color: colors.ocherSoft, fontSize: 12, fontWeight: '600' }}>UITNODIGINGSCODE</Text>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 4, marginTop: 2 }}>
                {active?.invite_code}
              </Text>
            </View>
            <Icon name="share" size={22} color={colors.onDark} />
          </TouchableOpacity>
          <Text style={[type.caption, { marginTop: 8, textAlign: 'center' }]}>
            Deel deze code zodat anderen kunnen aansluiten.
          </Text>
        </Card>

        {/* Leden */}
        <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>LEDEN</Text>
        <Card style={{ marginBottom: 16, padding: 6 }}>
          {members.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
              <Avatar emoji={m.avatar_emoji} name={m.display_name} />
              <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '500', color: colors.ink }}>
                {m.display_name}{m.id === profile?.id ? '  (jij)' : ''}
              </Text>
              {m.role === 'owner' && (
                <View style={{ backgroundColor: colors.ocherSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.forest }}>Beheerder</Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* Groepen (subgroepen) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginLeft: 4, marginRight: 4 }}>
          <Text style={[type.label]}>GROEPEN</Text>
          <TouchableOpacity onPress={openNewSubgroup} hitSlop={10}>
            <Text style={{ color: colors.forest, fontWeight: '700' }}>+ Nieuw</Text>
          </TouchableOpacity>
        </View>
        <Card style={{ marginBottom: 16, padding: 6 }}>
          {subgroups.length === 0 ? (
            <Text style={[type.caption, { padding: 12 }]}>
              Nog geen groepen. Maak er een (bijv. "Ouders" of "Voetbal Tim") om taken
              met een vast clubje te delen in plaats van het hele huishouden.
            </Text>
          ) : subgroups.map((g) => {
            const names = (g.memberIds ?? [])
              .map((id) => members.find((m) => m.id === id)?.display_name?.split(' ')[0])
              .filter(Boolean).join(', ');
            return (
              <TouchableOpacity key={g.id} onPress={() => openEditSubgroup(g)}
                onLongPress={() => confirmDeleteSubgroup(g)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{g.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{g.name}</Text>
                  <Text style={[type.caption]} numberOfLines={1}>
                    {names || 'Geen leden'}
                  </Text>
                </View>
                <Icon name="forward" size={20} color={colors.inkFaint} />
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Modules: aan/uit per gebruiker, en (als owner) voor het huishouden */}
        <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>MIJN MODULES</Text>
        <Card style={{ marginBottom: 16, padding: 6 }}>
          {TOGGLEABLE_MODULES.map((m) => {
            const offForHousehold = householdDisabled.includes(m.key);
            const onForMe = !offForHousehold && !userDisabled.includes(m.key);
            return (
              <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <Text style={{ fontSize: 22, marginRight: 12, opacity: offForHousehold ? 0.4 : 1 }}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: offForHousehold ? colors.inkFaint : colors.ink }}>
                    {m.label}
                  </Text>
                  {offForHousehold && (
                    <Text style={[type.caption]}>Uitgezet voor het hele huishouden</Text>
                  )}
                </View>
                <Switch
                  value={onForMe}
                  disabled={offForHousehold}
                  onValueChange={(v) => toggleUserModule(m.key, v)}
                  trackColor={{ true: colors.forest }}
                />
              </View>
            );
          })}
          <Text style={[type.caption, { paddingHorizontal: 12, paddingBottom: 6, paddingTop: 2 }]}>
            Kies welke modules jij in de tabbalk ziet. Vandaag en Huishouden staan altijd aan.
          </Text>
        </Card>

        {isOwner && (
          <>
            <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>MODULES VOOR HET HUISHOUDEN</Text>
            <Card style={{ marginBottom: 16, padding: 6 }}>
              {TOGGLEABLE_MODULES.map((m) => (
                <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{m.emoji}</Text>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink }}>{m.label}</Text>
                  <Switch
                    value={!householdDisabled.includes(m.key)}
                    onValueChange={(v) => toggleHouseholdModule(m.key, v)}
                    trackColor={{ true: colors.forest }}
                  />
                </View>
              ))}
              <Text style={[type.caption, { paddingHorizontal: 12, paddingBottom: 6, paddingTop: 2 }]}>
                Als beheerder bepaal je welke modules beschikbaar zijn. Wat je hier uitzet,
                kan niemand in het huishouden voor zichzelf aanzetten.
              </Text>
            </Card>
          </>
        )}

        {/* Wisselen tussen huishoudens */}
        {households.length > 1 && (
          <>
            <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>WISSEL VAN HUISHOUDEN</Text>
            <Card style={{ marginBottom: 16, padding: 6 }}>
              {households.map((h) => (
                <TouchableOpacity key={h.id} onPress={() => selectHousehold(h.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{h.emoji}</Text>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.ink }}>{h.name}</Text>
                  {h.id === active?.id && <Icon name="check" size={20} color={colors.done} weight="bold" />}
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}

        <Button title="+ Nieuw of aansluiten bij huishouden" variant="soft"
          onPress={() => router.push('/onboarding')} style={{ marginBottom: 10 }} />
        <Button title="Huishouden verlaten" variant="ghost" onPress={confirmLeave}
          style={{ marginBottom: 24, borderColor: 'transparent' }} />

        {/* Profiel */}
        <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>JIJ</Text>
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={profile?.avatar_emoji} name={profile?.display_name} size={44} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[type.title]}>{profile?.display_name}</Text>
            </View>
          </View>
        </Card>
        <Button title="Uitloggen" variant="ghost" onPress={signOut} style={{ borderColor: 'transparent' }} />

        <Text style={[type.caption, { textAlign: 'center', marginTop: 24 }]}>Huishoek · v1.0</Text>
      </ScrollView>

      {/* Subgroep-editor */}
      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity onPress={() => setEditorOpen(false)} hitSlop={10}>
                <Text style={{ fontSize: 16, color: colors.inkSoft, fontWeight: '600' }}>Annuleer</Text>
              </TouchableOpacity>
              <Text style={[type.title]}>{editId ? 'Groep bewerken' : 'Nieuwe groep'}</Text>
              <TouchableOpacity onPress={saveSubgroup} hitSlop={10} disabled={sgBusy}>
                <Text style={{ fontSize: 16, color: colors.forest, fontWeight: '800' }}>Bewaar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
              {!editId && (
                <Field label="Naam van de groep" value={sgName} onChangeText={setSgName}
                  placeholder="Bijv. Ouders, Voetbal Tim" autoFocus />
              )}
              {editId && (
                <Text style={[type.h2, { marginBottom: 14 }]}>{sgEmoji} {sgName}</Text>
              )}

              {!editId && (
                <>
                  <Text style={[type.label, { marginBottom: 8 }]}>Icoon</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                    {sgEmojis.map((e) => (
                      <Text key={e} onPress={() => setSgEmoji(e)}
                        style={{
                          fontSize: 26, padding: 8, borderRadius: 12, overflow: 'hidden',
                          backgroundColor: sgEmoji === e ? colors.ocherSoft : colors.surfaceAlt,
                        }}>{e}</Text>
                    ))}
                  </View>
                </>
              )}

              <Text style={[type.label, { marginBottom: 8 }]}>Wie zit in deze groep?</Text>
              <Card style={{ padding: 6 }}>
                {members.map((m) => {
                  const on = sgMembers.includes(m.id);
                  return (
                    <TouchableOpacity key={m.id} onPress={() => toggleSgMember(m.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                      <Avatar emoji={m.avatar_emoji} name={m.display_name} />
                      <Text style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.ink }}>
                        {m.display_name}{m.id === profile?.id ? '  (jij)' : ''}
                      </Text>
                      <View style={{
                        width: 24, height: 24, borderRadius: 8, borderWidth: 2,
                        borderColor: on ? colors.forest : colors.inkFaint,
                        backgroundColor: on ? colors.forest : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && <Icon name="check" size={14} color={colors.onDark} weight="bold" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>

              {editId && (
                <Button title="Groep verwijderen" variant="ghost"
                  onPress={() => { setEditorOpen(false); confirmDeleteSubgroup({ id: editId, name: sgName }); }}
                  style={{ marginTop: 16, borderColor: 'transparent' }} />
              )}
              <Button title={editId ? 'Wijzigingen bewaren' : 'Groep aanmaken'}
                onPress={saveSubgroup} loading={sgBusy} style={{ marginTop: 12 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
