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

// Eén rij voor zowel een schap-product als een "eerder gekozen"-product. Gememoiseerd +
// het aantal staat LOKAAL in de rij: een +/−-tik hertekent dus alléén deze rij, niet de
// (lange) lijst. Alle callbacks komen stabiel binnen, dus React slaat ongewijzigde rijen
// over. Dit (samen met directe feedback bij toevoegen) maakt de catalogus snappy.
const CatalogRow = React.memo(function CatalogRow({ entry, onList, onAdd, onPrune }) {
  const [qty, setQty] = useState(1);
  const addShelf = () => { onAdd(entry, qty); setQty(1); };
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
            <Icon name="shopping" size={18} color={colors.forest} weight="bold" />
          </Pressable>
          <Pressable onPress={() => onPrune(entry)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('catalog.recent.remove', { name: entry.name })}
            style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={16} color={colors.inkFaint} />
          </Pressable>
        </Row>
      ) : (
        <Row gap={space.sm} align="center">
          <Stepper value={qty} onChange={setQty} min={1} max={99} accessibilityLabel={t('catalog.qty')} />
          <Pressable onPress={addShelf} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={t('catalog.add', { name: entry.name })}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: pressed ? colors.ocher : colors.ocherSoft,
              alignItems: 'center', justifyContent: 'center',
            })}>
            <Icon name="shopping" size={18} color={colors.forest} weight="bold" />
          </Pressable>
        </Row>
      )}
    </View>
  );
});

