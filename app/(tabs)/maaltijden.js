/* eslint-disable react-hooks/immutability -- Reanimated-worklets muteren SharedValue.value bewust (de regel ziet shared values ten onrechte als onveranderbaar). */
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Image, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, parseISO, addDays, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useMealPlan } from '../../lib/useMealPlan';
import { useRecipes, useRecipePhotoUrl } from '../../lib/useRecipes';
import { usePantry } from '../../lib/usePantry';
import { useGroceries } from '../../lib/useGroceries';
import { useHousehold } from '../../lib/household';
import { useToast } from '../../lib/toast';
import {
  Empty, ScreenHeader, ItemRow, IconButton, ListSkeleton, Chip, Row, Card, Button,
  Badge, ModalHeader, Field, Stepper, Checkbox, BottomSheet, SwipeRow, SheetScrollView,
  SegmentedControl, Avatar,
} from '../../lib/ui';
import { filterRecipes, MEAL_MOMENTS, DISH_TYPES, dishTypeMeta } from '../../lib/recipeCatalog';
import { SearchField } from '../../lib/SearchField';
import { defaultServings, eaterCount } from '../../lib/mealPlan';
import { Icon } from '../../lib/icons';
import { colors, space, type, radius, screenPadding } from '../../lib/theme';
import { animateNextLayout, prefersReducedMotion } from '../../lib/motion';
import { success } from '../../lib/haptics';
import { MEAL_TYPES } from '../../lib/constants';
import { t, plural } from '../../lib/i18n';

