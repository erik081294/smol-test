import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, RefreshControl, Platform, Pressable } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../../lib/useGroceries';
import { useProducts, useProductFrequencies } from '../../lib/useProducts';
import { frequencyLabel } from '../../lib/buyFrequency';
import { useToast } from '../../lib/toast';
import { searchCatalog } from '../../lib/groceryCatalog';
import { countOf } from '../../lib/groceryCount';
import { normalize } from '../../lib/productMatch';
import { parseQuantity, formatQuantity } from '../../lib/quantity';
import { ProductImageView } from '../../lib/ProductImageView';
import { Empty, Checkbox, ScreenHeader, SectionHeader, ItemRow, IconButton, ListSkeleton, Row, SwipeRow, Button, Stepper } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, space, type, touchTarget } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { t } from '../../lib/i18n';

const SEARCH_LIMIT = 5;

export default function Boodschappen() {
  const dialog = useDialog();
  const { items, loading, reload, toggle: toggleItem, setQuantity, setCount, remove: removeItem, removeMany } = useGroceries();
  const { products, ensureProduct } = useProducts();
  const { byProduct: freqByProduct } = useProductFrequencies();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [counts, setCounts] = useState({}); // optimistische override voor de inline zoekrijen

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

  // Inline catalogus-zoekresultaten terwijl je typt — een paar mini-rijen met dezelfde
  // gekoppelde stepper als de lijst/catalogus.
  const searchResults = useMemo(() => (q ? searchCatalog(q).slice(0, SEARCH_LIMIT) : []), [q]);
  const exactMatch = useMemo(() => searchResults.some((r) => normalize(r.name) === normalize(q)), [searchResults, q]);

  // "Misschien weer nodig" (BOO-8): zachte frequentie-suggesties. Alleen als je niet typt.
  const dueSuggestions = useMemo(() => {
    if (q) return [];
    return products
      .filter((p) => !p.hidden && !openProductIds.has(p.id))
      .map((p) => ({ product: p, est: freqByProduct[p.id] }))
      .filter((x) => x.est && x.est.dueScore >= 1)
      .sort((a, b) => b.est.dueScore - a.est.dueScore)
      .slice(0, 6);
  }, [products, freqByProduct, openProductIds, q]);

  const countForCatalog = (item) => counts[item.key] ?? countOf(items, item.name);

  // Aantal van een catalogus-item op de lijst zetten (inline zoeken): optimistisch + koppel
  // aan een product bij de eerste plaatsing (recency). Daarna volstaat bijwerken op naam.
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
    setText('');
    ensureProduct({ name })
      .then((p) => setCount(name, 1, { productId: p?.id ?? null }))
      .then(() => toast.show({ message: t('catalog.added', { name }) }))
      .catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
  };

  const addLinked = (product) => {
    setText('');
    animateNextLayout();
    setCount(product.name, (countOf(items, product.name) || 0) + 1, { productId: product.id })
      .catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
  };

  const submitTyped = () => {
    if (!q) return;
    // Exacte catalogus-match? Voeg die toe; anders het eigen product.
    const exact = searchResults.find((r) => normalize(r.name) === normalize(q));
    if (exact) { setCatalogCount(exact, (countForCatalog(exact) || 0) + 1); setText(''); }
    else addCustom();
  };

  const toggle = async (item) => {
    animateNextLayout();
    try { await toggleItem(item); } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
  };

  // Aantal op een open rij. 0 = verwijderen (mét undo), ≥1 = aantal bijwerken. Afvinken
  // gebeurt via swipe/tik, niet via de stepper.
  const changeCount = (item, n) => {
    if (n <= 0) { removeWithUndo(item); return; }
    const { unit } = parseQuantity(item.quantity);
    setQuantity(item, formatQuantity(n, unit)).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };

  const removeWithUndo = (item) => {
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

  const renderRow = (item) => {
    const { count } = parseQuantity(item.quantity);
    return (
      <SwipeRow
        left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => removeWithUndo(item) }}
        right={{ icon: 'check', label: t('groceries.check'), color: colors.done, onTrigger: () => toggle(item) }}
      >
        <ItemRow
          leading={
            <Checkbox checked={item.checked} onPress={() => toggle(item)} shape="round" size={24}
              color={item.checked ? colors.done : colors.inkFaint}
              accessibilityLabel={`${item.name}, ${item.checked ? t('a11y.checked') : t('a11y.unchecked')}`} />
          }
          title={item.name}
          titleColor={item.checked ? colors.inkFaint : undefined}
          strikethrough={item.checked}
          dimmed={item.checked}
          meta={item.checked && item.quantity ? <Text style={type.caption}>{item.quantity}</Text> : undefined}
          onPress={() => toggle(item)}
          accessibilityHint={t('a11y.tapToToggle')}
          trailing={item.checked ? undefined : (
            <Stepper compact value={count} min={0} max={99}
              onChange={(v) => changeCount(item, v)} accessibilityLabel={t('catalog.qty.for', { name: item.name })} />
          )}
        />
      </SwipeRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('groceries.title')} subtitle={t('groceries.subtitle')} />

      {/* Toevoegbalk — typen zoekt direct in de catalogus (resultaten hieronder). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm, gap: space.sm }}>
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={submitTyped}
          returnKeyType="done" blurOnSubmit={false}
          placeholder={t('groceries.placeholder')}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={t('groceries.addLabel')}
          style={{
            flex: 1, minHeight: touchTarget, backgroundColor: colors.surface, borderRadius: radius.md,
            borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md,
            paddingVertical: Platform.OS === 'ios' ? space.md : space.sm, fontSize: 16, color: colors.ink,
          }}
        />
        <IconButton icon="add" accessibilityLabel={t('common.add')} tint={colors.forest}
          onPress={submitTyped} style={{ backgroundColor: colors.ocher }} />
      </View>

      {q ? (
        /* Inline zoekresultaten + UX-vriendelijke uitgangen (nieuw / hele catalogus). */
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          {searchResults.length ? (
            <Text style={[type.label, { color: colors.inkSoft, marginBottom: space.xs }]}>{t('groceries.search.results')}</Text>
          ) : null}
          {searchResults.map((item) => {
            const cnt = countForCatalog(item);
            return (
              <View key={item.key} style={{
                flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs,
              }}>
                <ProductImageView item={item} size={34} />
                <Text style={[type.body, cnt >= 1 ? { color: colors.forest, fontWeight: '700' } : null, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
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
          <Pressable onPress={() => router.push(`/catalog?q=${encodeURIComponent(q)}`)} accessibilityRole="button"
            accessibilityLabel={t('groceries.search.viewAll')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="catalog" size={18} color={colors.inkSoft} />
            <Text style={[type.body, { color: colors.inkSoft }]}>{t('groceries.search.viewAll')}</Text>
          </Pressable>
        </View>
      ) : (
        /* Niet aan het typen: heldere ingang naar de catalogus + rustige bon-link. */
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <Button title={t('catalog.open')} icon="catalog" variant="soft" onPress={() => router.push('/catalog')} />
          <Pressable onPress={() => router.push('/purchase/new')} hitSlop={8}
            accessibilityRole="button" accessibilityLabel={t('groceries.receipt')}
            style={{ alignSelf: 'center', paddingVertical: space.xs, marginTop: space.xs }}>
            <Row gap={4} align="center">
              <Icon name="receipt" size={14} color={colors.inkFaint} />
              <Text style={[type.caption, { color: colors.inkSoft }]}>{t('groceries.receipt')}</Text>
            </Row>
          </Pressable>
        </View>
      )}

      {/* "Misschien weer nodig" — zachte frequentie-suggesties, één tik = toevoegen */}
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

      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xs, paddingBottom: space.xxl }}
        data={open}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        ListHeaderComponent={open.length > 0 ? <SectionHeader title={t('groceries.section.open')} count={open.length} /> : null}
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          loading && items.length === 0 ? (
            <ListSkeleton count={5} />
          ) : !loading && items.length === 0 ? (
            <Empty illustration="groceries" title={t('groceries.empty.title')}
              subtitle={t('groceries.empty.subtitle')}
              actionTitle={t('catalog.open')} onAction={() => router.push('/catalog')} />
          ) : null
        }
        ListFooterComponent={
          done.length > 0 ? (
            <View style={{ marginTop: space.lg }}>
              <SectionHeader title={t('groceries.section.done')} count={done.length}
                action={
                  <IconButton icon="delete" accessibilityLabel={t('groceries.clearChecked')}
                    tint={colors.danger} onPress={onClearChecked} />
                } />
              {done.map((item) => <View key={item.id}>{renderRow(item)}</View>)}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
