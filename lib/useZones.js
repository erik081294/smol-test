import { useCollection } from './useCollection';

// Zones zijn structuur, geen "item" met het zichtbaarheidscontract — maar de
// generieke huishouden-gescopete CRUD + realtime van useCollection past prima.
// We geven simpelweg geen visibility-payload mee bij het aanmaken.
export function useZones() {
  const c = useCollection('zones', {
    label: 'zones',
    order: [{ column: 'sort_order', ascending: true }, { column: 'created_at', ascending: true }],
  });
  return {
    zones: c.items,
    loading: c.loading,
    reload: c.reload,
    addZone: c.create,    // ({ name, emoji, sort_order })
    updateZone: c.update,
    removeZone: c.remove,
  };
}
