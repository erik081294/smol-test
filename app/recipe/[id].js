import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, TextInput } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { mutate } from '../../lib/db';
import { useRecipes, useRecipe, addRecipePhoto, useRecipePhotoUrl } from '../../lib/useRecipes';
import { useProducts } from '../../lib/useProducts';
import { offerImagePicker } from '../../lib/photoPicker';
import { useEntityPhoto } from '../../lib/useEntityPhoto';
import {
  ModalHeader, Field, Stepper, ItemRow, IconButton, Row, Chip, SectionHeader, Editor, Button,
  Badge, ListSkeleton, Empty,
} from '../../lib/ui';
import { ProductImageView } from '../../lib/ProductImageView';
import { searchCatalog, itemByName } from '../../lib/groceryCatalog';
import { MEAL_MOMENTS, DISH_TYPES, momentMeta, dishTypeMeta } from '../../lib/recipeCatalog';
import { parseAmount } from '../../lib/quantity';
import { Icon } from '../../lib/icons';
import { colors, space, type, radius } from '../../lib/theme';
import { success, error as hapticError } from '../../lib/haptics';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText } from '../../lib/formValidation';
import { UNITS } from '../../lib/constants';
import { t, plural } from '../../lib/i18n';

// Eén route /recipe/:id met twee gezichten (MLT-feedback 5: aanmaken ≠ inplannen ≠ lezen):
//   • lezen  — de nette receptpagina (default): cover, categorie-badges, ingrediënten,
//              bereiding; knoppen Bewerken / Inplannen.
//   • bewerken — de editor (?edit=1, of het 'new'-sentinel voor een nieuw recept).
// Splitsen via een query-param i.p.v. losse routes houdt het 'new'-pad simpel en
// vermijdt een [id]-bestand/-map-conflict in expo-router.
export default function RecipeRoute() {
  const { id, edit } = useLocalSearchParams();
  const isNew = id === 'new';
  if (isNew || edit === '1') return <RecipeEditor />;
  return <RecipeDetail recipeId={id} />;
}

// Hoeveelheid-control voor een ingrediënt: −/+ knoppen (snelle stapjes) mét een typbaar
// numeriek veld ertussen, zodat grammen werkbaar zijn (MLT-feedback). Houdt een eigen
// tekst-buffer bij — zo kun je "1," tussentijds typen zonder dat de waarde wegspringt;
// pas bij een geldig getal (parseAmount) gaat het naar boven. min houdt de waarde ≥ 0.
function QtyControl({ value, onChange, accessibilityLabel }) {
  const [text, setText] = useState(String(value ?? 1));
  useEffect(() => { setText(String(value ?? 1)); }, [value]);
  const commit = (raw) => {
    setText(raw);
    const n = parseAmount(raw);
    if (n != null) onChange(n);
  };
  const bump = (delta) => {
    const base = parseAmount(text) ?? value ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 1000) / 1000);
    setText(String(next));
    onChange(next);
  };
  const btn = (label, sign, onPress) => (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, color: colors.forest, marginTop: -2 }}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
    }}>
      {btn(t('common.less'), '−', () => bump(-1))}
      <TextInput
        value={text} onChangeText={commit} keyboardType="decimal-pad" selectTextOnFocus
        accessibilityLabel={accessibilityLabel} returnKeyType="done"
        style={{ minWidth: 48, textAlign: 'center', fontSize: 16, color: colors.ink, paddingVertical: space.sm }}
      />
      {btn(t('common.more'), '+', () => bump(1))}
    </View>
  );
}

