import { useState, useCallback, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useGatedHouseholdId } from './household';
import { useAuth } from './auth';
import { mutate } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { isPending, subscribePending, pendingVersion } from './pendingDeletes';
import { getCached, setCached, cacheKey, dedupeFetch, seedFromCache } from './dataCache';
import { comparatorFromOrder, applyRealtimePatch } from './realtimePatch';

// Generieke, huishouden-gescopete collectie met realtime + CRUD.
//
// Dit is de ruggengraat van het module-framework: elke module-tabel volgt
// hetzelfde contract (kolommen household_id, een creator-kolom, en de
// zichtbaarheidskolommen visibility/share_subgroup_id/share_with) en krijgt
// daarmee gratis: gescopet laden, een realtime-subscription, en schrijf-acties
// met nette foutafhandeling via run()/mutate(). Een nieuwe module hoeft dit niet
// opnieuw te schrijven — alleen useCollection('mijn_tabel', …) aanroepen.
//
// Snelheid (PERF-2/INF-8 C3): de hook seedt zijn begintoestand uit een lichte
// in-memory cache (lib/dataCache.js) zodat een herbezochte tab meteen data toont
// i.p.v. een laad-skelet, en patcht platte (`select:'*'`) collecties incrementeel
// op realtime-events i.p.v. een volledige refetch.
//
// `order` is statisch per module; we laten het bewust buiten de useCallback-deps.
export function useCollection(table, {
  order = [],
  creatorColumn = 'created_by',
  label = table,
  select = '*',
  module = null,
} = {}) {
  const { user } = useAuth();

  // Module-gating in de datalaag (ARCH-3): laad geen data van een uitgezette module.
  // De `module`-optie koppelt de tabel aan zijn module; staat die uit, dan geeft de
  // gedeelde gate (useGatedHouseholdId) null terug. Dat laat élk laad-/realtime-pad
  // hieronder vanzelf no-op'en (alle `if (!activeId)`-takken + de lege cache-sleutel),
  // zónder per-pad een aparte gate. Zonder `module` (of voor een ingeschakelde module)
  // verandert er niets. Cross-module overzichten (Vandaag/Notificaties) stoppen zo
  // automatisch met het lezen van uitgezette modules.
  const activeId = useGatedHouseholdId(module);

  // Cache-sleutel + begintoestand. Een gecachete (ook lege) lijst → meteen tonen,
  // loading=false; niets gecachet → loading=true (koud laden toont nog wél skelet).
  const key = activeId ? cacheKey(table, activeId) : null;
  const seed = seedFromCache(key ? getCached(key) : undefined);
  const [items, setItems] = useState(seed.items);
  const [loading, setLoading] = useState(seed.loading);
  // Laadfout (offline/server). Blootgelegd zodat een scherm een nette foutstaat
  // met opnieuw-proberen kan tonen (UX-23) i.p.v. stil een leeg scherm.
  const [error, setError] = useState(null);

  // Incrementeel patchen kan alléén voor platte collecties: een join-select
  // (bv. zone/shares) komt niet mee in de realtime-payload, dus die zou de join
  // verliezen. Niet-plat → reload-on-event (geen onChange).
  const flat = select === '*';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const comparator = useMemo(() => comparatorFromOrder(order), []);

  // Spiegel van de huidige lijst voor de realtime-patch (zonder side-effects in een
  // setState-updater en zonder re-subscribe bij elke wijziging).
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Spiegel van het actieve huishouden voor de generatie-guard in load(): een trage fetch
  // van een vórig huishouden mag de lijst van het nu-actieve huishouden niet overschrijven
  // na een wissel (P4-review; useCatalog had dit patroon al).
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setLoading(false); setError(null); return; }
    const forId = activeId;
    let query = supabase.from(table).select(select).eq('household_id', activeId);
    for (const o of order) {
      query = query.order(o.column, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst });
    }
    try {
      // In-flight dedupe (P1): meerdere gemounte instanties van dezelfde (tabel, huishouden,
      // select) delen één netwerk-round-trip i.p.v. elk apart te refetchen op een event.
      const { data, error: qErr } = await dedupeFetch(`${cacheKey(table, forId)}::${select}`, () => query);
      if (qErr) throw qErr;
      // Generatie-guard (P4): resultaat van een vórig huishouden niet toepassen na een wissel.
      if (activeIdRef.current !== forId) return;
      const rows = data ?? [];
      setItems(rows);
      setCached(cacheKey(table, forId), rows);
      setError(null);
    } catch (e) {
      if (activeIdRef.current !== forId) return;
      // Transiënte fout: láát de bestaande (gecachete) lijst staan i.p.v. 'm naar
      // leeg te overschrijven, en markeer de fout zodat het scherm 'm kan tonen.
      console.warn(`[Huishoek] Laadfout (${label} laden): ${e?.message ?? e}`);
      setError(e);
    } finally {
      if (activeIdRef.current === forId) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, table]);

  // Huishouden-wissel: toon meteen de cache van het nieuwe huishouden (of leeg)
  // i.p.v. de vorige data te laten staan tot de revalidatie klaar is.
  useEffect(() => {
    if (!key) { setItems([]); setLoading(false); return; }
    const next = seedFromCache(getCached(key));
    setItems(next.items);
    setLoading(next.loading);
  }, [key]);

  // Realtime-event → lokaal patchen (+ cache bijwerken); lukt het niet, dan een
  // volledige reload als vangnet. Alleen actief voor platte collecties.
  const onChange = useCallback((payload) => {
    if (!activeId) return;
    const next = applyRealtimePatch(itemsRef.current, payload, comparator);
    if (next === null) { load(); return; }
    itemsRef.current = next;
    setItems(next);
    setCached(cacheKey(table, activeId), next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, table, comparator, load]);

  // Laden + realtime: bij mount fetchen; daarna patchen (plat) of herladen. RLS
  // filtert de payload, dus niet-zichtbare rijen lekken niet via het kanaal.
  useRealtimeReload(load, activeId, [
    { table, filter: `household_id=eq.${activeId}` },
  ], { name: table, onChange: flat ? onChange : undefined });

  // create blijft niet-optimistisch: zonder server-id zou een tijdelijke rij
  // botsen met de realtime-echo (dubbele key). De realtime-patch toont de nieuwe
  // rij snel genoeg; alleen de zwaardere acties hieronder zijn optimistisch.
  const create = (payload) => {
    // Guard tegen een create-tik in een race-venster (uitgelogd / auth-overgang /
    // geen actief huishouden): zonder dit gooit `user.id` een TypeError i.p.v. een
    // nette afwijzing die de aanroeper kan tonen.
    if (!activeId || !user) return Promise.reject(new Error(`${label} toevoegen: geen actief huishouden of niet ingelogd`));
    return mutate(
      supabase.from(table).insert({ ...payload, household_id: activeId, [creatorColumn]: user.id }),
      { context: `${label} toevoegen` }
    );
  };

  // Optimistisch: pas de lokale lijst meteen aan zodat een tik direct voelt, en
  // draai terug bij een fout. De realtime-subscription brengt daarna alsnog de
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

  return { items: visibleItems, loading, error, reload: load, create, update, remove, removeMany, activeId, user };
}
