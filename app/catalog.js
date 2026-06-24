import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, TextInput, Pressable, Platform, ScrollView } from 'react-native';
import { useDialog } from '../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../lib/useGroceries';
import { useProducts } from '../lib/useProducts';
import { useToast } from '../lib/toast';
import { backLabelFor } from '../lib/navMeta';
import { CATEGORIES, catalogByCategory, searchCatalog, itemByName } from '../lib/groceryCatalog';
import { recentProducts } from '../lib/favoriteGroceries';
import { normalize } from '../lib/productMatch';
import { formatQuantity } from '../lib/quantity';
import { ProductImageView } from '../lib/ProductImageView';
import { ModalHeader, Empty, Chip, Stepper, Row } from '../lib/ui';
import { Icon } from '../lib/icons';
import { animateNextLayout } from '../lib/motion';
import { colors, space, radius, type, touchTarget, screenPadding } from '../lib/theme';
import { t } from '../lib/i18n';

const RECENT_KEY = '__recent__';
const RECENT_CAP = 24;

// Eén rij voor zowel een schap-product als een "eerder gekozen"-product. Gememoiseerd
// zodat het bijstellen van het aantal op één rij niet de hele (lange) lijst hertekent —
// dat was de oorzaak van de traagheid. Alle callbacks komen stabiel binnen (zie hieronder),
// dus React kan rijen die niet veranderen overslaan.
const CatalogRow = React.memo(function CatalogRow({ entry, qty, onList, onQty, onAdd, onPrune }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
      borderBottomWidth: 1, borderBottomColor: colors.line,
    }}>
      <ProductImageView item={entry.image} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={type.body} numberOfLines={1}>{entry.name}</Text>
        {entry.unit ? <Text style={type.caption}>{entry.unit}</Text> : null}
      </View>

      {onList ? (
        <Row gap={4} align="center">
          <Icon name="check" size={16} color={colors.forest} weight="bold" />
          <Text style={[type.caption, { color: colors.forest }]}>{t('catalog.onlist')}</Text>
        </Row>
      ) : entry.isRecent ? (
        // Eerder gekozen = snelkeuze: één tik plaatst er één op de lijst (aantal stel je
        // daarna op de lijst zelf bij). × schoont 'm uit deze sectie op.
        <Row gap={space.xs} align="center">
          <Pressable onPress={() => onAdd(entry, 1)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('catalog.add', { name: entry.name })}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: pressed ? colors.ocher : colors.ocherSoft,
              alignItems: 'center', justifyContent: 'center',
            })}>
            <Icon name="add" size={18} color={colors.forest} weight="bold" />
          </Pressable>
          <Pressable onPress={() => onPrune(entry)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('catalog.recent.remove', { name: entry.name })}
            style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={16} color={colors.inkFaint} />
          </Pressable>
        </Row>
      ) : (
        <Row gap={space.sm} align="center">
          <Stepper value={qty} onChange={(v) => onQty(entry.key, v)}
            min={1} max={99} accessibilityLabel={t('catalog.qty')} />
          <Pressable onPress={() => onAdd(entry, qty)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('catalog.add', { name: entry.name })}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: pressed ? colors.ocher : colors.ocherSoft,
              alignItems: 'center', justifyContent: 'center',
            })}>
            <Icon name="add" size={18} color={colors.forest} weight="bold" />
          </Pressable>
        </Row>
      )}
    </View>
  );
});

