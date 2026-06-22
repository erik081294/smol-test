import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { mutate } from '../../lib/db';
import { useRecipes, useRecipe, addRecipePhoto, useRecipePhotoUrl } from '../../lib/useRecipes';
import { useProducts } from '../../lib/useProducts';
import { offerImagePicker } from '../../lib/photoPicker';
import {
  ModalHeader, Field, Stepper, ItemRow, IconButton, Row, Chip, SectionHeader, Editor,
} from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, space, type, radius } from '../../lib/theme';
import { success, error as hapticError } from '../../lib/haptics';
import { UNITS } from '../../lib/constants';
import { t } from '../../lib/i18n';

export default function RecipeEditor() {
  const dialog = useDialog();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addRecipe, updateRecipe, activeId } = useRecipes();
  const { recipe, ingredients, loading, reload, addIngredient, updateIngredient, removeIngredient } = useRecipe(isNew ? null : id);
  const { suggestFor } = useProducts();

  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(2);
  const [instructions, setInstructions] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [titleError, setTitleError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(isNew);
  // Omslagfoto (MLT-3): nieuw recept bewaart het asset tot opslaan; bestaand recept
  // uploadt meteen. `photoNonce` forceert een verse signed URL na vervangen.
  const [photoAsset, setPhotoAsset] = useState(null);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const coverUrl = useRecipePhotoUrl(recipe?.photo_path, photoNonce);

  const choosePhoto = () => {
    if (isNew) {
      offerImagePicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });
      return;
    }
    offerImagePicker(async (asset) => {
      setPhotoBusy(true);
      try { await addRecipePhoto({ householdId: activeId, recipeId: id, asset }); await reload(); setPhotoNonce((n) => n + 1); }
      catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
      finally { setPhotoBusy(false); }
    });
  };

  // Lokale ingrediënten voor een NIEUW recept (live voor een bestaand recept).
  const [draft, setDraft] = useState([]);
  // Invoervelden voor een nieuw ingrediënt.
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState(1);
  const [ingUnit, setIngUnit] = useState('stuk');
  const [ingProductId, setIngProductId] = useState(null);
  // Sleutel van het ingrediënt dat nu in de invoerrij bewerkt wordt (id of _key);
  // null = een nieuw ingrediënt toevoegen.
  const [editingKey, setEditingKey] = useState(null);

  React.useEffect(() => {
    if (isNew || !recipe) return;
    setTitle(recipe.title ?? '');
    setServings(recipe.servings ?? 2);
    setInstructions(recipe.instructions ?? '');
    setSourceUrl(recipe.source_url ?? '');
    setLoaded(true);
  }, [isNew, recipe]);

  const shownIngredients = isNew ? draft : ingredients;

  const hints = useMemo(() => {
    if (ingName.trim().length < 2) return [];
    return suggestFor(ingName, 3).filter((s) => s.score >= 0.4).map((s) => s.product);
  }, [ingName, suggestFor]);

  const resetIngInput = () => { setIngName(''); setIngQty(1); setIngUnit('stuk'); setIngProductId(null); setEditingKey(null); };

  // Tik een ingrediënt aan om het in de invoerrij te bewerken (i.p.v. verwijderen
  // + opnieuw toevoegen). De rij wordt dan de editor; "+" wordt "✓".
  const startEdit = (item) => {
    setEditingKey(item.id ?? item._key);
    setIngName(item.name);
    setIngQty(Math.max(1, Math.round(+item.quantity) || 1));
    setIngUnit(item.unit ?? 'stuk');
    setIngProductId(item.product_id ?? item.productId ?? null);
  };

  const addIng = async () => {
    if (!ingName.trim()) return;
    const ing = { name: ingName.trim(), quantity: ingQty, unit: ingUnit, productId: ingProductId };
    if (editingKey) {
      if (isNew) {
        setDraft((d) => d.map((x) => (x._key === editingKey ? { ...x, ...ing } : x)));
        resetIngInput();
      } else {
        try { await updateIngredient(editingKey, { name: ing.name, quantity: ing.quantity, unit: ing.unit, product_id: ing.productId }); resetIngInput(); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
      }
      return;
    }
    if (isNew) {
      setDraft((d) => [...d, { ...ing, _key: `${Date.now()}-${d.length}` }]);
      resetIngInput();
    } else {
      try { await addIngredient(ing); resetIngInput(); }
      catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
    }
  };

  const removeIng = (item) => {
    if (editingKey && editingKey === (item.id ?? item._key)) resetIngInput();
    if (isNew) setDraft((d) => d.filter((x) => x._key !== item._key));
    else removeIngredient(item.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };

  const save = async () => {
    if (!title.trim()) { setTitleError(t('recipe.error.title')); hapticError(); return; }
    setBusy(true);
    try {
      if (isNew) {
        const row = await addRecipe({ title, servings, instructions: instructions.trim() || null, sourceUrl: sourceUrl.trim() || null });
        if (row?.id && photoAsset) {
          try { await addRecipePhoto({ householdId: activeId, recipeId: row.id, asset: photoAsset }); }
          catch { /* een mislukte foto mag het opslaan niet blokkeren */ }
        }
        if (row?.id && draft.length) {
          await mutate(
            supabase.from('recipe_ingredients').insert(
              draft.map((d, i) => ({
                household_id: activeId, recipe_id: row.id, name: d.name,
                quantity: d.quantity, unit: d.unit, product_id: d.productId ?? null, sort_order: i,
              }))
            ),
            { context: 'ingrediënten opslaan' }
          );
        }
      } else {
        await updateRecipe(id, {
          title: title.trim(), servings,
          instructions: instructions.trim() || null, source_url: sourceUrl.trim() || null,
        });
      }
      success();
      router.back();
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); hapticError(); }
    finally { setBusy(false); }
  };

  if (!loaded && loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ModalHeader title="" onClose={() => router.back()} /></SafeAreaView>;
  }

  return (
    <Editor
      title={isNew ? t('recipe.new') : t('recipe.edit')}
      onClose={() => router.back()} onConfirm={save} busy={busy}
      confirmLabel={t('common.save')} cancelLabel={t('common.cancelLong')}
    >
          {/* Omslagfoto (MLT-3) */}
          <Pressable onPress={choosePhoto} disabled={photoBusy} accessibilityRole="button"
            accessibilityLabel={t('photo.source.title')}
            style={{
              height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: space.lg,
            }}>
            {(isNew ? photoAsset?.uri : coverUrl) ? (
              <Image source={{ uri: isNew ? photoAsset.uri : coverUrl }}
                style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : (
              <View style={{ alignItems: 'center', gap: space.xs }}>
                <Icon name="meals" size={28} color={colors.inkFaint} />
                <Text style={type.caption}>{t('photo.source.title')}</Text>
              </View>
            )}
          </Pressable>

          <Field label={t('recipe.field.title')} value={title}
            onChangeText={(x) => { setTitle(x); if (titleError) setTitleError(null); }}
            placeholder={t('recipe.field.title.placeholder')} autoFocus={isNew} error={titleError} />

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.servings')}</Text>
          <Stepper value={servings} onChange={setServings} min={1} max={20} accessibilityLabel={t('recipe.field.servings')} />

          <View style={{ height: space.lg }} />
          <SectionHeader title={t('recipe.ingredients')} count={shownIngredients.length} />
          {shownIngredients.length === 0 ? (
            <Text style={[type.caption, { marginBottom: space.md }]}>{t('recipe.empty.ingredients')}</Text>
          ) : shownIngredients.map((ing) => {
            const key = ing.id ?? ing._key;
            return (
              <ItemRow
                key={key}
                title={ing.name}
                borderColor={editingKey === key ? colors.forest : undefined}
                onPress={() => startEdit(ing)}
                accessibilityHint={t('recipe.ingredient.editHint')}
                meta={<Text style={type.caption}>{(+ing.quantity).toLocaleString('nl-NL')} {ing.unit}</Text>}
                trailing={<IconButton icon="delete" size={18} tint={colors.inkFaint}
                  accessibilityLabel={t('common.delete')} onPress={() => removeIng(ing)} />}
              />
            );
          })}

          {/* Ingrediënt toevoegen of (na aantikken) bewerken */}
          <Field label={editingKey ? t('recipe.ingredient.edit') : t('recipe.ingredient.add')}
            value={ingName} onChangeText={(x) => { setIngName(x); setIngProductId(null); }}
            placeholder={t('recipe.ingredient.placeholder')} onSubmitEditing={addIng} style={{ marginBottom: space.sm }} />
          {hints.length > 0 ? (
            <Row gap={space.xs} wrap style={{ marginBottom: space.sm }}>
              {hints.map((p) => (
                <Chip key={p.id} label={p.name} icon="catalog" active={ingProductId === p.id}
                  onPress={() => { setIngName(p.name); setIngProductId(p.id); }} />
              ))}
            </Row>
          ) : null}
          <Row gap={space.md} style={{ marginBottom: space.lg }}>
            <Stepper value={ingQty} onChange={setIngQty} min={1} max={999} accessibilityLabel={t('pantry.field.quantity')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {UNITS.map((u) => <Chip key={u} label={u} active={ingUnit === u} onPress={() => setIngUnit(u)} />)}
            </ScrollView>
            <IconButton icon={editingKey ? 'check' : 'add'} tint={colors.forest}
              accessibilityLabel={editingKey ? t('recipe.ingredient.edit') : t('recipe.ingredient.add')}
              onPress={addIng} style={{ backgroundColor: colors.ocherSoft }} />
          </Row>

          <Field label={t('recipe.field.instructions')} value={instructions} onChangeText={setInstructions}
            placeholder={t('recipe.field.instructions')} multiline numberOfLines={4}
            style={{ minHeight: 90 }} />
          <Field label={t('recipe.field.source')} value={sourceUrl} onChangeText={setSourceUrl}
            placeholder="https://…" autoCapitalize="none" keyboardType="url" />

          <View style={{ height: space.xxl }} />
    </Editor>
  );
}
