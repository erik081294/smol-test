import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { computeShares } from './expenses';
import { visibilityPayload } from './visibility';
import { useRealtimeReload } from './useRealtimeReload';
import { isPending, subscribePending, pendingVersion } from './pendingDeletes';
import { getCached, setCached, cacheKey } from './dataCache';

// Uitgaven van het actieve huishouden, mét hun per-persoon aandelen. useCollection
// kan geen geneste select, dus we volgen het patroon van loadSubgroups in
// household.js: één query met embedded expense_shares + een realtime-subscription
// die bij elke wijziging herlaadt. RLS filtert de payload (subgroep-scoping).
export function useExpenses() {
  const { activeId } = useHousehold();
  const { user } = useAuth();

  // Stale-while-revalidate: seed uit de cache zodat een herbezochte Kosten-tab geen
  // laad-skelet toont (PERF-2). We cachen de genormaliseerde rijen (wat consumers lezen).
  const key = activeId ? cacheKey('expenses', activeId) : null;
  const initial = key ? getCached(key) : undefined;
  const [expenses, setExpenses] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);

  const load = useCallback(async () => {
    if (!activeId) { setExpenses([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('expenses')
        .select('*, expense_shares(profile_id, amount_cents)')
        .eq('household_id', activeId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
        // PERF-1: ruime veiligheidsdrempel. In de praktijk "alle" uitgaven; begrenst
        // alleen de extreme worst-case. Een exact all-time saldo bij overschrijding
        // hoort later naar een server-side aggregaat (zie backlog PERF-1).
        .limit(2000),
      { fallback: [], context: 'uitgaven laden' }
    );
    const rows = (data ?? []).map((e) => ({
      ...e,
      // Genormaliseerd voor lib/expenses.js: { paidBy, shares: { id: cents } }.
      paidBy: e.paid_by,
      shares: Object.fromEntries((e.expense_shares ?? []).map((s) => [s.profile_id, s.amount_cents])),
      participantIds: (e.expense_shares ?? []).map((s) => s.profile_id),
    }));
    setExpenses(rows);
    setCached(cacheKey('expenses', activeId), rows);
    setLoading(false);
  }, [activeId]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg).
  useEffect(() => {
    if (!key) { setExpenses([]); setLoading(false); return; }
    const cached = getCached(key);
    setExpenses(cached ?? []);
    setLoading(cached === undefined);
  }, [key]);

  // Laden + realtime: herlaad bij wijzigingen op expenses én expense_shares, beide
  // gefilterd op huishouden (expense_shares heeft sinds 0025 een household_id-kolom,
  // dus geen brede tabel-subscription meer → geen cross-household refetch-storms).
  useRealtimeReload(load, activeId, [
    { table: 'expenses', filter: `household_id=eq.${activeId}` },
    { table: 'expense_shares', filter: `household_id=eq.${activeId}` },
  ], { name: 'expenses' });

  // Nieuwe uitgave: bereken de aandelen en maak expense + shares atomair aan via RPC.
  //   participants: [{ profileId, weight?, amountCents? }] (afhankelijk van splitType)
  const addExpense = async ({
    description, amountCents, paidBy, spentOn, splitType,
    participants, visibility, shareSubgroupId, shareWith, sourceType = null, sourceId = null,
    category = 'overig',
  }) => {
    const shares = computeShares({ amountCents, splitType, participants });
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    const id = await mutate(
      supabase.rpc('create_expense', {
        p_household_id: activeId,
        p_description: description,
        p_amount_cents: amountCents,
        p_paid_by: paidBy,
        p_spent_on: spentOn ?? null,
        p_split_type: splitType,
        p_visibility: vis.visibility,
        p_share_subgroup_id: vis.share_subgroup_id,
        p_share_with: vis.share_with,
        p_shares: Object.entries(shares).map(([profile_id, amount_cents]) => ({ profile_id, amount_cents })),
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_category: category,
      }),
      { context: 'uitgave toevoegen' }
    );
    await load();
    return id;
  };

  // Bestaande uitgave bijwerken: bereken de aandelen opnieuw en werk expense +
  // shares atomair bij via de update_expense-RPC (spiegel van addExpense). De
  // bron-koppeling blijft ongemoeid (zie 0022).
  const updateExpense = async (id, {
    description, amountCents, paidBy, spentOn, splitType,
    participants, visibility, shareSubgroupId, shareWith, category = 'overig',
  }) => {
    const shares = computeShares({ amountCents, splitType, participants });
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    await mutate(
      supabase.rpc('update_expense', {
        p_id: id,
        p_household_id: activeId,
        p_description: description,
        p_amount_cents: amountCents,
        p_paid_by: paidBy,
        p_spent_on: spentOn ?? null,
        p_split_type: splitType,
        p_visibility: vis.visibility,
        p_share_subgroup_id: vis.share_subgroup_id,
        p_share_with: vis.share_with,
        p_shares: Object.entries(shares).map(([profile_id, amount_cents]) => ({ profile_id, amount_cents })),
        p_category: category,
      }),
      { context: 'uitgave bijwerken' }
    );
    await load();
    return id;
  };

  const deleteExpense = (id) =>
    mutate(supabase.from('expenses').delete().eq('id', id), { context: 'uitgave verwijderen' });

  // Verberg uitgaven waarvan de undo-toast nog loopt (zie lib/pendingDeletes.js).
  useSyncExternalStore(subscribePending, pendingVersion, pendingVersion);
  const visibleExpenses = expenses.filter((e) => !isPending(e.id));

  return { expenses: visibleExpenses, loading, reload: load, addExpense, updateExpense, deleteExpense, user };
}
