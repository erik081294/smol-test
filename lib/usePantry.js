import { useCollection } from './useCollection';
import { aggregatePurchaseItems, purchaseItemKey } from './pantry';

// Voorraad (VOO-1) bovenop de generieke useCollection-hook. Household-breed
// (is_member-RLS); de creator-/wijziger-kolom is `updated_by`. De status-/sorteer-
// logica leeft puur in lib/pantry.js.
export function usePantry() {
  const c = useCollection('pantry_items', {
    label: 'voorraad',
    module: 'voorraad',
    creatorColumn: 'updated_by',
    order: [{ column: 'created_at', ascending: false }],
  });

  const add = ({ name, productId, catalogProductId, quantity = 1, unit = 'stuk', location = 'kast', bestBefore = null, lowThreshold = null }) =>
    c.create({
      name: name.trim(),
      quantity,
      unit,
      location,
      best_before: bestBefore,
      low_threshold: lowThreshold,
      ...(productId ? { product_id: productId } : {}),
      ...(catalogProductId ? { catalog_product_id: catalogProductId } : {}),
    });

  // Hoeveelheid bijstellen (+1/−1), nooit onder 0. Werkt updated_* bij.
  const adjustQuantity = (item, delta) =>
    c.update(item.id, {
      quantity: Math.max(0, (Number(item.quantity) || 0) + delta),
      updated_by: c.user.id,
      updated_at: new Date().toISOString(),
    });

  const update = (id, patch) =>
    c.update(id, { ...patch, updated_by: c.user.id, updated_at: new Date().toISOString() });

  // Voorraad bijvullen vanuit een bon: bestaande regel (zelfde product/naam + unit)
  // ophogen, anders een nieuwe voorraadregel aanmaken. Items zonder naam overslaan.
  const restockFromPurchase = async (purchaseItems = []) => {
    const byKey = new Map(c.items.map((p) => [purchaseItemKey(p), p]));
    // Eerst per product+unit optellen (aggregatePurchaseItems): zo wordt een bon met 2×
    // hetzelfde product één ophoging i.p.v. twee botsende schrijfacties vanuit dezelfde
    // snapshot — dan gaat er geen hoeveelheid verloren (review P4).
    await Promise.all(
      aggregatePurchaseItems(purchaseItems).map((i) => {
        const existing = byKey.get(i.key);
        if (existing) return adjustQuantity(existing, i.quantity);
        return add({
          name: i.name,
          productId: i.product_id,
          catalogProductId: i.catalog_product_id,
          quantity: i.quantity,
          unit: i.unit,
        });
      })
    );
  };

  return {
    items: c.items,
    loading: c.loading,
    error: c.error,
    reload: c.reload,
    add,
    update,
    adjustQuantity,
    remove: c.remove,
    removeMany: c.removeMany,
    restockFromPurchase,
    activeId: c.activeId,
    user: c.user,
  };
}
