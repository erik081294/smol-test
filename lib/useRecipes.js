import { useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { useCollection } from './useCollection';
import { useRealtimeReload } from './useRealtimeReload';
import { normalize } from './productMatch';
import { storagePath, collectPhotoPaths } from './plantPhoto';
import { uploadPhoto, useSignedUrl, deletePhotoObjects } from './photoStorage';

// Recept-omslagfoto (MLT-3): upload naar de 'recipes'-bucket (0034) op een household-
// gescopet pad <household_id>/<recipe_id>.<ext> en zet recipes.photo_path. Eén cover per
// recept (upsert). Hergebruikt de gedeelde opslag-helpers (lib/photoStorage.js).
export const RECIPE_BUCKET = 'recipes';

export async function addRecipePhoto({ householdId, recipeId, asset }) {
  const path = storagePath(householdId, recipeId, asset.ext);
  await uploadPhoto({ bucket: RECIPE_BUCKET, path, base64: asset.base64, ext: asset.ext });
  await mutate(
    supabase.from('recipes').update({ photo_path: path }).eq('id', recipeId),
    { context: 'receptfoto opslaan' }
  );
  return path;
}

export function useRecipePhotoUrl(path, refreshKey) {
  return useSignedUrl(RECIPE_BUCKET, path, refreshKey);
}

// Receptenlijst (MLT-2) bovenop useCollection (household-breed, is_member-RLS).
export function useRecipes() {
  const c = useCollection('recipes', {
    label: 'recepten',
    module: 'maaltijden',
    order: [{ column: 'title', ascending: true }],
  });
  // Maak een recept en geef de rij terug (incl. id) zodat de editor er meteen
  // ingrediënten aan kan hangen.
  const addRecipe = ({ title, servings = 2, instructions = null, sourceUrl = null, mealMoment = null, dishType = null }) =>
    mutate(
      supabase.from('recipes').insert({
        household_id: c.activeId, created_by: c.user.id,
        title: title.trim(), servings, instructions, source_url: sourceUrl,
        meal_moment: mealMoment, dish_type: dishType,
      }).select().single(),
      { context: 'recept toevoegen' }
    );
  // Recept verwijderen: ruim ook de omslagfoto in storage op (anders blijft 'm als wees
  // hangen). Eerst de rij weg (de bron van waarheid), dán best-effort de storage-cleanup —
  // zo zien we nooit een nog-bestaand recept met een verdwenen foto.
  const removeRecipe = async (id) => {
    const recipe = c.items.find((r) => r.id === id);
    const result = await c.remove(id);
    await deletePhotoObjects(RECIPE_BUCKET, collectPhotoPaths([recipe]));
    return result;
  };

  return {
    recipes: c.items,
    loading: c.loading,
    reload: c.reload,
    addRecipe,
    updateRecipe: c.update,
    removeRecipe,
    activeId: c.activeId,
    user: c.user,
  };
}

// Eén recept + zijn ingrediënten, met realtime (patroon useExpenses). Voor de
// recept-editor/detail. ingredient-CRUD via mutate.
export function useRecipe(recipeId) {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!recipeId || recipeId === 'new') { setRecipe(null); setIngredients([]); setLoading(false); return; }
    const data = await run(
      supabase.from('recipes').select('*, recipe_ingredients(*)').eq('id', recipeId).single(),
      { fallback: null, context: 'recept laden' }
    );
    if (data) {
      setRecipe(data);
      setIngredients([...(data.recipe_ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order));
    }
    setLoading(false);
  }, [recipeId]);

  // Laden + realtime: ingrediënten van dit recept. Het 'new'-sentinel (en geen id)
  // abonneert niet — loadFn wist dan de staat.
  const realtimeKey = recipeId && recipeId !== 'new' ? recipeId : null;
  useRealtimeReload(load, realtimeKey, [
    { table: 'recipe_ingredients', filter: `recipe_id=eq.${recipeId}` },
  ], { name: 'recipe' });

  const addIngredient = ({ name, quantity = 1, unit = 'stuk', productId = null, catalogProductId = null }) =>
    mutate(
      supabase.from('recipe_ingredients').insert({
        household_id: activeId, recipe_id: recipeId,
        name: name.trim(), quantity, unit,
        product_id: productId, catalog_product_id: catalogProductId,
        sort_order: ingredients.length,
      }),
      { context: 'ingrediënt toevoegen' }
    );

  const updateIngredient = (id, patch) =>
    mutate(supabase.from('recipe_ingredients').update(patch).eq('id', id), { context: 'ingrediënt bijwerken' });

  const removeIngredient = (id) =>
    mutate(supabase.from('recipe_ingredients').delete().eq('id', id), { context: 'ingrediënt verwijderen' });

  return { recipe, ingredients, loading, reload: load, addIngredient, updateIngredient, removeIngredient };
}

// Hulp: bouw een { [recipeId]: { servings, ingredients } } map voor een set
// recept-ids (voor de boodschappenlijst-aggregatie). Eén query per tabel.
export async function fetchRecipesWithIngredients(recipeIds = []) {
  const ids = [...new Set(recipeIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const rows = await run(
    supabase.from('recipes').select('id, servings, recipe_ingredients(*)').in('id', ids),
    { fallback: [], context: 'recepten voor lijst laden' }
  );
  const map = {};
  for (const r of rows ?? []) {
    map[r.id] = { servings: r.servings, ingredients: r.recipe_ingredients ?? [] };
  }
  return map;
}

export { normalize };
