import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { isPending, subscribePending, pendingVersion } from './pendingDeletes';

// Bonnen (BOO-2) mét hun regels. useCollection kan geen geneste select, dus we
// volgen het patroon van lib/useExpenses.js: één query met embedded purchase_items
// + een realtime-subscription op beide tabellen. Catalogus/bonnen zijn household-
// breed (is_member-RLS), dus geen visibility-payload nodig.
export function usePurchases() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) { setPurchases([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('purchases')
        .select('*, purchase_items(*)')
        .eq('household_id', activeId)
        .order('purchased_on', { ascending: false })
        .order('created_at', { ascending: false }),
      { fallback: [], context: 'bonnen laden' }
    );
    setPurchases(data ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: herlaad bij wijzigingen op purchases (gefilterd op huishouden) én op
  // purchase_items (geen household-filter nodig; RLS houdt het veilig).
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    if (!activeId) return;
    const suffix = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`purchases:${activeId}:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: `household_id=eq.${activeId}` }, () => loadRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_items' }, () => loadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  // Nieuwe bon: purchase + regels atomair via de RPC. items: [{ product_id?, name,
  // quantity, unit, unit_price_cents, line_total_cents }]. De bon-foto is een latere
  // stap (bucket 'receipts', migratie 0014) — voorlopig photo_path null.
  const addPurchase = async ({ store, purchasedOn, totalCents, items }) => {
    const id = await mutate(
      supabase.rpc('create_purchase', {
        p_household_id: activeId,
        p_store: store?.trim() || null,
        p_purchased_on: purchasedOn ?? null,
        p_total_cents: totalCents ?? null,
        p_photo_path: null,
        p_items: items.map((i) => ({
          product_id: i.product_id ?? null,
          name: i.name,
          quantity: i.quantity ?? 1,
          unit: i.unit ?? 'stuk',
          unit_price_cents: i.unit_price_cents ?? null,
          line_total_cents: i.line_total_cents ?? null,
        })),
      }),
      { context: 'bon opslaan' }
    );
    await load();
    return id;
  };

  const deletePurchase = (id) =>
    mutate(supabase.from('purchases').delete().eq('id', id), { context: 'bon verwijderen' });

  // Verberg bonnen waarvan de undo-toast nog loopt (zie lib/pendingDeletes.js).
  useSyncExternalStore(subscribePending, pendingVersion, pendingVersion);
  const visible = purchases.filter((p) => !isPending(p.id));

  return { purchases: visible, loading, reload: load, addPurchase, deletePurchase, user };
}

// Alle bonregels van één product (nieuwste eerst), de bron voor de prijstracker
// (lib/priceTrack.js). Inclusief winkel + datum van de parent-bon. RLS filtert mee.
export function useProductPrices(productId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!productId) { setItems([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('purchase_items')
        .select('id, unit, quantity, unit_price_cents, line_total_cents, created_at, purchase:purchases(store, purchased_on)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false }),
      { fallback: [], context: 'prijshistorie laden' }
    );
    // Plat naar de vorm die lib/priceTrack.js verwacht: { purchased_on, store, unit_price_cents }.
    setItems((data ?? []).map((r) => ({
      ...r,
      store: r.purchase?.store ?? null,
      purchased_on: r.purchase?.purchased_on ?? null,
    })));
    setLoading(false);
  }, [productId]);
  useEffect(() => { load(); }, [load]);
  return { items, loading, reload: load };
}
