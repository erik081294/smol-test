import React, { useMemo, useState } from 'react';
import { View, Text, SectionList, TextInput, Pressable, Platform, ScrollView } from 'react-native';
import { useDialog } from '../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGroceries } from '../lib/useGroceries';
import { useToast } from '../lib/toast';
import { backLabelFor } from '../lib/navMeta';
import { CATEGORIES, catalogByCategory, searchCatalog } from '../lib/groceryCatalog';
import { normalize } from '../lib/productMatch';
import { ProductImageView } from '../lib/ProductImageView';
import { ModalHeader, Empty, Chip, Stepper, Row } from '../lib/ui';
import { Icon } from '../lib/icons';
import { colors, space, radius, type, touchTarget, screenPadding } from '../lib/theme';
import { t } from '../lib/i18n';

// Bladeren/zoeken in de gebundelde, merkloze catalogus (lib/groceryCatalog) — Picnic-stijl:
// schappen (categorieën) + zoekbalk + beeld + aantallen. Tik een product → het komt op de
// gedeelde boodschappenlijst. Staat het er niet bij? Voeg het eenmalig toe via de zoekterm.
export default function Catalog() {
  const dialog = useDialog();
  const router = useRouter();
  const toast = useToast();
  const { items, add } = useGroceries();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = alle schappen
  const [qtyByKey, setQtyByKey] = useState({});

  const q = query.trim();
  const qtyOf = (key) => qtyByKey[key] ?? 1;

  // Wat staat al (open) op de lijst — op genormaliseerde naam, zodat "✓ op je lijst" klopt.
  const onListSet = useMemo(
    () => new Set(items.filter((i) => !i.checked).map((i) => normalize(i.name))),
    [items],
  );

  // Secties: zoeken → één resultatenlijst; één schap gekozen → dat schap; anders alle schappen.
  const sections = useMemo(() => {
    if (q) {
      const results = searchCatalog(q);
      return results.length ? [{ key: 'results', title: null, data: results }] : [];
    }
    const shelves = catalogByCategory();
    const picked = category ? shelves.filter((g) => g.key === category) : shelves;
    return picked.map((g) => ({ key: g.key, title: `${g.emoji}  ${g.label}`, data: g.items }));
  }, [q, category]);

  const addItem = (item) => {
    const n = qtyOf(item.key);
    const quantity = n > 1 ? `${n} ${item.unit}` : null;
    add(item.name, null, null, quantity)
      .then(() => {
        toast.show({ message: t('catalog.added', { name: item.name }) });
        setQtyByKey((m) => { const c = { ...m }; delete c[item.key]; return c; });
      })
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const addCustom = () => {
    const name = q;
    if (!name) return;
    add(name)
      .then(() => { toast.show({ message: t('catalog.added', { name }) }); setQuery(''); })
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const renderItem = ({ item }) => {
    const on = onListSet.has(normalize(item.name));
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
        borderBottomWidth: 1, borderBottomColor: colors.line,
      }}>
        <ProductImageView item={item} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={type.body} numberOfLines={1}>{item.name}</Text>
          {item.unit ? <Text style={type.caption}>{item.unit}</Text> : null}
        </View>
        {on ? (
          <Row gap={4} align="center">
            <Icon name="check" size={16} color={colors.forest} weight="bold" />
            <Text style={[type.caption, { color: colors.forest }]}>{t('catalog.onlist')}</Text>
          </Row>
        ) : (
          <Row gap={space.sm} align="center">
            <Stepper value={qtyOf(item.key)} onChange={(v) => setQtyByKey((m) => ({ ...m, [item.key]: v }))}
              min={1} max={99} accessibilityLabel={t('catalog.qty')} />
            <Pressable onPress={() => addItem(item)} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={t('catalog.add', { name: item.name })}
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
  };

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

      {/* Schap-filter (alleen relevant als je niet zoekt) */}
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: space.sm }} style={{ flexGrow: 0 }}>
          <Chip label={t('catalog.all')} active={category == null} onPress={() => setCategory(null)} />
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={`${c.emoji} ${c.label}`} active={category === c.key}
              onPress={() => setCategory((cur) => (cur === c.key ? null : c.key))} />
          ))}
        </ScrollView>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          section.title ? (
            <Text style={[type.label, { marginTop: space.md, marginBottom: space.xs, color: colors.inkSoft }]}>
              {section.title}
            </Text>
          ) : null
        )}
        ListEmptyComponent={
          !q ? null : (
            <Empty illustration="groceries" title={t('catalog.empty.title')} subtitle={t('catalog.empty.subtitle')} />
          )
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
