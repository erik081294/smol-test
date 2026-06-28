import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, SectionList, ScrollView, TextInput, RefreshControl, Platform, Pressable, Keyboard, StyleSheet } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../../lib/useGroceries';
import { useProducts, useProductFrequencies } from '../../lib/useProducts';
import { frequencyLabel } from '../../lib/buyFrequency';
import { useToast } from '../../lib/toast';
import { searchCatalog } from '../../lib/groceryCatalog';
import { countOf } from '../../lib/groceryCount';
import { groupGroceriesByCategory } from '../../lib/groceryList';
import { normalize } from '../../lib/productMatch';
import { parseQuantity, formatQuantity } from '../../lib/quantity';
import { ProductImageView } from '../../lib/ProductImageView';
import { Empty, Checkbox, ScreenHeader, SectionHeader, ItemRow, IconButton, ModuleHelpButton, ListSkeleton, Row, SwipeRow, Button, Stepper, Banner } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, space, type, touchTarget } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import * as haptics from '../../lib/haptics';
import { t } from '../../lib/i18n';

const SEARCH_LIMIT = 5;

// Eén boodschappen-lijstrij, gememoiseerd: een tik op de stepper/checkbox hertekent
// alléén deze rij (niet de hele lijst) — samen met de optimistische Stepper voelt het
// instant. Alle callbacks komen stabiel binnen (useEvent-patroon in de ouder).
const GroceryRow = React.memo(function GroceryRow({ item, onToggle, onChangeCount, onRemove }) {
  const { count, unit } = parseQuantity(item.quantity);
  return (
    <SwipeRow
      left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => onRemove(item) }}
      right={{ icon: 'check', label: t('groceries.check'), color: colors.done, onTrigger: () => onToggle(item) }}
    >
      <ItemRow
        leading={
          <Checkbox checked={item.checked} onPress={() => onToggle(item)} shape="round" size={24}
            color={item.checked ? colors.done : colors.inkFaint}
            accessibilityLabel={`${item.name}, ${item.checked ? t('a11y.checked') : t('a11y.unchecked')}`} />
        }
        title={item.name}
        titleColor={item.checked ? colors.inkFaint : undefined}
        strikethrough={item.checked}
        dimmed={item.checked}
        meta={item.checked && item.quantity ? <Text style={type.caption}>{item.quantity}</Text> : undefined}
        onPress={() => onToggle(item)}
        accessibilityHint={t('a11y.tapToToggle')}
        trailing={item.checked ? undefined : (
          <Stepper compact value={count} min={0} max={99}
            onChange={(v) => onChangeCount(item, v)}
            // Eenheid in de stepper (UX-44/B7): toon "2 pak" i.p.v. een kaal getal.
            formatValue={unit ? (n) => `${n} ${unit}` : undefined}
            accessibilityLabel={t('catalog.qty.for', { name: item.name })} />
        )}
      />
    </SwipeRow>
  );
});

