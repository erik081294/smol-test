import { supabase } from './supabase';
import { useCollection } from './useCollection';
import { mutate } from './db';

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

  // Alle afgevinkte items in één keer wissen (bulk, dus niet via remove(id)).
  const clearChecked = () => mutate(
    supabase.from('groceries').delete().eq('household_id', c.activeId).eq('checked', true),
    { context: 'afgevinkte boodschappen wissen' }
  );

  return {
    items: c.items,
    loading: c.loading,
    reload: c.reload,
    add: (name) => c.create({ name }),
    toggle,
    remove: c.remove,
    clearChecked,
  };
}
