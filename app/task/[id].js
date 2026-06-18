import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useTasks } from '../../lib/useTasks';
import { useZones } from '../../lib/useZones';
import { useHousehold } from '../../lib/household';
import { Field, Button, Chip, Avatar, Row, Stepper, AvatarSelect, IconButton, ModalHeader } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type, categoryMeta, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { VISIBILITY, RECUR } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityPayload, validateVisibility } from '../../lib/visibility';

const WEEKDAYS = [
  { d: 1, l: 'Ma' }, { d: 2, l: 'Di' }, { d: 3, l: 'Wo' }, { d: 4, l: 'Do' },
  { d: 5, l: 'Vr' }, { d: 6, l: 'Za' }, { d: 0, l: 'Zo' },
];

export default function TaskEditor() {
  const { id, date, zone } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const { addTask, updateTask, deleteTask } = useTasks();
  const { zones } = useZones();
  const { members, subgroups, activeId } = useHousehold();

  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  // Vanuit een zone toegevoegd (Schoonmaak) ⇒ standaard 'huishouden'; één gedeelde editor.
  const [category, setCategory] = useState(zone ? 'huishouden' : 'klus');
  const [zoneId, setZoneId] = useState(zone ?? null);
  const [assignedTo, setAssignedTo] = useState(null);
  const [dueDate, setDueDate] = useState(date ? new Date(date + 'T00:00:00') : null);   // Date | null
  const [freq, setFreq] = useState(null);          // null|daily|weekly|monthly
  const [interval, setIntervalN] = useState(1);
  const [weekdays, setWeekdays] = useState([]);
  const [rotation, setRotation] = useState([]); // profiel-ids in beurtvolgorde; [] = geen rotatie
  // Delen met: household | subgroup | custom
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]); // profiel-ids bij 'custom'
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // { title, date, visibility } — inline i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // Bestaande taak inladen
  useEffect(() => {
    if (isNew) return;
    supabase.from('tasks').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { router.back(); return; }
      setTitle(data.title);
      setNotes(data.notes ?? '');
      setCategory(data.category);
      setZoneId(data.zone_id ?? null);
      setAssignedTo(data.assigned_to);
      setDueDate(data.due_date ? new Date(data.due_date + 'T00:00:00') : null);
      setFreq(data.recur_freq);
      setIntervalN(data.recur_interval ?? 1);
      setWeekdays(data.recur_weekdays ?? []);
      setRotation(data.rotation ?? []);
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

  // Eenheid achter "Elke N …", afhankelijk van de frequentie en het aantal.
  const unitLabel = (n) => {
    if (freq === RECUR.DAILY) return n === 1 ? 'dag' : 'dagen';
    if (freq === RECUR.MONTHLY) return n === 1 ? 'maand' : 'maanden';
    return n === 1 ? 'week' : 'weken';
  };
  // Boven dit aantal heeft een interval weinig zin; houdt de stepper behapbaar.
  const intervalMax = freq === RECUR.DAILY ? 90 : freq === RECUR.MONTHLY ? 24 : 52;
  // "Elke N weken" geldt alleen als er géén specifieke weekdagen zijn gekozen.
  const showInterval = freq && !(freq === RECUR.WEEKLY && weekdays.length > 0);

  const toggleShareWith = (pid) =>
    setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  // Rotatie: tikvolgorde = beurtvolgorde. Opnieuw tikken haalt het lid eruit.
  const toggleRotationMember = (pid) =>
    setRotation((r) => (r.includes(pid) ? r.filter((x) => x !== pid) : [...r, pid]));

  const save = async () => {
    const e = {};
    if (!title.trim()) e.title = 'Geef de taak een titel';
    if (freq && !dueDate) e.date = 'Een terugkerende taak heeft een startdatum nodig.';
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) e.visibility = visError;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    // Rotatie geldt alleen bij een terugkerende taak; de huidige beurt (assigned_to)
    // wordt het eerste lid als de toewijzing nog niet in de rotatie zit.
    const rot = freq && rotation.length ? rotation : null;
    const assigned = rot && !rot.includes(assignedTo) ? rot[0] : assignedTo;
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      category,
      zone_id: zoneId,
      assigned_to: assigned,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      recur_freq: freq,
      recur_interval: freq && !(freq === RECUR.WEEKLY && weekdays.length) ? interval : 1,
      recur_weekdays: freq === RECUR.WEEKLY && weekdays.length ? weekdays : null,
      rotation: rot,
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
        <ModalHeader
          title={isNew ? 'Nieuwe taak' : 'Taak bewerken'}
          onClose={() => router.back()}
          onConfirm={save}
          busy={busy}
        />

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Field label="Wat moet er gebeuren?" value={title}
            onChangeText={(v) => { setTitle(v); clearErr('title'); }}
            placeholder="Bijv. Vuilnis buitenzetten" autoFocus={isNew} error={errors.title} />

          {/* Categorie */}
          <Text style={[type.label, { marginBottom: 8 }]}>Categorie</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {Object.entries(categoryMeta).map(([k, m]) => (
              <Chip key={k} icon={m.icon} label={m.label} active={category === k}
                color={m.color} onPress={() => setCategory(k)} />
            ))}
          </View>

          {/* Zone — koppelt de taak aan een schoonmaakruimte. Dezelfde taak,
              overal zichtbaar; hier ook te wijzigen of los te koppelen. */}
          {zones.length > 0 && (
            <>
              <Text style={[type.label, { marginBottom: 8 }]}>Zone (optioneel)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <Chip label="Geen zone" active={!zoneId} onPress={() => setZoneId(null)} />
                {zones.map((z) => (
                  <Chip key={z.id} label={`${z.emoji ? `${z.emoji} ` : ''}${z.name}`}
                    active={zoneId === z.id} onPress={() => setZoneId(z.id)} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Toewijzen */}
          <Text style={[type.label, { marginBottom: 8 }]}>Voor wie?</Text>
          <AvatarSelect members={members} selectedId={assignedTo} onSelect={setAssignedTo}
            includeEveryone style={{ marginBottom: 18 }} />

          {/* Delen met */}
          <VisibilityPicker
            visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
            shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
            shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
            subgroups={subgroups} members={members}
          />
          {errors.visibility ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.visibility}</Text>
          ) : null}

          {/* Datum */}
          <Text style={[type.label, { marginBottom: 8 }]}>Wanneer?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <Chip label="Geen datum" active={!dueDate} onPress={() => { setDueDate(null); setFreq(null); }} />
            {quickDates.map((q) => (
              <Chip key={q.l} label={q.l}
                active={dueDate && format(dueDate, 'yyyy-MM-dd') === format(q.v, 'yyyy-MM-dd')}
                onPress={() => { setDueDate(q.v); clearErr('date'); }} />
            ))}
          </ScrollView>
          {dueDate && (
            <DateStepper date={dueDate} onChange={setDueDate} />
          )}
          {errors.date ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: space.xs }]}>{errors.date}</Text>
          ) : null}

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

              {/* Interval: "Elke N dagen/weken/maanden" */}
              {showInterval && (
                <Row gap={space.md} style={{ marginTop: 12 }}>
                  <Text style={type.body}>Elke</Text>
                  <Stepper
                    value={interval}
                    onChange={setIntervalN}
                    min={1}
                    max={intervalMax}
                    accessibilityLabel={`Elke ${interval} ${unitLabel(interval)}`}
                  />
                  <Text style={type.body}>{unitLabel(interval)}</Text>
                </Row>
              )}

              {freq === RECUR.WEEKLY && (
                <>
                  <Text style={[type.caption, { marginTop: 12, marginBottom: 6 }]}>
                    Of kies vaste dagen (dan vervalt het wekeninterval):
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                    {WEEKDAYS.map((w) => (
                      <Chip key={w.d} label={w.l} active={weekdays.includes(w.d)}
                        onPress={() => toggleWeekday(w.d)} />
                    ))}
                  </View>
                </>
              )}

              {freq && (
                <Row gap={space.xs} align="center" style={{ marginTop: 10 }}>
                  <Icon name="repeat" size={14} color={colors.inkSoft} />
                  <Text style={[type.caption, { flex: 1 }]}>
                    {recurrenceLabel({ recur_freq: freq, recur_interval: interval, recur_weekdays: weekdays })}
                    {'  ·  '}Bij afvinken verschijnt automatisch de volgende keer.
                  </Text>
                </Row>
              )}

              {/* Beurtrotatie (KLU-4): roteer de toewijzing langs gekozen leden. */}
              {freq && (
                <>
                  <Row gap={space.xs} align="center" style={{ marginTop: 18, marginBottom: 8 }}>
                    <Icon name="rotation" size={16} color={colors.inkSoft} />
                    <Text style={[type.label, { flex: 1, marginBottom: 0 }]}>Rouleren tussen leden</Text>
                    <Chip label={rotation.length ? 'Aan' : 'Uit'} active={rotation.length > 0}
                      onPress={() => setRotation(rotation.length ? [] : members.map((m) => m.id))} />
                  </Row>
                  {rotation.length > 0 && (
                    <>
                      <Text style={[type.caption, { marginBottom: 8 }]}>
                        Tik op de leden in de gewenste beurtvolgorde. Bij elke afvink-beurt
                        gaat de taak naar de volgende.
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                        {members.map((m) => {
                          const pos = rotation.indexOf(m.id);
                          const on = pos !== -1;
                          return (
                            <Pressable key={m.id} onPress={() => toggleRotationMember(m.id)}
                              accessibilityRole="button" accessibilityState={{ selected: on }}
                              accessibilityLabel={`${m.display_name}${on ? `, beurt ${pos + 1}` : ''}`}
                              style={{ alignItems: 'center', opacity: on ? 1 : 0.45 }}>
                              <View style={{ borderWidth: 2, borderRadius: radius.pill, borderColor: on ? colors.forest : 'transparent' }}>
                                <Avatar emoji={m.avatar_emoji} name={m.display_name} size={48} />
                              </View>
                              <Text style={[type.caption, { marginTop: space.xs }]} numberOfLines={1}>
                                {on ? `${pos + 1}. ` : ''}{m.display_name?.split(' ')[0]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                </>
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
      borderColor: colors.line, padding: space.xs, marginTop: space.xs,
    }}>
      <IconButton icon="back" tint={colors.forest} accessibilityLabel="Dag eerder"
        onPress={() => onChange(addDays(date, -1))} />
      <Text style={[type.title, { fontWeight: '700' }]}>
        {format(date, 'EEEE d MMMM', { locale: nl })}
      </Text>
      <IconButton icon="forward" tint={colors.forest} accessibilityLabel="Dag later"
        onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}
