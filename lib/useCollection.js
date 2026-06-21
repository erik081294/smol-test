import { useState, useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { isPending, subscribePending, pendingVersion } from './pendingDeletes';

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
  select = '*',
} = {}) {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setLoading(false); return; }
    let query = supabase.from(table).select(select).eq('household_id', activeId);
    for (const o of order) {
      query = query.order(o.column, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst });
    }
    const data = await run(query, { fallback: [], context: `${label} laden` });
    setItems(data ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, table]);

  // Laden + realtime: herlaad bij elke wijziging voor dit huishouden. RLS filtert
  // de payload, dus niet-zichtbare rijen lekken niet via het kanaal.
  useRealtimeReload(load, activeId, [
    { table, filter: `household_id=eq.${activeId}` },
  ], { name: table });

  // create blijft niet-optimistisch: zonder server-id zou een tijdelijke rij
  // botsen met de realtime-echo (dubbele key). De realtime-reload toont de nieuwe
  // rij snel genoeg; alleen de zwaardere acties hieronder zijn optimistisch.
  const create = (payload) => mutate(
    supabase.from(table).insert({ ...payload, household_id: activeId, [creatorColumn]: user.id }),
    { context: `${label} toevoegen` }
  );

  // Optimistisch: pas de lokale lijst meteen aan zodat een tik direct voelt, en
  // draai terug bij een fout. De realtime-subscription herlaadt daarna alsnog de
  // serverwaarheid (en hersorteert), dus de optimistische staat is tijdelijk.
  const update = (id, patch) => {
    let prev;
    setItems((cur) => {
      prev = cur;
      return cur.map((it) => (it.id === id ? { ...it, ...patch } : it));
    });
    return mutate(
      supabase.from(table).update(patch).eq('id', id),
      { context: `${label} bijwerken` }
    ).catch((e) => { if (prev) setItems(prev); throw e; });
  };

  const remove = (id) => {
    let prev;
    setItems((cur) => {
      prev = cur;
      return cur.filter((it) => it.id !== id);
    });
    return mutate(
      supabase.from(table).delete().eq('id', id),
      { context: `${label} verwijderen` }
    ).catch((e) => { if (prev) setItems(prev); throw e; });
  };

  // Optimistische bulk-delete. Nodig omdat Supabase-realtime DELETE-events vaak
  // niet uitzendt (replica identity), waardoor een server-side bulk-delete pas
  // zichtbaar werd bij de volgende reload. Hier verdwijnen de rijen meteen lokaal.
  const removeMany = (ids) => {
    if (!ids?.length) return Promise.resolve();
    const idSet = new Set(ids);
    let prev;
    setItems((cur) => {
      prev = cur;
      return cur.filter((it) => !idSet.has(it.id));
    });
    return mutate(
      supabase.from(table).delete().in('id', ids),
      { context: `${label} verwijderen` }
    ).catch((e) => { if (prev) setItems(prev); throw e; });
  };

  // Verberg items waarvan de undo-toast nog loopt (delete-met-ongedaan-maken vanuit
  // een editor-scherm). useSyncExternalStore hertekent bij elke wijziging van de
  // pending-set; isPending() lezen we live tijdens render.
  useSyncExternalStore(subscribePending, pendingVersion, pendingVersion);
  const visibleItems = items.filter((it) => !isPending(it.id));

  return { items: visibleItems, loading, reload: load, create, update, remove, removeMany, activeId, user };
}
