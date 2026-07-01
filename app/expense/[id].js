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
import { Field, Button, Chip, Checkbox, Stepper, Row, AvatarSelect, Editor, DateStepper, useErrorScroll } from '../../lib/ui';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY, EXPENSE_CATEGORIES } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityRule } from '../../lib/visibility';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText, when, runRules, firstErrorField } from '../../lib/formValidation';
import { toggleValue } from '../../lib/listField';
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

// Prioriteit voor scroll-naar-eerste-fout (formulier-fundament): van boven naar onder.
const FIELD_ORDER = ['description', 'amount', 'paidBy', 'participants', 'exact', 'visibility'];

export default function ExpenseEditor() {
  const dialog = useDialog();
  const { id, prefillDescription, prefillAmount, sourceType, sourceId } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addExpense, updateExpense, deleteExpense } = useExpenses();
  const { members, subgroups } = useHousehold();
  const { user } = useAuth();

  const [loaded, setLoaded] = useState(isNew);

  // Gedeelde formulier-ruggengraat (ARCH-1) in full-mode: de hook beheert de waarden,
  // de dirty-detectie (via een genormaliseerde serialize — getrimde tekst, bedrag als
  // centen, datum als 'yyyy-MM-dd', deelnemer-sets gesorteerd zodat toggel-volgorde niet
  // als 'gewijzigd' telt) en de live/submit-validatie via de pure regels.
  // Voorvullen vanuit een bron (KOS-3): bv. "Splitsen met huishouden" vanaf een bon; een
  // zinnige default-categorie op basis van de bron (bon → boodschappen, reservering → vervoer).
  const serialize = (v) => JSON.stringify({
    description: v.description.trim(),
    amountCents: parseAmountToCents(v.amountText) ?? 0,
    category: v.category,
    paidBy: v.paidBy,
    spentOn: v.spentOn ? format(v.spentOn, 'yyyy-MM-dd') : null,
    selected: [...v.selected].sort(),
    splitType: v.splitType,
    weights: Object.entries(v.weights).sort(),
    exactText: Object.entries(v.exactText).sort(),
    visibility: v.visibility,
    shareSubgroupId: v.shareSubgroupId,
    shareWith: [...v.shareWith].sort(),
  });
  const form = useEntityForm({
    description: prefillDescription ?? '',
    amountText: prefillAmount ?? '',
    category: sourceType === 'purchase' ? 'boodschappen' : sourceType === 'reservation' ? 'vervoer' : 'overig',
    paidBy: user?.id ?? null,
    spentOn: new Date(),
    selected: members.map((m) => m.id),
    splitType: SPLIT.EQUAL,
    weights: {},   // { id: number } voor 'shares'
    exactText: {}, // { id: '12,50' } voor 'exact'
    visibility: VISIBILITY.HOUSEHOLD,
    shareSubgroupId: null,
    shareWith: [],
  }, { serialize });
  const { values, setField, setValues, reset, dirty, errors, clearError: clearErr, busy, setBusy, validate, validateField } = form;
  const {
    description, amountText, category, paidBy, spentOn, selected, splitType, weights, exactText,
    visibility, shareSubgroupId, shareWith,
  } = values;
  const { scrollRef, register, scrollToField } = useErrorScroll();

  // Nieuw formulier: zodra de leden geladen zijn, selecteer standaard iedereen én herbaseer
  // (reset) — zo telt een vers, onaangeraakt formulier niet meteen als 'gewijzigd'.
  useEffect(() => {
    if (isNew && members.length && selected.length === 0) reset({ ...values, selected: members.map((m) => m.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  // ----- Bestaande uitgave: laden en het formulier voorvullen (bewerkbaar) → nieuw ijkpunt -----
  useEffect(() => {
    if (isNew) return;
    supabase.from('expenses').select('*, expense_shares(profile_id, amount_cents)').eq('id', id).single()
      .then(({ data }) => {
        if (!data) { router.back(); return; }
        const sh = data.expense_shares ?? [];
        // Gewichten van een 'aandeel'-split worden niet bewaard en zijn na afronding
        // niet te reconstrueren uit de bedragen. Een opgeslagen aandeel- of exact-split
        // bewerken we daarom als exacte bedragen: de verdeling blijft exact behouden en
        // is volledig aanpasbaar. 'Gelijk' blijft gelijk (zelfde uitkomst).
        const isEqual = data.split_type === SPLIT.EQUAL;
        const exact = {};
        if (!isEqual) sh.forEach((s) => { exact[s.profile_id] = (s.amount_cents / 100).toFixed(2).replace('.', ','); });
        reset({
          description: data.description ?? '',
          amountText: data.amount_cents != null ? (data.amount_cents / 100).toFixed(2).replace('.', ',') : '',
          category: data.category ?? 'overig',
          paidBy: data.paid_by,
          spentOn: data.spent_on ? parseISO(data.spent_on) : new Date(),
          selected: sh.map((s) => s.profile_id),
          splitType: isEqual ? SPLIT.EQUAL : SPLIT.EXACT,
          weights: {},
          exactText: exact,
          visibility: data.visibility ?? VISIBILITY.HOUSEHOLD,
          shareSubgroupId: data.share_subgroup_id ?? null,
          shareWith: data.share_with ?? [],
        });
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setValues((v) => ({ ...v, selected: toggleValue(v.selected, pid) }));
  const toggleShareWith = (pid) =>
    setValues((v) => ({ ...v, shareWith: toggleValue(v.shareWith, pid) }));

  // Eén bron van waarheid voor de waarden die de regels lezen; de validatie zelf draait
  // door de pure runRules (lib/formValidation.js, ratchet-bewaakt). Gedeeld door de submit
  // (alle fouten) en de onBlur-live-check (alleen dat veld).
  const subject = {
    description, amountCents, paidBy, selected, splitType, participants,
    visibility, shareSubgroupId, shareWith,
  };
  const rules = [
    requiredText('description', t('expense.error.description')),
    // Foutsleutel 'amount' (zo leest het bedragveld 'm), waarde uit 'amountCents'.
    when('amount', (v) => v.amountCents > 0, t('expense.error.amount')),
    when('paidBy', (v) => !!v.paidBy, t('expense.error.paidBy')),
    when('participants', (v) => v.selected.length > 0, t('expense.error.participants')),
    when('exact', (v) => v.splitType !== SPLIT.EXACT || exactSharesValid(v.amountCents, v.participants),
      t('expense.error.exact', { amount: formatCents(exactRemaining) })),
    visibilityRule('visibility'),
  ];

  const save = async () => {
    if (!validate(rules, subject)) {
      scrollToField(firstErrorField(runRules(subject, rules), FIELD_ORDER));
      return; // validate() heeft de errors gezet + de haptische foutpuls gegeven
    }
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
      message: t('expense.deleted', { name: description.trim() || t('common.remove') }),
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
    <Editor title={isNew ? t('expense.new') : t('expense.edit')} onClose={() => router.back()} onConfirm={save}
      busy={busy} dirty={dirty} scrollRef={scrollRef}>
          <View onLayout={register('description')}>
            <Field label={t('expense.field.description')} value={description} testID="t-field-description"
              onChangeText={(v) => setField('description', v)}
              onBlur={() => validateField(rules, 'description', subject)}
              placeholder={t('expense.field.description.placeholder')} error={errors.description} />
          </View>
          <View onLayout={register('amount')}>
            <Field label={t('expense.field.amount')} value={amountText} testID="t-field-amount"
              onChangeText={(v) => setField('amountText', v)}
              onBlur={() => validateField(rules, 'amount', subject)}
              placeholder="0,00" keyboardType="decimal-pad" error={errors.amount} />
          </View>

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.category')}</Text>
          <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} label={t('category.' + c)} active={category === c} onPress={() => setField('category', c)} />
            ))}
          </Row>

          <View onLayout={register('paidBy')}>
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.paidBy')}</Text>
            <AvatarSelect members={members} selectedId={paidBy}
              onSelect={(pid) => { setField('paidBy', pid); clearErr('paidBy'); }} style={{ marginBottom: space.md }} />
            {errors.paidBy ? (
              <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.paidBy}</Text>
            ) : null}
          </View>

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('expense.field.split')}</Text>
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            {Object.values(SPLIT).map((s) => (
              <Chip key={s} label={t(SPLIT_LABELS[s])} active={splitType === s} onPress={() => setField('splitType', s)} />
            ))}
          </View>

          <View onLayout={register('participants')}>
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
                      <Stepper value={weights[m.id] ?? 1} onChange={(v) => setValues((prev) => ({ ...prev, weights: { ...prev.weights, [m.id]: v } }))}
                        min={1} accessibilityLabel={t('expense.a11y.share', { name: m.display_name })} />
                      <Text style={[type.caption, { width: 60, textAlign: 'right' }]}>{formatCents(preview[m.id] ?? 0)}</Text>
                    </Row>
                  )}
                  {on && splitType === SPLIT.EXACT && (
                    <TextInput value={exactText[m.id] ?? ''} onChangeText={(v) => setValues((prev) => ({ ...prev, exactText: { ...prev.exactText, [m.id]: v } }))}
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
          </View>

          <Text style={[type.label, { marginBottom: space.xs, marginTop: space.md }]}>{t('expense.field.date')}</Text>
          <DateStepper date={spentOn} onChange={(d) => setField('spentOn', d)} />

          <View style={{ marginTop: space.lg }} onLayout={register('visibility')}>
            <VisibilityPicker
              collapsible
              visibility={visibility} onChangeVisibility={(v) => { setField('visibility', v); clearErr('visibility'); }}
              shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setField('shareSubgroupId', v); clearErr('visibility'); }}
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
