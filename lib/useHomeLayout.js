import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { run, mutate } from './db';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { useRealtimeReload } from './useRealtimeReload';

// Persistentie van de Vandaag-widget-layout (VDG-4, Optie A — gesynct). Eén rij per
// (gebruiker, huishouden) in `home_layouts`. Geen rij ⇒ val terug op `defaultLayout`
// (afgeleid uit de ingeschakelde modules). Resilient: een ontbrekende tabel/fout laat
// de grid gewoon op de default draaien i.p.v. te crashen.
//
//   const { layout, save, loaded } = useHomeLayout(deriveDefaultLayout(...));
export function useHomeLayout(defaultLayout) {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [saved, setSaved] = useState(null); // null = nog niet geladen / geen rij
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!activeId || !user) { setSaved(null); setLoaded(true); return; }
    const rows = await run(
      supabase.from('home_layouts').select('layout')
        .eq('profile_id', user.id).eq('household_id', activeId).limit(1),
      { fallback: [], context: 'home-layout laden' }
    );
    const layout = rows?.[0]?.layout;
    setSaved(Array.isArray(layout) ? layout : null);
    setLoaded(true);
  }, [activeId, user]);

  useEffect(() => { load(); }, [load]);

  // Cross-device: herlaad als de eigen rij op een ander toestel verandert.
  useRealtimeReload(load, activeId, [
    { table: 'home_layouts', filter: `household_id=eq.${activeId}` },
  ], { name: 'home_layouts' });

  // Tot geladen tonen we de default; daarna de bewaarde layout als die er (niet-leeg) is.
  const layout = useMemo(() => {
    if (loaded && Array.isArray(saved) && saved.length) return saved;
    return defaultLayout;
  }, [loaded, saved, defaultLayout]);

  // Bewaar (optimistisch): pas lokaal aan en upsert. Bij een fout valt de volgende
  // realtime-/reload terug op de serverwaarheid.
  const save = useCallback(async (next) => {
    setSaved(next);
    if (!activeId || !user) return;
    await mutate(
      supabase.from('home_layouts').upsert(
        { profile_id: user.id, household_id: activeId, layout: next, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id,household_id' }
      ),
      { context: 'home-layout opslaan' }
    ).catch(() => {});
  }, [activeId, user]);

  return { layout, save, loaded };
}
