import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useRealtimeReload } from './useRealtimeReload';
import { disabledByAxis } from './timelineFilter';

// Tijdlijn-filters, twee lagen (TML-6, plan 19). Dunne hook op de prefs-tabellen
// uit migratie 0076 — zelfde model als de module-toggles in lib/household.js:
// household_timeline_prefs (owner zet de basis) + user_timeline_prefs (elk lid
// verfijnt voor zichzelf). DEFAULT-ON: de tabellen bevatten alleen overrides; de
// effectieve beslissing valt in de pure visibleOnTimeline (lib/timelineFilter.js),
// gevoed met de per-as-uitzetlijsten die deze hook oplevert.
//
// Schrijven is optimistisch (de Switch beweegt direct mee, zoals setHouseholdModule);
// mislukt de server, dan herladen we naar de serverwaarheid en gooien we door.

// Vervang (of voeg toe) de override-rij voor (axis, value) in een lokale rijenlijst.
function withPref(rows, axis, value, enabled) {
  return [...rows.filter((r) => !(r.axis === axis && r.value === value)), { axis, value, enabled }];
}

export function useTimelineFilters() {
  const { activeId } = useHousehold();
  const { user } = useAuth();

  const [hhRows, setHhRows] = useState([]);
  const [myRows, setMyRows] = useState([]);

  const load = useCallback(async () => {
    if (!activeId || !user) { setHhRows([]); setMyRows([]); return; }
    const [hh, mine] = await Promise.all([
      run(
        supabase.from('household_timeline_prefs').select('axis, value, enabled')
          .eq('household_id', activeId),
        { fallback: [], context: 'tijdlijn-filters (huishouden) laden' },
      ),
      run(
        supabase.from('user_timeline_prefs').select('axis, value, enabled')
          .eq('household_id', activeId).eq('profile_id', user.id),
        { fallback: [], context: 'tijdlijn-filters (jij) laden' },
      ),
    ]);
    setHhRows(hh ?? []);
    setMyRows(mine ?? []);
  }, [activeId, user]);

  useEffect(() => { load(); }, [load]);

  useRealtimeReload(load, activeId, [
    { table: 'household_timeline_prefs', filter: `household_id=eq.${activeId}` },
    { table: 'user_timeline_prefs', filter: `household_id=eq.${activeId}` },
  ], { name: 'timeline_prefs' });

  // Per-as-uitzetlijsten voor visibleOnTimeline, gememoiseerd zodat consumers
  // (de feed-filter) alleen her-rekenen als er écht een pref wijzigt.
  const householdDisabled = useMemo(() => disabledByAxis(hhRows), [hhRows]);
  const userDisabled = useMemo(() => disabledByAxis(myRows), [myRows]);

  // Basis-filter voor het hele huishouden (alleen de owner; RLS dwingt af).
  const setHouseholdPref = useCallback(async (axis, value, enabled) => {
    setHhRows((cur) => withPref(cur, axis, value, enabled));
    try {
      await mutate(
        supabase.from('household_timeline_prefs').upsert(
          { household_id: activeId, axis, value, enabled },
          { onConflict: 'household_id,axis,value' },
        ),
        { context: 'tijdlijn-filter (huishouden)' },
      );
    } catch (e) {
      await load(); // rollback naar serverwaarheid
      throw e;
    }
  }, [activeId, load]);

  // Persoonlijke verfijning, binnen wat het huishouden aanbiedt.
  const setUserPref = useCallback(async (axis, value, enabled) => {
    setMyRows((cur) => withPref(cur, axis, value, enabled));
    try {
      await mutate(
        supabase.from('user_timeline_prefs').upsert(
          { household_id: activeId, profile_id: user.id, axis, value, enabled },
          { onConflict: 'household_id,profile_id,axis,value' },
        ),
        { context: 'tijdlijn-filter (jij)' },
      );
    } catch (e) {
      await load(); // rollback naar serverwaarheid
      throw e;
    }
  }, [activeId, user, load]);

  return { householdDisabled, userDisabled, setHouseholdPref, setUserPref, reload: load };
}
