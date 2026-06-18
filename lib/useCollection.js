import { useEffect, useState, useCallback, useRef } from 'react';
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

  useEffect(() => { load(); }, [load]);

  // Houd een ref naar de laatste load(), zodat de realtime-subscription niet
  // opnieuw hoeft te abonneren telkens als load() een nieuwe identiteit krijgt —
  // alleen activeId/table mogen een her-subscribe triggeren.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Realtime: herlaad bij elke wijziging voor dit huishouden. RLS filtert de
  // payload, dus niet-zichtbare rijen lekken niet via het kanaal.
  //
  // Het kanaal krijgt een uniek topic per subscription-instantie. Zonder dat
  // geeft supabase.channel() bij een vast topic het al-bestaande (en al
  // ge-subscribete) kanaal terug bij een tweede mount — denk aan React Strict
  // Mode / Fast Refresh, waar de cleanup async is en nog niet klaar is. Een
  // .on() op een al-joined kanaal gooit dan "cannot add postgres_changes
  // callbacks after subscribe()". Een uniek topic geeft altijd een vers kanaal.
  useEffect(() => {
    if (!activeId) return;
    const topic = `${table}:${activeId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${activeId}` },
        () => loadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, table]);

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

  return { items, loading, reload: load, create, update, remove, removeMany, activeId, user };
}
