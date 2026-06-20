import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO, addDays, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useMealPlan } from '../../lib/useMealPlan';
import { useRecipes } from '../../lib/useRecipes';
import { usePantry } from '../../lib/usePantry';
import { useGroceries } from '../../lib/useGroceries';
import { useToast } from '../../lib/toast';
import {
  Empty, ScreenHeader, ItemRow, IconButton, ListSkeleton, Chip, Row, Card, Button,
  Badge, ModalHeader, Field, Stepper, Checkbox,
} from '../../lib/ui';
import { colors, space, type, radius } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { success } from '../../lib/haptics';
import { MEAL_TYPES } from '../../lib/constants';
import { normalize } from '../../lib/productMatch';
import { t } from '../../lib/i18n';

export default function Maaltijden() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(new Date());
  const { entries, loading, reload, weekDays, addEntry, removeEntry, buildShoppingList, commitShoppingList } = useMealPlan(weekStart);
  const { recipes } = useRecipes();
  const { items: pantryItems } = usePantry();
  const { removeMany: removeGroceries } = useGroceries();
  const toast = useToast();

  const [addFor, setAddFor] = useState(null);    // 'yyyy-MM-dd' waarvoor we toevoegen
  const [listItems, setListItems] = useState(null); // boodschappenlijst-preview of null

  const byDay = useMemo(() => {
    const m = {};
    for (const e of entries) (m[e.plan_date] ??= []).push(e);
    for (const d of Object.keys(m)) m[d].sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type));
    return m;
  }, [entries]);

  const weekLabel = `${format(parseISO(weekDays[0]), 'd MMM', { locale: nl })} – ${format(parseISO(weekDays[6]), 'd MMM', { locale: nl })}`;

  const remove = (entry) => { animateNextLayout(); removeEntry(entry.id).catch((e) => Alert.alert(t('common.failed'), e.message)); };

  const openShoppingList = async () => {
    const gap = await buildShoppingList(pantryItems);
    setListItems(gap.map((g) => ({ ...g, selected: true })));
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
          <ItemRow
            key={e.id}
            title={e.recipe?.title || e.title || t('mealtype.' + e.meal_type)}
            meta={
              <Row gap={space.sm}>
                <Badge label={t('mealtype.' + e.meal_type)} tone="brand" />
                <Text style={type.caption}>{t('meals.entry.servings', { n: e.servings })}</Text>
              </Row>
            }
            trailing={
              <IconButton icon="delete" size={18} tint={colors.inkFaint}
                accessibilityLabel={t('common.delete')} onPress={() => remove(e)} />
            }
          />
        ))}
      </Card>
    );
  };

  const hasAny = entries.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('meals.title')} subtitle={t('meals.subtitle')}
        right={<IconButton icon="library" accessibilityLabel={t('meals.recipes')} tint={colors.forest}
          onPress={() => router.push('/recipe/new')} />} />

      {/* Weeknavigatie */}
      <Row justify="space-between" style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <IconButton icon="back" accessibilityLabel={t('meals.prevWeek')} tint={colors.forest}
          onPress={() => setWeekStart((d) => addDays(d, -7))} />
        <Text style={type.title}>{weekLabel}</Text>
        <IconButton icon="forward" accessibilityLabel={t('meals.nextWeek')} tint={colors.forest}
          onPress={() => setWeekStart((d) => addDays(d, 7))} />
      </Row>

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

      <AddEntryModal
        date={addFor}
        recipes={recipes}
        onClose={() => setAddFor(null)}
        onAdd={addEntry}
        onNewRecipe={() => { setAddFor(null); router.push('/recipe/new'); }}
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
          } catch (e) { Alert.alert(t('common.failed'), e.message); }
        }}
      />
    </SafeAreaView>
  );
}

