import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { mutate } from '../../lib/db';
import { Field, Button, Chip, Avatar, ModalHeader } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type } from '../../lib/theme';
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
  const bumpWeight = (pid, d) =>
    setWeights((w) => ({ ...w, [pid]: Math.max(1, (w[pid] ?? 1) + d) }));

  const save = async () => {
    if (!description.trim()) { Alert.alert('Geef de uitgave een omschrijving'); return; }
    if (amountCents <= 0) { Alert.alert('Vul een geldig bedrag in'); return; }
    if (!paidBy) { Alert.alert('Kies wie betaald heeft'); return; }
    if (selected.length === 0) { Alert.alert('Kies minstens één deelnemer'); return; }
    if (splitType === SPLIT.EXACT && !exactSharesValid(amountCents, participants)) {
      Alert.alert('Bedragen kloppen niet', `Er moet nog ${formatCents(exactRemaining)} verdeeld worden.`);
      return;
    }
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) { Alert.alert('Delen met', visError); return; }

    setBusy(true);
    try {
      await addExpense({
        description: description.trim(), amountCents, paidBy, spentOn: null, splitType,
        participants, visibility, shareSubgroupId, shareWith,
      });
      router.back();
    } catch (e) {
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
        <View style={{ padding: 18 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Terug"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name="back" size={18} color={colors.forest} />
            <Text style={{ fontSize: 16, color: colors.forest }}>Terug</Text>
          </TouchableOpacity>
          <Text style={[type.h1, { marginTop: 12 }]}>{existing.description}</Text>
          <Text style={[type.h2, { color: colors.forest, marginTop: 4 }]}>{formatCents(existing.amount_cents)}</Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: 6 }]}>
            {nameOf(existing.paid_by)} betaalde · {format(parseISO(existing.spent_on), 'd MMMM yyyy', { locale: nl })}
          </Text>
          <Text style={[type.label, { marginTop: 18, marginBottom: 8 }]}>Verdeling</Text>
          {(existing.expense_shares ?? []).map((s) => (
            <View key={s.profile_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={[type.body]}>{nameOf(s.profile_id)}</Text>
              <Text style={[type.body]}>{formatCents(s.amount_cents)}</Text>
            </View>
          ))}
          <Button title="Verwijderen" variant="ghost" onPress={removeExisting} style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Nieuwe uitgave ----------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <ModalHeader title="Nieuwe uitgave" onClose={() => router.back()} />

          <Field label="Omschrijving" value={description} onChangeText={setDescription} placeholder="Boodschappen, etentje, ..." />
          <Field label="Bedrag (€)" value={amountText} onChangeText={setAmountText} placeholder="0,00" keyboardType="decimal-pad" />

          <Text style={[type.label, { marginBottom: 6 }]}>Betaald door</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {members.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setPaidBy(m.id)} style={{ alignItems: 'center', marginRight: 12, opacity: paidBy === m.id ? 1 : 0.45 }}>
                <Avatar emoji={m.avatar_emoji} name={m.display_name} />
                <Text style={[type.caption, { marginTop: 2 }]}>{m.display_name?.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[type.label, { marginBottom: 6 }]}>Splitsing</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            {Object.values(SPLIT).map((s) => (
              <Chip key={s} label={SPLIT_LABELS[s]} active={splitType === s} onPress={() => setSplitType(s)} />
            ))}
          </View>

          <Text style={[type.label, { marginBottom: 6 }]}>Deelnemers</Text>
          {members.map((m) => {
            const on = selected.includes(m.id);
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <TouchableOpacity onPress={() => toggleMember(m.id)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, marginRight: 10, borderWidth: 2,
                    borderColor: on ? colors.forest : colors.line, backgroundColor: on ? colors.forest : 'transparent',
                    alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Icon name="check" size={14} color={colors.onDark} weight="bold" />}
                  </View>
                  <Text style={[type.body]}>{m.avatar_emoji} {m.display_name}</Text>
                </TouchableOpacity>

                {on && splitType === SPLIT.EQUAL && (
                  <Text style={[type.body, { color: colors.inkSoft }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                )}
                {on && splitType === SPLIT.SHARES && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => bumpWeight(m.id, -1)} hitSlop={8}><Text style={{ fontSize: 20, color: colors.forest, width: 24, textAlign: 'center' }}>−</Text></TouchableOpacity>
                    <Text style={{ width: 22, textAlign: 'center' }}>{weights[m.id] ?? 1}</Text>
                    <TouchableOpacity onPress={() => bumpWeight(m.id, 1)} hitSlop={8}><Text style={{ fontSize: 20, color: colors.forest, width: 24, textAlign: 'center' }}>+</Text></TouchableOpacity>
                    <Text style={[type.caption, { width: 64, textAlign: 'right' }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                  </View>
                )}
                {on && splitType === SPLIT.EXACT && (
                  <TextInput value={exactText[m.id] ?? ''} onChangeText={(v) => setExactText((e) => ({ ...e, [m.id]: v }))}
                    placeholder="0,00" keyboardType="decimal-pad" placeholderTextColor={colors.inkFaint}
                    style={{ width: 80, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.sm,
                      paddingHorizontal: 8, paddingVertical: 6, textAlign: 'right', color: colors.ink }} />
                )}
              </View>
            );
          })}

          {splitType === SPLIT.EXACT && (
            <Text style={[type.caption, { marginTop: 8, color: exactRemaining === 0 ? colors.done : colors.danger }]}>
              {exactRemaining === 0 ? 'Bedragen kloppen' : `Nog te verdelen: ${formatCents(exactRemaining)}`}
            </Text>
          )}

          <View style={{ marginTop: 18 }}>
            <VisibilityPicker
              visibility={visibility} onChangeVisibility={setVisibility}
              shareSubgroupId={shareSubgroupId} onChangeSubgroup={setShareSubgroupId}
              shareWith={shareWith} onToggleMember={toggleShareWith}
              subgroups={subgroups} members={members} />
          </View>

          <Button title="Uitgave opslaan" onPress={save} loading={busy} style={{ marginTop: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
