import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, RefreshControl, Platform, Pressable } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../../lib/useGroceries';
import { useProducts, useProductFrequencies } from '../../lib/useProducts';
import { frequencyLabel } from '../../lib/buyFrequency';
import { useToast } from '../../lib/toast';
import { Empty, Checkbox, ScreenHeader, SectionHeader, ItemRow, IconButton, ListSkeleton, Chip, Row, SwipeRow, Button, Stepper } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { EtenNav } from '../../lib/EtenNav';
import { colors, radius, space, type, touchTarget } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { parseQuantity, formatQuantity } from '../../lib/quantity';
import { t } from '../../lib/i18n';

export default function Boodschappen() {
  const dialog = useDialog();
  const { items, loading, reload, add: addItem, toggle: toggleItem, setQuantity, remove: removeItem, removeMany } = useGroceries();
  const { products, suggestFor } = useProducts();
  const { byProduct: freqByProduct } = useProductFrequencies();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState('');

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

  // Aantal op een open rij bijstellen via de compacte stepper. Eén stuks → quantity leeg
  // (rustige rij); vanaf twee "<n> <eenheid>" (eenheid komt mee uit de bestaande waarde).
  const changeQuantity = (item, n) => {
    const { unit } = parseQuantity(item.quantity);
    setQuantity(item, formatQuantity(n, unit)).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
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

  const renderRow = (item) => {
    const { count } = parseQuantity(item.quantity);
    return (
      <SwipeRow
        left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => removeWithUndo(item) }}
        right={{ icon: 'check', label: t('groceries.check'), color: colors.done, onTrigger: () => toggle(item) }}
      >
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
          // Afgevinkt: aantal als rustige caption. Open: bewerkbaar via de stepper hiernaast.
          meta={item.checked && item.quantity ? <Text style={type.caption}>{item.quantity}</Text> : undefined}
          onPress={() => toggle(item)}
          accessibilityHint={t('a11y.tapToToggle')}
          trailing={item.checked ? undefined : (
            <Stepper compact value={count} min={1} max={99}
              onChange={(v) => changeQuantity(item, v)} accessibilityLabel={t('catalog.qty')} />
          )}
        />
      </SwipeRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('groceries.title')} subtitle={t('groceries.subtitle')} />

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

      {/* Eén heldere ingang naar de catalogus (bladeren, eerder gekozen, zelf toevoegen);
          bon invoeren is een rustige tweede-orde-link eronder. */}
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
