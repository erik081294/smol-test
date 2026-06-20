import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useCollection } from './useCollection';
import { visibilityPayload } from './visibility';

// Gedeelde resources (AUT-1) via useCollection (zichtbaarheidscontract).
export function useResources() {
  const c = useCollection('shared_resources', {
    label: 'gedeelde items',
    order: [{ column: 'name', ascending: true }],
  });
  const addResource = ({ name, kind = 'overig', notes = null, visibility, shareSubgroupId, shareWith }) =>
    mutate(
      supabase.from('shared_resources').insert({
        household_id: c.activeId, created_by: c.user.id,
        name: name.trim(), kind, notes,
        ...visibilityPayload({ visibility, shareSubgroupId, shareWith }),
      }).select().single(),
      { context: 'gedeeld item toevoegen' }
    );
  return {
    resources: c.items, loading: c.loading, reload: c.reload,
    addResource, updateResource: c.update, removeResource: c.remove,
    activeId: c.activeId, user: c.user,
  };
}

// Reserveringen van één resource, met realtime (patroon useExpenses/useRecipe).
export function useReservations(resourceId) {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!resourceId) { setReservations([]); setLoading(false); return; }
    const data = await run(
      supabase.from('reservations').select('*').eq('resource_id', resourceId).order('starts_at', { ascending: true }),
      { fallback: [], context: 'reserveringen laden' }
    );
    setReservations(data ?? []);
    setLoading(false);
  }, [resourceId]);

  useEffect(() => { load(); }, [load]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    if (!resourceId) return undefined;
    const ch = supabase
      .channel(`reservations:${resourceId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `resource_id=eq.${resourceId}` }, () => loadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [resourceId]);

  const addReservation = ({ startsAt, endsAt, note = null, usageValue = null }) =>
    mutate(
      supabase.from('reservations').insert({
        household_id: activeId, resource_id: resourceId, profile_id: user.id,
        starts_at: startsAt, ends_at: endsAt, note, usage_value: usageValue,
      }),
      { context: 'reservering toevoegen' }
    );

  const updateReservation = (id, patch) =>
    mutate(supabase.from('reservations').update(patch).eq('id', id), { context: 'reservering bijwerken' });

  const removeReservation = (id) =>
    mutate(supabase.from('reservations').delete().eq('id', id), { context: 'reservering verwijderen' });

  return { reservations, loading, reload: load, addReservation, updateReservation, removeReservation };
}