// Maaltijd toevoegen voor één dag: recept kiezen óf vrije tekst, type + servings.
function AddEntryModal({ date, recipes, onClose, onAdd, onNewRecipe }) {
  const [mealType, setMealType] = useState('diner');
  const [query, setQuery] = useState('');
  const [recipeId, setRecipeId] = useState(null);
  const [freeTitle, setFreeTitle] = useState('');
  const [servings, setServings] = useState(2);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (date) { setMealType('diner'); setQuery(''); setRecipeId(null); setFreeTitle(''); setServings(2); }
  }, [date]);

  const matches = useMemo(() => {
    const q = normalize(query);
    const list = q ? recipes.filter((r) => normalize(r.title).includes(q)) : recipes;
    return list.slice(0, 8);
  }, [query, recipes]);

  const chosen = recipeId ? recipes.find((r) => r.id === recipeId) : null;

  const save = async () => {
    if (!recipeId && !freeTitle.trim()) return;
    setBusy(true);
    try {
      await onAdd({ planDate: date, mealType, recipeId, title: recipeId ? null : freeTitle, servings });
      onClose();
    } catch (e) { Alert.alert(t('common.failed'), e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={!!date} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '90%' }}>
          <ModalHeader
            title={date ? format(parseISO(date), 'EEEE d MMM', { locale: nl }) : ''}
            onClose={onClose} onConfirm={save} busy={busy}
            confirmLabel={t('common.add')} cancelLabel={t('common.cancelLong')} />
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
            <Row gap={space.xs} wrap style={{ marginBottom: space.lg }}>
              {MEAL_TYPES.map((m) => (
                <Chip key={m} label={t('mealtype.' + m)} active={mealType === m} onPress={() => setMealType(m)} />
              ))}
            </Row>

            <Field label={t('meals.recipe.pick')} value={query} onChangeText={(x) => { setQuery(x); setRecipeId(null); }}
              placeholder={t('meals.recipe.pick')} />
            <Row gap={space.xs} wrap style={{ marginTop: -space.sm, marginBottom: space.md }}>
              {matches.map((r) => (
                <Chip key={r.id} label={r.title} icon="meals" active={recipeId === r.id}
                  onPress={() => { setRecipeId(r.id); setServings(r.servings ?? 2); setFreeTitle(''); }} />
              ))}
              <Chip label={t('recipe.new')} icon="add" onPress={onNewRecipe} />
            </Row>

            {!recipeId ? (
              <Field label={t('meals.recipe.orFree')} value={freeTitle} onChangeText={setFreeTitle}
                placeholder={t('meals.recipe.orFree')} />
            ) : null}

            <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.servings')}</Text>
            <Stepper value={servings} onChange={setServings} min={1} max={20} accessibilityLabel={t('recipe.field.servings')} />
            {chosen ? <Text style={[type.caption, { marginTop: space.sm }]}>{chosen.title}</Text> : null}
            <View style={{ height: space.xl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Preview van de aan te vullen boodschappen (alleen wat niet in voorraad is).
function ShoppingListModal({ items, onClose, onConfirm }) {
  const [rows, setRows] = useState([]);
  React.useEffect(() => { setRows(items ?? []); }, [items]);
  const selected = rows.filter((r) => r.selected);
  const toggle = (key) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));

  return (
    <Modal visible={!!items} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '85%' }}>
          <ModalHeader title={t('meals.list.title')} onClose={onClose} />
          <Text style={[type.body, { color: colors.inkSoft, paddingHorizontal: space.lg, marginBottom: space.sm }]}>
            {t('meals.list.subtitle')}
          </Text>
          {rows.length === 0 ? (
            <View style={{ padding: space.lg }}>
              <Empty illustration="groceries" title={t('meals.list.none')} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg }} style={{ maxHeight: 360 }}>
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
            </ScrollView>
          )}
          <View style={{ padding: space.lg }}>
            <Button title={t('meals.list.add')} icon="shopping" variant="accent"
              disabled={selected.length === 0} onPress={() => onConfirm(selected)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
