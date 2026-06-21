import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// Centrale realtime-helper voor de collectie-hooks. Roept `loadFn()` aan bij mount
// en na elke wijziging op de opgegeven postgres_changes-bronnen, en beheert het
// kanaal (uniek topic + opruimen). Vervangt de identieke loadRef + channel-
// boilerplate die los in useCollection/useExpenses/usePurchases/useMealPlan/
// useReservations/useRecipe/useTaskCompletions stond — één plek om over realtime
// te redeneren (en de seam voor latere optimalisaties: incrementeel patchen,
// gedeelde kanalen, strengere filters).
//
// Parameters:
//   loadFn        async (her)laadfunctie. Aangeroepen bij mount en na elke realtime-
//                 wijziging. Mag van identiteit wisselen (bv. een nieuw weekvenster) —
//                 dat triggert een herlaad, niet een her-subscribe.
//   subscribeKey  waarde die een HER-subscribe triggert (activeId/resourceId/recipeId).
//                 Falsy → niet abonneren (de hook handelt de lege staat zelf af in loadFn).
//   sources       [{ table, filter? }] — één of meer postgres_changes-bronnen.
//   name          topic-prefix (leesbaarheid/debug).
//
// Waarom een uniek topic per mount: een vást topic geeft bij een tweede mount
// (React Strict Mode / Fast Refresh, met nog-lopende async cleanup) het al-joinde
// kanaal terug, waarna `.on()` faalt met "cannot add postgres_changes callbacks
// after subscribe()". Een random suffix geeft altijd een vers kanaal.
export function useRealtimeReload(loadFn, subscribeKey, sources, { name = 'rt' } = {}) {
  // Herlaad bij mount en wanneer loadFn van identiteit wisselt (deps-wijziging).
  useEffect(() => { loadFn(); }, [loadFn]);

  // Stabiele ref zodat de subscription niet opnieuw hoeft te abonneren als alleen
  // loadFn een nieuwe identiteit krijgt — alleen subscribeKey/sources mogen dat.
  const loadRef = useRef(loadFn);
  useEffect(() => { loadRef.current = loadFn; }, [loadFn]);

  // `sources` is statisch per hook maar elke render een nieuw array-literal;
  // serialiseer naar een stabiele effect-dep zodat we niet elke render her-subscriben.
  const sourcesKey = JSON.stringify(sources);
  useEffect(() => {
    if (!subscribeKey) return undefined;
    const topic = `${name}:${subscribeKey}:${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(topic);
    for (const { table, filter } of sources) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => loadRef.current(),
      );
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
    // sources is gevangen via sourcesKey; loadFn via loadRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeKey, sourcesKey, name]);
}
