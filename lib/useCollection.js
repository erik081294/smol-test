import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';

// Generieke, huishouden-gescopete collectie met realtime + CRUD.
//
// Dit is de ruggengraat van het module-framework: elke module-tabel volgt
// hetzelfde contract (kolommen household_id, een creator-kolom, en de
// zichtbaarheidskolommen visibility/share_subgroup_id/share_with) en krijgt
// daarmee gratis: gescopet laden, een realtime-subscription, en schrijf-acties
// met nette foutafhandeling via run()/mutate(). Een nieuwe module hoeft dit niet
// opnieuw te schrijven — alleen useCollection('mijn_tabel', …) aanroepen.
//
// `order` is statisch per module; we laten het bewust buiten de useCallback-deps.
export function useCollection(table, {
  order = [],
  creatorColumn = 'created_by',
  label = table,
} = {}) {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setLoading(false); return; }
    let query = supabase.from(table).select('*').eq('household_id', activeId);
    for (const o of order) {
      query = query.order(o.column, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst });
    }
    const data = await run(query, { fallback: [], context: `${label} laden` });
    setItems(data ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, table]);

  useEffect(() => { load(); }, [load]);

  // Realtime: herlaad bij elke wijziging voor dit huishouden. RLS filtert de
  // payload, dus niet-zichtbare rijen lekken niet via het kanaal.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`${table}:${activeId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${activeId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, table, load]);

  const create = (payload) => mutate(
    supabase.from(table).insert({ ...payload, household_id: activeId, [creatorColumn]: user.id }),
    { context: `${label} toevoegen` }
  );

  const update = (id, patch) => mutate(
    supabase.from(table).update(patch).eq('id', id),
    { context: `${label} bijwerken` }
  );

  const remove = (id) => mutate(
    supabase.from(table).delete().eq('id', id),
    { context: `${label} verwijderen` }
  );

  return { items, loading, reload: load, create, update, remove, activeId, user };
}
