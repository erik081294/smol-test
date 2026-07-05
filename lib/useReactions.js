import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { getCached, setCached, cacheKey } from './dataCache';
import { aggregateReactions } from './timeline';

// Emoji-reacties op de tijdlijn (TML-3, plan 19). Eén huishouden-brede laad van
// `timeline_reactions`; per doel (post of systeem-event) aggregeren we client-side met
// de pure `aggregateReactions` (lib/timeline.js). Togglen = insert/delete op de unique-
// constraint (target_type, target_id, author_id, emoji). RLS scopet de payload: een
// reactie op een niet-zichtbare post komt niet in de laad mee (het zichtbaarheidscontract
// zit in de policy, niet hier). Realtime met FULL replica identity, dus ook toggle-uit
// (DELETE) draagt de rij en matcht het household_id-filter — één subscription volstaat.
//
// De aggregatie-LOGICA is puur + ratchet-bewaakt; deze hook is de dunne React/IO-schil.

export function useReactions() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const viewerId = user?.id;

  const key = activeId ? cacheKey('timeline_reactions', activeId) : null;
  const [rows, setRows] = useState(() => (key ? getCached(key) ?? [] : []));

  const load = useCallback(async () => {
    if (!activeId) { setRows([]); return; }
    const data = await run(
      supabase.from('timeline_reactions')
        .select('id, author_id, target_type, target_id, emoji')
        .eq('household_id', activeId),
      { fallback: [], context: 'reacties laden' },
    );
    const next = data ?? [];
    setRows(next);
    setCached(cacheKey('timeline_reactions', activeId), next);
  }, [activeId]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg).
  useEffect(() => {
    if (!key) { setRows([]); return; }
    setRows(getCached(key) ?? []);
  }, [key]);

  useRealtimeReload(load, activeId, [
    { table: 'timeline_reactions', filter: `household_id=eq.${activeId}` },
  ], { name: 'timeline_reactions' });

  // Index per doel-sleutel zodat reactionsFor() niet elke render de hele lijst hoeft te
  // filteren; de aggregatie zelf blijft de pure functie. Sleutel = '<type>:<id>'.
  const byTarget = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = `${r.target_type}:${r.target_id}`;
      const list = map.get(k);
      if (list) list.push(r); else map.set(k, [r]);
    }
    return map;
  }, [rows]);

  // Teller-chips voor één doel: [{ emoji, count, mine }] via de pure aggregatie.
  const reactionsFor = useCallback(
    (targetType, targetId) => aggregateReactions(byTarget.get(`${targetType}:${targetId}`) ?? [], viewerId),
    [byTarget, viewerId],
  );

  // Toggle je eigen reactie op een doel: staat 'ie er al → verwijderen, anders toevoegen.
  // Optimistisch (de lijst muteert meteen zodat de chip direct voelt); bij een serverfout
  // draaien we terug. De realtime-echo brengt daarna alsnog de serverwaarheid.
  const toggle = useCallback((targetType, targetId, emoji) => {
    if (!activeId || !viewerId) {
      return Promise.reject(new Error('reactie: geen actief huishouden of niet ingelogd'));
    }
    const mine = rows.find(
      (r) => r.target_type === targetType && r.target_id === targetId && r.author_id === viewerId && r.emoji === emoji,
    );
    const prev = rows;
    if (mine) {
      setRows((cur) => cur.filter((r) => r.id !== mine.id));
      return mutate(
        supabase.from('timeline_reactions').delete().eq('id', mine.id),
        { context: 'reactie verwijderen' },
      ).catch((e) => { setRows(prev); throw e; });
    }
    // Optimistische insert met een tijdelijk id; de realtime-echo (of reload) vervangt 'm.
    const optimistic = { id: `optim-${targetType}-${targetId}-${emoji}`, author_id: viewerId, target_type: targetType, target_id: targetId, emoji };
    setRows((cur) => [...cur, optimistic]);
    return mutate(
      supabase.from('timeline_reactions').insert({
        household_id: activeId, author_id: viewerId, target_type: targetType, target_id: targetId, emoji,
      }),
      { context: 'reactie plaatsen' },
    ).then(load).catch((e) => { setRows(prev); throw e; });
  }, [activeId, viewerId, rows, load]);

  return { reactionsFor, toggle, reload: load };
}
