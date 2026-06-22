import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { createRealtimeHub } from './realtimeHub';

// Eén app-brede hub bovenop de echte Supabase-client (module-singleton): alle hooks
// delen 'm, zodat per huishouden één kanaal volstaat.
const { subscribe: subscribeShared } = createRealtimeHub(supabase);

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
//   onChange      optioneel (payload) => void. Aanwezig → de helper roept dit per
//                 realtime-event aan i.p.v. een full reload (loadFn) — de naad voor
//                 incrementeel patchen (INF-8 C3). Afwezig → huidig gedrag
//                 (reload-on-event). De mount-fetch via loadFn() blijft altijd.
//
// Abonneren gaat via de gedeelde realtime-hub (lib/realtimeHub.js): álle hooks van één
// huishouden delen één kanaal, met per unieke (tabel, filter) precies één listener die
// fan-out't. Dat lost de "hook-storm" op (N kanalen → 1) zónder de API hier te wijzigen.
export function useRealtimeReload(loadFn, subscribeKey, sources, { name = 'rt', onChange } = {}) {
  // Herlaad bij mount en wanneer loadFn van identiteit wisselt (deps-wijziging).
  useEffect(() => { loadFn(); }, [loadFn]);

  // Stabiele refs zodat de subscription niet opnieuw hoeft te abonneren als alleen
  // loadFn/onChange een nieuwe identiteit krijgt — alleen subscribeKey/sources mogen dat.
  const loadRef = useRef(loadFn);
  useEffect(() => { loadRef.current = loadFn; }, [loadFn]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // `sources` is statisch per hook maar elke render een nieuw array-literal;
  // serialiseer naar een stabiele effect-dep zodat we niet elke render her-abonneren.
  const sourcesKey = JSON.stringify(sources);
  useEffect(() => {
    if (!subscribeKey) return undefined;
    // Eén stabiele callback (leest de actuele refs): incrementeel patchen via onChange,
    // anders een full reload. Wordt door de hub aangeroepen per realtime-event.
    const cb = (payload) => (onChangeRef.current ? onChangeRef.current(payload) : loadRef.current());
    const listeners = (sources ?? []).map((s) => ({ table: s.table, filter: s.filter, cb }));
    return subscribeShared(subscribeKey, listeners, name);
    // sources is gevangen via sourcesKey; loadFn/onChange via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeKey, sourcesKey, name]);
}
