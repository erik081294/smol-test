import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, Modal, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTasks } from '../../lib/useTasks';
import { useZones } from '../../lib/useZones';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { mutate } from '../../lib/db';
import { TaskRow } from '../../lib/TaskRow';
import { Empty, Card, Button, ScreenHeader } from '../../lib/ui';
import { colors, radius, type } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { visibilityPayload } from '../../lib/visibility';
import { CLEANING_TEMPLATES, planTemplate } from '../../lib/cleaningTemplates';

export default function Schoonmaak() {
  const { tasks, loading, reload, completeTask, uncompleteTask } = useTasks();
  const { zones, reload: reloadZones } = useZones();
  const { members, activeId } = useHousehold();
  const { user } = useAuth();
  const [picker, setPicker] = useState(null); // het gekozen sjabloon in de preview
  const [busy, setBusy] = useState(false);

  // Schoonmaaktaken = taken die aan een zone hangen.
  const byZone = useMemo(() => {
    const m = {};
    for (const t of tasks) {
      if (!t.zone_id || t.completed_at) continue;
      (m[t.zone_id] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));

  const preview = useMemo(
    () => (picker ? planTemplate(picker, { existingZones: zones, startDate: new Date() }) : null),
    [picker, zones]
  );

  const applyTemplate = async () => {
    if (!picker) return;
    setBusy(true);
    try {
      const plan = planTemplate(picker, { existingZones: zones, startDate: new Date() });
      let created = [];
      if (plan.zonesToCreate.length) {
        created = await mutate(
          supabase.from('zones')
            .insert(plan.zonesToCreate.map((z) => ({ ...z, household_id: activeId })))
            .select(),
          { context: 'zones aanmaken' }
        );
      }
      const byName = new Map();
      for (const z of [...zones, ...(created ?? [])]) byName.set(z.name.trim().toLowerCase(), z.id);

      const rows = plan.tasks.map((t) => ({
        household_id: activeId,
        created_by: user.id,
        title: t.title,
        category: t.category,
        zone_id: byName.get(t.zone_name.trim().toLowerCase()) ?? null,
        due_date: t.due_date,
        recur_freq: t.recur_freq,
        recur_interval: t.recur_interval,
        recur_weekdays: t.recur_weekdays,
        ...visibilityPayload({ visibility: t.visibility }),
      }));
      await mutate(supabase.from('tasks').insert(rows), { context: 'schoonmaaktaken aanmaken' });

      setPicker(null);
      reloadZones();
      reload();
    } catch (e) {
      Alert.alert('Kon schema niet opzetten', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenHeader title="Schoonmaak" subtitle="Per ruimte, met een vast ritme." />

      <FlatList
        contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 120 }}
        data={zones}
        keyExtractor={(z) => z.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.forest} />}
        renderItem={({ item: zone }) => {
          const zt = byZone[zone.id] ?? [];
          return (
            <Card style={{ marginBottom: 14 }}>
              <Text style={[type.title, { marginBottom: 8 }]}>{zone.emoji} {zone.name}</Text>
              {zt.length === 0 ? (
                <Text style={[type.caption]}>Nog geen taken in deze zone.</Text>
              ) : zt.map((t) => (
                <View key={t.id} style={{ marginBottom: 4 }}>
                  <TaskRow task={t} members={members} onToggle={toggle} />
                </View>
              ))}
            </Card>
          );
        }}
        ListEmptyComponent={!loading && (
          <Empty icon="cleaning" title="Nog geen schoonmaakzones"
            subtitle="Zet in één keer een weekschema op met de knop hieronder." />
        )}
      />

      {/* Actieknop: weekschema opzetten */}
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 24 }}>
        <Button title="Weekschema opzetten" variant="accent"
          onPress={() => setPicker(CLEANING_TEMPLATES[0])} />
      </View>

      {/* Sjabloon-preview */}
      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
            padding: 18, maxHeight: '85%' }}>
            <Text style={[type.h2, { marginBottom: 10 }]}>Weekschema opzetten</Text>

            {/* Sjabloonkeuze */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CLEANING_TEMPLATES.map((t) => (
                <TouchableOpacity key={t.key} onPress={() => setPicker(t)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, marginRight: 8,
                    backgroundColor: picker?.key === t.key ? colors.forest : colors.surface,
                    borderWidth: 1.5, borderColor: picker?.key === t.key ? colors.forest : colors.line,
                  }}>
                  <Text style={{ color: picker?.key === t.key ? '#fff' : colors.ink, fontWeight: '700' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {picker && (
              <Text style={[type.body, { color: colors.inkSoft, marginBottom: 10 }]}>{picker.description}</Text>
            )}

            <ScrollView style={{ maxHeight: 320 }}>
              {preview?.tasks.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={[type.body]}>{t.zone_name} · {t.title}</Text>
                  <Text style={[type.caption]}>{recurrenceLabel(t)}</Text>
                </View>
              ))}
            </ScrollView>

            {preview && (
              <Text style={[type.caption, { marginTop: 10 }]}>
                {preview.tasks.length} taken
                {preview.zonesToCreate.length ? ` · ${preview.zonesToCreate.length} nieuwe zones` : ' · gebruikt bestaande zones'}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1 }}><Button title="Annuleren" variant="ghost" onPress={() => setPicker(null)} /></View>
              <View style={{ flex: 1 }}><Button title="Opzetten" loading={busy} onPress={applyTemplate} /></View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
