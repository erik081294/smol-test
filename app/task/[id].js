import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { Field, Button, Chip, Avatar } from '../../lib/ui';
import { colors, radius, type, categoryMeta } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { VISIBILITY, RECUR } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityPayload, validateVisibility } from '../../lib/visibility';

const WEEKDAYS = [
  { d: 1, l: 'Ma' }, { d: 2, l: 'Di' }, { d: 3, l: 'Wo' }, { d: 4, l: 'Do' },
  { d: 5, l: 'Vr' }, { d: 6, l: 'Za' }, { d: 0, l: 'Zo' },
];

export default function TaskEditor() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addTask, updateTask, deleteTask } = useTasks();
  const { members, subgroups, activeId } = useHousehold();

  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('klus');
  const [assignedTo, setAssignedTo] = useState(null);
  const [dueDate, setDueDate] = useState(null);   // Date | null
  const [freq, setFreq] = useState(null);          // null|daily|weekly|monthly
  const [interval, setIntervalN] = useState(1);
  const [weekdays, setWeekdays] = useState([]);
  // Delen met: household | subgroup | custom
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]); // profiel-ids bij 'custom'
  const [busy, setBusy] = useState(false);

  // Bestaande taak inladen
  useEffect(() => {
    if (isNew) return;
    supabase.from('tasks').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { router.back(); return; }
      setTitle(data.title);
      setNotes(data.notes ?? '');
      setCategory(data.category);
      setAssignedTo(data.assigned_to);
      setDueDate(data.due_date ? new Date(data.due_date + 'T00:00:00') : null);
      setFreq(data.recur_freq);
      setIntervalN(data.recur_interval ?? 1);
      setWeekdays(data.recur_weekdays ?? []);
      setVisibility(data.visibility ?? VISIBILITY.HOUSEHOLD);
      setShareSubgroupId(data.share_subgroup_id ?? null);
      setShareWith(data.share_with ?? []);
      setLoaded(true);
    });
  }, [id]);

  const quickDates = [
    { l: 'Vandaag', v: new Date() },
    { l: 'Morgen', v: addDays(new Date(), 1) },
    { l: 'Over 3 dagen', v: addDays(new Date(), 3) },
    { l: 'Volgende week', v: addDays(new Date(), 7) },
  ];

  const toggleWeekday = (d) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  const toggleShareWith = (pid) =>
    setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  const save = async () => {
    if (!title.trim()) { Alert.alert('Geef de taak een titel'); return; }
    if (freq && !dueDate) { Alert.alert('Kies een startdatum', 'Een terugkerende taak heeft een datum nodig.'); return; }
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) { Alert.alert('Delen met', visError); return; }
    setBusy(true);
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      category,
      assigned_to: assignedTo,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      recur_freq: freq,
      recur_interval: freq ? interval : 1,
      recur_weekdays: freq === RECUR.WEEKLY && weekdays.length ? weekdays : null,
      ...visibilityPayload({ visibility, shareSubgroupId, shareWith }),
    };
    try {
      if (isNew) await addTask(payload);
      else await updateTask(id, payload);
      router.back();
    } catch (e) {
      Alert.alert('Mislukt', e.message);
    } finally { setBusy(false); }
  };

  const confirmDelete = () => {
    Alert.alert('Taak verwijderen?', '', [
      { text: 'Annuleer', style: 'cancel' },
      { text: 'Verwijder', style: 'destructive', onPress: async () => { await deleteTask(id); router.back(); } },
    ]);
  };

  if (!loaded) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Text style={{ fontSize: 16, color: colors.inkSoft, fontWeight: '600' }}>Annuleer</Text>
          </TouchableOpacity>
          <Text style={[type.title]}>{isNew ? 'Nieuwe taak' : 'Taak bewerken'}</Text>
          <TouchableOpacity onPress={save} hitSlop={10} disabled={busy}>
            <Text style={{ fontSize: 16, color: colors.forest, fontWeight: '800' }}>Bewaar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Field label="Wat moet er gebeuren?" value={title} onChangeText={setTitle}
            placeholder="Bijv. Vuilnis buitenzetten" autoFocus={isNew} />

          {/* Categorie */}
          <Text style={[type.label, { marginBottom: 8 }]}>Categorie</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {Object.entries(categoryMeta).map(([k, m]) => (
              <Chip key={k} label={`${m.emoji} ${m.label}`} active={category === k}
                color={m.color} onPress={() => setCategory(k)} />
            ))}
          </View>

          {/* Toewijzen */}
          <Text style={[type.label, { marginBottom: 8 }]}>Voor wie?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            <TouchableOpacity onPress={() => setAssignedTo(null)}
              style={{
                alignItems: 'center', marginRight: 14, opacity: assignedTo === null ? 1 : 0.5,
              }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: assignedTo === null ? colors.forest : 'transparent',
              }}>
                <Text style={{ fontSize: 20 }}>👥</Text>
              </View>
              <Text style={[type.caption, { marginTop: 4 }]}>Iedereen</Text>
            </TouchableOpacity>
            {members.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => setAssignedTo(m.id)}
                style={{ alignItems: 'center', marginRight: 14, opacity: assignedTo === m.id ? 1 : 0.5 }}>
                <View style={{ borderWidth: 2, borderRadius: 26, borderColor: assignedTo === m.id ? colors.forest : 'transparent' }}>
                  <Avatar emoji={m.avatar_emoji} name={m.display_name} size={48} />
                </View>
                <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={1}>
                  {m.display_name?.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Delen met */}
          <VisibilityPicker
            visibility={visibility} onChangeVisibility={setVisibility}
            shareSubgroupId={shareSubgroupId} onChangeSubgroup={setShareSubgroupId}
            shareWith={shareWith} onToggleMember={toggleShareWith}
            subgroups={subgroups} members={members}
          />

          {/* Datum */}
          <Text style={[type.label, { marginBottom: 8 }]}>Wanneer?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <Chip label="Geen datum" active={!dueDate} onPress={() => { setDueDate(null); setFreq(null); }} />
            {quickDates.map((q) => (
              <Chip key={q.l} label={q.l}
                active={dueDate && format(dueDate, 'yyyy-MM-dd') === format(q.v, 'yyyy-MM-dd')}
                onPress={() => setDueDate(q.v)} />
            ))}
          </ScrollView>
          {dueDate && (
            <DateStepper date={dueDate} onChange={setDueDate} />
          )}

          {/* Herhaling */}
          {dueDate && (
            <>
              <Text style={[type.label, { marginBottom: 8, marginTop: 18 }]}>Herhalen</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Eenmalig" active={!freq} onPress={() => setFreq(null)} />
                <Chip label="Dagelijks" active={freq === RECUR.DAILY} onPress={() => setFreq(RECUR.DAILY)} />
                <Chip label="Wekelijks" active={freq === RECUR.WEEKLY} onPress={() => setFreq(RECUR.WEEKLY)} />
                <Chip label="Maandelijks" active={freq === RECUR.MONTHLY} onPress={() => setFreq(RECUR.MONTHLY)} />
              </View>

              {freq === RECUR.WEEKLY && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {WEEKDAYS.map((w) => (
                    <TouchableOpacity key={w.d} onPress={() => toggleWeekday(w.d)}
                      style={{
                        width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: weekdays.includes(w.d) ? colors.forest : colors.surface,
                        borderWidth: 1.5, borderColor: weekdays.includes(w.d) ? colors.forest : colors.line,
                      }}>
                      <Text style={{ color: weekdays.includes(w.d) ? '#fff' : colors.inkSoft, fontWeight: '700', fontSize: 13 }}>
                        {w.l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {freq && (
                <Text style={[type.caption, { marginTop: 10 }]}>
                  🔁 {recurrenceLabel({ recur_freq: freq, recur_interval: interval, recur_weekdays: weekdays })}
                  {'  ·  '}Bij afvinken verschijnt automatisch de volgende keer.
                </Text>
              )}
            </>
          )}

          {/* Notities */}
          <View style={{ marginTop: 18 }}>
            <Field label="Notitie (optioneel)" value={notes} onChangeText={setNotes}
              placeholder="Extra details…" multiline numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top' }} />
          </View>

          {!isNew && (
            <Button title="Taak verwijderen" variant="ghost" onPress={confirmDelete}
              style={{ marginTop: 8, borderColor: 'transparent' }} />
          )}

          <Button title={isNew ? 'Taak toevoegen' : 'Wijzigingen bewaren'}
            onPress={save} loading={busy} style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Eenvoudige datum-stepper (geen native picker nodig, werkt overal gelijk)
function DateStepper({ date, onChange }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5,
      borderColor: colors.line, padding: 8, marginTop: 4,
    }}>
      <TouchableOpacity onPress={() => onChange(addDays(date, -1))} hitSlop={10}
        style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={{ fontSize: 22, color: colors.forest }}>‹</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
        {format(date, 'EEEE d MMMM', { locale: nl })}
      </Text>
      <TouchableOpacity onPress={() => onChange(addDays(date, 1))} hitSlop={10}
        style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={{ fontSize: 22, color: colors.forest }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
