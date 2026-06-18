import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroceries } from '../../lib/useGroceries';
import { useToast } from '../../lib/toast';
import { Empty, Checkbox, ScreenHeader, SectionHeader, ItemRow, IconButton, ListSkeleton } from '../../lib/ui';
import { colors, radius, space, type, touchTarget } from '../../lib/theme';
import { animateNextLayout } from '../../lib/motion';
import { t } from '../../lib/i18n';

export default function Boodschappen() {
  const { items, loading, reload, add: addItem, toggle: toggleItem, remove: removeItem, removeMany } = useGroceries();
  const toast = useToast();
  const [text, setText] = useState('');
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

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    animateNextLayout();
    try { await addItem(name); } catch (e) { Alert.alert(t('groceries.error.add'), e.message); }
  };

  const toggle = async (item) => {
    animateNextLayout(); // het item glijdt zacht tussen "te halen" en "afgevinkt"
    try { await toggleItem(item); } catch (e) { Alert.alert(t('common.failed'), e.message); }
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
        catch (e) { Alert.alert(t('groceries.error.delete'), e.message); }
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
        catch (e) { Alert.alert(t('common.failed'), e.message); }
        finally { setHiddenIds((h) => h.filter((x) => !ids.includes(x))); }
      },
    });
  };

  const renderRow = (item) => (
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
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title={t('groceries.title')} subtitle={t('groceries.subtitle')} />

      {/* Toevoegbalk */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.sm, gap: space.sm }}>
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done"
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
              subtitle={t('groceries.empty.subtitle')} />
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
