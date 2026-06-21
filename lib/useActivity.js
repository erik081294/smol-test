import { useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { run } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { buildFeed } from './activity';

// Activiteitenfeed (PLT-6). Leesgericht: leidt af uit de bestaande voltooiingen-log
// `task_completions` (geen nieuwe tabel/triggers nodig). RLS scopet de payload — een
// lid ziet alleen voltooiingen van taken die het mag zien. De actor-naam mappen we
// uit de al-geladen huishoudleden (zelfde aanpak als lib/fairness.js), zodat we geen
// extra join nodig hebben. Realtime via het gedeelde useRealtimeReload-primitief.
//
// Bewust source-agnostisch achter `buildFeed`: later kunnen uitgaven/bonnen als extra
// event-typen meegevoed worden zonder de UI te wijzigen.
const FEED_LIMIT = 50;

export function useActivity() {
  const { activeId, members } = useHousehold();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setRows([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('task_completions')
        .select('id, completed_by, completed_at, task:tasks!inner(title)')
        .eq('household_id', activeId)
        .order('completed_at', { ascending: false })
        .limit(FEED_LIMIT),
      { fallback: [], context: 'activiteit laden' },
    );
    setRows(data ?? []);
    setLoading(false);
  }, [activeId]);

  useRealtimeReload(load, activeId, [
    { table: 'task_completions', filter: `household_id=eq.${activeId}` },
  ], { name: 'activity' });

  const nameById = useMemo(
    () => Object.fromEntries((members ?? []).map((m) => [m.id, m.display_name])),
    [members],
  );

  // Ruwe rijen → genormaliseerde events → geformatteerde, gesorteerde feed.
  const feed = useMemo(() => buildFeed(
    rows.map((r) => ({
      id: r.id,
      type: 'task_completed',
      at: r.completed_at,
      actorName: nameById[r.completed_by],
      taskTitle: r.task?.title,
    })),
  ), [rows, nameById]);

  return { feed, loading, reload: load };
}
