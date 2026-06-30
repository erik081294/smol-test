import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDialog } from '../../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { useTasks } from '../../lib/useTasks';
import { useTags } from '../../lib/useTags';
import { useHousehold } from '../../lib/household';
import { Field, Button, Chip, Row, Stepper, Editor, Checkbox, IconButton } from '../../lib/ui';
import { TagPicker } from '../../lib/TagPicker';
import { PeriodPicker } from '../../lib/PeriodPicker';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { VISIBILITY, RECUR } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityPayload, visibilityRule } from '../../lib/visibility';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText, when } from '../../lib/formValidation';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { dateLocale, t, plural } from '../../lib/i18n';

const WEEKDAYS = [
  { d: 1, l: 'Ma' }, { d: 2, l: 'Di' }, { d: 3, l: 'Wo' }, { d: 4, l: 'Do' },
  { d: 5, l: 'Vr' }, { d: 6, l: 'Za' }, { d: 0, l: 'Zo' },
];

// Eerste letter als hoofdletter (NL-datumnamen komen lowercase uit date-fns).
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Afspraken-editor (UXR-2). Bewust simpel: titel → (optioneel beschrijving) → wanneer
// → voor wie. Zone/categorie-keuze en beurtrotatie zijn eruit — die horen bij hun
// modules (UX-34/40). Een afspraak heeft standaard de datum van vandaag (UX-36) en
// "Voor wie?" combineert toewijzing én zichtbaarheid in één keuze (UX-35/37). Bestaande
// module-/schoonmaaktaken kunnen hier nog wél bewerkt worden: zone_id, rotation en
// (bij Hele-huishouden) assigned_to blijven behouden, ook al tonen we ze niet.
export default function TaskEditor() {
  const dialog = useDialog();
  const { id, date, zone, plant } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addTask, updateTask, deleteTask } = useTasks();
  const { tags, addTag, deleteTag } = useTags();
  const { members, subgroups } = useHousehold();

  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false); // beschrijving pas op verzoek (UX-38)
  // Vanuit een zone toegevoegd (Schoonmaak) ⇒ 'huishouden'; vanuit een plant
  // (PLA-10: "verzorgingstaak toevoegen") ⇒ 'plant'; anders een gewone afspraak.
  const [category, setCategory] = useState(plant ? 'plant' : zone ? 'huishouden' : 'afspraak');
  const [zoneId, setZoneId] = useState(zone ?? null);            // passthrough (UX-34)
  const [plantId, setPlantId] = useState(plant ?? null);         // passthrough (PLA-10)
  const [assignedTo, setAssignedTo] = useState(null);            // passthrough (Hele-huishouden)
  // Datum staat standaard op vandaag (UX-36); een afspraak hoort op de kalender.
  const [dueDate, setDueDate] = useState(date ? new Date(date + 'T00:00:00') : (isNew ? new Date() : null));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [freq, setFreq] = useState(null);          // null|daily|weekly|monthly
  const [interval, setIntervalN] = useState(1);
  const [weekdays, setWeekdays] = useState([]);
  // Herhaal-einde (UX, batch 2): standaard geen einde; subtiel te onthullen.
  const [showRecurEnd, setShowRecurEnd] = useState(false);
  const [recurEndMode, setRecurEndMode] = useState('never');  // never|until|count
  const [recurUntil, setRecurUntil] = useState(null);         // Date bij 'until'
  const [recurCount, setRecurCount] = useState(5);            // aantal beurten bij 'count'
  const [recurUntilPickerOpen, setRecurUntilPickerOpen] = useState(false);
  const [rotation, setRotation] = useState([]);    // passthrough (UX-40)
  const [tagIds, setTagIds] = useState([]);        // zelfgemaakte labels (UX-41)
  // Voor wie / wie ziet 'm: household | subgroup | custom
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]); // profiel-ids bij 'custom'
  const [initialSnap, setInitialSnap] = useState(null);
  // Gedeelde formulier-ruggengraat (ARCH-1): errors + busy + validatie via de pure
  // regels (lib/formValidation.js). De velden blijven losse state (incrementele migratie).
  const { errors, clearError: clearErr, busy, setBusy, validate } = useEntityForm();

  // Bestaande taak inladen
  useEffect(() => {
    if (isNew) return;
    supabase.from('tasks').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { router.back(); return; }
      setTitle(data.title);
      setNotes(data.notes ?? '');
      setShowNotes(!!(data.notes ?? '').trim());
      setCategory(data.category);
      setZoneId(data.zone_id ?? null);
      setPlantId(data.plant_id ?? null);
      setAssignedTo(data.assigned_to);
      setDueDate(data.due_date ? new Date(data.due_date + 'T00:00:00') : null);
      setFreq(data.recur_freq);
      setIntervalN(data.recur_interval ?? 1);
      setWeekdays(data.recur_weekdays ?? []);
      // Herhaal-einde uit de opgeslagen kolommen afleiden.
      const until = data.recur_until ? new Date(data.recur_until + 'T00:00:00') : null;
      const count = data.recur_count ?? null;
      const endMode = until ? 'until' : (count != null ? 'count' : 'never');
      setRecurUntil(until);
      setRecurCount(count ?? 5);
      setRecurEndMode(endMode);
      setShowRecurEnd(endMode !== 'never');
      setRotation(data.rotation ?? []);
      setTagIds(data.tag_ids ?? []);
      setVisibility(data.visibility ?? VISIBILITY.HOUSEHOLD);
      setShareSubgroupId(data.share_subgroup_id ?? null);
      setShareWith(data.share_with ?? []);
      setLoaded(true);
    });
  }, [id]);

  // Niet-bewaarde-wijzigingen-detectie (voedt de Editor-guard).
  const buildSnapshot = () => JSON.stringify({
    title: title.trim(), notes: notes.trim(), category, zoneId, assignedTo,
    dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
    freq, interval, weekdays, rotation, tagIds, visibility, shareSubgroupId, shareWith,
    recurEndMode, recurUntil: recurUntil ? format(recurUntil, 'yyyy-MM-dd') : null, recurCount,
  });
  useEffect(() => {
    if (loaded && initialSnap === null) setInitialSnap(buildSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  const dirty = initialSnap !== null && buildSnapshot() !== initialSnap;

  const toggleWeekday = (d) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  // Herhaal-toggle: aan → standaard wekelijks; uit → eenmalig (weekdagen + einde leeg).
  const toggleRecurring = () => {
    if (freq) {
      setFreq(null); setWeekdays([]);
      setShowRecurEnd(false); setRecurEndMode('never'); setRecurUntil(null);
    } else { setFreq(RECUR.WEEKLY); clearErr('date'); }
  };

  // Eenheid achter "Elke N …".
  const unitLabel = (n) => {
    if (freq === RECUR.DAILY) return plural(n, 'task.unit.day.one', 'task.unit.day.other');
    if (freq === RECUR.MONTHLY) return plural(n, 'task.unit.month.one', 'task.unit.month.other');
    return plural(n, 'task.unit.week.one', 'task.unit.week.other');
  };
  const intervalMax = freq === RECUR.DAILY ? 90 : freq === RECUR.MONTHLY ? 24 : 52;
  const showInterval = freq && !(freq === RECUR.WEEKLY && weekdays.length > 0);

  const toggleShareWith = (pid) =>
    setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  const save = async () => {
    const ok = validate([
      requiredText('title', t('task.error.title')),
      when('date', (v) => !v.freq || !!v.dueDate, t('task.error.recurDate')),
      when('recurEnd', (v) => !(v.freq && v.recurEndMode === 'until') || !!v.recurUntil, t('task.recur.end.untilNone')),
      visibilityRule('visibility'),
    ], { title, freq, dueDate, recurEndMode, recurUntil, visibility, shareSubgroupId, shareWith });
    if (!ok) return;
    setBusy(true);
    // "Voor wie?" stuurt de toewijzing: precies één gekozen persoon → die persoon;
    // anders behouden we de bestaande assigned_to (Hele-huishouden/subgroep), zodat
    // een bewerkte schoonmaaktaak zijn beurt niet kwijtraakt.
    const assigned = visibility === VISIBILITY.CUSTOM
      ? (shareWith.length === 1 ? shareWith[0] : null)
      : assignedTo;
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      category,
      zone_id: zoneId,
      plant_id: plantId,
      assigned_to: assigned,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      recur_freq: freq,
      recur_interval: freq && !(freq === RECUR.WEEKLY && weekdays.length) ? interval : 1,
      recur_weekdays: freq === RECUR.WEEKLY && weekdays.length ? weekdays : null,
      // Herhaal-einde (UX, batch 2): alleen relevant als 'ie herhaalt.
      recur_until: freq && recurEndMode === 'until' && recurUntil ? format(recurUntil, 'yyyy-MM-dd') : null,
      recur_count: freq && recurEndMode === 'count' ? recurCount : null,
      rotation: rotation.length ? rotation : null,
      tag_ids: tagIds,
      ...visibilityPayload({ visibility, shareSubgroupId, shareWith }),
    };
    try {
      if (isNew) await addTask(payload);
      else await updateTask(id, payload);
      haptics.success();
      router.back();
    } catch (err) {
      haptics.error();
      dialog.alert({ title: t('common.failed'), body: err.message });
    } finally { setBusy(false); }
  };

  // Verwijderen met ongedaan-maken (geen blokkerende confirm — de undo-toast ís het
  // vangnet, en Alert-knoppen vuren bovendien niet op web).
  const confirmDelete = () => {
    markPending(id);
    router.back();
    toast.show({
      message: t('task.deleted', { name: title.trim() || t('task.deleteButton') }),
      actionLabel: t('common.undo'),
      onAction: () => unmarkPending(id),
      onExpire: async () => {
        try { await deleteTask(id); }
        catch (err) { dialog.alert({ title: t('common.failed'), body: err.message }); }
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
      dirty={dirty}
    >
      <Field label={t('task.field.title')} value={title}
        onChangeText={(v) => { setTitle(v); clearErr('title'); }}
        placeholder={t('task.field.title.placeholder')} autoFocus={isNew} error={errors.title} />

      {/* Beschrijving pas op verzoek (UX-38): een rustige toggle onder de titel. */}
      {showNotes ? (
        <Field label={t('task.field.notes')} value={notes} onChangeText={setNotes}
          placeholder={t('task.field.notes.placeholder')} multiline numberOfLines={3}
          style={{ minHeight: 70, textAlignVertical: 'top' }} />
      ) : (
        <Pressable onPress={() => setShowNotes(true)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="add" size={16} color={colors.forest} />
          <Text style={[type.label, { color: colors.forest }]}>{t('task.notes.add')}</Text>
        </Pressable>
      )}

      {/* Labels — zelfgemaakte, gekleurde tags voor maximale flexibiliteit (UX-41).
          Lang indrukken verwijdert een label; het is huishouden-breed, dus eerst bevestigen. */}
      <TagPicker tags={tags} selectedIds={tagIds} onCreate={addTag}
        onToggle={(id) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
        onDelete={async (tag) => {
          const ok = await dialog.confirm({
            title: t('task.tags.delete.title', { name: tag.name }),
            body: t('task.tags.delete.body'),
            tone: 'danger',
            confirmLabel: t('common.delete'),
          });
          if (!ok) return;
          setTagIds((ids) => ids.filter((x) => x !== tag.id));
          deleteTag(tag.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
        }} />

      {/* Wanneer — standaard vandaag; tik op de datum (of het icoon) om te kiezen (UX-36). */}
      <Text style={[type.label, { marginBottom: 8 }]}>{t('task.field.when')}</Text>
      <Row gap={space.sm} style={{ marginBottom: dueDate ? 12 : 18 }}>
        <Pressable onPress={() => setDatePickerOpen(true)} accessibilityRole="button"
          accessibilityLabel={dueDate ? cap(format(dueDate, 'EEEE d MMMM', { locale: dateLocale() })) : t('task.date.none')}
          accessibilityHint={t('tasks.picker.hint')}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48,
            paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line,
            backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          })}>
          <Icon name="agenda" size={18} color={colors.forest} />
          <Text style={[type.title, { fontSize: 15, flex: 1 }]}>
            {dueDate ? cap(format(dueDate, 'EEEE d MMMM', { locale: dateLocale() })) : t('task.date.none')}
          </Text>
        </Pressable>
        {dueDate ? (
          <IconButton icon="close" tint={colors.inkSoft} accessibilityLabel={t('task.date.clear')}
            onPress={() => { setDueDate(null); setFreq(null); setWeekdays([]); }} />
        ) : null}
      </Row>
      {errors.date ? (
        <Text style={[type.caption, { color: colors.danger, marginBottom: 12 }]}>{errors.date}</Text>
      ) : null}

      {/* Herhalen — een vinkje onthult pas dán de herhaalinstellingen (UX-36). */}
      {dueDate ? (
        <View style={{ marginBottom: 18 }}>
          <Pressable onPress={toggleRecurring} accessibilityRole="checkbox" accessibilityState={{ checked: !!freq }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
            <Checkbox checked={!!freq} onPress={toggleRecurring} accessibilityLabel={t('task.recur.toggle')} />
            <Text style={type.body}>{t('task.recur.toggle')}</Text>
          </Pressable>

          {freq ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label={t('task.recur.daily')} active={freq === RECUR.DAILY} onPress={() => setFreq(RECUR.DAILY)} />
                <Chip label={t('task.recur.weekly')} active={freq === RECUR.WEEKLY} onPress={() => setFreq(RECUR.WEEKLY)} />
                <Chip label={t('task.recur.monthly')} active={freq === RECUR.MONTHLY} onPress={() => setFreq(RECUR.MONTHLY)} />
              </View>

              {showInterval ? (
                <Row gap={space.md} style={{ marginTop: 12 }}>
                  <Text style={type.body}>{t('task.interval.every')}</Text>
                  <Stepper value={interval} onChange={setIntervalN} min={1} max={intervalMax}
                    accessibilityLabel={`${t('task.interval.every')} ${interval} ${unitLabel(interval)}`} />
                  <Text style={type.body}>{unitLabel(interval)}</Text>
                </Row>
              ) : null}

              {freq === RECUR.WEEKLY ? (
                <>
                  <Text style={[type.caption, { marginTop: 12, marginBottom: 6 }]}>{t('task.weekly.fixedDays')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                    {WEEKDAYS.map((w) => (
                      <Chip key={w.d} label={w.l} active={weekdays.includes(w.d)} onPress={() => toggleWeekday(w.d)} />
                    ))}
                  </View>
                </>
              ) : null}

              {/* Plain-language samenvatting als anker (UXR-10, à la Google/Apple Calendar):
                  toon de regel in gewone taal ("Elke week op za") als rustige bevestiging van
                  "dit krijg je", met de auto-doorrol als stillere helper eronder — i.p.v. één
                  drukke caption-regel. Het model zelf is bewust simpel (interval óf vaste dagen,
                  spiegelt wat de recurrence-engine kan). */}
              <View style={{ marginTop: 12, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
                <Row gap={space.xs} align="center">
                  <Icon name="repeat" size={15} color={colors.forest} />
                  <Text style={[type.label, { flex: 1, color: colors.ink }]}>
                    {recurrenceLabel({ recur_freq: freq, recur_interval: interval, recur_weekdays: weekdays })}
                  </Text>
                </Row>
                <Text style={[type.caption, { marginTop: 2 }]}>{t('task.recur.autoNext')}</Text>
              </View>

              {/* Herhaal-einde — subtiele extra optie (UX, batch 2): standaard verborgen
                  achter een tekstlink (net als "Beschrijving toevoegen"), zodat een
                  herhaling niet eindeloos hoeft door te gaan. */}
              {showRecurEnd ? (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label={t('task.recur.end.never')} active={recurEndMode === 'never'} onPress={() => { setRecurEndMode('never'); clearErr('recurEnd'); }} />
                    <Chip label={t('task.recur.end.until')} active={recurEndMode === 'until'} onPress={() => setRecurEndMode('until')} />
                    <Chip label={t('task.recur.end.count')} active={recurEndMode === 'count'} onPress={() => { setRecurEndMode('count'); clearErr('recurEnd'); }} />
                  </View>

                  {recurEndMode === 'until' ? (
                    <Pressable onPress={() => setRecurUntilPickerOpen(true)} accessibilityRole="button"
                      accessibilityLabel={recurUntil ? cap(format(recurUntil, 'EEEE d MMMM', { locale: dateLocale() })) : t('task.recur.end.untilNone')}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, marginTop: 10,
                        paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5,
                        borderColor: errors.recurEnd ? colors.danger : colors.line,
                        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                      })}>
                      <Icon name="agenda" size={18} color={colors.forest} />
                      <Text style={[type.title, { fontSize: 15, flex: 1, color: recurUntil ? colors.ink : colors.inkFaint }]}>
                        {recurUntil ? `${t('task.recur.end.untilPick')} ${cap(format(recurUntil, 'EEEE d MMMM', { locale: dateLocale() }))}` : t('task.recur.end.untilNone')}
                      </Text>
                    </Pressable>
                  ) : null}

                  {recurEndMode === 'count' ? (
                    <Row gap={space.md} align="center" style={{ marginTop: 12 }}>
                      <Text style={type.body}>{t('task.recur.count.label')}</Text>
                      <Stepper value={recurCount} onChange={setRecurCount} min={2} max={365}
                        accessibilityLabel={`${recurCount} ${plural(recurCount, 'task.recur.count.unit.one', 'task.recur.count.unit.other')}`} />
                      <Text style={type.body}>{plural(recurCount, 'task.recur.count.unit.one', 'task.recur.count.unit.other')}</Text>
                    </Row>
                  ) : null}

                  {errors.recurEnd ? (
                    <Text style={[type.caption, { color: colors.danger, marginTop: 8 }]}>{errors.recurEnd}</Text>
                  ) : null}
                </View>
              ) : (
                <Pressable onPress={() => { setShowRecurEnd(true); setRecurEndMode('until'); }} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, opacity: pressed ? 0.6 : 1 })}>
                  <Icon name="add" size={16} color={colors.forest} />
                  <Text style={[type.label, { color: colors.forest }]}>{t('task.recur.end.add')}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Voor wie? — combineert toewijzing én zichtbaarheid in één keuze (UX-35/37).
          Subtiel (collapsible): standaard zien álle huisgenoten de afspraak; pas op
          tikken vouwt de keuze "alleen bepaalde personen/groepen" open (UX, batch 2). */}
      <VisibilityPicker
        collapsible
        label={t('task.audience.label')}
        hint={t('task.audience.hint')}
        visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
        shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
        shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
        subgroups={subgroups} members={members}
      />
      {errors.visibility ? (
        <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.visibility}</Text>
      ) : null}

      {/* Primaire actie óók onderaan (UX-39), naast de bevestiging rechtsboven. */}
      <Button title={isNew ? t('task.create') : t('task.saveChanges')} onPress={save} loading={busy}
        style={{ marginTop: space.md }} />

      {!isNew ? (
        <Button title={t('task.deleteButton')} variant="ghost" onPress={confirmDelete}
          style={{ marginTop: space.sm, borderColor: 'transparent' }} />
      ) : null}

      <PeriodPicker
        visible={datePickerOpen} onClose={() => setDatePickerOpen(false)}
        scope="dag" value={dueDate ?? new Date()} tasks={[]}
        onPick={(d) => { setDueDate(d); clearErr('date'); }}
      />

      {/* Stopdatum-kiezer voor een herhaling (UX, batch 2). */}
      <PeriodPicker
        visible={recurUntilPickerOpen} onClose={() => setRecurUntilPickerOpen(false)}
        scope="dag" value={recurUntil ?? dueDate ?? new Date()} tasks={[]}
        onPick={(d) => { setRecurUntil(d); clearErr('recurEnd'); }}
      />
    </Editor>
  );
}
