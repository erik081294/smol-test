import { useState, useEffect } from 'react';
import { getCached } from './dataCache';

// Gedeelde stale-while-revalidate-seed + reset-bij-sleutelwissel voor de collectie-hooks
// met een eigen geneste/gevensterde load (useExpenses/usePurchases/useMealPlan). Die
// kunnen niet op de generieke useCollection leunen — geneste select, een query-venster,
// genormaliseerde rijen, dubbele-tabel-realtime of een venster-gekeyde cache — maar
// herhaalden allemaal exact ditzelfde blokje:
//   • seed de begintoestand uit lib/dataCache, zodat een herbezochte tab meteen data
//     toont i.p.v. een laad-skelet (PERF-2);
//   • toon bij een sleutelwissel (ander huishouden, of bij het weekmenu een ander
//     weekvenster) meteen de cache van de níeuwe sleutel — of leeg — i.p.v. de oude data
//     te laten staan tot de revalidatie klaar is.
// `key` is de dataCache-sleutel (null = geen actief huishouden → leeg, niet-ladend).
// Geeft [items, setItems, loading, setLoading] terug. De hook doet bewust géén fetch of
// realtime: die logica verschilt te veel per consumer om te delen — dit is enkel de
// gedeelde state-seed.
export function useCachedCollection(key) {
  const initial = key ? getCached(key) : undefined;
  const [items, setItems] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    if (!key) { setItems([]); setLoading(false); return; }
    const cached = getCached(key);
    setItems(cached ?? []);
    setLoading(cached === undefined);
  }, [key]);

  return [items, setItems, loading, setLoading];
}
