import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useCollection } from './useCollection';
import { useExpenses } from './useExpenses';
import { dueRun } from './recurringExpense';

// Terugkerende uitgaven (KOS-4). De sjablonen via useCollection; bij het laden
// materialiseren we de verschuldigde occurrences als echte uitgaven (create_expense
// met source_type='recurring'). De partiële unieke index expenses(source_id,
// spent_on) where source_type='recurring' (0017) maakt dat idempotent: een dubbele
// poging faalt stil. Daarna schuift next_date door.
export function useRecurringExpenses() {
  const c = useCollection('recurring_expenses', {
    label: 'terugkerende uitgaven',
    order: [{ column: 'next_date', ascending: true }],
  });
  const { addExpense } = useExpenses();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || c.loading || !c.items.length) return;
    ranRef.current = true;
    (async () => {
      for (const tpl of c.items.filter((t) => t.active)) {
        const { occurrences, nextDate } = dueRun(tpl, new Date());
        if (!occurrences.length) continue;
        for (const occ of occurrences) {
          try {
            await addExpense({
              description: tpl.description,
              amountCents: tpl.amount_cents,
              paidBy: tpl.paid_by,
              spentOn: format(occ, 'yyyy-MM-dd'),
              splitType: tpl.split_type,
              participants: (tpl.participants ?? []).map((p) => ({
                profileId: p.profile_id, weight: p.weight, amountCents: p.amount_cents,
              })),
              visibility: tpl.visibility,
              shareSubgroupId: tpl.share_subgroup_id,
              shareWith: tpl.share_with,
              sourceType: 'recurring',
              sourceId: tpl.id,
            });
          } catch { /* unieke index → occurrence bestaat al; overslaan */ }
        }
        try { await c.update(tpl.id, { next_date: format(nextDate, 'yyyy-MM-dd') }); } catch { /* */ }
      }
    })();
  }, [c.loading, c.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTemplate = (payload) => c.create(payload);

  return {
    templates: c.items,
    loading: c.loading,
    reload: c.reload,
    addTemplate,
    updateTemplate: c.update,
    removeTemplate: c.remove,
    activeId: c.activeId,
    user: c.user,
  };
}
