import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, addDays, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useReservations } from '../../lib/useResources';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { hasConflict, usageParticipants } from '../../lib/reservations';
import {
  ModalHeader, Field, Stepper, Button, ItemRow, IconButton, Row, Banner, Empty, SectionHeader, Chip, AvatarSelect,
} from '../../lib/ui';
import { colors, space, type, radius } from '../../lib/theme';
import { parseAmountToCents } from '../../lib/expenses';
import { success, error as hapticError } from '../../lib/haptics';
import { t } from '../../lib/i18n';

export default function ResourceDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { reservations, loading, addReservation, removeReservation } = useReservations(id);
  const { members } = useHousehold();
  const [resource, setResource] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    supabase.from('shared_resources').select('*').eq('id', id).single()
      .then(({ data }) => { if (!data) router.back(); else setResource(data); });
  }, [id]);

  const nameOf = (pid) => members.find((m) => m.id === pid)?.display_name ?? t('common.someone');

  if (!resource) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ModalHeader title="" onClose={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={resource.name} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        <Row gap={space.sm} style={{ marginBottom: space.md }}>
          <Button title={t('share.reserve')} icon="add" variant="accent" onPress={() => setReserving(true)} style={{ flex: 1 }} />
          <Button title={t('share.splitCost')} icon="expenses" variant="soft" onPress={() => setSplitting(true)} style={{ flex: 1 }} />
        </Row>

        <SectionHeader title={t('share.reservations')} count={reservations.length} />
        {reservations.length === 0 && !loading ? (
          <Empty icon="agenda" title={t('share.empty.reservations')} subtitle={t('share.empty.reservationsSub')} />
        ) : reservations.map((r) => (
          <ItemRow
            key={r.id}
            title={`${format(parseISO(r.starts_at), 'EEE d MMM HH:mm', { locale: nl })} – ${format(parseISO(r.ends_at), 'HH:mm', { locale: nl })}`}
            meta={
              <Text style={type.caption}>
                {nameOf(r.profile_id)}{r.usage_value ? ` · ${r.usage_value} km` : ''}{r.note ? ` · ${r.note}` : ''}
                {r.expense_id ? ` · ${t('share.reservation.billed')}` : ''}
              </Text>
            }
            trailing={<IconButton icon="delete" size={18} tint={colors.inkFaint}
              accessibilityLabel={t('common.delete')} onPress={() => removeReservation(r.id)} />}
          />
        ))}
        <View style={{ height: space.xxl }} />
      </ScrollView>

      <ReserveModal visible={reserving} onClose={() => setReserving(false)} reservations={reservations} onAdd={addReservation} />
      <SplitModal visible={splitting} onClose={() => setSplitting(false)} resource={resource}
        reservations={reservations} members={members} />
    </SafeAreaView>
  );
}

