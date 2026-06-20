import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Field, Button, Chip, Checkbox, Stepper, Row, AvatarSelect, ModalHeader, Editor } from '../../lib/ui';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY, EXPENSE_CATEGORIES } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { validateVisibility } from '../../lib/visibility';
import {
  SPLIT, computeShares, exactSharesValid, formatCents, parseAmountToCents,
} from '../../lib/expenses';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t, dateLocale } from '../../lib/i18n';

const SPLIT_LABELS = {
  [SPLIT.EQUAL]: 'expense.split.equal',
  [SPLIT.SHARES]: 'expense.split.shares',
  [SPLIT.EXACT]: 'expense.split.exact',
};

export default function ExpenseEditor() {
  const { id, prefillDescription, prefillAmount, sourceType, sourceId } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addExpense, deleteExpense } = useExpenses();
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
  // Voorvullen vanuit een bron (KOS-3): bv. "Splitsen met huishouden" vanaf een bon.
  const [description, setDescription] = useState(prefillDescription ?? '');
  const [amountText, setAmountText] = useState(prefillAmount ?? '');
  // Zinnige default-categorie op basis van de bron (bon → boodschappen, reservering → vervoer).
  const [category, setCategory] = useState(
    sourceType === 'purchase' ? 'boodschappen' : sourceType === 'reservation' ? 'vervoer' : 'overig'
  );
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
    if (!description.trim()) e.description = t('expense.error.description');
    if (amountCents <= 0) e.amount = t('expense.error.amount');
    if (!paidBy) e.paidBy = t('expense.error.paidBy');
    if (selected.length === 0) e.participants = t('expense.error.participants');
    if (splitType === SPLIT.EXACT && !exactSharesValid(amountCents, participants)) {
      e.exact = t('expense.error.exact', { amount: formatCents(exactRemaining) });
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
        sourceType: sourceType ?? null, sourceId: sourceId ?? null, category,
      });
      haptics.success();
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert(t('expense.error.save'), e.message);
    } finally { setBusy(false); }
  };

  // Verwijderen met ongedaan-maken (zelfde patroon als de taak-editor): de uitgave
  // verdwijnt meteen uit het overzicht, de echte delete volgt pas bij het verlopen
  // van de toast. Geen blokkerende Alert — undo is het vangnet en werkt óók op web.
  const removeExisting = () => {
    markPending(id);
    router.back();
    toast.show({
      message: t('expense.deleted', { name: existing?.description ?? t('common.remove') }),
      actionLabel: t('common.undo'),
      onAction: () => unmarkPending(id),
      onExpire: async () => {
        try { await deleteExpense(id); }
        catch (e) { Alert.alert(t('common.failed'), e.message); }
        finally { unmarkPending(id); }
      },
    });
  };

  // ---------- Read-only weergave bestaande uitgave ----------
  if (!isNew) {
    if (!existing) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const nameOf = (pid) => members.find((m) => m.id === pid)?.display_name ?? t('common.someone');
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <ModalHeader title={existing.description} onClose={() => router.back()} />
          <Text style={[type.h2, { color: colors.forest }]}>{formatCents(existing.amount_cents)}</Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: space.xs }]}>
            {t('expenses.row.paid', { name: nameOf(existing.paid_by) })} · {format(parseISO(existing.spent_on), 'd MMMM yyyy', { locale: dateLocale() })}
          </Text>
          <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>{t('expense.detail.split')}</Text>
          {(existing.expense_shares ?? []).map((s) => (
            <Row key={s.profile_id} justify="space-between" style={{ paddingVertical: space.xs }}>
              <Text style={type.body}>{nameOf(s.profile_id)}</Text>
              <Text style={type.body}>{formatCents(s.amount_cents)}</Text>
            </Row>
          ))}
          <Button title={t('common.remove')} icon="delete" variant="ghost" onPress={removeExisting} style={{ marginTop: space.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Nieuwe uitgave ----------
  return (
    <Editor title={t('expense.new')} onClose={() => router.back()} onConfirm={save} busy={busy}>
          <Field label={t('expense.field.description')} value={description}
            onChangeText={(v) => { setDescription(v); clearErr('description'); }}
            placeholder={t('expense.field.description.placeholder')} error={errors.description} />
          <Field label={t('expense.field.amount')} value={amountText}
            onChangeText={(v) => { setAmountText(v); clearErr('amount'); }}
            placeholder="0,00" keyboardType="decimal-pad" error={errors.amount} />

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.category')}</Text>
          <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} label={t('category.' + c)} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </Row>

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.paidBy')}</Text>
          <AvatarSelect members={members} selectedId={paidBy}
            onSelect={(id) => { setPaidBy(id); clearErr('paidBy'); }} style={{ marginBottom: space.md }} />
          {errors.paidBy ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.paidBy}</Text>
          ) : null}

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.split')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            {Object.values(SPLIT).map((s) => (
              <Chip key={s} label={t(SPLIT_LABELS[s])} active={splitType === s} onPress={() => setSplitType(s)} />
            ))}
          </View>

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.participants')}</Text>
          {errors.participants ? (
            <Text style={[type.caption, { color: colors.danger, marginBottom: space.xs }]}>{errors.participants}</Text>
          ) : null}
          {members.map((m) => {
            const on = selected.includes(m.id);
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
                borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <Checkbox checked={on} onPress={() => { toggleMember(m.id); clearErr('participants'); }}
                  accessibilityLabel={`${m.display_name}${on ? t('expense.a11y.participant') : ''}`} />
                <Text style={[type.body, { flex: 1 }]}>{m.avatar_emoji} {m.display_name}</Text>

                {on && splitType === SPLIT.EQUAL && (
                  <Text style={[type.body, { color: colors.inkSoft }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                )}
                {on && splitType === SPLIT.SHARES && (
                  <Row gap={space.sm}>
                    <Stepper value={weights[m.id] ?? 1} onChange={(v) => setWeights((w) => ({ ...w, [m.id]: v }))}
                      min={1} accessibilityLabel={t('expense.a11y.share', { name: m.display_name })} />
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
              {exactRemaining === 0 ? t('expense.exact.balanced') : t('expense.exact.remaining', { amount: formatCents(exactRemaining) })}
            </Text>
          )}

          <View style={{ marginTop: space.lg }}>
            <VisibilityPicker
              collapsible
              visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
              shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
              shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
              subgroups={subgroups} members={members} />
            {errors.visibility ? (
              <Text style={[type.caption, { color: colors.danger, marginTop: space.xs }]}>{errors.visibility}</Text>
            ) : null}
          </View>
    </Editor>
  );
}
