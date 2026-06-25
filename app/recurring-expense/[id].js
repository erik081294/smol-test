import React, { useEffect, useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useRecurringExpenses } from '../../lib/useRecurringExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { ModalHeader, Field, Stepper, Button, Chip, Checkbox, Row, AvatarSelect, Editor, DateStepper } from '../../lib/ui';
import { colors, space, type } from '../../lib/theme';
import { parseAmountToCents, formatCents } from '../../lib/expenses';
import { success, error as hapticError } from '../../lib/haptics';
import { RECUR } from '../../lib/constants';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t } from '../../lib/i18n';

const FREQS = [RECUR.DAILY, RECUR.WEEKLY, RECUR.MONTHLY];

export default function RecurringExpenseEditor() {
  const dialog = useDialog();
  const { id, vehicle } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addTemplate, updateTemplate, removeTemplate } = useRecurringExpenses();
  const { members } = useHousehold();
  const { user } = useAuth();
  const toast = useToast();

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState(user?.id ?? null);
  const [participants, setParticipants] = useState(members.map((m) => m.id));
  const [freq, setFreq] = useState(RECUR.MONTHLY);
  const [interval, setIntervalN] = useState(1);
  const [startDate, setStartDate] = useState(new Date());
  const [active, setActive] = useState(true);
  // Optionele koppeling aan een voertuig (V3): meegegeven bij 'nieuw' vanaf de auto, of
  // geladen bij een bestaande vaste last. Zo telt het voertuig-kostenoverzicht 'm mee.
  const [vehicleId, setVehicleId] = useState(vehicle ?? null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) { setParticipants(members.map((m) => m.id)); return; }
    supabase.from('recurring_expenses').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { router.back(); return; }
      setDescription(data.description ?? '');
      setAmountText(data.amount_cents != null ? (data.amount_cents / 100).toFixed(2).replace('.', ',') : '');
      setPaidBy(data.paid_by);
      setParticipants((data.participants ?? []).map((p) => p.profile_id));
      setFreq(data.recur_freq);
      setIntervalN(data.recur_interval ?? 1);
      setStartDate(parseISO(data.next_date));
      setActive(data.active);
      setVehicleId(data.vehicle_id ?? null);
      setLoaded(true);
    });
  }, [id]);

  const toggleParticipant = (pid) =>
    setParticipants((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : [...p, pid]));

  const unitLabel = (n) => {
    if (freq === RECUR.DAILY) return n === 1 ? 'dag' : 'dagen';
    if (freq === RECUR.WEEKLY) return n === 1 ? 'week' : 'weken';
    return n === 1 ? 'maand' : 'maanden';
  };

  const save = async () => {
    const amountCents = parseAmountToCents(amountText);
    const next = {};
    if (!description.trim()) next.description = t('recurring.error.description');
    if (!amountCents || amountCents <= 0) next.amount = t('recurring.error.amount');
    if (participants.length === 0) next.participants = t('recurring.error.participants');
    setErrors(next);
    if (Object.keys(next).length) { hapticError(); return; }

    setBusy(true);
    const payload = {
      description: description.trim(),
      amount_cents: amountCents,
      paid_by: paidBy,
      split_type: 'equal',
      participants: participants.map((profile_id) => ({ profile_id })),
      recur_freq: freq,
      recur_interval: interval,
      next_date: format(startDate, 'yyyy-MM-dd'),
      active,
      vehicle_id: vehicleId ?? null,
    };
    try {
      if (isNew) await addTemplate(payload);
      else await updateTemplate(id, payload);
      success();
      router.back();
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); hapticError(); }
    finally { setBusy(false); }
  };

  // Verwijderen met ongedaan-maken — zelfde patroon als de taak-/uitgave-editor
  // (geen blokkerende Alert; undo is het vangnet en werkt óók op web).
  const confirmDelete = () => {
    markPending(id);
    router.back();
    toast.show({
      message: t('recurring.deleted', { name: description.trim() || t('recurring.delete') }),
      actionLabel: t('common.undo'),
      onAction: () => unmarkPending(id),
      onExpire: async () => {
        try { await removeTemplate(id); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { unmarkPending(id); }
      },
    });
  };

  if (!loaded) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ModalHeader title="" onClose={() => router.back()} /></SafeAreaView>;

  const amountCents = parseAmountToCents(amountText);
  const perPerson = amountCents && participants.length ? Math.round(amountCents / participants.length) : 0;

  return (
    <Editor
      title={isNew ? t('recurring.new') : t('recurring.edit')}
      onClose={() => router.back()} onConfirm={save} busy={busy}
      confirmLabel={t('common.save')} cancelLabel={t('common.cancelLong')}
    >
          <Field label={t('recurring.field.description')} value={description}
            onChangeText={(x) => { setDescription(x); setErrors((e) => ({ ...e, description: null })); }}
            placeholder={t('recurring.field.description.placeholder')} autoFocus={isNew} error={errors.description} />

          <Field label={t('recurring.field.amount')} value={amountText}
            onChangeText={(x) => { setAmountText(x); setErrors((e) => ({ ...e, amount: null })); }}
            placeholder="0,00" keyboardType="decimal-pad" error={errors.amount} />

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.paidBy')}</Text>
          <AvatarSelect members={members} selectedId={paidBy} onSelect={setPaidBy} style={{ marginBottom: space.lg }} />

          {/* Deelnemers — checkbox-rijen met het gelijke aandeel per persoon,
              gelijkgetrokken met de uitgave-editor. */}
          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recurring.field.participants')}</Text>
          {errors.participants ? <Text style={[type.caption, { color: colors.danger, marginBottom: space.xs }]}>{errors.participants}</Text> : null}
          {members.map((m) => {
            const on = participants.includes(m.id);
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
                borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Checkbox checked={on} onPress={() => { toggleParticipant(m.id); setErrors((e) => ({ ...e, participants: null })); }}
                  accessibilityLabel={m.display_name} />
                <Text style={[type.body, { flex: 1 }]}>{m.avatar_emoji} {m.display_name}</Text>
                {on && perPerson ? <Text style={[type.body, { color: colors.inkSoft }]}>{formatCents(perPerson)}</Text> : null}
              </View>
            );
          })}
          <View style={{ marginBottom: space.lg }} />

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recurring.field.freq')}</Text>
          <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
            {FREQS.map((f) => (
              <Chip key={f} label={t('recur.' + f + '.one')} active={freq === f} onPress={() => setFreq(f)} />
            ))}
          </Row>
          <Row gap={space.md} align="center" style={{ marginBottom: space.lg }}>
            <Text style={type.body}>{t('recurring.every')}</Text>
            <Stepper value={interval} onChange={setIntervalN} min={1} max={36} accessibilityLabel={t('recurring.every')} />
            <Text style={type.body}>{unitLabel(interval)}</Text>
          </Row>

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recurring.field.start')}</Text>
          <DateStepper date={startDate} onChange={setStartDate} style={{ marginBottom: space.lg }} />

          <Row justify="space-between" style={{ marginBottom: space.lg }}>
            <Text style={type.body}>{t('recurring.field.active')}</Text>
            <Switch value={active} onValueChange={setActive}
              trackColor={{ true: colors.done, false: colors.line }} thumbColor={colors.surface}
              accessibilityLabel={t('recurring.field.active')} />
          </Row>

          {!isNew ? (
            <Button title={t('recurring.delete')} variant="ghost" onPress={confirmDelete}
              style={{ borderColor: 'transparent' }} />
          ) : null}
    </Editor>
  );
}