// Nieuwe reservering: dag + van/tot uur + km + notitie, met dubbelboek-waarschuwing.
function ReserveModal({ visible, onClose, reservations, onAdd }) {
  const [day, setDay] = useState(new Date());
  const [fromH, setFromH] = useState(9);
  const [toH, setToH] = useState(17);
  const [note, setNote] = useState('');
  const [km, setKm] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { if (visible) { setDay(new Date()); setFromH(9); setToH(17); setNote(''); setKm(''); } }, [visible]);

  const mk = (h) => { const d = new Date(day); d.setHours(h, 0, 0, 0); return d; };
  const startsAt = mk(fromH), endsAt = mk(toH);
  const timeError = endsAt <= startsAt;
  const candidate = { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
  const conflict = !timeError && hasConflict(candidate, reservations);

  const save = async () => {
    if (timeError) return;
    setBusy(true);
    try {
      await onAdd({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), note: note.trim() || null, usageValue: km.trim() ? Number(km.replace(',', '.')) : null });
      success(); onClose();
    } catch (e) { Alert.alert(t('common.failed'), e.message); hapticError(); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '90%' }}>
          <ModalHeader title={t('share.reserve')} onClose={onClose} onConfirm={save} busy={busy}
            confirmLabel={t('common.add')} cancelLabel={t('common.cancelLong')} />
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('share.reservation.day')}</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line,
              padding: space.xs, marginBottom: space.lg,
            }}>
              <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('task.date.prev')} onPress={() => setDay((d) => addDays(d, -1))} />
              <Text style={[type.title, { fontWeight: '700' }]}>{format(day, 'EEEE d MMMM', { locale: nl })}</Text>
              <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('task.date.next')} onPress={() => setDay((d) => addDays(d, 1))} />
            </View>

            <Row gap={space.xl} style={{ marginBottom: space.md }}>
              <View>
                <Text style={[type.label, { marginBottom: space.xs }]}>{t('share.reservation.from')}</Text>
                <Stepper value={fromH} onChange={setFromH} min={0} max={23} formatValue={(h) => `${h}:00`} accessibilityLabel={t('share.reservation.from')} />
              </View>
              <View>
                <Text style={[type.label, { marginBottom: space.xs }]}>{t('share.reservation.to')}</Text>
                <Stepper value={toH} onChange={setToH} min={0} max={23} formatValue={(h) => `${h}:00`} accessibilityLabel={t('share.reservation.to')} />
              </View>
            </Row>
            {timeError ? <Text style={[type.caption, { color: colors.danger, marginBottom: space.sm }]}>{t('share.reservation.timeError')}</Text> : null}
            {conflict ? <Banner tone="warning" style={{ marginBottom: space.md }}>{t('share.reservation.conflict')}</Banner> : null}

            <Field label={t('share.reservation.km')} value={km} onChangeText={setKm} placeholder="0" keyboardType="numeric" />
            <Field label={t('share.reservation.note')} value={note} onChangeText={setNote} placeholder={t('share.reservation.note')} />
            <View style={{ height: space.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// AUT-2: kosten verdelen over de reserveerders — gelijk of naar gebruik (km).
function SplitModal({ visible, onClose, resource, reservations, members }) {
  const { addExpense } = useExpenses();
  const { user } = useAuth();
  const toast = useToast();
  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState('usage');     // 'usage' | 'equal'
  const [paidBy, setPaidBy] = useState(user?.id ?? null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => { if (visible) { setAmountText(''); setMode('usage'); setPaidBy(user?.id ?? null); } }, [visible, user]);

  const usage = useMemo(() => usageParticipants(reservations), [reservations]);
  const reservers = useMemo(() => [...new Set(reservations.map((r) => r.profile_id))], [reservations]);
  // 'naar gebruik' kan alleen als er km-data is; anders gelijk.
  const effectiveMode = mode === 'usage' && usage.length > 0 ? 'usage' : 'equal';
  const participants = effectiveMode === 'usage'
    ? usage
    : reservers.map((profileId) => ({ profileId }));
  const amountCents = parseAmountToCents(amountText);
  const canSave = amountCents > 0 && participants.length > 0;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await addExpense({
        description: t('share.split.description', { name: resource.name }),
        amountCents,
        paidBy,
        splitType: effectiveMode === 'usage' ? 'shares' : 'equal',
        participants,
        visibility: resource.visibility,
        shareSubgroupId: resource.share_subgroup_id,
        shareWith: resource.share_with,
        sourceType: 'reservation',
        sourceId: resource.id,
      });
      success();
      toast.show({ message: t('share.split.done') });
      onClose();
    } catch (e) { Alert.alert(t('common.failed'), e.message); hapticError(); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '90%' }}>
          <ModalHeader title={t('share.splitCost')} onClose={onClose} onConfirm={save} busy={busy}
            confirmLabel={t('common.save')} cancelLabel={t('common.cancelLong')} />
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            {reservers.length === 0 ? (
              <Banner tone="info">{t('share.split.noReservers')}</Banner>
            ) : (
              <>
                <Field label={t('share.split.amount')} value={amountText} onChangeText={setAmountText}
                  placeholder="0,00" keyboardType="decimal-pad" autoFocus />
                <Text style={[type.label, { marginBottom: space.xs }]}>{t('share.split.how')}</Text>
                <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
                  <Chip label={t('share.split.usage')} active={effectiveMode === 'usage'} onPress={() => setMode('usage')} />
                  <Chip label={t('share.split.equal')} active={effectiveMode === 'equal'} onPress={() => setMode('equal')} />
                </Row>
                {mode === 'usage' && usage.length === 0 ? (
                  <Text style={[type.caption, { marginBottom: space.md }]}>{t('share.split.noUsage')}</Text>
                ) : null}
                <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.paidBy')}</Text>
                <AvatarSelect members={members} selectedId={paidBy} onSelect={setPaidBy} style={{ marginBottom: space.lg }} />
              </>
            )}
            <View style={{ height: space.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
