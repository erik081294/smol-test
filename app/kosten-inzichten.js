import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { mutate } from '../lib/db';
import { useExpenses } from '../lib/useExpenses';
import { useHousehold } from '../lib/household';
import { byMonth, byCategory, monthTotal, budgetStatus } from '../lib/insights';
import { formatCents, parseAmountToCents } from '../lib/expenses';
import { ModalHeader, SectionHeader, Row, Chip, Card, Field, BarChart, Empty } from '../lib/ui';
import { colors, space, type, radius } from '../lib/theme';
import { t } from '../lib/i18n';

export default function KostenInzichten() {
  const router = useRouter();
  const { expenses, loading } = useExpenses();
  const { active, activeId, reload } = useHousehold();

  const months = useMemo(() => byMonth(expenses, { months: 6 }), [expenses]);
  const [selected, setSelected] = useState(null);
  const month = selected ?? months[months.length - 1]?.month;

  const cats = useMemo(() => byCategory(expenses, { month }), [expenses, month]);
  const total = useMemo(() => monthTotal(expenses, month), [expenses, month]);
  const status = budgetStatus(total, active?.monthly_budget_cents ?? null);

  const [budgetText, setBudgetText] = useState('');
  useEffect(() => {
    setBudgetText(active?.monthly_budget_cents != null ? (active.monthly_budget_cents / 100).toFixed(0) : '');
  }, [active?.monthly_budget_cents]);

  const saveBudget = async () => {
    const cents = budgetText.trim() ? parseAmountToCents(budgetText) : null;
    if (budgetText.trim() && cents == null) { Alert.alert(t('common.failed'), t('budget.invalid')); return; }
    try {
      await mutate(supabase.from('households').update({ monthly_budget_cents: cents }).eq('id', activeId),
        { context: 'budget opslaan' });
      reload();
    } catch (e) { Alert.alert(t('common.failed'), e.message); }
  };

  const hasData = expenses.length > 0;
  const catMax = cats[0]?.totalCents || 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('insights.title')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg }}>
        {!hasData ? (
          loading ? null : <Empty illustration="expenses" title={t('insights.empty.title')} subtitle={t('insights.empty.subtitle')} />
        ) : (
          <>
            {/* Maandgrafiek (laatste 6 maanden) */}
            <Card style={{ marginBottom: space.lg }}>
              <Text style={[type.caption, { marginBottom: space.sm }]}>{t('insights.perMonth')}</Text>
              <BarChart data={months.map((m) => ({ label: m.label, value: m.totalCents, highlight: m.month === month }))} />
            </Card>

            {/* Maandkiezer */}
            <Row gap={space.xs} wrap style={{ marginBottom: space.lg }}>
              {months.map((m) => (
                <Chip key={m.month} label={m.label} active={m.month === month} onPress={() => setSelected(m.month)} />
              ))}
            </Row>

            {/* Budget */}
            <SectionHeader title={t('budget.title')} />
            <Card style={{ marginBottom: space.lg }}>
              {status ? (
                <>
                  <Row justify="space-between" style={{ marginBottom: space.sm }}>
                    <Text style={type.title}>{formatCents(total)}</Text>
                    <Text style={[type.body, { color: colors.inkSoft }]}>{t('budget.of', { amount: formatCents(status.budgetCents) })}</Text>
                  </Row>
                  <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                    <View style={{
                      width: `${Math.min(100, status.pct)}%`, height: 10, borderRadius: radius.pill,
                      backgroundColor: status.over ? colors.danger : colors.forest,
                    }} />
                  </View>
                  <Text style={[type.caption, { marginTop: space.sm, color: status.over ? colors.danger : colors.inkSoft }]}>
                    {status.over
                      ? t('budget.over', { amount: formatCents(-status.remainingCents) })
                      : t('budget.left', { amount: formatCents(status.remainingCents) })}
                  </Text>
                </>
              ) : (
                <Text style={[type.body, { color: colors.inkSoft, marginBottom: space.sm }]}>{t('budget.none')}</Text>
              )}
              <Field label={t('budget.set')} value={budgetText} onChangeText={setBudgetText}
                onSubmitEditing={saveBudget} placeholder="0" keyboardType="numeric"
                helper={t('budget.help')} style={{ marginTop: space.md, marginBottom: 0 }} />
            </Card>

            {/* Per categorie (gekozen maand) */}
            <SectionHeader title={t('insights.perCategory')} />
            {cats.length === 0 ? (
              <Text style={[type.caption, { marginTop: space.sm }]}>{t('insights.noneThisMonth')}</Text>
            ) : cats.map((c) => (
              <View key={c.category} style={{ marginBottom: space.md }}>
                <Row justify="space-between" style={{ marginBottom: space.xs }}>
                  <Text style={type.body}>{t('category.' + c.category)}</Text>
                  <Text style={type.body}>{formatCents(c.totalCents)}</Text>
                </Row>
                <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round((c.totalCents / catMax) * 100)}%`, height: 8, borderRadius: radius.pill, backgroundColor: colors.forest }} />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
