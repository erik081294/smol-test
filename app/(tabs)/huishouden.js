import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Platform, Modal, KeyboardAvoidingView, Switch } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import {
  Card, Button, Avatar, Field, Checkbox, Badge, EmojiPicker,
  ScreenHeader, SectionHeader, ItemRow, ModalHeader, IconButton,
} from '../../lib/ui';
import { Illustration } from '../../lib/illustrations';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { TOGGLEABLE_MODULES } from '../../lib/modules';
import { t, plural } from '../../lib/i18n';

export default function HuishoudenTab() {
  const dialog = useDialog();
  const { active, households, members, subgroups, selectHousehold, leaveHousehold,
          createSubgroup, updateSubgroupMembers, deleteSubgroup,
          householdDisabled, userDisabled, setHouseholdModule, setUserModule } = useHousehold();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const isOwner = active?.role === 'owner';

  const toggleHouseholdModule = (key, enabled) =>
    setHouseholdModule(key, enabled).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  const toggleUserModule = (key, enabled) =>
    setUserModule(key, enabled).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));

  // Subgroep-editor (inline modal)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState(null);          // null = nieuw
  const [sgName, setSgName] = useState('');
  const [sgEmoji, setSgEmoji] = useState('👥');
  const [sgMembers, setSgMembers] = useState([]);
  const [sgBusy, setSgBusy] = useState(false);
  const [sgErrors, setSgErrors] = useState({}); // { name, members } — inline i.p.v. Alert
  const clearSgErr = (key) => setSgErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const openNewSubgroup = () => {
    setEditId(null); setSgName(''); setSgEmoji('👥'); setSgMembers([]); setSgErrors({}); setEditorOpen(true);
  };
  const openEditSubgroup = (g) => {
    setEditId(g.id); setSgName(g.name); setSgEmoji(g.emoji);
    setSgMembers(g.memberIds ?? []); setSgErrors({}); setEditorOpen(true);
  };
  const toggleSgMember = (pid) => {
    clearSgErr('members');
    setSgMembers((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  };

  const saveSubgroup = async () => {
    const e = {};
    if (!sgName.trim()) e.name = t('household.subgroup.error.name');
    if (sgMembers.length === 0) e.members = t('household.subgroup.error.members');
    setSgErrors(e);
    if (Object.keys(e).length) return;
    setSgBusy(true);
    try {
      if (editId) await updateSubgroupMembers(editId, sgMembers);
      else await createSubgroup(sgName.trim(), sgEmoji, sgMembers);
      setEditorOpen(false);
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setSgBusy(false); }
  };

  const confirmDeleteSubgroup = async (g) => {
    if (await dialog.confirm({
      title: t('household.subgroup.delete.title'),
      body: t('household.subgroup.delete.body', { name: g.name }),
      confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), tone: 'danger',
    })) deleteSubgroup(g.id);
  };

  const sgEmojis = ['👥', '👩‍❤️‍👨', '⚽', '🎓', '🏠', '🧒', '🎸', '🐾'];

  const shareCode = async () => {
    if (!active) return;
    try {
      await Share.share({
        message: t('household.share.message', { name: active.name, code: active.invite_code }),
      });
    } catch {}
  };

  const confirmLeave = async () => {
    if (await dialog.confirm({
      title: t('household.leave.title'),
      body: t('household.leave.body', { name: active.name }),
      confirmLabel: t('household.leave.confirm'), cancelLabel: t('common.cancel'), tone: 'danger',
    })) leaveHousehold(active.id);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('household.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl }}>

        {/* Actief huishouden */}
        <Card style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginRight: space.md }}>{active?.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.h2}>{active?.name}</Text>
              <Text style={type.caption}>{plural(members.length, 'household.members.one', 'household.members.other')}</Text>
            </View>
          </View>

          {/* Invite code — branded hero, tikbaar om te delen */}
          <Pressable onPress={shareCode} accessibilityRole="button" accessibilityLabel={t('household.shareCode')}
            style={({ pressed }) => ({
              marginTop: space.lg, backgroundColor: pressed ? colors.forestSoft : colors.forest,
              borderRadius: radius.md, padding: space.md,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            })}>
            <View>
              <Text style={{ color: colors.ocherSoft, fontSize: 12, fontWeight: '600' }}>{t('household.inviteCode.label')}</Text>
              <Text style={{ color: colors.onDark, fontSize: 26, fontWeight: '800', letterSpacing: 4, marginTop: 2 }}>
                {active?.invite_code}
              </Text>
            </View>
            <Icon name="share" size={22} color={colors.onDark} />
          </Pressable>
          <Text style={[type.caption, { marginTop: space.sm, textAlign: 'center' }]}>
            {t('household.inviteCode.hint')}
          </Text>
        </Card>

        {/* Leden */}
        <SectionHeader title={t('household.section.members')} count={members.length} />
        {members.map((m) => (
          <ItemRow
            key={m.id}
            leading={<Avatar emoji={m.avatar_emoji} name={m.display_name} />}
            title={`${m.display_name}${m.id === profile?.id ? `  ${t('household.you')}` : ''}`}
            trailing={m.role === 'owner' ? <Badge label={t('household.role.owner')} tone="brand" /> : null}
          />
        ))}

        {/* Groepen (subgroepen) */}
        <SectionHeader title={t('household.section.groups')} count={subgroups.length}
          action={<IconButton icon="add" accessibilityLabel={t('household.subgroup.new')} tint={colors.forest} onPress={openNewSubgroup} />} />
        {subgroups.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <Illustration name="groups" size={96} />
            <Text style={[type.caption, { textAlign: 'center', marginTop: space.sm }]}>
              {t('household.groups.empty')}
            </Text>
          </View>
        ) : subgroups.map((g) => {
          const names = (g.memberIds ?? [])
            .map((id) => members.find((m) => m.id === id)?.display_name?.split(' ')[0])
            .filter(Boolean).join(', ');
          return (
            <ItemRow
              key={g.id}
              leading={<Avatar emoji={g.emoji} />}
              title={g.name}
              meta={<Text style={type.caption} numberOfLines={1}>{names || t('household.subgroup.noMembers')}</Text>}
              chevron
              onPress={() => openEditSubgroup(g)}
              accessibilityHint={t('household.tapToEdit')}
            />
          );
        })}

        {/* Modules: aan/uit per gebruiker */}
        <SectionHeader title={t('household.section.myModules')} />
        {TOGGLEABLE_MODULES.map((m) => {
          const offForHousehold = householdDisabled.includes(m.key);
          const onForMe = !offForHousehold && !userDisabled.includes(m.key);
          return (
            <ItemRow
              key={m.key}
              leading={<Icon name={m.icon} size={24} color={offForHousehold ? colors.inkFaint : colors.forest} />}
              title={m.label}
              titleColor={offForHousehold ? colors.inkFaint : undefined}
              meta={offForHousehold ? <Text style={type.caption}>{t('household.module.disabledByHousehold')}</Text> : undefined}
              trailing={
                <Switch value={onForMe} disabled={offForHousehold}
                  onValueChange={(v) => toggleUserModule(m.key, v)} trackColor={{ true: colors.forest }} />
              }
            />
          );
        })}
        <Text style={[type.caption, { marginTop: space.xs, marginBottom: space.lg }]}>
          {t('household.myModules.hint')}
        </Text>

        {isOwner && (
          <>
            <SectionHeader title={t('household.section.householdModules')} />
            {TOGGLEABLE_MODULES.map((m) => (
              <ItemRow
                key={m.key}
                leading={<Icon name={m.icon} size={24} color={colors.forest} />}
                title={m.label}
                trailing={
                  <Switch value={!householdDisabled.includes(m.key)}
                    onValueChange={(v) => toggleHouseholdModule(m.key, v)} trackColor={{ true: colors.forest }} />
                }
              />
            ))}
            <Text style={[type.caption, { marginTop: space.xs, marginBottom: space.lg }]}>
              {t('household.householdModules.hint')}
            </Text>
          </>
        )}

        {/* Wisselen tussen huishoudens */}
        {households.length > 1 && (
          <>
            <SectionHeader title={t('household.section.switch')} />
            {households.map((h) => (
              <ItemRow
                key={h.id}
                leading={<Avatar emoji={h.emoji} />}
                title={h.name}
                trailing={h.id === active?.id ? <Icon name="check" size={20} color={colors.done} weight="bold" /> : null}
                onPress={() => selectHousehold(h.id)}
              />
            ))}
          </>
        )}

        <Button title={t('household.newOrJoin')} icon="add" variant="soft"
          onPress={() => router.push('/onboarding')} style={{ marginTop: space.sm, marginBottom: space.sm }} />
        <Button title={t('household.leave.button')} variant="ghost" onPress={confirmLeave}
          style={{ marginBottom: space.xl, borderColor: 'transparent' }} />

        {/* Profiel */}
        <SectionHeader title={t('household.section.you')} />
        <Card style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={profile?.avatar_emoji} name={profile?.display_name} size={44} />
            <View style={{ marginLeft: space.md, flex: 1 }}>
              <Text style={type.title}>{profile?.display_name}</Text>
            </View>
          </View>
        </Card>
        <Button title={t('common.signOut')} icon="signout" variant="ghost" onPress={signOut} style={{ borderColor: 'transparent' }} />

        <Text style={[type.caption, { textAlign: 'center', marginTop: space.xl }]}>Huishoek · v1.0</Text>
      </ScrollView>

      {/* Subgroep-editor */}
      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ModalHeader
              title={editId ? t('household.subgroup.edit') : t('household.subgroup.new')}
              onClose={() => setEditorOpen(false)}
              onConfirm={saveSubgroup}
              busy={sgBusy}
            />
            <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
              {!editId ? (
                <Field label={t('household.subgroup.field.name')} value={sgName}
                  onChangeText={(v) => { setSgName(v); clearSgErr('name'); }}
                  placeholder={t('household.subgroup.field.name.placeholder')} autoFocus error={sgErrors.name} />
              ) : (
                <Text style={[type.h2, { marginBottom: space.md }]}>{sgEmoji} {sgName}</Text>
              )}

              {!editId && (
                <>
                  <Text style={[type.label, { marginBottom: space.sm }]}>{t('household.subgroup.icon')}</Text>
                  <EmojiPicker options={sgEmojis} value={sgEmoji} onChange={setSgEmoji} style={{ marginBottom: space.lg }} />
                </>
              )}

              <Text style={[type.label, { marginBottom: space.sm }]}>{t('household.subgroup.whoLabel')}</Text>
              {sgErrors.members ? (
                <Text style={[type.caption, { color: colors.danger, marginBottom: space.sm }]}>{sgErrors.members}</Text>
              ) : null}
              {members.map((m) => {
                const on = sgMembers.includes(m.id);
                return (
                  <ItemRow
                    key={m.id}
                    leading={<Avatar emoji={m.avatar_emoji} name={m.display_name} />}
                    title={`${m.display_name}${m.id === profile?.id ? `  ${t('household.you')}` : ''}`}
                    trailing={<Checkbox checked={on} onPress={() => toggleSgMember(m.id)}
                      accessibilityLabel={`${m.display_name}${on ? `, ${t('a11y.selected')}` : ''}`} />}
                    onPress={() => toggleSgMember(m.id)}
                  />
                );
              })}

              {editId && (
                <Button title={t('household.subgroup.deleteButton')} icon="delete" variant="ghost"
                  onPress={() => { setEditorOpen(false); confirmDeleteSubgroup({ id: editId, name: sgName }); }}
                  style={{ marginTop: space.lg, borderColor: 'transparent' }} />
              )}
              <Button title={editId ? t('common.saveChanges') : t('household.subgroup.create')}
                onPress={saveSubgroup} loading={sgBusy} style={{ marginTop: space.md }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
