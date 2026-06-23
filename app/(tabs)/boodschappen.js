import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, SectionList, ScrollView, TextInput, RefreshControl, Platform, Modal, Pressable } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../../lib/useGroceries';
import { useProducts, useProductFrequencies } from '../../lib/useProducts';
import { frequencyLabel } from '../../lib/buyFrequency';
import { useCatalogCategories } from '../../lib/useCatalog';
import { groupFavorites, topFavorites, hiddenProducts } from '../../lib/favoriteGroceries';
import { useToast } from '../../lib/toast';
import { Empty, Checkbox, ScreenHeader, SectionHeader, ItemRow, IconButton, ListSkeleton, Chip, Row, ModalHeader, SwipeRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { EtenNav } from '../../lib/EtenNav';
import { colors, radius, space, type, touchTarget } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { t, plural } from '../../lib/i18n';

export default function Boodschappen() {
  const dialog = useDialog();
  const { items, loading, reload, add: addItem, toggle: toggleItem, remove: removeItem, removeMany } = useGroceries();
  const { products, suggestFor, setHidden } = useProducts();
  const { byProduct: freqByProduct } = useProductFrequencies();
  const { categories: productCategories } = useCatalogCategories();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState('');
  const [favOpen, setFavOpen] = useState(false);   // "Vaste boodschappen"-sheet
  const [favQuery, setFavQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // Catalogus-suggesties terwijl je typt (BOO-5): koppel een boodschap aan een
  // bestaand product zodat de prijsdata uit normaal gebruik groeit.
  const productHints = useMemo(() => {
    if (text.trim().length < 2) return [];
    return suggestFor(text, 3).filter((s) => s.score >= 0.4).map((s) => s.product);
  }, [text, products]);

  const addLinked = (product) => {
    setText('');
    animateNextLayout();
    addItem(product.name, product.id).catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
  };
  // Ids die we lokaal verbergen zolang de "ongedaan maken"-toast loopt; de echte
  // verwijdering gebeurt pas als die toast verloopt.
  const [hiddenIds, setHiddenIds] = useState([]);

  // Open bovenaan, afgevinkt in een eigen sectie eronder. Beide afgeleid van
  // `checked`, dus een (optimistische) tik verplaatst het item meteen. Items in
  // `hiddenIds` zijn lokaal verborgen zolang hun undo-toast loopt.
  const open = useMemo(
    () => items.filter((i) => !i.checked && !hiddenIds.includes(i.id)),
    [items, hiddenIds]
  );
  const done = useMemo(
    () => items.filter((i) => i.checked && !hiddenIds.includes(i.id)),
    [items, hiddenIds]
  );

  // "Vaste boodschappen": een "Meest gekozen"-snelkoppeling bovenaan + je producten per
  // schap (op gebruik gesorteerd). Verborgen producten vallen overal uit, behalve in een
  // optionele "Verborgen"-sectie om ze weer te tonen. Producten die al op de open lijst
  // staan tonen we als "✓ op je lijst" (geen dubbele toevoeging).
  const favGroups = useMemo(
    () => groupFavorites(products, productCategories, { query: favQuery }),
    [products, productCategories, favQuery]
  );
  const favTop = useMemo(() => topFavorites(products, { n: 8 }), [products]);
  const favHidden = useMemo(() => hiddenProducts(products, { query: favQuery }), [products, favQuery]);
  const hiddenCount = useMemo(() => products.filter((p) => p.hidden).length, [products]);

  // Secties voor de SectionList: top (alleen zonder filter) → schappen → verborgen (alleen
  // als "toon verborgen" aan staat). `kind` stuurt de rij-rendering.
  const favSections = useMemo(() => {
    // Een product kan in "Meest gekozen" én in zijn schap staan; geef de rij een
    // sectie-gebonden key zodat React geen dubbele keys ziet.
    const tag = (sectionKey, arr) => arr.map((p) => ({ ...p, _favKey: `${sectionKey}:${p.id}` }));
    const out = [];
    if (!favQuery && favTop.length) out.push({ key: '__top__', label: t('groceries.favorites.top'), emoji: '⭐', kind: 'top', data: tag('top', favTop) });
    for (const g of favGroups) out.push({ ...g, kind: 'group', data: tag(g.key, g.items) });
    if (showHidden && favHidden.length) out.push({ key: '__hidden__', label: t('groceries.favorites.hidden'), emoji: '🙈', kind: 'hidden', data: tag('hidden', favHidden) });
    return out;
  }, [favQuery, favTop, favGroups, showHidden, favHidden]);

  const openProductIds = useMemo(
    () => new Set(open.map((i) => i.product_id).filter(Boolean)),
    [open]
  );

  // "Misschien weer nodig" (BOO-8): producten waarvan het historische koopinterval
  // verstreken is (dueScore >= 1) en die nog niet op de lijst staan. Zacht en
  // uitlegbaar; alleen tonen als je niet aan het typen bent (anders staan de
  // catalogus-hints in de weg).
  const dueSuggestions = useMemo(() => {
    if (text.trim()) return [];
    return products
      .filter((p) => !p.hidden && !openProductIds.has(p.id))
      .map((p) => ({ product: p, est: freqByProduct[p.id] }))
      .filter((x) => x.est && x.est.dueScore >= 1)
      .sort((a, b) => b.est.dueScore - a.est.dueScore)
      .slice(0, 6);
  }, [products, freqByProduct, openProductIds, text]);
  const addFavorite = (product) => {
    if (openProductIds.has(product.id)) { toast.show({ message: t('groceries.favorites.onlist') }); return; }
    addItem(product.name, product.id).catch((e) => dialog.alert({ title: t('groceries.error.add'), body: e.message }));
    toast.show({ message: t('groceries.favorites.added', { name: product.name }) });
  };
  // Verbergen is subtiel (lang indrukken) en meteen terug te draaien via de toast.
  const hideFavorite = (product) => {
    animateNextLayout();
    setHidden(product.id, true).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
    toast.show({
      message: t('groceries.favorites.hide.done', { name: product.name }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHidden(product.id, false).catch(() => {}); },
    });
  };
  const unhideFavorite = (product) => {
    animateNextLayout();
    setHidden(product.id, false).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
  };

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    animateNextLayout();
    try { await addItem(name); } catch (e) { dialog.alert({ title: t('groceries.error.add'), body: e.message }); }
  };

  const toggle = async (item) => {
    animateNextLayout(); // het item glijdt zacht tussen "te halen" en "afgevinkt"
    try { await toggleItem(item); } catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
  };

  // Eén item wissen is óók terug te draaien: verberg het lokaal, verwijder pas
  // echt als de undo-toast verloopt (zelfde patroon als "afgevinkte wissen").
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
    setHiddenIds((h) => [...h, ...ids]);   // meteen weg uit beeld
    toast.show({
      message: t('groceries.clearedChecked', { n: ids.length }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }, // weer tonen
      onExpire: async () => {                // pas nu de echte verwijdering
        try { await removeMany(ids); }
        catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
        finally { setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }
      },
    });
  };

  const renderRow = (item) => (
    <SwipeRow left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => removeWithUndo(item) }}>
      <ItemRow
        leading={
          <Checkbox
            checked={item.checked}
            onPress={() => toggle(item)}
            shape="round"
            size={24}
            color={item.checked ? colors.done : colors.inkFaint}
            accessibilityLabel={`${item.name}, ${item.checked ? t('a11y.checked') : t('a11y.unchecked')}`}
          />
        }
        title={item.name}
        titleColor={item.checked ? colors.inkFaint : undefined}
        strikethrough={item.checked}
        dimmed={item.checked}
        meta={item.quantity ? <Text style={type.caption}>{item.quantity}</Text> : undefined}
        onPress={() => toggle(item)}
        accessibilityHint={t('a11y.tapToToggle')}
        trailing={
          <IconButton icon="delete" size={20} tint={colors.inkFaint}
            accessibilityLabel={t('groceries.deleteItem', { name: item.name })} onPress={() => removeWithUndo(item)} />
        }
      />
    </SwipeRow>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('groceries.title')} subtitle={t('groceries.subtitle')}
        right={
          <Row gap={space.xs}>
            <IconButton icon="search" accessibilityLabel={t('catalog.open')} tint={colors.forest}
              onPress={() => router.push('/catalog')} />
            <IconButton icon="repeat" accessibilityLabel={t('groceries.favorites')} tint={colors.forest}
              onPress={() => setFavOpen(true)} />
            <IconButton icon="receipt" accessibilityLabel={t('groceries.receipt')} tint={colors.forest}
              onPress={() => router.push('/purchase/new')} />
          </Row>
        } />

      <EtenNav active="boodschappen" />

      {/* Toevoegbalk */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm, gap: space.sm }}>
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={add}
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
          onPress={add} style={{ backgroundColor: colors.ocher }} />
      </View>

      {productHints.length > 0 ? (
        <Row gap={space.xs} wrap style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          {productHints.map((p) => (
            <Chip key={p.id} label={p.name} icon="catalog" onPress={() => addLinked(p)} />
          ))}
        </Row>
      ) : null}

      {/* "Misschien weer nodig" (BOO-8): zachte frequentie-suggesties, één tik = toevoegen */}
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
              actionTitle={t('groceries.favorites')} onAction={() => setFavOpen(true)} />
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

      {/* "Vaste boodschappen": je eigen producten, per schap, op gebruik gesorteerd.
          Eén tik = op de lijst (blijft open voor meerdere). De prijstracker zit op de
          chevron ernaast. Producten die al op de lijst staan tonen we als "✓ op je lijst". */}
      <Modal visible={favOpen} animationType="slide" onRequestClose={() => setFavOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <ModalHeader title={t('groceries.favorites.title')} onClose={() => setFavOpen(false)} />
          <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
            <TextInput
              value={favQuery} onChangeText={setFavQuery}
              placeholder={t('groceries.favorites.filter')} placeholderTextColor={colors.inkFaint}
              accessibilityLabel={t('groceries.favorites.filter')}
              style={{
                minHeight: touchTarget, backgroundColor: colors.surface, borderRadius: radius.md,
                borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md,
                paddingVertical: Platform.OS === 'ios' ? space.md : space.sm, fontSize: 16, color: colors.ink,
              }}
            />
            {hiddenCount > 0 ? (
              <Pressable
                onPress={() => setShowHidden((s) => !s)} hitSlop={8}
                accessibilityRole="button"
                style={{ alignSelf: 'flex-end', paddingVertical: space.xs }}
              >
                <Text style={[type.caption, { color: colors.forest }]}>
                  {showHidden ? t('groceries.favorites.hideHidden')
                    : plural(hiddenCount, 'groceries.favorites.showHidden.one', 'groceries.favorites.showHidden.other')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <SectionList
            sections={favSections}
            keyExtractor={(p) => p._favKey}
            contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: space.xxl }}
            stickySectionHeadersEnabled={false}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => (
              <SectionHeader title={`${section.emoji ? `${section.emoji} ` : ''}${section.label}`} count={section.data.length} />
            )}
            renderItem={({ item, section }) => {
              // Verborgen-sectie: tik = weer tonen.
              if (section.kind === 'hidden') {
                return (
                  <ItemRow
                    leading={<Icon name="catalog" size={20} color={colors.inkFaint} />}
                    title={item.name}
                    titleColor={colors.inkFaint}
                    onPress={() => unhideFavorite(item)}
                    accessibilityLabel={`${item.name} — ${t('groceries.favorites.unhide')}`}
                    trailing={<Text style={[type.caption, { color: colors.forest }]}>{t('groceries.favorites.unhide')}</Text>}
                  />
                );
              }
              const onList = openProductIds.has(item.id);
              return (
                <ItemRow
                  leading={
                    <View style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: onList ? colors.forestTint : colors.ocherSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={onList ? 'check' : 'add'} size={18} color={colors.forest} weight="bold" />
                    </View>
                  }
                  title={item.name}
                  titleColor={onList ? colors.inkFaint : undefined}
                  meta={
                    onList ? <Text style={type.caption}>{t('groceries.favorites.onlist')}</Text>
                      : item.times_added > 0
                        ? <Text style={type.caption}>{plural(item.times_added, 'groceries.favorites.times.one', 'groceries.favorites.times.other')}</Text>
                        : undefined
                  }
                  onPress={() => addFavorite(item)}
                  onLongPress={() => hideFavorite(item)}
                  accessibilityLabel={onList ? t('groceries.favorites.onlist') : t('catalog.add', { name: item.name })}
                  accessibilityHint={t('groceries.favorites.longpress')}
                  trailing={
                    <IconButton icon="price" size={20} tint={colors.inkFaint}
                      accessibilityLabel={t('groceries.favorites.detail')}
                      onPress={() => { setFavOpen(false); router.push(`/product/${item.id}`); }} />
                  }
                />
              );
            }}
            ListEmptyComponent={
              <Empty illustration="groceries" title={t('groceries.favorites.empty.title')}
                subtitle={t('groceries.favorites.empty.subtitle')} />
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
