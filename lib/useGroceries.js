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

  return {
    items: c.items,
    loading: c.loading,
    reload: c.reload,
    // Optioneel gekoppeld aan een catalogusproduct (BOO-5): voedt later de
    // prijsdata en de "op de bon zetten"-loop.
    add: (name, productId = null) => c.create({ name, ...(productId ? { product_id: productId } : {}) }),
    toggle,
    remove: c.remove,
    // Bulk-delete (optimistisch). Het scherm stelt de echte wis uit achter een
    // "ongedaan maken"-toast; daarom geven we removeMany rechtstreeks door.
    removeMany: c.removeMany,
  };
}
