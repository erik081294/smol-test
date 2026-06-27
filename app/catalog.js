import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, Pressable, Platform, ScrollView } from 'react-native';
import { useDialog } from '../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGroceries } from '../lib/useGroceries';
import { useProducts } from '../lib/useProducts';
import { useToast } from '../lib/toast';
import { backLabelFor } from '../lib/navMeta';
import { CATEGORIES, catalogByCategory, searchCatalog, itemByName } from '../lib/groceryCatalog';
import { recentProducts } from '../lib/favoriteGroceries';
import { countOf } from '../lib/groceryCount';
import { ProductImageView } from '../lib/ProductImageView';
import { ModalHeader, Empty, Chip, Stepper, SwipeRow } from '../lib/ui';
import { Icon } from '../lib/icons';
import { SearchField } from '../lib/SearchField';
import { animateNextLayout } from '../lib/motion';
import { colors, space, radius, type, screenPadding } from '../lib/theme';
import { t } from '../lib/i18n';

const RECENT_KEY = '__recent__';
const RECENT_CAP = 24;

// Eén catalogus-/eerder-gekozen-rij. De stepper IS het mechaniek: zijn waarde is het
// aantal dat op de boodschappenlijst staat (0 = er niet op). 0→n zet het op de lijst,
// →0 haalt het eraf. Gememoiseerd zodat één tik niet de hele lijst hertekent.
//
// "Eerder gekozen"-rijen verwijder je nu door naar LINKS te vegen (de app-brede conventie:
// links = verwijderen), i.p.v. een vaste × naast de stepper — dat ontruimt de rij en houdt
// de stepper de enige knop. De veegactie is óók als accessibility-actie beschikbaar (SwipeRow).
const CatalogRow = React.memo(function CatalogRow({ entry, count, onSetCount, onPrune, onEdit }) {
  const onList = count >= 1;
  const row = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
      backgroundColor: colors.bg,
      borderBottomWidth: 1, borderBottomColor: colors.line,
    }}>
      {/* Tik op het product (beeld + naam) → producteditor (BOO-13). De stepper ernaast
          blijft de toevoeg-knop, dus de twee acties botsen niet. */}
      <Pressable onPress={() => onEdit(entry)} accessibilityRole="button"
        accessibilityLabel={entry.name} accessibilityHint={t('catalog.edit.hint')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
        <ProductImageView item={entry.image} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, onList ? { color: colors.forest, fontWeight: '700' } : null]} numberOfLines={1}>{entry.name}</Text>
          {entry.unit ? <Text style={type.caption}>{entry.unit}</Text> : null}
        </View>
      </Pressable>
      <Stepper value={count} onChange={(v) => onSetCount(entry, v)} min={0} max={99}
        accessibilityLabel={t('catalog.qty.for', { name: entry.name })} />
    </View>
  );
  if (entry.isRecent) {
    return (
      <SwipeRow left={{ icon: 'delete', label: t('catalog.recent.remove', { name: entry.name }), color: colors.danger, onTrigger: () => onPrune(entry) }}>
        {row}
      </SwipeRow>
    );
  }
  return row;
});

