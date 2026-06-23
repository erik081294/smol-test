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

// Laad-venster: ruime veiligheidsdrempel op de uitgavenlijst (PERF-1). In de
// praktijk "alle" uitgaven; pas bij overschrijding rekenen we het saldo uit een
// server-side aggregaat (exactTotals) i.p.v. uit de afgekapte rijen.
export const EXPENSE_WINDOW = 2000;

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
  // Exacte all-time-totalen per lid (PERF-1). Null zolang het venster niet vol is;
  // alleen dán (>EXPENSE_WINDOW rijen) lazy via de aggregaat-RPC opgehaald.
  const [exactTotals, setExactTotals] = useState(null);

  const load = useCallback(async () => {
    if (!activeId) { setExpenses([]); setExactTotals(null); setLoading(false); return; }
    const data = await run(
      supabase
        .from('expenses')
        .select('*, expense_shares(profile_id, amount_cents)')
        .eq('household_id', activeId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(EXPENSE_WINDOW),
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

    // Alleen bij een vol venster een exact all-time saldo ophalen (PERF-1). Onder
    // de drempel is de client-berekening al exact, dus dan geen extra query.
    if (rows.length >= EXPENSE_WINDOW) {
      const totals = await run(
        supabase.rpc('household_expense_totals', { p_household: activeId }),
        { fallback: null, context: 'exacte saldo-totalen laden' }
      );
      setExactTotals(totals ?? null);
    } else {
      setExactTotals(null);
    }
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

  return { expenses: visibleExpenses, loading, reload: load, addExpense, updateExpense, deleteExpense, exactTotals, user };
}
