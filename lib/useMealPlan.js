import { useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { weekRange, aggregateIngredients } from './mealPlan';
import { shoppingGap } from './pantry';
import { useRealtimeReload } from './useRealtimeReload';
import { fetchRecipesWithIngredients } from './useRecipes';
import { setCached, cacheKey } from './dataCache';
import { useCachedCollection } from './useCachedCollection';

// Weekmenu (MLT-1). Laadt de meal_plan_entries voor één weekvenster (maandag-start)
// met realtime, en levert de "menu → boodschappenlijst (− voorraad)"-flow.
//   weekStart: Date binnen de gewenste week (default = deze week).
export function useMealPlan(weekStart = new Date()) {
  const { activeId } = useHousehold();
  const { user } = useAuth();

  // Stabiliseer het weekvenster (PERF-4): callers geven vaak een verse `new Date()` mee,
  // waardoor weekRange élke render een nieuwe days-array (en weekDays-referentie) opleverde.
  // Keyed op de dag-sleutel blijft het venster referentieel stabiel zolang de dag niet
  // wisselt; parseISO reconstrueert lokale middernacht (timezone-veilig, anders dan new Date).
  const dayKey = format(weekStart, 'yyyy-MM-dd');
  const { days } = useMemo(() => weekRange(parseISO(dayKey)), [dayKey]);
  const from = days[0], to = days[6];

  // Stale-while-revalidate, per weekvenster gekeyd zodat een ander venster niet de
  // verkeerde cache toont (PERF-2) — seed + venster-wissel-reset via de gedeelde hook.
  const key = activeId ? cacheKey('meal_plan_entries', activeId, from) : null;
  const [entries, setEntries, loading, setLoading] = useCachedCollection(key);

  const load = useCallback(async () => {
    if (!activeId) { setEntries([]); setLoading(false); return; }
    const data = await run(
      supabase.from('meal_plan_entries').select('*, recipe:recipes(id, title, servings)')
        .eq('household_id', activeId).gte('plan_date', from).lte('plan_date', to)
        .order('plan_date', { ascending: true }),
      { fallback: [], context: 'weekmenu laden' }
    );
    const rows = data ?? [];
    setEntries(rows);
    setCached(cacheKey('meal_plan_entries', activeId, from), rows);
    setLoading(false);
  }, [activeId, from, to]);

  // Laden + realtime. Het venster (from/to) zit in loadFn → een nieuw weekvenster
  // herlaadt; alleen activeId triggert een her-subscribe.
  useRealtimeReload(load, activeId, [
    { table: 'meal_plan_entries', filter: `household_id=eq.${activeId}` },
  ], { name: 'mealplan' });

  const addEntry = ({ planDate, mealType = 'diner', recipeId = null, title = null, servings = 2, note = null, eaterIds = [], extraEaters = 0 }) =>
    mutate(
      supabase.from('meal_plan_entries').insert({
        household_id: activeId, created_by: user.id,
        plan_date: planDate, meal_type: mealType, recipe_id: recipeId,
        title: title?.trim() || null, servings, note,
        eater_ids: eaterIds, extra_eaters: extraEaters,
      }),
      { context: 'maaltijd toevoegen' }
    );

  const updateEntry = (id, patch) =>
    mutate(supabase.from('meal_plan_entries').update(patch).eq('id', id), { context: 'maaltijd bijwerken' });

  const removeEntry = (id) =>
    mutate(supabase.from('meal_plan_entries').delete().eq('id', id), { context: 'maaltijd verwijderen' });

  // Behoefte van de hele week (geschaald op servings) minus de voorraad.
  // -> [{ key, name, productId, catalogProductId, unit, quantity }]
  const buildShoppingList = async (pantryItems = []) => {
    const recipeIds = entries.map((e) => e.recipe_id).filter(Boolean);
    const recipesById = await fetchRecipesWithIngredients(recipeIds);
    const needed = aggregateIngredients(
      entries.map((e) => ({ recipe_id: e.recipe_id, servings: e.servings })),
      recipesById
    );
    return shoppingGap(needed, pantryItems);
  };

  // Voeg de gekozen items in één transactie toe aan de boodschappenlijst (add_groceries RPC).
  // Geeft de aangemaakte rijen terug (voor een undo-toast).
  const commitShoppingList = async (items = []) => {
    if (items.length === 0) return [];
    const payload = items.map((i) => ({
      name: i.name,
      product_id: i.productId ?? null,
      catalog_product_id: i.catalogProductId ?? null,
    }));
    return mutate(
      supabase.rpc('add_groceries', { p_household_id: activeId, p_items: payload }),
      { context: 'boodschappen toevoegen' }
    );
  };

  return { entries, loading, reload: load, weekDays: days, addEntry, updateEntry, removeEntry, buildShoppingList, commitShoppingList };
}