// "Keuken" — de eigen omgeving voor het weekmenu (plannen) én het beheren van recepten.
// Eén scherm met een Weekmenu/Recepten-toggle; Boodschappen staat los (de "uit recept →
// lijst"-flow blijft hier). Door de weken bladeren kan met de ‹ › knoppen óf zijwaarts vegen.
export default function Keuken() {
  const dialog = useDialog();
  const router = useRouter();
  const [view, setView] = useState('weekmenu'); // 'weekmenu' | 'recepten'
  const [weekStart, setWeekStart] = useState(new Date());
  const { entries, loading, reload, weekDays, addEntry, removeEntry, buildShoppingList, commitShoppingList } = useMealPlan(weekStart);
  const { recipes, loading: recipesLoading, removeRecipe } = useRecipes();
  const { items: pantryItems } = usePantry();
  const { removeMany: removeGroceries } = useGroceries();
  const { members } = useHousehold();
  const toast = useToast();

  // Snel een profiel-id → lid opzoeken voor de eters-avatars op de dagkaart.
  const memberById = useMemo(() => Object.fromEntries((members ?? []).map((m) => [m.id, m])), [members]);

  const [addFor, setAddFor] = useState(null);
  const [planRecipeId, setPlanRecipeId] = useState(null);
  const [listItems, setListItems] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);

  // "Inplannen" vanaf een receptpagina (?planRecipe=<id>): spring naar het weekmenu en
  // open de toevoeg-sheet met dit recept voorgevuld voor de eerste dag van de week. Daarna
  // de param wissen zodat 'ie niet opnieuw afgaat bij een re-render.
  const params = useLocalSearchParams();
  React.useEffect(() => {
    const rid = typeof params.planRecipe === 'string' ? params.planRecipe : null;
    if (!rid) return;
    setView('weekmenu');
    setPlanRecipeId(rid);
    setAddFor(weekDays[0]);
    router.setParams({ planRecipe: undefined });
  }, [params.planRecipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = {};
    for (const e of entries) {
      if (hiddenIds.includes(e.id)) continue;
      (m[e.plan_date] ??= []).push(e);
    }
    for (const d of Object.keys(m)) m[d].sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type));
    return m;
  }, [entries, hiddenIds]);

  const weekLabel = `${format(parseISO(weekDays[0]), 'd MMM', { locale: nl })} – ${format(parseISO(weekDays[6]), 'd MMM', { locale: nl })}`;

  // Zijwaarts door de weken vegen (zoals Taken): content schuift mee, nieuwe week komt van
  // de overkant binnen. ‹ › blijven als bediening. activeOffsetX/failOffsetY laten verticaal
  // scrollen ongemoeid; bij "verminder beweging" springt 'ie direct.
  const { width: SCREEN_W } = useWindowDimensions();
  const reduce = prefersReducedMotion();
  const tx = useSharedValue(0);
  const listAnim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const stepWeek = (delta) => setWeekStart((d) => addDays(d, delta * 7));
  const slideWeek = (delta) => {
    if (reduce) { stepWeek(delta); return; }
    const out = delta > 0 ? -SCREEN_W : SCREEN_W;
    tx.value = withTiming(out, { duration: 150 }, (finished) => {
      if (!finished) return;
      runOnJS(stepWeek)(delta);
      tx.value = -out;
      tx.value = withTiming(0, { duration: 200 });
    });
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onUpdate((e) => { 'worklet'; if (!reduce) tx.value = e.translationX; })
    .onEnd((e) => {
      'worklet';
      if (e.translationX <= -56) runOnJS(slideWeek)(1);
      else if (e.translationX >= 56) runOnJS(slideWeek)(-1);
      else tx.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const remove = (entry) => {
    animateNextLayout();
    setHiddenIds((h) => [...h, entry.id]);
    toast.show({
      message: t('meals.deleted', { name: entry.recipe?.title || entry.title || t('mealtype.' + entry.meal_type) }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => x !== entry.id)); },
      onExpire: async () => {
        try { await removeEntry(entry.id); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => x !== entry.id)); }
      },
    });
  };

  const openShoppingList = async () => {
    const gap = await buildShoppingList(pantryItems);
    setListItems(gap.map((g) => ({ ...g, selected: true })));
  };

  const onDeleteRecipe = async (recipe) => {
    const ok = await dialog.confirm({
      title: t('recipe.delete.title', { name: recipe.title }),
      body: t('recipe.delete.body'), tone: 'danger', confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    removeRecipe(recipe.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };

  const renderDay = (date) => {
    const dayEntries = byDay[date] ?? [];
    const today = isToday(parseISO(date));
    return (
      <Card style={{ marginBottom: space.md, borderColor: today ? colors.forest : colors.line }}>
        <Row justify="space-between" style={{ marginBottom: dayEntries.length ? space.sm : 0 }}>
          <Text style={[type.title, today ? { color: colors.forest } : null]}>
            {format(parseISO(date), 'EEEE d MMM', { locale: nl })}
          </Text>
          <IconButton icon="add" size={20} tint={colors.forest}
            accessibilityLabel={t('meals.addForDay')} onPress={() => setAddFor(date)} />
        </Row>
        {dayEntries.map((e) => (
          <SwipeRow key={e.id}
            left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => remove(e) }}>
            <ItemRow
              title={e.recipe?.title || e.title || t('mealtype.' + e.meal_type)}
              meta={
                <Row gap={space.sm} wrap>
                  <Badge label={t('mealtype.' + e.meal_type)} tone="brand" />
                  <Text style={type.caption}>{t('meals.entry.servings', { n: e.servings })}</Text>
                  <EaterAvatars eaterIds={e.eater_ids} extraEaters={e.extra_eaters} memberById={memberById} />
                </Row>
              }
              trailing={
                <IconButton icon="delete" size={18} tint={colors.inkFaint}
                  accessibilityLabel={t('common.delete')} onPress={() => remove(e)} />
              }
            />
          </SwipeRow>
        ))}
      </Card>
    );
  };

  const hasAny = entries.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('keuken.title')} subtitle={t('keuken.subtitle')} />

      <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <SegmentedControl
          value={view} onChange={setView}
          options={[
            { value: 'weekmenu', label: t('keuken.tab.weekmenu') },
            { value: 'recepten', label: t('keuken.tab.recepten') },
          ]} />
      </View>

      {view === 'weekmenu' ? (
        <>
          {/* Weeknavigatie — ‹ › óf zijwaarts vegen op de lijst eronder. */}
          <Row justify="space-between" align="center" style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
            <IconButton icon="back" accessibilityLabel={t('meals.prevWeek')} tint={colors.forest} onPress={() => slideWeek(-1)} />
            <Text style={type.title}>{weekLabel}</Text>
            <IconButton icon="forward" accessibilityLabel={t('meals.nextWeek')} tint={colors.forest} onPress={() => slideWeek(1)} />
          </Row>

          <GestureDetector gesture={swipe}>
            <Animated.View style={[{ flex: 1 }, listAnim]}>
              <FlatList
                contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl }}
                data={weekDays}
                keyExtractor={(d) => d}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
                renderItem={({ item }) => renderDay(item)}
                ListEmptyComponent={loading ? <ListSkeleton count={4} /> : null}
                ListFooterComponent={
                  <View style={{ marginTop: space.sm }}>
                    {!hasAny && !loading ? (
                      <Empty illustration="meals" title={t('meals.empty.title')} subtitle={t('meals.empty.subtitle')}
                        actionTitle={t('meals.empty.action')} onAction={() => setAddFor(weekDays[0])} />
                    ) : null}
                    {hasAny ? (
                      <Button title={t('meals.fillList')} icon="shopping" variant="accent" onPress={openShoppingList} />
                    ) : null}
                  </View>
                }
              />
            </Animated.View>
          </GestureDetector>
        </>
      ) : (
        <RecipesView
          recipes={recipes}
          loading={recipesLoading}
          onNew={() => router.push('/recipe/new')}
          onOpen={(r) => router.push(`/recipe/${r.id}`)}
          onDelete={onDeleteRecipe}
        />
      )}

      <AddEntryModal
        date={addFor}
        recipes={recipes}
        initialRecipeId={planRecipeId}
        onClose={() => { setAddFor(null); setPlanRecipeId(null); }}
        onAdd={addEntry}
        onNewRecipe={() => { setAddFor(null); setPlanRecipeId(null); router.push('/recipe/new'); }}
      />

      <ShoppingListModal
        items={listItems}
        onClose={() => setListItems(null)}
        onConfirm={async (selected) => {
          try {
            const rows = await commitShoppingList(selected);
            setListItems(null);
            success();
            const ids = (rows ?? []).map((r) => r.id);
            toast.show({
              message: t('meals.list.added', { n: selected.length }),
              actionLabel: t('common.undo'),
              onAction: () => { if (ids.length) removeGroceries(ids); },
            });
          } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        }}
      />
    </SafeAreaView>
  );
}

