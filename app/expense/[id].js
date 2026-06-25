import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { useExpenses } from '../../lib/useExpenses';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Field, Button, Chip, Checkbox, Stepper, Row, AvatarSelect, Editor, DateStepper } from '../../lib/ui';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY, EXPENSE_CATEGORIES } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { validateVisibility } from '../../lib/visibility';
import {
  SPLIT, computeShares, exactSharesValid, formatCents, parseAmountToCents,
} from '../../lib/expenses';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t } from '../../lib/i18n';

const SPLIT_LABELS = {
  [SPLIT.EQUAL]: 'expense.split.equal',
  [SPLIT.SHARES]: 'expense.split.shares',
  [SPLIT.EXACT]: 'expense.split.exact',
};

export default function ExpenseEditor() {
  const dialog = useDialog();
  const { id, prefillDescription, prefillAmount, sourceType, sourceId } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addExpense, updateExpense, deleteExpense } = useExpenses();
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();

  const [existing, setExisting] = useState(null);
  const [loaded, setLoaded] = useState(isNew);

  // ----- Formulier-state -----
  // Voorvullen vanuit een bron (KOS-3): bv. "Splitsen met huishouden" vanaf een bon.
  const [description, setDescription] = useState(prefillDescription ?? '');
  const [amountText, setAmountText] = useState(prefillAmount ?? '');
  // Zinnige default-categorie op basis van de bron (bon → boodschappen, reservering → vervoer).
  const [category, setCategory] = useState(
    sourceType === 'purchase' ? 'boodschappen' : sourceType === 'reservation' ? 'vervoer' : 'overig'
  );
  const [paidBy, setPaidBy] = useState(user?.id ?? null);
  const [spentOn, setSpentOn] = useState(new Date());
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

  // ----- Bestaande uitgave: laden en het formulier voorvullen (bewerkbaar) -----
  useEffect(() => {
    if (isNew) return;
    supabase.from('expenses').select('*, expense_shares(profile_id, amount_cents)').eq('id', id).single()
      .then(({ data }) => {
        if (!data) { router.back(); return; }
        setExisting(data);
        setDescription(data.description ?? '');
        setAmountText(data.amount_cents != null ? (data.amount_cents / 100).toFixed(2).replace('.', ',') : '');
        setCategory(data.category ?? 'overig');
        setPaidBy(data.paid_by);
        setSpentOn(data.spent_on ? parseISO(data.spent_on) : new Date());
        setVisibility(data.visibility ?? VISIBILITY.HOUSEHOLD);
        setShareSubgroupId(data.share_subgroup_id ?? null);
        setShareWith(data.share_with ?? []);
        const sh = data.expense_shares ?? [];
        setSelected(sh.map((s) => s.profile_id));
        // Gewichten van een 'aandeel'-split worden niet bewaard en zijn na afronding
        // niet te reconstrueren uit de bedragen. Een opgeslagen aandeel- of exact-split
        // bewerken we daarom als exacte bedragen: de verdeling blijft exact behouden en
        // is volledig aanpasbaar. 'Gelijk' blijft gelijk (zelfde uitkomst).
        if (data.split_type === SPLIT.EQUAL) {
          setSplitType(SPLIT.EQUAL);
        } else {
          setSplitType(SPLIT.EXACT);
          const ex = {}; sh.forEach((s) => { ex[s.profile_id] = (s.amount_cents / 100).toFixed(2).replace('.', ','); });
          setExactText(ex);
        }
        setLoaded(true);
      });
  }, [id]);

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
      if (isNew) {
        await addExpense({
          description: description.trim(), amountCents, paidBy, spentOn: format(spentOn, 'yyyy-MM-dd'), splitType,
          participants, visibility, shareSubgroupId, shareWith,
          sourceType: sourceType ?? null, sourceId: sourceId ?? null, category,
        });
      } else {
        await updateExpense(id, {
          description: description.trim(), amountCents, paidBy, spentOn: format(spentOn, 'yyyy-MM-dd'), splitType,
          participants, visibility, shareSubgroupId, shareWith, category,
        });
      }
      haptics.success();
      router.back();
    } catch (e) {
      haptics.error();
      dialog.alert({ title: t('expense.error.save'), body: e.message });
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
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { unmarkPending(id); }
      },
    });
  };

  // Wacht tot een bestaande uitgave geladen is (geen lege-formulier-flits).
  if (!isNew && !loaded) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;

  // ---------- Uitgave aanmaken / bewerken (zelfde formulier) ----------
  return (
    <Editor title={isNew ? t('expense.new') : t('expense.edit')} onClose={() => router.back()} onConfirm={save} busy={busy}>
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
                    accessibilityLabel={t('expense.a11y.exact', { name: m.display_name })}
                    style={{ width: 80, minHeight: 44, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.sm,
                      paddingHorizontal: space.sm, paddingVertical: space.sm, textAlign: 'right', color: colors.ink }} />
                )}
              </View>
            );
          })}

          {splitType === SPLIT.EXACT && (
            <Text style={[type.caption, { marginTop: space.sm, color: exactRemaining === 0 ? colors.done : colors.danger }]}>
              {exactRemaining === 0 ? t('expense.exact.balanced') : t('expense.exact.remaining', { amount: formatCents(exactRemaining) })}
            </Text>
          )}

          <Text style={[type.label, { marginBottom: space.xs, marginTop: space.md }]}>{t('expense.field.date')}</Text>
          <DateStepper date={spentOn} onChange={setSpentOn} />

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

          {!isNew ? (
            <Button title={t('common.remove')} icon="delete" variant="ghost" onPress={removeExisting}
              style={{ marginTop: space.lg, borderColor: 'transparent' }} />
          ) : null}
    </Editor>
  );
}