// Bladeren/zoeken in de gebundelde, merkloze catalogus (lib/groceryCatalog) — Picnic-stijl:
// schappen (categorieën) + zoekbalk + beeld + aantallen, met "Eerder gekozen" bovenaan
// (recentheid, zelf op te schonen). Toevoegen koppelt aan een huishoud-product, zodat die
// sectie zich vanzelf vult. Staat een product er niet bij? Voeg de zoekterm zelf toe.
export default function Catalog() {
  const dialog = useDialog();
  const router = useRouter();
  const toast = useToast();
  const { items, add } = useGroceries();
  const { products, ensureProduct, setHidden } = useProducts();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = alle schappen, RECENT_KEY = eerder gekozen, anders schap-key
  const [qtyByKey, setQtyByKey] = useState({});

  const q = query.trim();

  // Wat staat al (open) op de lijst — op genormaliseerde naam, zodat "✓ op je lijst" klopt.
  const onListSet = useMemo(
    () => new Set(items.filter((i) => !i.checked).map((i) => normalize(i.name))),
    [items],
  );

  // "Eerder gekozen": huishoud-producten op recentheid. Elk product leent beeld/eenheid van
  // het generieke catalogus-item met dezelfde naam (anders valt het terug op de schap-emoji).
  const recentEntries = useMemo(() => recentProducts(products, { n: RECENT_CAP }).map((p) => {
    const cat = itemByName(p.name);
    return {
      key: `r:${p.id}`,
      name: p.name,
      unit: cat?.unit || p.default_unit || '',
      image: { emoji: cat?.emoji, category: p.category || cat?.category },
      isRecent: true,
      product: p,
    };
  }), [products]);

  // Een schap-item → een rij-entry (stabiele ref dankzij useMemo op de schappen).
  const toShelfEntry = (it) => ({ key: `c:${it.key}`, name: it.name, unit: it.unit, image: it, isRecent: false, item: it });

  // Secties: zoeken → één resultatenlijst; "eerder gekozen" → die sectie; één schap → dat
  // schap; anders eerder-gekozen (indien gevuld) bovenaan gevolgd door alle schappen.
  const sections = useMemo(() => {
    if (q) {
      const results = searchCatalog(q).map(toShelfEntry);
      return results.length ? [{ key: 'results', title: null, data: results }] : [];
    }
    if (category === RECENT_KEY) {
      return recentEntries.length
        ? [{ key: RECENT_KEY, title: `🕘  ${t('catalog.recent')}`, data: recentEntries }]
        : [];
    }
    const shelves = catalogByCategory();
    const out = [];
    if (category == null && recentEntries.length) {
      out.push({ key: RECENT_KEY, title: `🕘  ${t('catalog.recent')}`, data: recentEntries });
    }
    const picked = category ? shelves.filter((g) => g.key === category) : shelves;
    for (const g of picked) out.push({ key: g.key, title: `${g.emoji}  ${g.label}`, data: g.items.map(toShelfEntry) });
    return out;
  }, [q, category, recentEntries]);

  // ── Stabiele callbacks: via een ref zodat de rij-memo niet door verse closures wordt
  // verbroken (anders hertekent elke aantal-tik tóch de hele lijst).
  const addImpl = (entry, n) => {
    const quantity = entry.isRecent ? null : formatQuantity(n, entry.unit);
    const ensure = entry.isRecent
      ? Promise.resolve(entry.product)
      : ensureProduct({ name: entry.item.name, category: entry.item.category, defaultUnit: entry.item.unit });
    ensure
      .then((product) => add(entry.name, product?.id ?? null, null, quantity))
      .then(() => {
        toast.show({ message: t('catalog.added', { name: entry.name }) });
        if (!entry.isRecent) setQtyByKey((m) => { const c = { ...m }; delete c[entry.key]; return c; });
      })
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };
  const pruneImpl = (entry) => {
    animateNextLayout();
    setHidden(entry.product.id, true).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
    toast.show({
      message: t('catalog.recent.removed', { name: entry.name }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setHidden(entry.product.id, false).catch(() => {}); },
    });
  };
  // Houd de refs ná de render gelijk aan de laatste closures (useEvent-patroon): zo
  // blijven onAdd/onPrune stabiel en hertekent een aantal-tik niet de hele lijst, terwijl
  // de handlers tóch de verse state zien op het moment dat je tikt.
  const addRef = useRef(addImpl);
  const pruneRef = useRef(pruneImpl);
  useEffect(() => { addRef.current = addImpl; pruneRef.current = pruneImpl; });

  const onAdd = useCallback((entry, n) => addRef.current(entry, n), []);
  const onPrune = useCallback((entry) => pruneRef.current(entry), []);
  const onQty = useCallback((key, v) => setQtyByKey((m) => ({ ...m, [key]: v })), []);

  const addCustom = () => {
    const name = q;
    if (!name) return;
    ensureProduct({ name })
      .then((product) => add(name, product?.id ?? null))
      .then(() => { toast.show({ message: t('catalog.added', { name }) }); setQuery(''); })
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const renderItem = useCallback(({ item: entry }) => (
    <CatalogRow
      entry={entry}
      qty={qtyByKey[entry.key] ?? 1}
      onList={onListSet.has(normalize(entry.name))}
      onQty={onQty}
      onAdd={onAdd}
      onPrune={onPrune}
    />
  ), [qtyByKey, onListSet, onQty, onAdd, onPrune]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('catalog.title')} onClose={() => router.back()} backLabel={backLabelFor('catalog')} />

      {/* Zoekbalk */}
      <View style={{ paddingHorizontal: screenPadding }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md,
          borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md, marginBottom: space.sm,
        }}>
          <Icon name="search" size={20} color={colors.inkFaint} />
          <TextInput
            value={query} onChangeText={setQuery}
            placeholder={t('catalog.search')} placeholderTextColor={colors.inkFaint}
            autoCorrect={false} returnKeyType="search" accessibilityLabel={t('catalog.search')}
            style={{
              flex: 1, minHeight: touchTarget, marginLeft: space.sm,
              paddingVertical: Platform.OS === 'ios' ? space.md : space.sm, fontSize: 16, color: colors.ink,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
              <Icon name="close" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Schap-filter (alleen relevant als je niet zoekt) — met "Eerder gekozen" als eerste chip */}
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: space.sm }} style={{ flexGrow: 0 }}>
          <Chip label={t('catalog.all')} active={category == null} onPress={() => setCategory(null)} />
          {recentEntries.length ? (
            <Chip label={`🕘 ${t('catalog.recent')}`} active={category === RECENT_KEY}
              onPress={() => setCategory((cur) => (cur === RECENT_KEY ? null : RECENT_KEY))} />
          ) : null}
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={`${c.emoji} ${c.label}`} active={category === c.key}
              onPress={() => setCategory((cur) => (cur === c.key ? null : c.key))} />
          ))}
        </ScrollView>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.key}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          section.title ? (
            <Text style={[type.label, { marginTop: space.md, marginBottom: space.xs, color: colors.inkSoft }]}>
              {section.title}
            </Text>
          ) : null
        )}
        ListEmptyComponent={
          q ? (
            <Empty illustration="groceries" title={t('catalog.empty.title')} subtitle={t('catalog.empty.subtitle')} />
          ) : category === RECENT_KEY ? (
            <Empty illustration="groceries" title={t('catalog.recent.empty.title')} subtitle={t('catalog.recent.empty.subtitle')} />
          ) : null
        }
        ListFooterComponent={
          // Staat het er niet (precies) bij? Voeg de zoekterm eenmalig toe.
          q ? (
            <Pressable onPress={addCustom} accessibilityRole="button" accessibilityLabel={t('catalog.add', { name: q })}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md,
                paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md,
                borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed',
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
              })}>
              <Icon name="add" size={18} color={colors.forest} weight="bold" />
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: colors.forest, fontWeight: '700' }]}>{t('catalog.add', { name: q })}</Text>
                <Text style={type.caption}>{t('catalog.custom.hint')}</Text>
              </View>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
