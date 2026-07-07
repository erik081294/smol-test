import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { getCached, setCached, cacheKey } from './dataCache';
import { orderComments } from './timeline';

// Tekstreacties / comments op de tijdlijn (TML-4, plan 19). Zelfde opzet als
// lib/useReactions.js: één huishouden-brede laad van `timeline_comments`, per post
// geordend met de pure `orderComments` (lib/timeline.js — oudste eerst). RLS scopet
// de payload: comments op een niet-zichtbare post komen niet mee (het zichtbaarheids-
// contract zit in de policy, niet hier). Realtime met FULL replica identity, dus ook
// een verwijderde comment (DELETE) draagt de rij en matcht het household_id-filter.
// Comments bestaan alléén op handgeschreven berichten — systeem-events hebben geen
// post_id om aan te hangen (de FK dwingt dat af).
//
// De orden-LOGICA is puur + ratchet-bewaakt; deze hook is de dunne React/IO-schil.

export function useComments() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const viewerId = user?.id;

  const key = activeId ? cacheKey('timeline_comments', activeId) : null;
  const [rows, setRows] = useState(() => (key ? getCached(key) ?? [] : []));

  const load = useCallback(async () => {
    if (!activeId) { setRows([]); return; }
    const data = await run(
      supabase.from('timeline_comments')
        .select('id, post_id, author_id, body, created_at')
        .eq('household_id', activeId),
      { fallback: [], context: 'tekstreacties laden' },
    );
    const next = data ?? [];
    setRows(next);
    setCached(cacheKey('timeline_comments', activeId), next);
  }, [activeId]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg).
  useEffect(() => {
    if (!key) { setRows([]); return; }
    setRows(getCached(key) ?? []);
  }, [key]);

  useRealtimeReload(load, activeId, [
    { table: 'timeline_comments', filter: `household_id=eq.${activeId}` },
  ], { name: 'timeline_comments' });

  // Index per post zodat commentsFor() niet elke render de hele lijst filtert;
  // de ordening zelf blijft de pure functie.
  const byPost = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const list = map.get(r.post_id);
      if (list) list.push(r); else map.set(r.post_id, [r]);
    }
    return map;
  }, [rows]);

  // De thread van één post, oudste eerst (gesprek leest van boven naar beneden).
  const commentsFor = useCallback(
    (postId) => orderComments(byPost.get(postId) ?? []),
    [byPost],
  );

  // Alleen de teller (voor het "2 reacties"-label op de feed-kaart).
  const commentCountFor = useCallback(
    (postId) => (byPost.get(postId) ?? []).length,
    [byPost],
  );

  // Nieuwe comment onder een post. Optimistisch (de thread groeit meteen zodat het
  // invoerveld direct voelt); bij een serverfout draaien we terug. De reload na de
  // insert vervangt de tijdelijke rij door de serverwaarheid (echte id/created_at).
  const addComment = useCallback((postId, body) => {
    const trimmed = (body ?? '').trim();
    if (!activeId || !viewerId) {
      return Promise.reject(new Error('reactie: geen actief huishouden of niet ingelogd'));
    }
    if (!trimmed) return Promise.reject(new Error('reactie: leeg bericht'));
    const prev = rows;
    const optimistic = {
      id: `optim-${postId}-${Date.now()}`, post_id: postId, author_id: viewerId,
      body: trimmed, created_at: new Date().toISOString(),
    };
    setRows((cur) => [...cur, optimistic]);
    return mutate(
      supabase.from('timeline_comments').insert({
        household_id: activeId, post_id: postId, author_id: viewerId, body: trimmed,
      }),
      { context: 'reactie plaatsen' },
    ).then(load).catch((e) => { setRows(prev); throw e; });
  }, [activeId, viewerId, rows, load]);

  // Eigen comment verwijderen (RLS staat alléén je eigen rij toe). Optimistisch weg;
  // bij een serverfout komt de rij terug.
  const deleteComment = useCallback((id) => {
    const prev = rows;
    setRows((cur) => cur.filter((r) => r.id !== id));
    return mutate(
      supabase.from('timeline_comments').delete().eq('id', id),
      { context: 'reactie verwijderen' },
    ).catch((e) => { setRows(prev); throw e; });
  }, [rows]);

  return { commentsFor, commentCountFor, addComment, deleteComment, viewerId, reload: load };
}
