import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroceries } from '../../lib/useGroceries';
import { Empty } from '../../lib/ui';
import { colors, radius, type } from '../../lib/theme';

export default function Boodschappen() {
  const { items, loading, reload, add: addItem, toggle: toggleItem, remove: removeItem, clearChecked } = useGroceries();
  const [text, setText] = useState('');

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    try { await addItem(name); } catch (e) { Alert.alert('Kon niet toevoegen', e.message); }
  };

  const toggle = async (item) => {
    try { await toggleItem(item); } catch (e) { Alert.alert('Mislukt', e.message); }
  };

  const remove = async (id) => {
    try { await removeItem(id); } catch (e) { Alert.alert('Kon niet verwijderen', e.message); }
  };

  const onClearChecked = async () => {
    try { await clearChecked(); } catch (e) { Alert.alert('Mislukt', e.message); }
  };

  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ padding: 18, paddingBottom: 8 }}>
        <Text style={[type.h1]}>Boodschappen</Text>
        <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>
          Gedeelde lijst — iedereen ziet hetzelfde, live.
        </Text>
      </View>

      {/* Toevoegbalk */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 10, gap: 10 }}>
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done"
          placeholder="Voeg toe… bijv. melk, brood"
          placeholderTextColor={colors.inkFaint}
          style={{
            flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
            borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: colors.ink,
          }}
        />
        <TouchableOpacity onPress={add}
          style={{ backgroundColor: colors.ocher, borderRadius: radius.md, paddingHorizontal: 20, justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, color: colors.forest }}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 40 }}
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.forest} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => toggle(item)} onLongPress={() => remove(item.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
              borderRadius: radius.md, padding: 14, marginBottom: 9,
              borderWidth: 1, borderColor: colors.line, opacity: item.checked ? 0.55 : 1,
            }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12, marginRight: 12, borderWidth: 2,
              borderColor: item.checked ? colors.done : colors.inkFaint,
              backgroundColor: item.checked ? colors.done : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {item.checked && <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>✓</Text>}
            </View>
            <Text style={{
              flex: 1, fontSize: 16, color: colors.ink,
              textDecorationLine: item.checked ? 'line-through' : 'none',
            }}>{item.name}{item.quantity ? `  ·  ${item.quantity}` : ''}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && (
            <Empty emoji="🛒" title="Lijst is leeg"
              subtitle="Typ hierboven om iets toe te voegen. Tik om af te vinken, houd ingedrukt om te verwijderen." />
          )
        }
      />

      {checkedCount > 0 && (
        <TouchableOpacity onPress={clearChecked}
          style={{
            position: 'absolute', bottom: 22, alignSelf: 'center',
            backgroundColor: colors.forest, paddingHorizontal: 22, paddingVertical: 13,
            borderRadius: radius.pill,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {checkedCount} afgevinkt wissen
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