function RecipeEditor() {
  const dialog = useDialog();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addRecipe, updateRecipe, activeId } = useRecipes();
  const { recipe, ingredients, loading, reload, addIngredient, updateIngredient, removeIngredient } = useRecipe(isNew ? null : id);
  const { suggestFor } = useProducts();

  // Gedeelde formulier-ruggengraat (ARCH-1) in full-mode: de hook beheert de tekst-/keuze-
  // velden, plus dirty (discard-guard, via een genormaliseerde serialize) en onBlur-live-
  // validatie via de pure regels. Ingrediënten en de omslagfoto van een BESTAAND recept
  // slaan live op (buiten de form-dirty); voor een NIEUW recept tellen een gekozen foto of
  // concept-ingrediënten wél mee voor de discard-guard (zie `dirty` onder).
  const serialize = (v) => JSON.stringify({
    title: v.title.trim(), servings: v.servings,
    instructions: v.instructions.trim(), sourceUrl: v.sourceUrl.trim(),
    mealMoment: v.mealMoment, dishType: v.dishType,
  });
  const form = useEntityForm({
    title: '', servings: 2, instructions: '', sourceUrl: '', mealMoment: null, dishType: null,
  }, { serialize });
  const { values, setField, reset, dirty: fieldsDirty, errors, busy, setBusy, validate, validateField } = form;
  const { title, servings, instructions, sourceUrl, mealMoment, dishType } = values;
  const rules = [requiredText('title', t('recipe.error.title'))];
  const [loaded, setLoaded] = useState(isNew);
  // Omslagfoto (MLT-3): nieuw recept bewaart het asset tot opslaan; bestaand recept
  // uploadt meteen via de gedeelde foto-flow (busy + verse signed URL). Zie useEntityPhoto.
  const [photoAsset, setPhotoAsset] = useState(null);
  const { busy: photoBusy, nonce: photoNonce, pick: pickPhoto } = useEntityPhoto({
    onError: (e) => dialog.alert({ title: t('common.failed'), body: e.message }),
  });
  const coverUrl = useRecipePhotoUrl(recipe?.photo_path, photoNonce);

  const choosePhoto = () => {
    if (isNew) {
      offerImagePicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });
      return;
    }
    pickPhoto(async (asset) => { await addRecipePhoto({ householdId: activeId, recipeId: id, asset }); await reload(); });
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
    reset({
      title: recipe.title ?? '', servings: recipe.servings ?? 2,
      instructions: recipe.instructions ?? '', sourceUrl: recipe.source_url ?? '',
      mealMoment: recipe.meal_moment ?? null, dishType: recipe.dish_type ?? null,
    });
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, recipe]);

  const shownIngredients = isNew ? draft : ingredients;

  // Catalogus-stijl suggesties tijdens het typen: eigen huishoud-producten (met een
  // product-koppeling) vóór de gebundelde catalogus. Eén tik vult naam + eenheid (+ link)
  // in de invoerrij, zodat je daarna de hoeveelheid zet en op "Toevoegen" tikt — dezelfde
  // beeldtaal als de boodschappen-catalogus, i.p.v. de oude losse "+".
  const suggestions = useMemo(() => {
    const q = ingName.trim();
    if (q.length < 2 || editingKey) return [];
    const own = suggestFor(q, 4)
      .filter((s) => s.score >= 0.4)
      .map((s) => ({
        key: `p:${s.product.id}`, name: s.product.name,
        unit: s.product.default_unit || 'stuk',
        image: itemByName(s.product.name) ?? { category: s.product.category },
        productId: s.product.id,
      }));
    const seen = new Set(own.map((o) => o.name.toLowerCase()));
    const cat = searchCatalog(q).slice(0, 6)
      .filter((it) => !seen.has(it.name.toLowerCase()))
      .map((it) => ({ key: `c:${it.key}`, name: it.name, unit: it.unit, image: it, productId: null }));
    return [...own, ...cat].slice(0, 6);
  }, [ingName, editingKey, suggestFor]);

  const resetIngInput = () => { setIngName(''); setIngQty(1); setIngUnit('stuk'); setIngProductId(null); setEditingKey(null); };

  // Tik een suggestie aan: vul de invoerrij (naam/eenheid/koppeling), de hoeveelheid blijft.
  const pickSuggestion = (s) => { setIngName(s.name); setIngUnit(s.unit || 'stuk'); setIngProductId(s.productId ?? null); };

  // Tik een ingrediënt aan om het in de invoerrij te bewerken (i.p.v. verwijderen
  // + opnieuw toevoegen). De rij wordt dan de editor; de knop wordt "Bijwerken".
  const startEdit = (item) => {
    setEditingKey(item.id ?? item._key);
    setIngName(item.name);
    setIngQty(+item.quantity || 1);            // decimalen behouden (grammen), niet afronden
    setIngUnit(item.unit ?? 'stuk');
    setIngProductId(item.product_id ?? item.productId ?? null);
  };

  const addIng = async () => {
    if (!ingName.trim()) return;
    const ing = { name: ingName.trim(), quantity: ingQty > 0 ? ingQty : 1, unit: ingUnit, productId: ingProductId };
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
    if (!validate(rules)) return;
    setBusy(true);
    try {
      if (isNew) {
        const row = await addRecipe({ title, servings, instructions: instructions.trim() || null, sourceUrl: sourceUrl.trim() || null, mealMoment, dishType });
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
          meal_moment: mealMoment, dish_type: dishType,
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
      cancelLabel={t('common.cancelLong')}
      dirty={fieldsDirty || (isNew && (!!photoAsset || draft.length > 0))}
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
            onChangeText={(x) => setField('title', x)}
            onBlur={() => validateField(rules, 'title')}
            placeholder={t('recipe.field.title.placeholder')} autoFocus={isNew} error={errors.title} />

          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.servings')}</Text>
          <Stepper value={servings} onChange={(n) => setField('servings', n)} min={1} max={20} accessibilityLabel={t('recipe.field.servings')} />

          {/* Categorisering (MLT): twee onafhankelijke assen, zodat de recepten-catalogus
              doorzoekbaar/filterbaar wordt. Nogmaals tikken = deselecteren (terug naar leeg). */}
          <View style={{ height: space.lg }} />
          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.moment')}</Text>
          <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
            {MEAL_MOMENTS.map((m) => (
              <Chip key={m.key} label={`${m.emoji} ${m.label}`} active={mealMoment === m.key}
                onPress={() => setField('mealMoment', mealMoment === m.key ? null : m.key)} />
            ))}
          </Row>
          <Text style={[type.label, { marginBottom: space.xs }]}>{t('recipe.field.dishType')}</Text>
          <Row gap={space.xs} wrap style={{ marginBottom: space.md }}>
            {DISH_TYPES.map((d) => (
              <Chip key={d.key} label={`${d.emoji} ${d.label}`} active={dishType === d.key}
                onPress={() => setField('dishType', dishType === d.key ? null : d.key)} />
            ))}
          </Row>

          <View style={{ height: space.xs }} />
          <SectionHeader title={t('recipe.ingredients')} count={shownIngredients.length} />
          {shownIngredients.length === 0 ? (
            <Text style={[type.caption, { marginBottom: space.md }]}>{t('recipe.empty.ingredients')}</Text>
          ) : shownIngredients.map((ing) => {
            const key = ing.id ?? ing._key;
            return (
              <ItemRow
                key={key}
                leading={<ProductImageView item={itemByName(ing.name)} size={40} />}
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

          {/* Catalogus-stijl picker: zoek/typ → suggestierijen met beeld → tik om in te
              vullen; zet de hoeveelheid (typbaar of −/+) + eenheid en tik "Toevoegen". */}
          <View style={{ marginTop: space.sm }}>
            <Field label={editingKey ? t('recipe.ingredient.edit') : t('recipe.ingredient.add')}
              value={ingName} onChangeText={(x) => { setIngName(x); setIngProductId(null); }}
              placeholder={t('recipe.ingredient.search')} onSubmitEditing={addIng} style={{ marginBottom: space.sm }} />
            {suggestions.length > 0 ? (
              <View style={{ marginBottom: space.sm }}>
                {suggestions.map((s) => (
                  <Pressable key={s.key} onPress={() => pickSuggestion(s)} accessibilityRole="button"
                    accessibilityLabel={s.name}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: space.sm,
                      paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.sm,
                      backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                    })}>
                    <ProductImageView item={s.image} size={36} />
                    <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                    {s.unit ? <Text style={type.caption}>{s.unit}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {/* Hoeveelheid + eenheid + toevoegen verschijnen pas zodra er een naam staat
                (progressieve onthulling). Zo concurreert de hoeveelheid-stepper niet meer
                met de toevoeg-knop (de twee +'jes stonden eerst pal naast elkaar) en krijgen
                de eenheden de volle breedte i.p.v. een krappe horizontale scroll. */}
            {ingName.trim() ? (
              <View style={{
                backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
                padding: space.md, marginBottom: space.lg,
              }}>
                <Text style={[type.label, { color: colors.inkSoft, marginBottom: space.xs }]}>{t('recipe.ingredient.amount')}</Text>
                <QtyControl value={ingQty} onChange={setIngQty} accessibilityLabel={t('recipe.ingredient.amount')} />
                <Text style={[type.label, { color: colors.inkSoft, marginTop: space.md, marginBottom: space.xs }]}>{t('recipe.ingredient.unit')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {UNITS.map((u) => <Chip key={u} label={u} active={ingUnit === u} onPress={() => setIngUnit(u)} />)}
                </View>
                <Button title={editingKey ? t('recipe.ingredient.edit') : t('recipe.ingredient.add')}
                  icon={editingKey ? 'check' : 'add'} variant="primary"
                  onPress={addIng} style={{ marginTop: space.md }} />
              </View>
            ) : null}
          </View>

          <Field label={t('recipe.field.instructions')} value={instructions} onChangeText={(x) => setField('instructions', x)}
            placeholder={t('recipe.field.instructions')} multiline numberOfLines={4}
            style={{ minHeight: 90 }} />
          <Field label={t('recipe.field.source')} value={sourceUrl} onChangeText={(x) => setField('sourceUrl', x)}
            placeholder="https://…" autoCapitalize="none" keyboardType="url" />

          <View style={{ height: space.xxl }} />
    </Editor>
  );
}

// Receptpagina (lezen): de nette weergave met cover, categorie-badges, ingrediënten en
// bereiding. Hiervandaan ga je expliciet naar Bewerken (de editor) of Inplannen (het
// weekmenu) — het onderscheid aanmaken/inplannen dat de oude "openen = editor" miste.
function RecipeDetail({ recipeId }) {
  const router = useRouter();
  const { recipe, ingredients, loading } = useRecipe(recipeId);
  const coverUrl = useRecipePhotoUrl(recipe?.photo_path);
  const moment = recipe?.meal_moment ? momentMeta(recipe.meal_moment) : null;
  const dish = recipe?.dish_type ? dishTypeMeta(recipe.dish_type) : null;

  if (loading && !recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="" onClose={() => router.back()} />
        <View style={{ padding: space.lg }}><ListSkeleton count={4} /></View>
      </SafeAreaView>
    );
  }
  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="" onClose={() => router.back()} />
        <Empty illustration="meals" title={t('recipe.notfound.title')} subtitle={t('recipe.notfound.subtitle')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={recipe.title} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} accessibilityIgnoresInvertColors
            style={{ width: '100%', height: 180, borderRadius: radius.md, marginBottom: space.md }} resizeMode="cover" />
        ) : (
          <View style={{
            height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
            alignItems: 'center', justifyContent: 'center', marginBottom: space.md,
          }}>
            <Icon name="meals" size={32} color={colors.inkFaint} />
          </View>
        )}

        <Text style={type.h2}>{recipe.title}</Text>
        <Row gap={space.xs} wrap style={{ marginTop: space.sm, marginBottom: space.lg }}>
          {moment ? <Badge label={`${moment.emoji} ${moment.label}`} tone="brand" /> : null}
          {dish ? <Badge label={`${dish.emoji} ${dish.label}`} tone="neutral" /> : null}
          <Text style={[type.caption, { alignSelf: 'center' }]}>
            {plural(recipe.servings ?? 2, 'recipe.servings.one', 'recipe.servings.other')}
          </Text>
        </Row>

        <SectionHeader title={t('recipe.ingredients')} count={ingredients.length} />
        {ingredients.length === 0 ? (
          <Text style={[type.caption, { marginBottom: space.md }]}>{t('recipe.empty.ingredients')}</Text>
        ) : ingredients.map((ing) => (
          <ItemRow
            key={ing.id}
            leading={<ProductImageView item={itemByName(ing.name)} size={40} />}
            title={ing.name}
            meta={<Text style={type.caption}>{(+ing.quantity).toLocaleString('nl-NL')} {ing.unit}</Text>}
          />
        ))}

        {recipe.instructions ? (
          <View style={{ marginTop: space.lg }}>
            <SectionHeader title={t('recipe.field.instructions.read')} />
            <Text style={[type.body, { lineHeight: 24 }]}>{recipe.instructions}</Text>
          </View>
        ) : null}

        {recipe.source_url ? (
          <Pressable onPress={() => router.push(recipe.source_url)} style={{ marginTop: space.lg }}
            accessibilityRole="link" accessibilityLabel={recipe.source_url}>
            <Row gap={space.xs}>
              <Icon name="link" size={16} color={colors.forest} />
              <Text style={[type.body, { color: colors.forest }]} numberOfLines={1}>{recipe.source_url}</Text>
            </Row>
          </Pressable>
        ) : null}

        <View style={{ height: space.xl }} />
        <Button title={t('recipe.edit')} icon="edit" variant="soft"
          onPress={() => router.push(`/recipe/${recipeId}?edit=1`)} style={{ marginBottom: space.sm }} />
        <Button title={t('recipe.plan')} icon="meals" variant="primary"
          onPress={() => router.push(`/(tabs)/maaltijden?planRecipe=${recipeId}`)} />
      </ScrollView>
    </SafeAreaView>
  );
}