// Bladeren/zoeken in de gebundelde catalogus (lib/groceryCatalog). Picnic-stijl: schappen
// + zoekbalk + beeld + "Eerder gekozen" bovenaan. Elke rij toont een stepper die direct
// gekoppeld is aan de boodschappenlijst (zelfde model als de lijst zelf). Optimistisch:
// het aantal verandert meteen lokaal, het netwerk volgt op de achtergrond.
export default function Catalog() {
  const dialog = useDialog();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();
  const { items, setCount } = useGroceries();
  const { products, ensureProduct, setHidden } = useProducts();
  const [query, setQuery] = useState(typeof params.q === 'string' ? params.q : '');
  const [category, setCategory] = useState(null); // null = alle, RECENT_KEY, of schap-key
  const [counts, setCounts] = useState({});        // optimistische override: entry.key → aantal
  const [prunedIds, setPrunedIds] = useState(() => new Set());

  const q = query.trim();

  // De gebundelde catalogus is statisch → schap-secties + key→entry-map één keer bouwen.
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

  const recentEntries = useMemo(() => recentProducts(products, { n: RECENT_CAP })
    .filter((p) => !prunedIds.has(p.id))
    .map((p) => {
      const cat = itemByName(p.name);
      return {
        key: `r:${p.id}`, name: p.name, unit: cat?.unit || p.default_unit || '',
        image: { emoji: p.emoji ?? cat?.emoji, category: p.category || cat?.category }, isRecent: true, product: p,
      };
    }), [products, prunedIds]);

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

  // Huidig aantal van een rij: optimistische override > werkelijke lijst-stand.
  const countFor = useCallback(
    (entry) => counts[entry.key] ?? countOf(items, entry.name),
    [counts, items],
  );

  // Aantal zetten: meteen lokaal (snappy) + netwerk op de achtergrond. Bij de eerste plaatsing
  // (0→n) koppelen we aan een huishoud-product (recency vult "Eerder gekozen"); daarna volstaat
  // het bijwerken op naam.
  const setImpl = (entry, n) => {
    const prev = countFor(entry);
    setCounts((m) => ({ ...m, [entry.key]: n }));
    const unit = entry.unit;
    const fail = (e) => { setCounts((m) => ({ ...m, [entry.key]: prev })); dialog.alert({ title: t('catalog.error.add'), body: e.message }); };
    if (entry.isRecent) {
      setCount(entry.name, n, { productId: entry.product.id, unit }).catch(fail);
    } else if (prev <= 0 && n >= 1) {
      ensureProduct({ name: entry.item.name, category: entry.item.category, defaultUnit: entry.item.unit })
        .then((p) => setCount(entry.name, n, { productId: p?.id ?? null, unit })).catch(fail);
    } else {
      setCount(entry.name, n, { unit }).catch(fail);
    }
  };
  const pruneImpl = (entry) => {
    const id = entry.product.id;
    animateNextLayout();
    setPrunedIds((s) => new Set(s).add(id));
    setHidden(id, true).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
    toast.show({
      message: t('catalog.recent.removed', { name: entry.name }),
      actionLabel: t('common.undo'),
      onAction: () => { animateNextLayout(); setPrunedIds((s) => { const next = new Set(s); next.delete(id); return next; }); setHidden(id, false).catch(() => {}); },
    });
  };
  // Open de producteditor (BOO-13). Een bestaand huishoud-product bewerken we direct; een
  // bundel-/zoek-item (nog niet in de huishoud-catalogus) maken we eerst aan ("opslaan"),
  // dán bewerken — zo kun je élk catalogusproduct aankleden.
  const openEditorImpl = async (entry) => {
    let id = entry.product?.id ?? null;
    if (!id) {
      const p = await ensureProduct({
        name: entry.item?.name ?? entry.name,
        category: entry.item?.category,
        defaultUnit: entry.unit,
        emoji: entry.item?.emoji ?? entry.image?.emoji,
      }).catch((e) => { dialog.alert({ title: t('catalog.error.add'), body: e.message }); return null; });
      id = p?.id ?? null;
    }
    if (id) router.push({ pathname: '/product/edit', params: { id } });
  };

  const setRef = useRef(setImpl);
  const pruneRef = useRef(pruneImpl);
  const editRef = useRef(openEditorImpl);
  useEffect(() => { setRef.current = setImpl; pruneRef.current = pruneImpl; editRef.current = openEditorImpl; });
  const onSetCount = useCallback((entry, n) => setRef.current(entry, n), []);
  const onPrune = useCallback((entry) => pruneRef.current(entry), []);
  const onEdit = useCallback((entry) => editRef.current(entry), []);

  const addCustom = () => {
    const name = q;
    if (!name) return;
    // Toast pas ná succes (UX-44/B6) — gelijk aan boodschappen.js. Eerder verscheen de
    // "toegevoegd"-toast vóór de netwerkcall, gevolgd door een fout-dialog bij falen.
    setQuery('');
    ensureProduct({ name })
      .then(async (p) => {
        await setCount(name, 1, { productId: p?.id ?? null });
        toast.show({ message: t('catalog.added', { name }) });
        // "Even aankleden?" (BOO-13) — niet opdringerig: één optionele vraag, daarna door.
        if (p?.id && await dialog.confirm({
          title: t('catalog.enrich.title', { name }),
          body: t('catalog.enrich.body'),
          confirmLabel: t('catalog.enrich.confirm'),
          cancelLabel: t('catalog.enrich.cancel'),
        })) {
          router.push({ pathname: '/product/edit', params: { id: p.id } });
        }
      })
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const renderItem = useCallback(({ item: entry }) => (
    <CatalogRow entry={entry} count={countFor(entry)} onSetCount={onSetCount} onPrune={onPrune} onEdit={onEdit} />
  ), [countFor, onSetCount, onPrune, onEdit]);

  // De "voeg '<zoekterm>' toe"-knop. Bij een zoekterm zónder resultaten is dit dé actie,
  // dus dan zetten we 'm bovenáán de lege staat (direct onder de zoekbalk, altijd boven
  // het toetsenbord). Zijn er wél resultaten, dan blijft 'ie als footer onder de lijst.
  const addCustomButton = q ? (
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
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ModalHeader title={t('catalog.title')} onClose={() => router.back()} backLabel={backLabelFor('catalog')} />

      {/* Zoekbalk */}
      <View style={{ paddingHorizontal: screenPadding }}>
        <SearchField value={query} onChangeText={setQuery} label={t('catalog.search')} />
      </View>

      {/* Schap-filter — met "Eerder gekozen" als eerste chip; paddingVertical geeft de
          chip-rand lucht zodat 'ie bovenaan niet wordt afgesneden. */}
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingVertical: space.sm, alignItems: 'center' }}
          // flexShrink:0 → de lange productlijst eronder mag deze chip-rij niet indrukken
          // (anders werd de bovenkant van de pills afgekapt).
          style={{ flexGrow: 0, flexShrink: 0 }}>
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
        keyboardDismissMode="on-drag"
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
            // Knop bovenáán (boven het toetsenbord), de illustratie als context eronder.
            <View>
              {addCustomButton}
              <Empty illustration="groceries" title={t('catalog.empty.title')} subtitle={t('catalog.empty.subtitle')} />
            </View>
          ) : category === RECENT_KEY ? (
            <Empty illustration="groceries" title={t('catalog.recent.empty.title')} subtitle={t('catalog.recent.empty.subtitle')} />
          ) : null
        }
        ListFooterComponent={
          // Alleen onder de lijst tonen als er résultaten zijn; bij nul resultaten leeft de
          // knop in de lege staat (anders valt 'ie onder de grote illustratie, achter het
          // toetsenbord).
          q && sections.length ? addCustomButton : null
        }
      />
    </SafeAreaView>
  );
}