export default function Boodschappen() {
  const dialog = useDialog();
  const { items, loading, reload, toggle: toggleItem, setQuantity, setCount, remove: removeItem, removeMany } = useGroceries();
  const { products, ensureProduct } = useProducts();
  const { byProduct: freqByProduct } = useProductFrequencies();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [counts, setCounts] = useState({});       // optimistische override voor de zoekrijen
  const [searchTop, setSearchTop] = useState(0);   // y onder de toevoegbalk (voor de dropdown)
  const inputRef = useRef(null);                   // BOO-15/16: gericht legen + herfocussen

  const q = text.trim();

  const open = useMemo(
    () => items.filter((i) => !i.checked && !hiddenIds.includes(i.id)),
    [items, hiddenIds]
  );
  const done = useMemo(
    () => items.filter((i) => i.checked && !hiddenIds.includes(i.id)),
    [items, hiddenIds]
  );
  const openProductIds = useMemo(() => new Set(open.map((i) => i.product_id).filter(Boolean)), [open]);

  // product_id → categorie (voedt de schap-indeling van de lijst).
  const categoryById = useMemo(() => {
    const m = {};
    for (const p of products) if (p.category) m[p.id] = p.category;
    return m;
  }, [products]);

  // Lijst-secties: open boodschappen per supermarkt-schap (lege schappen weg), daarna een
  // "Afgevinkt"-sectie. `kind` stuurt de sectiekop-rendering.
  const sections = useMemo(() => {
    const cat = groupGroceriesByCategory(open, { categoryById })
      .map((g) => ({ key: g.key, kind: 'cat', title: `${g.emoji}  ${g.label}`, data: g.data }));
    if (done.length) cat.push({ key: '__done__', kind: 'done', title: t('groceries.section.done'), data: done });
    return cat;
  }, [open, done, categoryById]);

  const searchResults = useMemo(() => (q ? searchCatalog(q).slice(0, SEARCH_LIMIT) : []), [q]);
  const exactMatch = useMemo(() => {
    const nq = normalize(q); // PERF-6: query één keer normaliseren i.p.v. per resultaat
    return searchResults.some((r) => normalize(r.name) === nq);
  }, [searchResults, q]);

  const dueSuggestions = useMemo(() => {
    if (q) return [];
    return products
      .filter((p) => !p.hidden && !openProductIds.has(p.id))
      .map((p) => ({ product: p, est: freqByProduct[p.id] }))
      .filter((x) => x.est && x.est.dueScore >= 1)
      .sort((a, b) => b.est.dueScore - a.est.dueScore)
      .slice(0, 6);
  }, [products, freqByProduct, openProductIds, q]);

  const dismissSearch = () => { setText(''); Keyboard.dismiss(); };
  // BOO-15/16: na een keuze (of de wis-knop) het veld legen én de focus teruggeven,
  // zodat je meteen het volgende item kunt typen — i.p.v. het toetsenbord laten wegvallen.
  const clearAndRefocus = () => { setText(''); inputRef.current?.focus(); };

  const countForCatalog = (item) => counts[item.key] ?? countOf(items, item.name);
  const setCatalogCount = (item, n) => {
    const prev = countForCatalog(item);
    setCounts((m) => ({ ...m, [item.key]: n }));
    const fail = (e) => { setCounts((m) => ({ ...m, [item.key]: prev })); dialog.alert({ title: t('groceries.error.add'), body: e.message }); };
    if (prev <= 0 && n >= 1) {
      ensureProduct({ name: item.name, category: item.category, defaultUnit: item.unit })
        .then((p) => setCount(item.name, n, { productId: p?.id ?? null, unit: item.unit })).catch(fail);
    } else {
      setCount(item.name, n, { unit: item.unit }).catch(fail);
    }
  };

  const addCustom = () => {
    if (!q) return;
    const name = q;
    clearAndRefocus();
    ensureProduct({ name })
      .then((p) => setCount(name, 1, { productId: p?.id ?? null }))
      .then(() => toast.show({ message: t('catalog.added', { name }) }))
      .catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
  };

  const submitTyped = () => {
    if (!q) return;
    const nq = normalize(q); // PERF-6: query één keer normaliseren i.p.v. per resultaat
    const exact = searchResults.find((r) => normalize(r.name) === nq);
    if (exact) { setCatalogCount(exact, (countForCatalog(exact) || 0) + 1); clearAndRefocus(); }
    else addCustom();
  };

  // BOO-15: tik op een zoekresultaat = toevoegen + balk legen + herfocussen. De stepper
  // in de rij blijft voor het fijn-regelen van het aantal (die laat de balk juist staan).
  const pickCatalog = (item) => {
    setCatalogCount(item, (countForCatalog(item) || 0) + 1);
    clearAndRefocus();
  };

  const addLinked = (product) => {
    setText('');
    animateNextLayout();
    setCount(product.name, (countOf(items, product.name) || 0) + 1, { productId: product.id })
      .catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
  };

  // ── Stabiele rij-handlers (useEvent): zo blijft GroceryRow's memo intact.
  const removeWithUndo = (item) => {
    haptics.tapLight(); // BOO-17: voelbare bevestiging bij verwijderen (≠ afvinken)
    animateNextLayout();
    setHiddenIds((h) => [...h, item.id]);
    toast.show({
      message: t('groceries.deleted', { name: item.name }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => x !== item.id)); },
      onExpire: async () => {
        try { await removeItem(item.id); }
        catch (e) { dialog.alert({ title: t('groceries.error.delete'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => x !== item.id)); }
      },
    });
  };
  const toggleImpl = async (item) => {
    const checking = !item.checked; // BOO-17: alleen het áfvinken viert, niet het terugzetten
    animateNextLayout();
    try {
      await toggleItem(item);
      if (checking) {
        haptics.success();
        toast.show({ message: t('groceries.checkedFeedback', { name: item.name }), duration: 1500 });
      }
    } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
  };
  // 0 = verwijderen (mét undo), ≥1 = aantal bijwerken. Afvinken gaat via swipe/tik.
  const changeCountImpl = (item, n) => {
    if (n <= 0) { removeWithUndo(item); return; }
    const { unit } = parseQuantity(item.quantity);
    setQuantity(item, formatQuantity(n, unit)).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };
  const toggleRef = useRef(toggleImpl);
  const changeRef = useRef(changeCountImpl);
  const removeRef = useRef(removeWithUndo);
  useEffect(() => { toggleRef.current = toggleImpl; changeRef.current = changeCountImpl; removeRef.current = removeWithUndo; });
  const onToggle = useCallback((item) => toggleRef.current(item), []);
  const onChangeCount = useCallback((item, n) => changeRef.current(item, n), []);
  const onRemove = useCallback((item) => removeRef.current(item), []);

  const onClearChecked = () => {
    const ids = done.map((i) => i.id);
    if (!ids.length) return;
    animateNextLayout();
    setHiddenIds((h) => [...h, ...ids]);
    toast.show({
      message: t('groceries.clearedChecked', { n: ids.length }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => !ids.includes(x))); },
      onExpire: async () => {
        try { await removeMany(ids); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }
      },
    });
  };

  const renderItem = useCallback(({ item }) => (
    <GroceryRow item={item} onToggle={onToggle} onChangeCount={onChangeCount} onRemove={onRemove} />
  ), [onToggle, onChangeCount, onRemove]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('groceries.title')} subtitle={t('groceries.subtitle')}
        right={<ModuleHelpButton module="boodschappen" />} />

      {/* Toevoegbalk — typen zoekt direct in de catalogus (dropdown hieronder). */}
      <View onLayout={(e) => setSearchTop(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm, gap: space.sm }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <TextInput
            ref={inputRef}
            value={text} onChangeText={setText} onSubmitEditing={submitTyped}
            returnKeyType="done" blurOnSubmit={false}
            placeholder={t('groceries.placeholder')}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={t('groceries.addLabel')}
            style={{
              minHeight: touchTarget, backgroundColor: colors.surface, borderRadius: radius.md,
              borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md,
              // BOO-16: ruimte rechts vrijhouden voor de wis-knop zodra er tekst staat.
              paddingRight: text ? touchTarget : space.md,
              paddingVertical: Platform.OS === 'ios' ? space.md : space.sm, fontSize: 16, color: colors.ink,
            }}
          />
          {/* BOO-16: snelle wis-knop — één tik leegt het veld en houdt de focus. */}
          {text ? (
            <IconButton icon="close" size={18} accessibilityLabel={t('common.clear')} tint={colors.inkFaint}
              onPress={clearAndRefocus}
              style={{ position: 'absolute', right: 0, width: touchTarget, height: touchTarget }} />
          ) : null}
        </View>
        <IconButton icon="add" accessibilityLabel={t('common.add')} tint={colors.forest}
          onPress={submitTyped} style={{ backgroundColor: colors.ocher }} />
      </View>

      {!q ? (
        /* Niet aan het typen: catalogus + bonnen op één compacte rij (BOO-14: minder
           chrome boven de lijst). Beide blijven duidelijk benoemd en bereikbaar. */
        <Row gap={space.sm} style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title={t('catalog.open')} icon="catalog" variant="soft" onPress={() => router.push('/catalog')} />
          </View>
          {/* Bonnen-hub (BOO-10): naar de lijst met bestaande bonnen. */}
          <View style={{ flex: 1 }}>
            <Button title={t('groceries.receipts')} icon="receipt" variant="ghost" onPress={() => router.push('/purchases')} />
          </View>
        </Row>
      ) : null}

      {/* "Misschien weer nodig" — alleen als je niet typt */}
      {dueSuggestions.length > 0 ? (
        <View style={{ marginBottom: space.sm }}>
          <View style={{ paddingHorizontal: space.lg }}>
            <SectionHeader title={t('groceries.again.section')} count={dueSuggestions.length} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}>
            {dueSuggestions.map(({ product, est }) => (
              <Pressable key={product.id} onPress={() => addLinked(product)} accessibilityRole="button"
                accessibilityLabel={t('groceries.again.add', { name: product.name })}
                style={({ pressed }) => ({
                  width: 168, padding: space.md, borderRadius: radius.md, borderWidth: 1,
                  borderColor: colors.line, backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                })}>
                <Row justify="space-between" align="center" gap={space.xs}>
                  <Text style={[type.title, { fontSize: 14, flex: 1 }]} numberOfLines={1}>{product.name}</Text>
                  <Icon name="add" size={16} color={colors.forest} />
                </Row>
                <Text style={[type.caption, { marginTop: 2 }]} numberOfLines={1}>{frequencyLabel(est)}</Text>
                <Text style={[type.caption, { color: colors.inkFaint }]} numberOfLines={1}>
                  {t('groceries.again.lastBought', { n: est.daysSince })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl }}
        stickySectionHeadersEnabled={false}
        // Virtualisatie-afstelling, gelijk aan app/catalog.js (PERF-9): begrens de
        // eerste render + batchgrootte en knip off-screen rijen op Android weg.
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        // Klaar-moment (UX-44/B5): alles afgevinkt (open leeg, afgevinkt gevuld) → een
        // positieve bevestiging boven de "Afgevinkt"-sectie i.p.v. een stille lijst.
        ListHeaderComponent={
          !q && open.length === 0 && done.length > 0
            ? <Banner tone="success" style={{ marginBottom: space.sm }}>{t('groceries.allDone')}</Banner>
            : null
        }
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          section.kind === 'done' ? (
            <SectionHeader title={section.title} count={section.data.length}
              action={<IconButton icon="delete" accessibilityLabel={t('groceries.clearChecked')} tint={colors.danger} onPress={onClearChecked} />} />
          ) : (
            <Text style={[type.label, { marginTop: space.md, marginBottom: space.xs, color: colors.inkSoft }]}>{section.title}</Text>
          )
        )}
        ListEmptyComponent={
          loading && items.length === 0 ? (
            <ListSkeleton count={5} />
          ) : !loading && items.length === 0 ? (
            <Empty illustration="groceries" title={t('groceries.empty.title')}
              subtitle={t('groceries.empty.subtitle')}
              actionTitle={t('catalog.open')} onAction={() => router.push('/catalog')} />
          ) : null
        }
      />

      {/* Zoek-dropdown als een overlay onder de balk; tik ernaast (de backdrop) sluit 'm. */}
      {q ? (
        <View style={[StyleSheet.absoluteFill, { top: searchTop, zIndex: 20 }]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t('common.close')} onPress={dismissSearch} />
          <View style={{
            marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.xs,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
          }}>
            {searchResults.length ? (
              <Text style={[type.label, { color: colors.inkSoft, marginTop: space.xs, marginBottom: space.xs }]}>{t('groceries.search.results')}</Text>
            ) : null}
            {searchResults.map((item) => {
              const cnt = countForCatalog(item);
              return (
                <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs }}>
                  {/* BOO-15: tik op product (beeld + naam) = +1 en de balk legen/herfocussen. */}
                  <Pressable onPress={() => pickCatalog(item)} accessibilityRole="button"
                    accessibilityLabel={t('catalog.add', { name: item.name })}
                    style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.6 : 1 })}>
                    <ProductImageView item={item} size={34} />
                    <Text style={[type.body, cnt >= 1 ? { color: colors.forest, fontWeight: '700' } : null, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                  </Pressable>
                  <Stepper compact value={cnt} min={0} max={99} onChange={(v) => setCatalogCount(item, v)}
                    accessibilityLabel={t('catalog.qty.for', { name: item.name })} />
                </View>
              );
            })}
            {!exactMatch ? (
              <Pressable onPress={addCustom} accessibilityRole="button" accessibilityLabel={t('catalog.add', { name: q })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="add" size={18} color={colors.forest} weight="bold" />
                <Text style={[type.body, { color: colors.forest, fontWeight: '700' }]}>{t('catalog.add', { name: q })}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { const term = q; dismissSearch(); router.push(`/catalog?q=${encodeURIComponent(term)}`); }}
              accessibilityRole="button" accessibilityLabel={t('groceries.search.viewAll')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="catalog" size={18} color={colors.inkSoft} />
              <Text style={[type.body, { color: colors.inkSoft }]}>{t('groceries.search.viewAll')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
