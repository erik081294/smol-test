import { supabase } from './supabase';
import { mutate } from './db';
import { useCollection } from './useCollection';

// Tags-module bovenop de generieke collectie-hook (UX-41). Door gebruikers gemaakte,
// gekleurde labels per huishouden, die aan afspraken hangen (tasks.tag_ids) en de
// filters voeden. `addTag` doet een insert mét select zodat de aanroeper het nieuwe
// id meteen aan een afspraak kan koppelen (de realtime-echo komt iets later).
export function useTags() {
  const c = useCollection('tags', {
    label: 'tags',
    order: [{ column: 'name', ascending: true }],
  });

  const addTag = async ({ name, color }) => {
    const rows = await mutate(
      supabase.from('tags').insert({
        name: name.trim(), color, household_id: c.activeId, created_by: c.user.id,
      }).select(),
      { context: 'tag toevoegen' },
    );
    return rows?.[0] ?? null;
  };

  return {
    tags: c.items,
    loading: c.loading,
    error: c.error,
    reload: c.reload,
    addTag,
    updateTag: c.update,
    deleteTag: c.remove,
  };
}
