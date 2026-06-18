import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { mutate } from '../../lib/db';
import { Field, Button, Chip, Checkbox, Stepper, Row, AvatarSelect, ModalHeader } from '../../lib/ui';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { validateVisibility } from '../../lib/visibility';
import {
  SPLIT, computeShares, exactSharesValid, formatCents, parseAmountToCents,
} from '../../lib/expenses';

const SPLIT_LABELS = { [SPLIT.EQUAL]: 'Gelijk', [SPLIT.SHARES]: 'Op aandeel', [SPLIT.EXACT]: 'Exact bedrag' };

export default function ExpenseEditor() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addExpense } = useExpenses();
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();

  // ----- Bestaande uitgave: laden en read-only tonen -----
  const [existing, setExisting] = useState(null);
  useEffect(() => {
    if (isNew) return;
    supabase.from('expenses').select('*, expense_shares(profile_id, amount_cents)').eq('id', id).single()
      .then(({ data }) => { if (!data) router.back(); else setExisting(data); });
  }, [id]);

  // ----- Nieuwe uitgave: formulier -----
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState(user?.id ?? null);
  const [selected, setSelected] = useState(members.map((m) => m.id));
  const [splitType, setSplitType] = useState(SPLIT.EQUAL);
  const [weights, setWeights] = useState({}); // { id: number } voor 'shares'
  const [exactText, setExactText] = useState({}); // { id: '12,50' } voor 'exact'
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // inline validatie i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // Selecteer standaard alle leden zodra ze geladen zijn.
  useEffect(() => {
    if (isNew && members.length && selected.length === 0) setSelected(members.map((m) => m.id));
  }, [members.length]);

  const amountCents = parseAmountToCents(amountText) ?? 0;

  const participants = useMemo(() => selected.map((pid) => {
    if (splitType === SPLIT.SHARES) return { profileId: pid, weight: weights[pid] ?? 1 };
    if (splitType === SPLIT.EXACT) return { profileId: pid, amountCents: parseAmountToCents(exactText[pid]) ?? 0 };
    return { profileId: pid };
  }), [selected, splitType, weights, exactText]);

  const preview = useMemo(
    () => computeShares({ amountCents, splitType, participants }),
    [amountCents, splitType, participants]
  );
  const exactRemaining = amountCents - participants.reduce((a, p) => a + (p.amountCents ?? 0), 0);

  const toggleMember = (pid) =>
    setSelected((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  const toggleShareWith = (pid) =>
    setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  const save = async () => {
    const e = {};
    if (!description.trim()) e.description = 'Geef de uitgave een omschrijving';
    if (amountCents <= 0) e.amount = 'Vul een geldig bedrag in';
    if (!paidBy) e.paidBy = 'Kies wie betaald heeft';
    if (selected.length === 0) e.participants = 'Kies minstens één deelnemer';
    if (splitType === SPLIT.EXACT && !exactSharesValid(amountCents, participants)) {
      e.exact = `Er moet nog ${formatCents(exactRemaining)} verdeeld worden.`;
    }
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) e.visibility = visError;
    setErrors(e);
    if (Object.keys(e).length) { haptics.error(); return; }

    setBusy(true);
    try {
      await addExpense({
        description: description.trim(), amountCents, paidBy, spentOn: null, splitType,
        participants, visibility, shareSubgroupId, shareWith,
      });
      haptics.success();
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert('Kon uitgave niet opslaan', e.message);
    } finally { setBusy(false); }
  };

  const removeExisting = () => {
    Alert.alert('Uitgave verwijderen?', 'Dit kan niet ongedaan worden gemaakt.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijder', style: 'destructive', onPress: async () => {
        await mutate(supabase.from('expenses').delete().eq('id', id), { context: 'uitgave verwijderen' });
        router.back();
      } },
    ]);
  };

  // ---------- Read-only weergave bestaande uitgave ----------
  if (!isNew) {
    if (!existing) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const nameOf = (pid) => members.find((m) => m.id === pid)?.display_name ?? 'Iemand';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <ModalHeader title={existing.description} onClose={() => router.back()} />
          <Text style={[type.h2, { color: colors.forest }]}>{formatCents(existing.amount_cents)}</Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: space.xs }]}>
            {nameOf(existing.paid_by)} betaalde · {format(parseISO(existing.spent_on), 'd MMMM yyyy', { locale: nl })}
          </Text>
          <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>Verdeling</Text>
          {(existing.expense_shares ?? []).map((s) => (
            <Row key={s.profile_id} justify="space-between" style={{ paddingVertical: space.xs }}>
              <Text style={type.body}>{nameOf(s.profile_id)}</Text>
              <Text style={type.body}>{formatCents(s.amount_cents)}</Text>
            </Row>
          ))}
          <Button title="Verwijderen" icon="delete" variant="ghost" onPress={removeExisting} style={{ marginTop: space.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Nieuwe uitgave ----------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
          <ModalHeader title="Nieuwe uitgave" onClose={() => router.back()} />

          <Field label="Omschrijving" value={description}
            onChangeText={(v) => { setDescription(v); clearErr('description'); }}
            placeholder="Boodschappen, etentje, ..." error={errors.description} />
          <Field label="Bedrag (€)" value={amountText}
            onChangeText={(v) => { setAmountText(v); clearErr('amount'); }}
            placeholder="0,00" keyboardType="decimal-pad" error={errors.amount} />

          <Text style={[type.label, { marginBottom: space.xs }]}>Betaald door</Text>
          <AvatarSelect members={members} selectedId={paidBy}
            onSelect={(id) => { setPaidBy(id); clearErr('paidBy'); }} style={{ marginBottom: space.md }} />
          {errors.paidBy ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.paidBy}</Text>
          ) : null}

          <Text style={[type.label, { marginBottom: space.xs }]}>Splitsing</Text>
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            {Object.values(SPLIT).map((s) => (
              <Chip key={s} label={SPLIT_LABELS[s]} active={splitType === s} onPress={() => setSplitType(s)} />
            ))}
          </View>

          <Text style={[type.label, { marginBottom: space.xs }]}>Deelnemers</Text>
          {errors.participants ? (
            <Text style={[type.caption, { color: colors.danger, marginBottom: space.xs }]}>{errors.participants}</Text>
          ) : null}
          {members.map((m) => {
            const on = selected.includes(m.id);
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
                borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Checkbox checked={on} onPress={() => { toggleMember(m.id); clearErr('participants'); }}
                  accessibilityLabel={`${m.display_name}${on ? ', deelnemer' : ''}`} />
                <Text style={[type.body, { flex: 1 }]}>{m.avatar_emoji} {m.display_name}</Text>

                {on && splitType === SPLIT.EQUAL && (
                  <Text style={[type.body, { color: colors.inkSoft }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                )}
                {on && splitType === SPLIT.SHARES && (
                  <Row gap={space.sm}>
                    <Stepper value={weights[m.id] ?? 1} onChange={(v) => setWeights((w) => ({ ...w, [m.id]: v }))}
                      min={1} accessibilityLabel={`Aandeel ${m.display_name}`} />
                    <Text style={[type.caption, { width: 60, textAlign: 'right' }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                  </Row>
                )}
                {on && splitType === SPLIT.EXACT && (
                  <TextInput value={exactText[m.id] ?? ''} onChangeText={(v) => setExactText((e) => ({ ...e, [m.id]: v }))}
                    placeholder="0,00" keyboardType="decimal-pad" placeholderTextColor={colors.inkFaint}
                    style={{ width: 80, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.sm,
                      paddingHorizontal: space.sm, paddingVertical: space.xs, textAlign: 'right', color: colors.ink }} />
                )}
              </View>
            );
          })}

          {splitType === SPLIT.EXACT && (
            <Text style={[type.caption, { marginTop: space.sm, color: exactRemaining === 0 ? colors.done : colors.danger }]}>
              {exactRemaining === 0 ? 'Bedragen kloppen' : `Nog te verdelen: ${formatCents(exactRemaining)}`}
            </Text>
          )}

          <View style={{ marginTop: space.lg }}>
            <VisibilityPicker
              visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
              shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
              shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
              subgroups={subgroups} members={members} />
            {errors.visibility ? (
              <Text style={[type.caption, { color: colors.danger, marginTop: space.xs }]}>{errors.visibility}</Text>
            ) : null}
          </View>

          <Button title="Uitgave opslaan" onPress={save} loading={busy} style={{ marginTop: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
