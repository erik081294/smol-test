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
import { Field, Button, Chip, Row, Stepper, Editor, Checkbox, IconButton, RevealLink, useErrorScroll } from '../../lib/ui';
import { TagPicker } from '../../lib/TagPicker';
import { PeriodPicker } from '../../lib/PeriodPicker';
import { Icon } from '../../lib/icons';
import { colors, radius, type, space } from '../../lib/theme';
import { recurrenceLabel } from '../../lib/recurrence';
import { VISIBILITY, RECUR } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityPayload, visibilityRule } from '../../lib/visibility';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText, when, runRules, firstErrorField } from '../../lib/formValidation';
import { toggleValue } from '../../lib/listField';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { dateLocale, t, plural } from '../../lib/i18n';

const WEEKDAYS = [
  { d: 1, l: 'Ma' }, { d: 2, l: 'Di' }, { d: 3, l: 'Wo' }, { d: 4, l: 'Do' },
  { d: 5, l: 'Vr' }, { d: 6, l: 'Za' }, { d: 0, l: 'Zo' },
];

// Prioriteit voor scroll-naar-eerste-fout (formulier-fundament): van boven naar onder.
const FIELD_ORDER = ['title', 'date', 'recurEnd', 'visibility'];

// Eerste letter als hoofdletter (NL-datumnamen komen lowercase uit date-fns).
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Afspraken-editor (UXR-2). Bewust simpel: titel → (optioneel beschrijving) → wanneer
// → voor wie. Zone/categorie-keuze en beurtrotatie zijn eruit — die horen bij hun
// modules (UX-34/40). Een afspraak heeft standaard de datum van vandaag (UX-36) en
// "Voor wie?" combineert toewijzing én zichtbaarheid in één keuze (UX-35/37). Bestaande
// module-/schoonmaaktaken kunnen hier nog wél bewerkt worden: zone_id, rotation en
// (bij Hele-huishouden) assigned_to blijven behouden, ook al tonen we ze niet.
//
// Referentie-implementatie voor het formulier-fundament: de veld-state leeft in de
// full-mode useEntityForm (values + dirty + reset + validateField), de discard-guard
// leunt op hook-`dirty`, en de optionele velden gebruiken het gedeelde RevealLink.
export default function TaskEditor() {
  const dialog = useDialog();
  const { id, date, zone, plant } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addTask, updateTask, deleteTask } = useTasks();
  const { tags, addTag, deleteTag } = useTags();
  const { members, subgroups } = useHousehold();

  // Alleen niet-data-UI-state blijft lokaal; de formulierwaarden leven in de hook.
  const [loaded, setLoaded] = useState(isNew);
  const [showNotes, setShowNotes] = useState(false);       // beschrijving pas op verzoek (UX-38)
  const [showRecurEnd, setShowRecurEnd] = useState(false); // herhaal-einde subtiel (UX, batch 2)
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [recurUntilPickerOpen, setRecurUntilPickerOpen] = useState(false);

  // Gedeelde formulier-ruggengraat (ARCH-1) in full-mode: de hook beheert de waarden,
  // de dirty-detectie (via een genormaliseerde serialize — getrimde tekst + datums als
  // 'yyyy-MM-dd', zodat cosmetische verschillen niet als 'gewijzigd' tellen) en de
  // live/submit-validatie via de pure regels (lib/formValidation.js).
  const serialize = (v) => JSON.stringify({
    title: v.title.trim(), notes: v.notes.trim(), category: v.category, zoneId: v.zoneId, assignedTo: v.assignedTo,
    dueDate: v.dueDate ? format(v.dueDate, 'yyyy-MM-dd') : null,
    freq: v.freq, interval: v.interval, weekdays: v.weekdays, rotation: v.rotation, tagIds: v.tagIds,
    visibility: v.visibility, shareSubgroupId: v.shareSubgroupId, shareWith: v.shareWith,
    recurEndMode: v.recurEndMode, recurUntil: v.recurUntil ? format(v.recurUntil, 'yyyy-MM-dd') : null, recurCount: v.recurCount,
  });
  const form = useEntityForm({
    title: '', notes: '',
    // Vanuit een zone toegevoegd (Schoonmaak) ⇒ 'huishouden'; vanuit een plant
    // (PLA-10: "verzorgingstaak toevoegen") ⇒ 'plant'; anders een gewone afspraak.
    category: plant ? 'plant' : zone ? 'huishouden' : 'afspraak',
    zoneId: zone ?? null,          // passthrough (UX-34)
    plantId: plant ?? null,        // passthrough (PLA-10)
    assignedTo: null,              // passthrough (Hele-huishouden)
    // Datum staat standaard op vandaag (UX-36); een afspraak hoort op de kalender.
    dueDate: date ? new Date(date + 'T00:00:00') : (isNew ? new Date() : null),
    freq: null, interval: 1, weekdays: [],                 // null|daily|weekly|monthly
    recurEndMode: 'never', recurUntil: null, recurCount: 5, // herhaal-einde (UX, batch 2)
    rotation: [],                  // passthrough (UX-40)
    tagIds: [],                    // zelfgemaakte labels (UX-41)
    visibility: VISIBILITY.HOUSEHOLD, shareSubgroupId: null, shareWith: [], // voor wie / wie ziet 'm
  }, { serialize });
  const { values, setField, setValues, reset, dirty, errors, clearError: clearErr, busy, setBusy, validate, validateField } = form;
  const {
    title, notes, category, zoneId, plantId, assignedTo, dueDate,
    freq, interval, weekdays, recurEndMode, recurUntil, recurCount,
    rotation, tagIds, visibility, shareSubgroupId, shareWith,
  } = values;
  const { scrollRef, register, scrollToField } = useErrorScroll();

  // De validatieregels — gedeeld door de submit (alle fouten) en de onBlur-live-check
  // (alleen dit veld). Elke regel leest uit het meegegeven subject (default: de values).
  const rules = [
    requiredText('title', t('task.error.title')),
    when('date', (v) => !v.freq || !!v.dueDate, t('task.error.recurDate')),
    when('recurEnd', (v) => !(v.freq && v.recurEndMode === 'until') || !!v.recurUntil, t('task.recur.end.untilNone')),
    visibilityRule('visibility'),
  ];

  // Bestaande taak inladen → herbaseer het formulier (nieuw ijkpunt voor dirty).
  useEffect(() => {
    if (isNew) return;
    supabase.from('tasks').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) { router.back(); return; }
      // Herhaal-einde uit de opgeslagen kolommen afleiden.
      const until = data.recur_until ? new Date(data.recur_until + 'T00:00:00') : null;
      const count = data.recur_count ?? null;
      const endMode = until ? 'until' : (count != null ? 'count' : 'never');
      reset({
        title: data.title, notes: data.notes ?? '',
        category: data.category, zoneId: data.zone_id ?? null, plantId: data.plant_id ?? null,
        assignedTo: data.assigned_to,
        dueDate: data.due_date ? new Date(data.due_date + 'T00:00:00') : null,
        freq: data.recur_freq, interval: data.recur_interval ?? 1, weekdays: data.recur_weekdays ?? [],
        recurEndMode: endMode, recurUntil: until, recurCount: count ?? 5,
        rotation: data.rotation ?? [], tagIds: data.tag_ids ?? [],
        visibility: data.visibility ?? VISIBILITY.HOUSEHOLD,
        shareSubgroupId: data.share_subgroup_id ?? null, shareWith: data.share_with ?? [],
      });
      setShowNotes(!!(data.notes ?? '').trim());
      setShowRecurEnd(endMode !== 'never');
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleWeekday = (d) =>
    setValues((v) => ({ ...v, weekdays: toggleValue(v.weekdays, d) }));

  // Herhaal-toggle: aan → standaard wekelijks; uit → eenmalig (weekdagen + einde leeg).
  const toggleRecurring = () => {
    if (freq) {
      setValues((v) => ({ ...v, freq: null, weekdays: [], recurEndMode: 'never', recurUntil: null }));
      setShowRecurEnd(false);
    } else {
      setValues((v) => ({ ...v, freq: RECUR.WEEKLY }));
      clearErr('date');
    }
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
    setValues((v) => ({ ...v, shareWith: toggleValue(v.shareWith, pid) }));

  const save = async () => {
    if (!validate(rules)) {
      // errors-state is deze render nog niet doorgevoerd → bereken de eerste fout vers
      // en scroll ernaartoe, zodat een fout onderin ("voor wie?") niet onzichtbaar blijft.
      scrollToField(firstErrorField(runRules(values, rules), FIELD_ORDER));
      return;
    }
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
      scrollRef={scrollRef}
    >
      <View onLayout={register('title')}>
        <Field label={t('task.field.title')} value={title}
          onChangeText={(v) => setField('title', v)}
          onBlur={() => validateField(rules, 'title')}
          placeholder={t('task.field.title.placeholder')} autoFocus={isNew} error={errors.title} />
      </View>

      {/* Beschrijving pas op verzoek (UX-38): een rustige toggle onder de titel. */}
      {showNotes ? (
        <Field label={t('task.field.notes')} value={notes} onChangeText={(v) => setField('notes', v)}
          placeholder={t('task.field.notes.placeholder')} multiline numberOfLines={3}
          style={{ minHeight: 70, textAlignVertical: 'top' }} />
      ) : (
        <RevealLink label={t('task.notes.add')} onPress={() => setShowNotes(true)} style={{ marginBottom: 18 }} />
      )}

      {/* Labels — zelfgemaakte, gekleurde tags voor maximale flexibiliteit (UX-41).
          Lang indrukken verwijdert een label; het is huishouden-breed, dus eerst bevestigen. */}
      <TagPicker tags={tags} selectedIds={tagIds} onCreate={addTag}
        onToggle={(tid) => setValues((v) => ({ ...v, tagIds: toggleValue(v.tagIds, tid) }))}
        onDelete={async (tag) => {
          const ok = await dialog.confirm({
            title: t('task.tags.delete.title', { name: tag.name }),
            body: t('task.tags.delete.body'),
            tone: 'danger',
            confirmLabel: t('common.delete'),
          });
          if (!ok) return;
          setValues((v) => ({ ...v, tagIds: v.tagIds.filter((x) => x !== tag.id) }));
          deleteTag(tag.id).catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));
        }} />

      {/* Wanneer — standaard vandaag; tik op de datum (of het icoon) om te kiezen (UX-36). */}
      <View onLayout={register('date')}>
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
              onPress={() => setValues((v) => ({ ...v, dueDate: null, freq: null, weekdays: [] }))} />
          ) : null}
        </Row>
        {errors.date ? (
          <Text style={[type.caption, { color: colors.danger, marginBottom: 12 }]}>{errors.date}</Text>
        ) : null}
      </View>

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
                <Chip label={t('task.recur.daily')} active={freq === RECUR.DAILY} onPress={() => setField('freq', RECUR.DAILY)} />
                <Chip label={t('task.recur.weekly')} active={freq === RECUR.WEEKLY} onPress={() => setField('freq', RECUR.WEEKLY)} />
                <Chip label={t('task.recur.monthly')} active={freq === RECUR.MONTHLY} onPress={() => setField('freq', RECUR.MONTHLY)} />
              </View>

              {showInterval ? (
                <Row gap={space.md} style={{ marginTop: 12 }}>
                  <Text style={type.body}>{t('task.interval.every')}</Text>
                  <Stepper value={interval} onChange={(n) => setField('interval', n)} min={1} max={intervalMax}
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
                  achter een RevealLink (net als "Beschrijving toevoegen"), zodat een
                  herhaling niet eindeloos hoeft door te gaan. */}
              <View onLayout={register('recurEnd')}>
                {showRecurEnd ? (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Chip label={t('task.recur.end.never')} active={recurEndMode === 'never'} onPress={() => { setField('recurEndMode', 'never'); clearErr('recurEnd'); }} />
                      <Chip label={t('task.recur.end.until')} active={recurEndMode === 'until'} onPress={() => setField('recurEndMode', 'until')} />
                      <Chip label={t('task.recur.end.count')} active={recurEndMode === 'count'} onPress={() => { setField('recurEndMode', 'count'); clearErr('recurEnd'); }} />
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
                        <Stepper value={recurCount} onChange={(n) => setField('recurCount', n)} min={2} max={365}
                          accessibilityLabel={`${recurCount} ${plural(recurCount, 'task.recur.count.unit.one', 'task.recur.count.unit.other')}`} />
                        <Text style={type.body}>{plural(recurCount, 'task.recur.count.unit.one', 'task.recur.count.unit.other')}</Text>
                      </Row>
                    ) : null}

                    {errors.recurEnd ? (
                      <Text style={[type.caption, { color: colors.danger, marginTop: 8 }]}>{errors.recurEnd}</Text>
                    ) : null}
                  </View>
                ) : (
                  <RevealLink label={t('task.recur.end.add')} style={{ marginTop: 14 }}
                    onPress={() => { setShowRecurEnd(true); setField('recurEndMode', 'until'); }} />
                )}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Voor wie? — combineert toewijzing én zichtbaarheid in één keuze (UX-35/37).
          Subtiel (collapsible): standaard zien álle huisgenoten de afspraak; pas op
          tikken vouwt de keuze "alleen bepaalde personen/groepen" open (UX, batch 2). */}
      <View onLayout={register('visibility')}>
        <VisibilityPicker
          collapsible
          label={t('task.audience.label')}
          hint={t('task.audience.hint')}
          visibility={visibility} onChangeVisibility={(v) => { setField('visibility', v); clearErr('visibility'); }}
          shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setField('shareSubgroupId', v); clearErr('visibility'); }}
          shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
          subgroups={subgroups} members={members}
        />
        {errors.visibility ? (
          <Text style={[type.caption, { color: colors.danger, marginTop: -space.sm, marginBottom: space.sm }]}>{errors.visibility}</Text>
        ) : null}
      </View>

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
        onPick={(d) => { setValues((v) => ({ ...v, dueDate: d })); clearErr('date'); }}
      />

      {/* Stopdatum-kiezer voor een herhaling (UX, batch 2). */}
      <PeriodPicker
        visible={recurUntilPickerOpen} onClose={() => setRecurUntilPickerOpen(false)}
        scope="dag" value={recurUntil ?? dueDate ?? new Date()} tasks={[]}
        onPick={(d) => { setValues((v) => ({ ...v, recurUntil: d })); clearErr('recurEnd'); }}
      />
    </Editor>
  );
}
