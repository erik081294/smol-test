import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useResources } from '../../lib/useResources';
import { useHousehold } from '../../lib/household';
import { Empty, ScreenHeader, ItemRow, ListSkeleton, FAB, Field, Chip, Row, Badge, ModalHeader } from '../../lib/ui';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { colors, space, type } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { validateVisibility } from '../../lib/visibility';
import { t } from '../../lib/i18n';

const KINDS = ['auto', 'gereedschap', 'overig'];

export default function Delen() {
  const { resources, loading, reload, addResource } = useResources();
  const { members, subgroups } = useHousehold();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('share.title')} subtitle={t('share.subtitle')} />
      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: 96 }}
        data={resources}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <ItemRow
            title={item.name}
            meta={<Badge label={t('share.kind.' + item.kind)} tone="brand" />}
            chevron
            onPress={() => router.push(`/resource/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          loading && resources.length === 0 ? <ListSkeleton count={4} />
            : !loading ? (
              <Empty icon="share" title={t('share.empty.title')} subtitle={t('share.empty.subtitle')}
                actionTitle={t('share.add')} onAction={() => setAdding(true)} />
            ) : null
        }
      />
      <FAB label={t('fab.share')} accessibilityLabel={t('share.add')} onPress={() => setAdding(true)} />
      <AddResourceModal
        visible={adding} onClose={() => setAdding(false)}
        onAdd={addResource} members={members} subgroups={subgroups}
      />
    </SafeAreaView>
  );
}

function AddResourceModal({ visible, onClose, onAdd, members, subgroups }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('auto');
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (visible) { setName(''); setKind('auto'); setVisibility(VISIBILITY.HOUSEHOLD); setShareSubgroupId(null); setShareWith([]); }
  }, [visible]);

  const toggleMember = (pid) => setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  const save = async () => {
    if (!name.trim()) return;
    const visErr = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visErr) { Alert.alert(t('share.title'), visErr); return; }
    setBusy(true);
    try { await onAdd({ name, kind, visibility, shareSubgroupId, shareWith }); onClose(); }
    catch (e) { Alert.alert(t('common.failed'), e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%' }}>
          <ModalHeader title={t('share.add')} onClose={onClose} onConfirm={save} busy={busy}
            confirmLabel={t('common.add')} cancelLabel={t('common.cancelLong')} />
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Field label={t('share.field.name')} value={name} onChangeText={setName}
              placeholder={t('share.field.name.placeholder')} autoFocus />
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('share.field.kind')}</Text>
            <Row gap={space.xs} wrap style={{ marginBottom: space.lg }}>
              {KINDS.map((k) => <Chip key={k} label={t('share.kind.' + k)} active={kind === k} onPress={() => setKind(k)} />)}
            </Row>
            <VisibilityPicker
              visibility={visibility} onChangeVisibility={setVisibility}
              shareSubgroupId={shareSubgroupId} onChangeSubgroup={setShareSubgroupId}
              shareWith={shareWith} onToggleMember={toggleMember}
              subgroups={subgroups} members={members}
            />
            <View style={{ height: space.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