// Recepten-catalogus: zoekbalk + filter-chips (eet-moment & soort gerecht) bovenop een
// bladerbare lijst met coverfoto + categorie-badge — dezelfde beeldtaal als de
// boodschappen-catalogus (catalog.js). Tik → receptpagina (lezen), swipe = verwijderen.
function RecipesView({ recipes, loading, onNew, onOpen, onDelete }) {
  const [query, setQuery] = useState('');
  const [moment, setMoment] = useState(null);
  const [dishType, setDishType] = useState(null);
  const q = query.trim();
  const filtered = useMemo(
    () => filterRecipes(recipes, { query: q, moment, dishType }),
    [recipes, q, moment, dishType],
  );
  const hasFilter = !!(q || moment || dishType);

  return (
    <View style={{ flex: 1 }}>
      {/* Zoekbalk (gelijk aan de boodschappen-catalogus) */}
      <View style={{ paddingHorizontal: screenPadding }}>
        <SearchField value={query} onChangeText={setQuery} label={t('recipes.search')} />
      </View>

      {/* Twee filter-assen: eet-moment + soort gerecht. Nogmaals tikken = filter uit. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingVertical: space.xs, alignItems: 'center' }}>
        {MEAL_MOMENTS.map((m) => (
          <Chip key={m.key} label={`${m.emoji} ${m.label}`} active={moment === m.key}
            onPress={() => setMoment((cur) => (cur === m.key ? null : m.key))} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: space.xs, alignItems: 'center' }}>
        {DISH_TYPES.map((d) => (
          <Chip key={d.key} label={`${d.emoji} ${d.label}`} active={dishType === d.key}
            onPress={() => setDishType((cur) => (cur === d.key ? null : d.key))} />
        ))}
      </ScrollView>

      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl }}
        data={filtered}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Button title={t('recipe.new')} icon="add" variant="soft" onPress={onNew} style={{ marginBottom: space.md }} />
        }
        renderItem={({ item }) => <RecipeCard recipe={item} onOpen={onOpen} onDelete={onDelete} />}
        ListEmptyComponent={
          loading ? <ListSkeleton count={4} /> : hasFilter ? (
            <Empty illustration="meals" title={t('recipes.empty.search.title')} subtitle={t('recipes.empty.search.subtitle')} />
          ) : (
            <Empty illustration="meals" title={t('recipes.empty.title')} subtitle={t('recipes.empty.subtitle')}
              actionTitle={t('recipe.new')} onAction={onNew} />
          )
        }
      />
    </View>
  );
}

function RecipeCard({ recipe, onOpen, onDelete }) {
  const url = useRecipePhotoUrl(recipe.photo_path);
  const dish = recipe.dish_type ? dishTypeMeta(recipe.dish_type) : null;
  return (
    <SwipeRow left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => onDelete(recipe) }}>
      <Pressable onPress={() => onOpen(recipe)} accessibilityRole="button" accessibilityLabel={recipe.title}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm,
          opacity: pressed ? 0.7 : 1,
        })}>
        <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {url ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} accessibilityIgnoresInvertColors />
            : <Icon name="meals" size={26} color={colors.inkFaint} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{recipe.title}</Text>
          <Row gap={space.xs} align="center" wrap style={{ marginTop: 2 }}>
            {dish ? <Badge label={`${dish.emoji} ${dish.label}`} tone="neutral" /> : null}
            <Text style={type.caption}>{plural(recipe.servings ?? 2, 'recipe.servings.one', 'recipe.servings.other')}</Text>
          </Row>
        </View>
        <Icon name="chevron" size={18} color={colors.inkFaint} />
      </Pressable>
    </SwipeRow>
  );
}

// Maaltijd toevoegen voor één dag: recept kiezen óf vrije tekst, type + servings.
// Mini-avatars van wie er mee-eet, op de dagkaart. Toont de eerste vier leden + "+N"
// voor de rest, en "+N gast(en)" voor eters van buiten het huishouden. Niets → leeg.
function EaterAvatars({ eaterIds, extraEaters = 0, memberById }) {
  const ids = (Array.isArray(eaterIds) ? eaterIds : []).filter((id) => memberById[id]);
  const guests = Number(extraEaters) || 0;
  if (ids.length === 0 && guests === 0) return null;
  const shown = ids.slice(0, 4);
  return (
    <Row gap={2} align="center">
      {shown.map((id) => (
        <Avatar key={id} emoji={memberById[id].avatar_emoji} name={memberById[id].display_name} size={20} />
      ))}
      {ids.length > 4 ? <Text style={type.caption}>+{ids.length - 4}</Text> : null}
      {guests > 0 ? <Text style={type.caption}>+{plural(guests, 'meals.eaters.guest.one', 'meals.eaters.guest.other')}</Text> : null}
    </Row>
  );
}

// Eén selecteerbare receptrij in de inplan-sheet: coverfoto/placeholder + titel +
// categorie-badge — dezelfde beeldtaal als de recepten-catalogus.
function RecipePickRow({ recipe, selected, onPress }) {
  const url = useRecipePhotoUrl(recipe.photo_path);
  const dish = recipe.dish_type ? dishTypeMeta(recipe.dish_type) : null;
  return (
    <ItemRow
      leading={
        <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {url ? <Image source={{ uri: url }} style={{ width: 40, height: 40 }} accessibilityIgnoresInvertColors />
            : <Icon name="meals" size={20} color={colors.inkFaint} />}
        </View>
      }
      title={recipe.title}
      titleColor={selected ? colors.forest : undefined}
      borderColor={selected ? colors.forest : undefined}
      meta={dish ? <Badge label={`${dish.emoji} ${dish.label}`} tone="neutral" /> : null}
      onPress={onPress}
      trailing={selected ? <Icon name="check" size={18} color={colors.forest} /> : null}
    />
  );
}

function AddEntryModal({ date, recipes, initialRecipeId = null, onClose, onAdd, onNewRecipe }) {
  const dialog = useDialog();
  const { members } = useHousehold();
  const [mealType, setMealType] = useState('diner');
  const [query, setQuery] = useState('');
  const [recipeId, setRecipeId] = useState(null);
  const [freeTitle, setFreeTitle] = useState('');
  const [servings, setServings] = useState(2);
  const [eaterIds, setEaterIds] = useState([]);
  const [extraEaters, setExtraEaters] = useState(0);
  // Zodra je het portie-aantal zélf bijstelt, ontkoppelt het van "wie eet mee" (anders
  // zou de volgende eter-tik je handmatige waarde overschrijven).
  const [servingsManual, setServingsManual] = useState(false);
  const [busy, setBusy] = useState(false);

  const chosen = recipeId ? recipes.find((r) => r.id === recipeId) : null;

  React.useEffect(() => {
    if (!date) return;
    setMealType('diner'); setQuery(''); setFreeTitle(''); setServingsManual(false);
    const pre = initialRecipeId ? recipes.find((r) => r.id === initialRecipeId) : null;
    setRecipeId(pre ? pre.id : null);
    // Standaard eet het hele huishouden mee; porties volgen dat aantal (overschrijfbaar).
    const ids = (members ?? []).map((m) => m.id);
    setEaterIds(ids);
    setExtraEaters(0);
    setServings(defaultServings({ eater_ids: ids, extra_eaters: 0 }, pre?.servings ?? 2));
  }, [date, initialRecipeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Houd porties gekoppeld aan het aantal eters zolang je het niet handmatig overschreef.
  const syncServings = (ids, guests) => {
    if (!servingsManual) setServings(defaultServings({ eater_ids: ids, extra_eaters: guests }, chosen?.servings ?? 2));
  };
  const toggleMember = (id) => {
    const next = eaterIds.includes(id) ? eaterIds.filter((x) => x !== id) : [...eaterIds, id];
    setEaterIds(next);
    syncServings(next, extraEaters);
  };
  const changeGuests = (n) => { setExtraEaters(n); syncServings(eaterIds, n); };

  const matches = useMemo(() => filterRecipes(recipes, { query }).slice(0, 8), [query, recipes]);

  const save = async () => {
    if (!recipeId && !freeTitle.trim()) return;
    setBusy(true);
    try {
      await onAdd({ planDate: date, mealType, recipeId, title: recipeId ? null : freeTitle, servings, eaterIds, extraEaters });
      onClose();
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <BottomSheet visible={!!date} onClose={onClose} avoidKeyboard maxHeight="90%">
      <ModalHeader
        title={date ? format(parseISO(date), 'EEEE d MMM', { locale: nl }) : ''}
        onClose={onClose} onConfirm={save} busy={busy}
        confirmLabel={t('common.add')} cancelLabel={t('common.cancelLong')} />
      <SheetScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Row gap={space.xs} wrap style={{ marginBottom: space.lg }}>
              {MEAL_TYPES.map((m) => (
                <Chip key={m} label={t('mealtype.' + m)} active={mealType === m} onPress={() => setMealType(m)} />
              ))}
            </Row>

            {/* Recept kiezen — catalogus-stijl zoekbalk + rijen met cover (i.p.v. platte chips) */}
            <Field label={t('meals.recipe.pick')} value={query} onChangeText={(x) => { setQuery(x); }}
              placeholder={t('recipes.search')} style={{ marginBottom: space.sm }} />
            {matches.map((r) => (
              <RecipePickRow key={r.id} recipe={r} selected={recipeId === r.id}
                onPress={() => { setRecipeId((cur) => (cur === r.id ? null : r.id)); setFreeTitle(''); }} />
            ))}
            <Button title={t('recipe.new')} icon="add" variant="ghost" onPress={onNewRecipe} style={{ marginTop: space.xs, marginBottom: space.md }} />

            {!recipeId ? (
              <Field label={t('meals.recipe.orFree')} value={freeTitle} onChangeText={setFreeTitle}
                placeholder={t('meals.recipe.orFree')} />
            ) : null}

            {/* Wie eet mee — huishoudleden aanvinken + gasten van buiten */}
            <Text style={[type.label, { marginBottom: space.xs }]}>{t('meals.eaters.title')}</Text>
            {members.length > 0 ? (
              <Row gap={space.md} wrap style={{ marginBottom: space.sm }}>
                {members.map((m) => {
                  const on = eaterIds.includes(m.id);
                  return (
                    <Pressable key={m.id} onPress={() => toggleMember(m.id)} accessibilityRole="button"
                      accessibilityState={{ selected: on }} accessibilityLabel={m.display_name}
                      style={{ alignItems: 'center', opacity: on ? 1 : 0.4 }}>
                      <View style={{ borderWidth: 2, borderRadius: radius.pill, borderColor: on ? colors.forest : 'transparent' }}>
                        <Avatar emoji={m.avatar_emoji} name={m.display_name} size={44} />
                      </View>
                      <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>{m.display_name?.split(' ')[0]}</Text>
                    </Pressable>
                  );
                })}
              </Row>
            ) : null}
            <Row gap={space.md} align="center" style={{ marginBottom: space.lg }}>
              <Text style={type.caption}>{t('meals.eaters.guests')}</Text>
              <Stepper value={extraEaters} onChange={changeGuests} min={0} max={20} accessibilityLabel={t('meals.eaters.guests')} />
            </Row>

            <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.servings')}</Text>
            <Stepper value={servings} onChange={(v) => { setServingsManual(true); setServings(v); }}
              min={1} max={40} accessibilityLabel={t('recipe.field.servings')} />
            <Text style={[type.caption, { marginTop: space.xs }]}>
              {t('meals.eaters.summary', { n: eaterCount({ eater_ids: eaterIds, extra_eaters: extraEaters }) })}
            </Text>
            <View style={{ height: space.xl }} />
      </SheetScrollView>
    </BottomSheet>
  );
}