// Bladeren/zoeken in de gebundelde catalogus (lib/groceryCatalog) — Picnic-stijl: schappen
// + zoekbalk + beeld + aantallen, met "Eerder gekozen" bovenaan (recentheid, op te schonen).
// Toevoegen koppelt aan een huishoud-product zodat die sectie zich vanzelf vult, en geeft
// directe feedback (het netwerk volgt op de achtergrond) zodat tikken meteen voelt.
export default function Catalog() {
  const dialog = useDialog();
  const router = useRouter();
  const toast = useToast();
  const { items, add } = useGroceries();
  const { products, ensureProduct, setHidden } = useProducts();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = alle schappen, RECENT_KEY = eerder gekozen, anders schap-key
  const [justAdded, setJustAdded] = useState(() => new Set());   // optimistische "✓ op je lijst" (genormaliseerde naam)
  const [prunedIds, setPrunedIds] = useState(() => new Set());   // optimistisch opgeschoond uit "eerder gekozen"

  const q = query.trim();

  // Wat staat al (open) op de lijst — op genormaliseerde naam, plus wat we zojuist
  // optimistisch toevoegden (zodat "✓ op je lijst" meteen verschijnt, zonder netwerk).
  const onListSet = useMemo(
    () => new Set(items.filter((i) => !i.checked).map((i) => normalize(i.name))),
    [items],
  );
  const isOnList = useCallback((name) => {
    const n = normalize(name);
    return onListSet.has(n) || justAdded.has(n);
  }, [onListSet, justAdded]);

  // De gebundelde catalogus is statisch → schap-secties + een key→entry-map één keer
  // bouwen. Stabiele entry-refs betekenen dat data-wijzigingen (nieuwe boodschap, recency)
  // de schap-rijen niet onnodig hertekenen.
  const shelf = useMemo(() => {
    const byKey = new Map();
    const sections = catalogByCategory().map((g) => {
      const data = g.items.map((it) => {
        const e = { key: `c:${it.key}`, name: it.name, unit: it.unit, image: it, isRecent: false, item: it };
        byKey.set(it.key, e);
        return e;
      });
      return { key: g.key, title: `${g.emoji}  ${g.label}`, data };
    });
    return { sections, byKey };
  }, []);

  // "Eerder gekozen": huishoud-producten op recentheid (min wat optimistisch is opgeschoond).
  // Elk product leent beeld/eenheid van het gelijknamige catalogus-item.
  const recentEntries = useMemo(() => recentProducts(products, { n: RECENT_CAP })
    .filter((p) => !prunedIds.has(p.id))
    .map((p) => {
      const cat = itemByName(p.name);
      return {
        key: `r:${p.id}`,
        name: p.name,
        unit: cat?.unit || p.default_unit || '',
        image: { emoji: cat?.emoji, category: p.category || cat?.category },
        isRecent: true,
        product: p,
      };
    }), [products, prunedIds]);

  // Secties: zoeken → één resultatenlijst; "eerder gekozen" → die sectie; één schap → dat
  // schap; anders eerder-gekozen (indien gevuld) bovenaan gevolgd door alle schappen.
  const sections = useMemo(() => {
    if (q) {
      const results = searchCatalog(q).map((it) => shelf.byKey.get(it.key)).filter(Boolean);
      return results.length ? [{ key: 'results', title: null, data: results }] : [];
    }
    const recentSection = { key: RECENT_KEY, title: `🕘  ${t('catalog.recent')}`, data: recentEntries };
    if (category === RECENT_KEY) return recentEntries.length ? [recentSection] : [];
    const out = [];
    if (category == null && recentEntries.length) out.push(recentSection);
    const picked = category ? shelf.sections.filter((s) => s.key === category) : shelf.sections;
    return out.concat(picked);
  }, [q, category, recentEntries, shelf]);

  // ── Toevoegen voelt meteen: feedback + optimistische ✓ nú, netwerk op de achtergrond.
  const addImpl = (entry, n) => {
    const norm = normalize(entry.name);
    toast.show({ message: t('catalog.added', { name: entry.name }) });
    setJustAdded((s) => new Set(s).add(norm));
    const quantity = entry.isRecent ? null : formatQuantity(n, entry.unit);
    const ensure = entry.isRecent
      ? Promise.resolve(entry.product)
      : ensureProduct({ name: entry.item.name, category: entry.item.category, defaultUnit: entry.item.unit });
    ensure
      .then((product) => add(entry.name, product?.id ?? null, null, quantity))
      .catch((e) => {
        setJustAdded((s) => { const next = new Set(s); next.delete(norm); return next; });
        dialog.alert({ title: t('catalog.error.add'), body: e.message });
      });
  };
  const pruneImpl = (entry) => {
    const id = entry.product.id;
    animateNextLayout();
    setPrunedIds((s) => new Set(s).add(id));
    setHidden(id, true).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
    toast.show({
      message: t('catalog.recent.removed', { name: entry.name }),
      actionLabel: t('common.undo'),
      onAction: () => {
        animateNextLayout();
        setPrunedIds((s) => { const next = new Set(s); next.delete(id); return next; });
        setHidden(id, false).catch(() => {});
      },
    });
  };
  // Stabiele wrappers (useEvent-patroon) zodat de rij-memo niet door verse closures breekt.
  const addRef = useRef(addImpl);
  const pruneRef = useRef(pruneImpl);
  useEffect(() => { addRef.current = addImpl; pruneRef.current = pruneImpl; });
  const onAdd = useCallback((entry, n) => addRef.current(entry, n), []);
  const onPrune = useCallback((entry) => pruneRef.current(entry), []);

  const addCustom = () => {
    const name = q;
    if (!name) return;
    toast.show({ message: t('catalog.added', { name }) });
    setQuery('');
    ensureProduct({ name })
      .then((product) => add(name, product?.id ?? null))
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const renderItem = useCallback(({ item: entry }) => (
    <CatalogRow entry={entry} onList={isOnList(entry.name)} onAdd={onAdd} onPrune={onPrune} />
  ), [isOnList, onAdd, onPrune]);

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

      {/* Schap-filter (alleen relevant als je niet zoekt) — met "Eerder gekozen" als eerste chip.
          paddingVertical geeft de chip-rand lucht zodat 'ie bovenaan niet wordt afgesneden. */}
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.sm }}
          style={{ flexGrow: 0 }}>
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
              <Icon name="shopping" size={18} color={colors.forest} weight="bold" />
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
