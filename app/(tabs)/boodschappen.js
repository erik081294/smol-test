import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Empty } from '../../lib/ui';
import { colors, radius, type } from '../../lib/theme';
import { run } from '../../lib/db';

export default function Boodschappen() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('groceries').select('*')
        .eq('household_id', activeId)
        .order('checked', { ascending: true })
        .order('created_at', { ascending: false }),
      { fallback: [], context: 'boodschappen laden' }
    );
    setItems(data ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`groceries:${activeId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'groceries', filter: `household_id=eq.${activeId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, load]);

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    await supabase.from('groceries').insert({
      household_id: activeId, name, added_by: user.id,
    });
  };

  const toggle = async (item) =>
    supabase.from('groceries').update({ checked: !item.checked }).eq('id', item.id);

  const remove = async (id) => supabase.from('groceries').delete().eq('id', id);

  const clearChecked = async () => {
    await supabase.from('groceries').delete().eq('household_id', activeId).eq('checked', true);
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
