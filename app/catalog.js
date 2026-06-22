import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, Image, ActivityIndicator, Platform, ScrollView, Pressable, Linking } from 'react-native';
import { useDialog } from "../lib/dialog";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCatalogCategories, useCatalogSearch } from '../lib/useCatalog';
import { useGroceries } from '../lib/useGroceries';
import { useToast } from '../lib/toast';
import { ModalHeader, ItemRow, Empty, ListSkeleton, Chip } from '../lib/ui';
import { Icon } from '../lib/icons';
import { colors, space, radius, type, touchTarget, screenPadding } from '../lib/theme';
import { t } from '../lib/i18n';

// Bladeren/zoeken in de globale Open Food Facts-catalogus (NL) om de
// boodschappenlijst te vullen. Tik een product → het komt op de lijst, gekoppeld
// aan het catalogusproduct (catalog_product_id).
export default function Catalog() {
  const dialog = useDialog();
  const router = useRouter();
  const toast = useToast();
  const { add } = useGroceries();
  const { categories } = useCatalogCategories();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = nog niets gekozen
  const { items, loading, loadingMore, hasMore, loadMore, active } = useCatalogSearch({ query, category });

  const onAdd = (item) => {
    add(item.name, null, item.id)
      .then(() => toast.show({ message: t('catalog.added', { name: item.name }) }))
      .catch((e) => dialog.alert({ title: t('catalog.error.add'), body: e.message }));
  };

  const renderItem = ({ item }) => (
    <ItemRow
      leading={
        item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="catalog" size={20} color={colors.inkFaint} />
          </View>
        )
      }
      title={item.name}
      meta={
        (item.brands || item.quantity) ? (
          <Text style={type.caption} numberOfLines={1}>
            {[item.brands, item.quantity].filter(Boolean).join(' · ')}
          </Text>
        ) : undefined
      }
      onPress={() => onAdd(item)}
      accessibilityLabel={t('catalog.add', { name: item.name })}
      trailing={
        <Pressable
          onPress={() => onAdd(item)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('catalog.add', { name: item.name })}
          style={({ pressed }) => ({
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: pressed ? colors.ocher : colors.ocherSoft,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <Icon name="add" size={18} color={colors.forest} weight="bold" />
        </Pressable>
      }
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* ModalHeader pad zichzelf (space.lg) — niet in de screenPadding-wrapper zetten. */}
      <ModalHeader title={t('catalog.title')} onClose={() => router.back()} />
      <View style={{ paddingHorizontal: screenPadding }}>
        {/* Zoekbalk */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md, marginBottom: space.sm }}>
          <Icon name="search" size={20} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('catalog.search')}
            placeholderTextColor={colors.inkFaint}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('catalog.search')}
            style={{
              flex: 1, minHeight: touchTarget, marginLeft: space.sm,
              paddingVertical: Platform.OS === 'ios' ? space.md : space.sm,
              fontSize: 16, color: colors.ink,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
              <Icon name="close" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Categorie-schappen (horizontaal). 'Alles' = filter uit. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingBottom: space.sm }}
        style={{ flexGrow: 0 }}
      >
        <Chip label={t('catalog.all')} active={category == null} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip
            key={c.key}
            label={`${c.emoji ? c.emoji + ' ' : ''}${c.label}`}
            active={category === c.key}
            onPress={() => setCategory((cur) => (cur === c.key ? null : c.key))}
          />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: space.xs, paddingBottom: space.xxl }}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => { if (hasMore) loadMore(); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton count={6} />
          ) : !active ? (
            <Empty illustration="groceries" title={t('catalog.start.title')} subtitle={t('catalog.start.subtitle')} />
          ) : (
            <Empty illustration="groceries" title={t('catalog.empty.title')} subtitle={t('catalog.empty.subtitle')} />
          )
        }
        ListFooterComponent={
          <View style={{ paddingVertical: space.lg, alignItems: 'center', gap: space.sm }}>
            {loadingMore ? <ActivityIndicator color={colors.forest} /> : null}
            {items.length > 0 ? (
              <Pressable
                onPress={() => Linking.openURL('https://world.openfoodfacts.org')}
                accessibilityRole="link"
                accessibilityLabel={t('catalog.attribution')}
                hitSlop={8}
              >
                <Text style={[type.caption, { textAlign: 'center', textDecorationLine: 'underline', color: colors.forest }]}>
                  {t('catalog.attribution')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
