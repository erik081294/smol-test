import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Platform, Modal, KeyboardAvoidingView, Switch } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import {
  Card, Button, Avatar, Field, Checkbox, Badge, EmojiPicker,
  ScreenHeader, SectionHeader, ItemRow, ModalHeader, IconButton,
} from '../../lib/ui';
import { Illustration } from '../../lib/illustrations';
import { Icon } from '../../lib/icons';
import { colors, type, space } from '../../lib/theme';
import { TOGGLEABLE_MODULES } from '../../lib/modules';
import { inviteUrl, inviteStatus, hoursUntilExpiry, WEB_BASE_URL } from '../../lib/invites';
import { t, plural } from '../../lib/i18n';

export default function HuishoudenTab() {
  const dialog = useDialog();
  const { active, households, members, subgroups, selectHousehold, leaveHousehold,
          createSubgroup, updateSubgroupMembers, deleteSubgroup,
          invites, createInvite, revokeInvite,
          householdDisabled, userDisabled, setHouseholdModule, setUserModule } = useHousehold();
  const { profile, signOut } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const isOwner = active?.role === 'owner';

  // FND-5: actief huishouden wisselen. De datalaag herlaadt reactief (useCollection
  // her-sleutelt op activeId, realtime her-subscribet); hier alleen feedback + een
  // no-op-guard zodat opnieuw tikken op het actieve huishouden niets doet.
  const switchHousehold = (h) => {
    if (h.id === active?.id) return;
    selectHousehold(h.id);
    toast.show({ message: t('household.switched', { name: h.name }) });
  };

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

  // --- Uitnodigen (PLT-7) ----------------------------------------------------
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  // Op web wijst de link naar de huidige origin; op native naar de gehoste web-app.
  const inviteBase = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_BASE_URL;

  const openInvite = () => { setInviteRole('member'); setCreatedInvite(null); setInviteOpen(true); };

  const generateInvite = async () => {
    setInviteBusy(true);
    try { setCreatedInvite(await createInvite(inviteRole)); }
    catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setInviteBusy(false); }
  };

  const shareInvite = async () => {
    if (!createdInvite) return;
    const url = inviteUrl(createdInvite.token, inviteBase);
    try {
      await Share.share({
        message: t('invite.share.message', {
          inviter: profile?.display_name ?? t('common.someone'),
          household: active?.name, url,
        }),
      });
    } catch {}
  };

  const confirmRevoke = async (inv) => {
    if (await dialog.confirm({
      title: t('invite.revoke.confirm.title'),
      body: t('invite.revoke.confirm.body'),
      confirmLabel: t('invite.revoke'), cancelLabel: t('common.cancel'), tone: 'danger',
    })) revokeInvite(inv.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
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

          {/* Uitnodigen (PLT-7): een persoonlijke, 24u geldige link i.p.v. een statische
              code. Alleen de beheerder kan uitnodigen (RPC dwingt het ook af). */}
          {isOwner ? (
            <>
              <Button title={t('invite.new')} icon="add" onPress={openInvite} style={{ marginTop: space.lg }} />
              <Text style={[type.caption, { marginTop: space.sm, textAlign: 'center' }]}>
                {t('invite.hint')}
              </Text>
            </>
          ) : null}
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

        {/* Openstaande uitnodigingen (PLT-7) — beheerder ziet + trekt ze per stuk in. */}
        {isOwner && invites.length > 0 && (
          <>
            <SectionHeader title={t('invite.pending.title')} count={invites.length} />
            {invites.map((inv) => {
              const expired = inviteStatus(inv) === 'expired';
              const hoursLeft = hoursUntilExpiry(inv);
              return (
                <ItemRow
                  key={inv.id}
                  leading={<Avatar emoji="📨" />}
                  title={inv.role === 'owner' ? t('invite.role.owner') : t('invite.role.member')}
                  meta={<Text style={[type.caption, expired && { color: colors.danger }]}>
                    {expired ? t('invite.expired') : t('invite.expiresInHours', { h: hoursLeft })}
                  </Text>}
                  trailing={<IconButton icon="delete" accessibilityLabel={t('invite.revoke')}
                    tint={colors.danger} onPress={() => confirmRevoke(inv)} />}
                />
              );
            })}
          </>
        )}

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
                onPress={() => switchHousehold(h)}
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

      {/* Uitnodigen (PLT-7): rol vooraf → persoonlijke 24u-link → delen via OS-sharesheet. */}
      <Modal visible={inviteOpen} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setInviteOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <ModalHeader title={t('invite.title')} onClose={() => setInviteOpen(false)} />
          <ScrollView contentContainerStyle={{ padding: space.lg }}>
            {!createdInvite ? (
              <>
                <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.lg }]}>{t('invite.intro')}</Text>
                <Text style={[type.label, { marginBottom: space.sm }]}>{t('invite.role.label')}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.lg }}>
                  <Button title={t('invite.role.member')} variant={inviteRole === 'member' ? 'primary' : 'soft'}
                    onPress={() => setInviteRole('member')} style={{ flex: 1 }} />
                  <Button title={t('invite.role.owner')} variant={inviteRole === 'owner' ? 'primary' : 'soft'}
                    onPress={() => setInviteRole('owner')} style={{ flex: 1 }} />
                </View>
                <Text style={[type.caption, { marginBottom: space.lg }]}>
                  {inviteRole === 'owner' ? t('invite.role.owner.hint') : t('invite.role.member.hint')}
                </Text>
                <Button title={t('invite.create')} onPress={generateInvite} loading={inviteBusy} />
              </>
            ) : (
              <>
                <Card>
                  <Text style={[type.label, { color: colors.inkFaint }]}>{t('invite.link.label')}</Text>
                  <Text selectable style={[type.body, { color: colors.forest, marginTop: space.xs }]}>
                    {inviteUrl(createdInvite.token, inviteBase)}
                  </Text>
                  <Text style={[type.caption, { marginTop: space.sm }]}>{t('invite.link.hint')}</Text>
                </Card>
                <Button title={t('invite.share')} icon="share" onPress={shareInvite} style={{ marginTop: space.lg }} />
                <Button title={t('invite.another')} variant="soft" onPress={() => setCreatedInvite(null)}
                  style={{ marginTop: space.sm }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