// Preview van de aan te vullen boodschappen (alleen wat niet in voorraad is).
function ShoppingListModal({ items, onClose, onConfirm }) {
  const [rows, setRows] = useState([]);
  React.useEffect(() => { setRows(items ?? []); }, [items]);
  const selected = rows.filter((r) => r.selected);
  const toggle = (key) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));

  return (
    <BottomSheet visible={!!items} onClose={onClose} maxHeight="85%">
      <ModalHeader title={t('meals.list.title')} onClose={onClose} />
      <Text style={[type.body, { color: colors.inkSoft, paddingHorizontal: space.lg, marginBottom: space.sm }]}>
        {t('meals.list.subtitle')}
      </Text>
      {rows.length === 0 ? (
        <View style={{ padding: space.lg }}>
          <Empty illustration="groceries" title={t('meals.list.none')} />
        </View>
      ) : (
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg }} style={{ maxHeight: 360 }}>
          {rows.map((r) => (
            <ItemRow
              key={r.key}
              leading={<Checkbox checked={r.selected} onPress={() => toggle(r.key)} size={22}
                accessibilityLabel={r.name} />}
              title={r.name}
              meta={<Text style={type.caption}>{(+r.quantity).toLocaleString('nl-NL')} {r.unit}</Text>}
              onPress={() => toggle(r.key)}
            />
          ))}
        </SheetScrollView>
      )}
      <View style={{ padding: space.lg }}>
        <Button title={t('meals.list.add')} icon="shopping" variant="accent"
          disabled={selected.length === 0} onPress={() => onConfirm(selected)} />
      </View>
    </BottomSheet>
  );
}
