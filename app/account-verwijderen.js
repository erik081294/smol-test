import React, { useEffect, useState, useCallback } from 'react';
import { Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { backLabelFor } from '../lib/navMeta';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { run, mutate } from '../lib/db';
import { classifyHouseholds, canDeleteAccount } from '../lib/accountDeletion';
import { ModalHeader, Card, Field, Button, Banner, SectionHeader, ListSkeleton } from '../lib/ui';
import { colors, space, type } from '../lib/theme';
import { dialog } from '../lib/dialog';
import { t } from '../lib/i18n';

// Account verwijderen (PLT-11, migratie 0078). Een apart, bewust-omslachtig scherm
// voor een onomkeerbare actie: eerst de impact tonen (via account_deletion_preview →
// de pure classifyHouseholds), dan een getypte bevestiging, dan delete_account().
// De server-RPC is de bron van waarheid; dit scherm previewt en beveiligt de UX.
function Group({ tone, title, body, items }) {
  if (!items?.length) return null;
  return (
    <Banner tone={tone} title={title} style={{ marginBottom: space.md }}>
      <Text style={[type.caption, { marginTop: space.xs }]}>{body}</Text>
      {items.map((h) => (
        <Text key={h.householdId} style={[type.body, { marginTop: space.xs }]}>• {h.name ?? '—'}</Text>
      ))}
    </Banner>
  );
}

export default function AccountVerwijderen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [plan, setPlan] = useState(null);   // classifyHouseholds-uitkomst
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const rows = await run(supabase.rpc('account_deletion_preview'), {
      fallback: null, context: 'account-impact laden',
    });
    if (rows == null) { setLoadError(true); setLoading(false); return; }
    setPlan(classifyHouseholds(rows));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmWord = t('account.delete.confirm.word');
  const allowed = plan != null && canDeleteAccount(plan) && word.trim() === confirmWord && !busy;

  const onDelete = async () => {
    if (!allowed) return;
    const ok = await dialog.confirm({
      title: t('account.delete.title'), body: t('account.delete.intro'), tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await mutate(supabase.rpc('delete_account'), { context: t('account.delete.error') });
    } catch (e) {
      // mutate gooit met een nette NL-melding (bv. de owner-blokkade P0001).
      setBusy(false);
      await dialog.alert({ title: t('account.delete.error'), body: e.message });
      load();   // impact opnieuw laden (blokkade kan gewijzigd zijn)
      return;
    }
    await signOut();   // sessie weg; de auth-gate stuurt terug naar welcome
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('account.delete.title')} onClose={() => router.back()} backLabel={backLabelFor('account-verwijderen')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
        <Text style={[type.body, { marginBottom: space.lg }]}>{t('account.delete.intro')}</Text>

        {loading ? (
          <ListSkeleton count={3} />
        ) : loadError ? (
          <Banner tone="warning" icon="warning" title={t('account.delete.loadError')}>
            <Button title={t('common.retry')} variant="ghost" onPress={load} style={{ marginTop: space.sm }} />
          </Banner>
        ) : (
          <>
            <Group tone="danger" title={t('account.delete.blocked.title')}
              body={t('account.delete.blocked.body')} items={plan.blocked} />
            <Group tone="warning" title={t('account.delete.willDelete.title')}
              body={t('account.delete.willDelete.body')} items={plan.toDelete} />
            <Group tone="info" title={t('account.delete.willLeave.title')}
              body={t('account.delete.willLeave.body')} items={plan.toLeave} />

            {canDeleteAccount(plan) ? (
              <Card style={{ marginTop: space.sm }}>
                <SectionHeader title={t('settings.danger')} />
                <Field
                  label={t('account.delete.confirm.label')}
                  placeholder={t('account.delete.confirm.placeholder')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={word}
                  onChangeText={setWord}
                />
                <Button
                  title={busy ? t('account.delete.busy') : t('account.delete.button')}
                  icon="delete"
                  variant="danger"
                  onPress={onDelete}
                  disabled={!allowed}
                  loading={busy}
                  testID="t-delete-account"
                />
              </Card>
            ) : (
              <Text style={[type.caption, { marginTop: space.sm }]}>{t('account.delete.blocked.body')}</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
