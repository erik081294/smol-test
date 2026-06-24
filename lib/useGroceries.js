import { useCollection } from './useCollection';

// Boodschappen-module bovenop useCollection. De gedeelde lijst is bewust
// huishouden-breed (visibility blijft de default 'household'); het datamodel
// ondersteunt subgroepen wél, dus een latere "privé-lijst" kan zonder migratie.
export function useGroceries() {
  const c = useCollection('groceries', {
    label: 'boodschappen',
    creatorColumn: 'added_by',
    order: [
      { column: 'checked', ascending: true },
      { column: 'created_at', ascending: false },
    ],
  });

  const toggle = (item) => c.update(item.id, { checked: !item.checked });

  // Vrije-tekst aantal op een lijstrij bijstellen ("2 pak", of null = enkelvoud).
  // De inline +/−-stepper op de open rij werkt hierop (lib/quantity.js).
  const setQuantity = (item, quantity) => c.update(item.id, { quantity: quantity ?? null });

  return {
    items: c.items,
    loading: c.loading,
    reload: c.reload,
    // Optioneel gekoppeld aan een catalogusproduct: `productId` = per-huishouden
    // product (BOO-5, voedt de prijsdata); `catalogProductId` = globaal product
    // (legacy). `quantity` is vrije tekst ("2 pak") voor "meerdere halen". Alle optioneel.
    add: (name, productId = null, catalogProductId = null, quantity = null) => c.create({
      name,
      ...(productId ? { product_id: productId } : {}),
      ...(catalogProductId ? { catalog_product_id: catalogProductId } : {}),
      ...(quantity ? { quantity } : {}),
    }),
    toggle,
    setQuantity,
    remove: c.remove,
    // Bulk-delete (optimistisch). Het scherm stelt de echte wis uit achter een
    // "ongedaan maken"-toast; daarom geven we removeMany rechtstreeks door.
    removeMany: c.removeMany,
  };
}
