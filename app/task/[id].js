import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, addDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { useTasks } from '../../lib/useTasks';
import { useZones } from '../../lib/useZones';
import { useHousehold } from '../../lib/household';
import { Field, Button, Chip, Avatar, Row, Stepper, AvatarSelect, IconButton, Editor } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, radius, type, categoryMeta, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { VISIBILITY, RECUR } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityPayload, validateVisibility } from '../../lib/visibility';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t, plural, dateLocale } from '../../lib/i18n';

const WEEKDAYS = [
  { d: 1, l: 'Ma' }, { d: 2, l: 'Di' }, { d: 3, l: 'Wo' }, { d: 4, l: 'Do' },
  { d: 5, l: 'Vr' }, { d: 6, l: 'Za' }, { d: 0, l: 'Zo' },
];

export default function TaskEditor() {
  const { id, date, zone } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addTask, updateTask, deleteTask } = useTasks();
  const { zones } = useZones();
  const { members, subgroups } = useHousehold();

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
    { l: t('task.quick.today'), v: new Date() },
    { l: t('task.quick.tomorrow'), v: addDays(new Date(), 1) },
    { l: t('task.quick.in3'), v: addDays(new Date(), 3) },
    { l: t('task.quick.nextWeek'), v: addDays(new Date(), 7) },
  ];

  const toggleWeekday = (d) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  // Eenheid achter "Elke N …", afhankelijk van de frequentie en het aantal.
  const unitLabel = (n) => {
    if (freq === RECUR.DAILY) return plural(n, 'task.unit.day.one', 'task.unit.day.other');
    if (freq === RECUR.MONTHLY) return plural(n, 'task.unit.month.one', 'task.unit.month.other');
    return plural(n, 'task.unit.week.one', 'task.unit.week.other');
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
    if (!title.trim()) e.title = t('task.error.title');
    if (freq && !dueDate) e.date = t('task.error.recurDate');
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) e.visibility = visError;
    setErrors(e);
    if (Object.keys(e).length) { haptics.error(); return; }
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
      haptics.success();
      router.back();
    } catch (e) {
      haptics.error();
      Alert.alert(t('common.failed'), e.message);
    } finally { setBusy(false); }
  };

  // Verwijderen met ongedaan-maken (geen blokkerende confirm — de undo-toast ís het
  // vangnet, en Alert-knoppen vuren bovendien niet op web). De taak verdwijnt meteen
  // uit de lijst (markPending), we navigeren terug, en de echte delete volgt pas als
  // de toast verloopt; "Ongedaan maken" haalt de markering weg en er is niets gebeurd.
  const confirmDelete = () => {
    markPending(id);
    router.back();
    toast.show({
      message: t('task.deleted', { name: title.trim() || t('task.deleteButton') }),
      actionLabel: t('common.undo'),
      onAction: () => unmarkPending(id),
      onExpire: async () => {
        try { await deleteTask(id); }
        catch (e) { Alert.alert(t('common.failed'), e.message); }
        finally { unmarkPending(id); }
      },
    });
  };

  if (!loaded) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <Editor
      title={isNew ? t('task.new') : t('task.edit')}
      onClose={() => router.back()}
      onConfirm={save}
      busy={busy}
    >
          <Field label={t('task.field.title')} value={title}
            onChangeText={(v) => { setTitle(v); clearErr('title'); }}
            placeholder={t('task.field.title.placeholder')} autoFocus={isNew} error={errors.title} />

          {/* Categorie */}
          <Text style={[type.label, { marginBottom: 8 }]}>{t('task.field.category')}</Text>
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
              <Text style={[type.label, { marginBottom: 8 }]}>{t('task.field.zone')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <Chip label={t('task.zone.none')} active={!zoneId} onPress={() => setZoneId(null)} />
                {zones.map((z) => (
                  <Chip key={z.id} label={`${z.emoji ? `${z.emoji} ` : ''}${z.name}`}
                    active={zoneId === z.id} onPress={() => setZoneId(z.id)} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Toewijzen */}
          <Text style={[type.label, { marginBottom: 8 }]}>{t('task.field.assignee')}</Text>
          <AvatarSelect members={members} selectedId={assignedTo} onSelect={setAssignedTo}
            includeEveryone style={{ marginBottom: 18 }} />

          {/* Datum */}
          <Text style={[type.label, { marginBottom: 8 }]}>{t('task.field.when')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <Chip label={t('task.date.none')} active={!dueDate} onPress={() => { setDueDate(null); setFreq(null); }} />
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
              <Text style={[type.label, { marginBottom: 8, marginTop: 18 }]}>{t('task.field.repeat')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label={t('task.recur.once')} active={!freq} onPress={() => setFreq(null)} />
                <Chip label={t('task.recur.daily')} active={freq === RECUR.DAILY} onPress={() => setFreq(RECUR.DAILY)} />
                <Chip label={t('task.recur.weekly')} active={freq === RECUR.WEEKLY} onPress={() => setFreq(RECUR.WEEKLY)} />
                <Chip label={t('task.recur.monthly')} active={freq === RECUR.MONTHLY} onPress={() => setFreq(RECUR.MONTHLY)} />
              </View>

              {/* Interval: "Elke N dagen/weken/maanden" */}
              {showInterval && (
                <Row gap={space.md} style={{ marginTop: 12 }}>
                  <Text style={type.body}>{t('task.interval.every')}</Text>
                  <Stepper
                    value={interval}
                    onChange={setIntervalN}
                    min={1}
                    max={intervalMax}
                    accessibilityLabel={`${t('task.interval.every')} ${interval} ${unitLabel(interval)}`}
                  />
                  <Text style={type.body}>{unitLabel(interval)}</Text>
                </Row>
              )}

              {freq === RECUR.WEEKLY && (
                <>
                  <Text style={[type.caption, { marginTop: 12, marginBottom: 6 }]}>
                    {t('task.weekly.fixedDays')}
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
                    {'  ·  '}{t('task.recur.autoNext')}
                  </Text>
                </Row>
              )}

              {/* Beurtrotatie (KLU-4): roteer de toewijzing langs gekozen leden. */}
              {freq && (
                <>
                  <Row gap={space.xs} align="center" style={{ marginTop: 18, marginBottom: 8 }}>
                    <Icon name="rotation" size={16} color={colors.inkSoft} />
                    <Text style={[type.label, { flex: 1, marginBottom: 0 }]}>{t('task.rotation.label')}</Text>
                    <Chip label={rotation.length ? t('common.on') : t('common.off')} active={rotation.length > 0}
                      onPress={() => setRotation(rotation.length ? [] : members.map((m) => m.id))} />
                  </Row>
                  {rotation.length > 0 && (
                    <>
                      <Text style={[type.caption, { marginBottom: 8 }]}>
                        {t('task.rotation.hint')}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                        {members.map((m) => {
                          const pos = rotation.indexOf(m.id);
                          const on = pos !== -1;
                          return (
                            <Pressable key={m.id} onPress={() => toggleRotationMember(m.id)}
                              accessibilityRole="button" accessibilityState={{ selected: on }}
                              accessibilityLabel={`${m.display_name}${on ? t('task.rotation.turn', { n: pos + 1 }) : ''}`}
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
            <Field label={t('task.field.notes')} value={notes} onChangeText={setNotes}
              placeholder={t('task.field.notes.placeholder')} multiline numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top' }} />
          </View>

          {/* Delen met — geavanceerd, ingeklapt onderaan zodat het de hoofd-flow
              (wat → wie → wanneer) niet onderbreekt. */}
          <VisibilityPicker
            collapsible
            visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
            shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
            shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
            subgroups={subgroups} members={members}
          />
          {errors.visibility ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.visibility}</Text>
          ) : null}

          {!isNew && (
            <Button title={t('task.deleteButton')} variant="ghost" onPress={confirmDelete}
              style={{ marginTop: 8, borderColor: 'transparent' }} />
          )}
    </Editor>
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
      <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('task.date.prev')}
        onPress={() => onChange(addDays(date, -1))} />
      <Text style={[type.title, { fontWeight: '700' }]}>
        {format(date, 'EEEE d MMMM', { locale: dateLocale() })}
      </Text>
      <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('task.date.next')}
        onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}
