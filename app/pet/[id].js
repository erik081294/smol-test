import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { mutate } from '../../lib/db';
import * as haptics from '../../lib/haptics';
import {
  usePets, usePetPhotoUrl, addPetPhoto, addPetLog, usePetLog, deletePetLog, updatePetLogNote,
} from '../../lib/usePets';
import { PET_TYPES, petType, speciesLabel, careTemplates, buildCareTasks, ageLabel } from '../../lib/petCare';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { backLabelFor } from '../../lib/navMeta';
import { Field, Button, Checkbox, Stepper, ModalHeader, Row, Editor, BottomSheet, Collapsible, SheetScrollView, SwipeRow, useErrorScroll } from '../../lib/ui';
import { PhotoDetailSheet } from '../../lib/PhotoDetailSheet';
import { Icon } from '../../lib/icons';
import { TaskRow } from '../../lib/TaskRow';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityRule } from '../../lib/visibility';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText, when, runRules, firstErrorField } from '../../lib/formValidation';
import { toggleValue } from '../../lib/listField';
import { recurrenceLabel, snoozeDate, dueLabel } from '../../lib/recurrence';
import { offerImagePicker } from '../../lib/photoPicker';
import { useEntityPhoto } from '../../lib/useEntityPhoto';
import { useToast } from '../../lib/toast';
import { useDialog } from '../../lib/dialog';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t, dateLocale } from '../../lib/i18n';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Prioriteit voor scroll-naar-eerste-fout (formulier-fundament): van boven naar onder.
const FIELD_ORDER = ['name', 'birth', 'visibility'];

// Verzorging-checklist-staat uit de soort-routine: { [key]: { on, interval } }.
function initCareState(type) {
  const o = {};
  for (const tpl of careTemplates(type)) o[tpl.key] = { on: !!tpl.defaultOn, interval: tpl.interval };
  return o;
}

// Eén regel in de verzorging-checklist: aan/uit + (indien aan) een interval-stepper
// met een leesbaar label ("elke 3 maanden"). Gedeeld door de nieuw-flow en het
// "verzorging aanpassen"-sheet.
function CareRowToggle({ tpl, state, onToggle, onInterval }) {
  return (
    <View style={{ paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: state.on }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Checkbox checked={state.on} onPress={onToggle} />
        <View style={{ flex: 1 }}>
          <Text style={type.body}>{tpl.title}</Text>
          {tpl.hint ? <Text style={type.caption}>{tpl.hint}</Text> : null}
        </View>
      </Pressable>
      {state.on ? (
        <View style={{ marginTop: space.xs, marginLeft: 38, alignSelf: 'flex-start' }}>
          <Stepper
            value={state.interval} min={1} max={36}
            onChange={onInterval}
            formatValue={(v) => recurrenceLabel({ recur_freq: tpl.freq, recur_interval: v })}
            accessibilityLabel={t('pet.care.interval', { task: tpl.title })}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function PetScreen() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const { addPet, removePet } = usePets();
  const { tasks, reload: reloadTasks, completeTask, uncompleteTask, deleteTask, updateTask } = useTasks();
  const { subgroups, members, activeId } = useHousehold();
  const { user } = useAuth();

  // ----- Nieuw huisdier: formulier -----
  // Gedeelde formulier-ruggengraat (ARCH-1) in full-mode: de hook beheert de velden, plus
  // dirty (discard-guard, via een genormaliseerde serialize), onBlur-live-validatie en
  // scroll-naar-eerste-fout. De verzorging-checklist (care) en de foto blijven lokaal.
  const serialize = (v) => JSON.stringify({
    name: v.name.trim(), petKind: v.petKind, speciesText: v.speciesText.trim(),
    birthDate: v.birthDate.trim(), chipNumber: v.chipNumber.trim(), vetName: v.vetName.trim(),
    notes: v.notes.trim(), visibility: v.visibility, shareSubgroupId: v.shareSubgroupId,
    shareWith: [...v.shareWith].sort(),
  });
  const form = useEntityForm({
    name: '', petKind: 'hond', speciesText: '', birthDate: '', chipNumber: '', vetName: '', notes: '',
    visibility: VISIBILITY.HOUSEHOLD, shareSubgroupId: null, shareWith: [],
  }, { serialize });
  const { values, setField, setValues, dirty: fieldsDirty, errors, clearError: clearErr, busy, setBusy, validate, validateField } = form;
  const { name, petKind, speciesText, birthDate, chipNumber, vetName, notes, visibility, shareSubgroupId, shareWith } = values;
  const [photoAsset, setPhotoAsset] = useState(null);
  const [care, setCare] = useState(() => initCareState('hond'));
  const { scrollRef, register, scrollToField } = useErrorScroll();

  const rules = [
    requiredText('name', t('pet.error.name')),
    when('birth', (v) => !v.birthDate || DATE_RE.test(v.birthDate.trim()), t('pet.error.birth')),
    visibilityRule('visibility'),
  ];

  // Soort kiezen → de voorgestelde verzorging-checklist meteen opnieuw opzetten.
  const chooseKind = (key) => { setField('petKind', key); setCare(initCareState(key)); };

  const toggleShareWith = (pid) =>
    setValues((v) => ({ ...v, shareWith: toggleValue(v.shareWith, pid) }));

  const choosePhoto = () => offerImagePicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });

  const save = async () => {
    if (!validate(rules)) {
      scrollToField(firstErrorField(runRules(values, rules), FIELD_ORDER));
      return;
    }
    setBusy(true);
    try {
      const careKeys = Object.entries(care).filter(([, v]) => v.on).map(([k]) => k);
      const careOverrides = Object.fromEntries(
        Object.entries(care).filter(([, v]) => v.on).map(([k, v]) => [k, v.interval])
      );
      await addPet({
        name: name.trim(), type: petKind, speciesLabel: speciesText,
        birthDate: birthDate.trim() || null,
        chipNumber, vetName, notes,
        visibility, shareSubgroupId, shareWith, photoAsset,
        careKeys, careOverrides,
      });
      haptics.success();
      router.back();
    } catch (e2) {
      haptics.error();
      dialog.alert({ title: t('pet.error.save'), body: e2.message });
    } finally { setBusy(false); }
  };

  // ----- Bestaand huisdier: detail -----
  const [pet, setPet] = useState(null);
  // Lokaal verborgen verzorgingstaken (optimistisch wissen met undo-vangnet, zelfde
  // patroon als taken.js): pas bij het verlopen van de toast écht verwijderen.
  const [hiddenTaskIds, setHiddenTaskIds] = useState([]);
  useEffect(() => {
    if (isNew) return;
    supabase.from('pets').select('*').eq('id', id).single()
      .then(({ data }) => { if (!data) router.back(); else setPet(data); });
  }, [id]);

  const { busy: photoBusy, nonce: photoNonce, pick: pickPhoto, refresh: refreshPhoto } = useEntityPhoto({
    onError: (e) => dialog.alert({ title: t('pet.photo.title'), body: e.message ?? t('pet.photo.uploadError') }),
  });
  const detailPhotoUrl = usePetPhotoUrl(pet?.photo_path, photoNonce);
  const { entries: log, reload: reloadLog } = usePetLog(pet?.id);

  // Tijdlijn-post-detail (modal): grote foto (indien aanwezig), notitie bewerken, verwijderen.
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState('');
  const selectedUrl = usePetPhotoUrl(selected?.photo_path);
  useEffect(() => { setNoteText(selected?.note ?? ''); }, [selected?.id]);

  // Losse notitie / gewicht toevoegen.
  const [composing, setComposing] = useState(null); // 'note' | 'weight' | null
  const [composeText, setComposeText] = useState('');
  const [composeWeight, setComposeWeight] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);

  // Verzorging aanpassen (sheet).
  const [careSheet, setCareSheet] = useState(null); // { [key]: {on, interval} } | null
  const [careBusy, setCareBusy] = useState(false);

  const saveComposed = async () => {
    setComposeBusy(true);
    try {
      if (composing === 'weight') {
        const kg = parseFloat(composeWeight.replace(',', '.'));
        if (!(kg > 0)) { setComposeBusy(false); return; }
        await addPetLog({ householdId: activeId, petId: pet.id, userId: user.id, weightGrams: Math.round(kg * 1000), note: composeText.trim() || null });
      } else {
        if (!composeText.trim()) { setComposeBusy(false); return; }
        await addPetLog({ householdId: activeId, petId: pet.id, userId: user.id, note: composeText });
      }
      setComposing(null); setComposeText(''); setComposeWeight('');
      reloadLog();
    } catch (e) {
      dialog.alert({ title: t('pet.timeline.error'), body: e.message });
    } finally { setComposeBusy(false); }
  };

  const changePhoto = () => pickPhoto(async (asset) => {
    const path = await addPetPhoto({ householdId: activeId, petId: pet.id, userId: user.id, asset });
    setPet((p) => ({ ...p, photo_path: path }));
    reloadLog();
  });

  const saveNote = async () => {
    if (!selected) return;
    if (!selected.photo_path && selected.weight_grams == null && !noteText.trim()) { removeSelected(); return; }
    try {
      await updatePetLogNote(selected.id, noteText);
      setSelected(null);
      reloadLog();
    } catch (e) {
      dialog.alert({ title: t('pet.timeline.error'), body: e.message });
    }
  };

  const removeSelected = async () => {
    const entry = selected;
    if (!entry) return;
    setSelected(null);
    try {
      const newCover = await deletePetLog({ entry, pet });
      setPet((p) => ({ ...p, photo_path: newCover }));
      refreshPhoto();
      reloadLog();
    } catch (e) {
      dialog.alert({ title: t('pet.photo.title'), body: e.message ?? t('pet.photo.deleteError') });
    }
  };

  if (!isNew) {
    if (!pet) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const tp = petType(pet.type);
    const petTasks = tasks.filter((pt) => pt.pet_id === pet.id && !hiddenTaskIds.includes(pt.id));
    const toggle = (task) => (task.completed_at ? uncompleteTask(task.id) : completeTask(task));

    // Veeg-acties op verzorgingstaken (zelfde conventie als taken.js): links = verwijderen
    // (met undo-vangnet, pas bij toast-expiry echt weg), rechts = uitstellen (één dag vooruit).
    const removeTaskWithUndo = (task) => {
      setHiddenTaskIds((h) => [...h, task.id]);
      toast.show({
        message: t('tasks.deleted', { name: task.title }),
        actionLabel: t('common.undo'),
        onAction: () => setHiddenTaskIds((h) => h.filter((x) => x !== task.id)),
        onExpire: async () => {
          try { await deleteTask(task.id); }
          catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
          finally { setHiddenTaskIds((h) => h.filter((x) => x !== task.id)); }
        },
      });
    };

    const snoozeTaskWithUndo = (task) => {
      const prev = task.due_date ?? null;
      const next = snoozeDate(task, 1);
      updateTask(task.id, { due_date: next });
      toast.show({
        message: t('tasks.snoozed', { date: dueLabel({ due_date: next }) }),
        actionLabel: t('common.undo'),
        onAction: () => updateTask(task.id, { due_date: prev }),
      });
    };
    const age = ageLabel(pet.birth_date);

    // Welke templates hebben al een gekoppelde taak (gematcht op titel-prefix)?
    const presentKeys = new Set(
      careTemplates(pet.type)
        .filter((tpl) => petTasks.some((pt) => pt.title?.startsWith(`${tpl.title} — `)))
        .map((tpl) => tpl.key)
    );
    const openCareSheet = () => {
      const st = {};
      for (const tpl of careTemplates(pet.type)) {
        st[tpl.key] = { on: presentKeys.has(tpl.key), interval: tpl.interval };
      }
      setCareSheet(st);
    };

    // Verzorging-checklist toepassen: nieuw-aangevinkt → taak aanmaken; uitgevinkt
    // wat al bestond → die gekoppelde taken verwijderen. (Interval van bestaande
    // taken pas je aan via de taak zelf.)
    const applyCare = async () => {
      setCareBusy(true);
      try {
        const addKeys = [];
        const overrides = {};
        const removeIds = [];
        for (const tpl of careTemplates(pet.type)) {
          const st = careSheet[tpl.key];
          const present = presentKeys.has(tpl.key);
          if (st.on && !present) { addKeys.push(tpl.key); overrides[tpl.key] = st.interval; }
          else if (!st.on && present) {
            for (const pt of petTasks) if (pt.title?.startsWith(`${tpl.title} — `)) removeIds.push(pt.id);
          }
        }
        if (addKeys.length) {
          const payloads = buildCareTasks(pet, addKeys, { overrides })
            .map((task) => ({ ...task, household_id: activeId, created_by: user.id }));
          await mutate(supabase.from('tasks').insert(payloads), { context: 'verzorgingstaken aanmaken' });
        }
        if (removeIds.length) {
          await mutate(supabase.from('tasks').delete().in('id', removeIds), { context: 'verzorgingstaken verwijderen' });
        }
        setCareSheet(null);
        reloadTasks();
      } catch (e) {
        dialog.alert({ title: t('pet.care.error'), body: e.message });
      } finally { setCareBusy(false); }
    };

    const confirmRemove = () => {
      markPending(pet.id);
      router.back();
      toast.show({
        message: t('pet.deleted', { name: pet.name }),
        actionLabel: t('common.undo'),
        onAction: () => unmarkPending(pet.id),
        onExpire: async () => {
          try { await removePet(pet.id); }
          catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
          finally { unmarkPending(pet.id); }
        },
      });
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={pet.name} onClose={() => router.back()} backLabel={backLabelFor('pet')} />
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
          <View style={{ alignItems: 'center', marginVertical: space.lg }}>
            <Pressable onPress={changePhoto} disabled={photoBusy} accessibilityRole="button"
              accessibilityLabel={detailPhotoUrl ? t('pet.photo.change') : t('pet.photo.add')}>
              <View style={{ width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photoBusy
                  ? <ActivityIndicator color={colors.forest} />
                  : detailPhotoUrl
                    ? <Image source={{ uri: detailPhotoUrl }} style={{ width: 88, height: 88 }} />
                    : <Text style={{ fontSize: 44 }}>{tp.emoji}</Text>}
              </View>
              <Text style={[type.caption, { color: colors.forest, marginTop: space.sm, textAlign: 'center' }]}>
                {detailPhotoUrl ? t('pet.photo.change') : t('pet.photo.add')}
              </Text>
            </Pressable>
            <Text style={[type.h1, { marginTop: 10 }]}>{pet.name}</Text>
            <Text style={[type.body, { color: colors.inkSoft }]}>
              {speciesLabel(pet)}{age ? ` · ${age}` : ''}
            </Text>
          </View>

          {/* Verzorgingskaart: gekoppelde terugkerende taken + "verzorging aanpassen". */}
          <Row justify="space-between" align="center" style={{ marginBottom: space.sm }}>
            <Text style={type.label}>{t('pet.careTasks')}</Text>
            <Pressable onPress={openCareSheet} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={t('pet.care.adjust')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="repeat" size={16} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]}>{t('pet.care.adjust')}</Text>
            </Pressable>
          </Row>
          {petTasks.length === 0
            ? <Text style={type.caption}>{t('pet.noTasks')}</Text>
            : petTasks.map((task) => (
              <SwipeRow key={task.id}
                left={{ icon: 'delete', label: t('common.delete'), color: colors.danger, onTrigger: () => removeTaskWithUndo(task) }}
                right={{ icon: 'agenda', label: t('tasks.snooze'), color: colors.forest, onTrigger: () => snoozeTaskWithUndo(task) }}
              >
                {/* Tik opent de taak-editor (PLA-10-parity): interval/frequentie aanpassen
                    of pauzeren. Zonder onPress viel 'ie via taskHref terug op dit huisdier
                    zelf (dode tik). */}
                <TaskRow task={task} members={members} onToggle={toggle}
                  onPress={() => router.push(`/task/${task.id}`)} />
              </SwipeRow>
            ))}

          {/* Extra info (chip, dierenarts, notitie) — alleen tonen wat ingevuld is. */}
          {(pet.chip_number || pet.vet_name || pet.notes) ? (
            <View style={{ marginTop: 20, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg }}>
              {pet.chip_number ? <InfoRow icon="chip" label={t('pet.field.chip')} value={pet.chip_number} /> : null}
              {pet.vet_name ? <InfoRow icon="vet" label={t('pet.field.vet')} value={pet.vet_name} /> : null}
              {pet.notes ? <InfoRow icon="note" label={t('pet.field.notes')} value={pet.notes} /> : null}
            </View>
          ) : null}

          {/* Tijdlijn: foto's, notities én gewicht-posts over tijd. */}
          <Row justify="space-between" align="center" style={{ marginTop: 20, marginBottom: 8 }}>
            <Text style={type.label}>{t('pet.timeline')}</Text>
            <Row gap={space.md}>
              <Pressable onPress={() => { setComposeWeight(''); setComposeText(''); setComposing('weight'); }} hitSlop={8}
                accessibilityRole="button" accessibilityLabel={t('pet.weight.add')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="weight" size={16} color={colors.forest} />
                <Text style={[type.caption, { color: colors.forest }]}>{t('pet.weight.add')}</Text>
              </Pressable>
              <Pressable onPress={() => { setComposeText(''); setComposing('note'); }} hitSlop={8}
                accessibilityRole="button" accessibilityLabel={t('pet.timeline.addNote')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="add" size={16} color={colors.forest} />
                <Text style={[type.caption, { color: colors.forest }]}>{t('pet.timeline.addNote')}</Text>
              </Pressable>
            </Row>
          </Row>
          {log.length === 0 ? (
            <Text style={type.caption}>{t('pet.timeline.empty')}</Text>
          ) : (
            <PetTimeline entries={log} onSelect={setSelected} />
          )}

          <Button title={t('pet.deleteButton')} variant="ghost" onPress={confirmRemove} style={{ marginTop: 24 }} />
        </ScrollView>

        {/* Tijdlijn-post-detail */}
        <PhotoDetailSheet
          visible={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.photo_path ? t('pet.timeline.photo') : (selected?.weight_grams != null ? t('pet.weight.title') : t('pet.timeline.note'))}
          hasPhoto={!!selected?.photo_path}
          imageUrl={selectedUrl}
          dateText={selected ? `${format(parseISO(selected.created_at), 'd MMMM yyyy', { locale: dateLocale() })}${selected.weight_grams != null ? ` · ${t('pet.weight.value', { kg: (selected.weight_grams / 1000).toFixed(2).replace('.', ',') })}` : ''}` : null}
          noteValue={noteText}
          onChangeNote={setNoteText}
          noteLabel={t('pet.field.note')}
          notePlaceholder={t('pet.field.note.placeholder')}
          saveLabel={t('common.save')}
          onSave={saveNote}
          onRemove={removeSelected}
        />

        {/* Notitie / gewicht toevoegen */}
        <BottomSheet visible={!!composing} onClose={() => setComposing(null)} avoidKeyboard>
          <ModalHeader title={composing === 'weight' ? t('pet.weight.add') : t('pet.timeline.addNote')} onClose={() => setComposing(null)} />
          <SheetScrollView contentContainerStyle={{ paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
            {composing === 'weight' ? (
              <Field label={t('pet.weight.field')} value={composeWeight} onChangeText={setComposeWeight}
                keyboardType="decimal-pad" placeholder="4,2" autoFocus />
            ) : null}
            <Field label={t('pet.field.note')} value={composeText} onChangeText={setComposeText} multiline
              placeholder={t('pet.field.note.placeholder')} autoFocus={composing === 'note'} style={{ marginBottom: 0 }} />
            <Button title={t('common.save')} onPress={saveComposed} loading={composeBusy}
              disabled={composing === 'weight' ? !(parseFloat(composeWeight.replace(',', '.')) > 0) : !composeText.trim()}
              style={{ marginTop: space.md }} />
          </SheetScrollView>
        </BottomSheet>

        {/* Verzorging aanpassen */}
        <BottomSheet visible={!!careSheet} onClose={() => setCareSheet(null)} avoidKeyboard>
          <ModalHeader title={t('pet.care.adjust')} onClose={() => setCareSheet(null)} />
          <SheetScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Text style={[type.caption, { marginBottom: space.sm }]}>{t('pet.care.adjust.hint')}</Text>
            {careSheet ? careTemplates(pet.type).map((tpl) => (
              <CareRowToggle key={tpl.key} tpl={tpl} state={careSheet[tpl.key]}
                onToggle={() => setCareSheet((c) => ({ ...c, [tpl.key]: { ...c[tpl.key], on: !c[tpl.key].on } }))}
                onInterval={(v) => setCareSheet((c) => ({ ...c, [tpl.key]: { ...c[tpl.key], interval: v } }))} />
            )) : null}
            <Button title={t('common.save')} onPress={applyCare} loading={careBusy} style={{ marginTop: space.md }} />
          </SheetScrollView>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  // ----- Nieuw huisdier -----
  const kindEmojiGrid = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
      {PET_TYPES.map((pt) => {
        const active = petKind === pt.key;
        return (
          <Pressable key={pt.key} onPress={() => chooseKind(pt.key)} accessibilityRole="button"
            accessibilityLabel={pt.label} accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: space.xs, paddingHorizontal: space.sm,
              borderRadius: radius.pill, borderWidth: 1.5,
              borderColor: active ? colors.forest : colors.line,
              backgroundColor: active ? colors.forestSoft : colors.surface,
            }}>
            <Text style={{ fontSize: 18 }}>{pt.emoji}</Text>
            <Text style={[type.body, active ? { color: colors.forest, fontWeight: '700' } : null]}>{pt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Editor title={t('pet.new')} onClose={() => router.back()} onConfirm={save} busy={busy}
      dirty={fieldsDirty || !!photoAsset} scrollRef={scrollRef}>
      {/* Foto kiezen (camera/bibliotheek) — preview totdat we opslaan. */}
      <View style={{ alignItems: 'center', marginBottom: space.lg }}>
        <Pressable onPress={choosePhoto} accessibilityRole="button"
          accessibilityLabel={photoAsset ? t('pet.photo.change') : t('pet.photo.add')}>
          <View style={{ width: 96, height: 96, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            borderWidth: 2, borderColor: colors.line }}>
            {photoAsset?.uri
              ? <Image source={{ uri: photoAsset.uri }} style={{ width: 96, height: 96 }} />
              : <Text style={{ fontSize: 40 }}>{petType(petKind).emoji}</Text>}
          </View>
        </Pressable>
        <Text style={[type.caption, { color: colors.forest, marginTop: space.sm }]}>
          {photoAsset ? t('pet.photo.change') : t('pet.photo.add')}
        </Text>
        <Text style={type.caption}>{t('pet.photo.optional')}</Text>
      </View>

      <View onLayout={register('name')}>
        <Field label={t('pet.field.name')} value={name} onChangeText={(v) => setField('name', v)}
          onBlur={() => validateField(rules, 'name')}
          placeholder={t('pet.field.name.placeholder')} error={errors.name} />
      </View>

      <Text style={[type.label, { marginBottom: 6 }]}>{t('pet.field.type')}</Text>
      {kindEmojiGrid}
      {/* Eigen soort bij "Anders" (HUI-2): vrij label, optioneel. */}
      {petKind === 'anders' ? (
        <Field label={t('pet.field.species')} value={speciesText} onChangeText={(v) => setField('speciesText', v)}
          placeholder={t('pet.field.species.placeholder')} style={{ marginTop: -space.sm }} />
      ) : null}

      {/* Voorgestelde verzorging — voor-aangevinkt, alleen bevestigen of bijschaven. */}
      <Text style={[type.label, { marginBottom: 2 }]}>{t('pet.care.title')}</Text>
      <Text style={[type.caption, { marginBottom: space.sm }]}>{t('pet.care.subtitle')}</Text>
      <View style={{ marginBottom: space.lg }}>
        {careTemplates(petKind).map((tpl) => (
          <CareRowToggle key={tpl.key} tpl={tpl} state={care[tpl.key]}
            onToggle={() => setCare((c) => ({ ...c, [tpl.key]: { ...c[tpl.key], on: !c[tpl.key].on } }))}
            onInterval={(v) => setCare((c) => ({ ...c, [tpl.key]: { ...c[tpl.key], interval: v } }))} />
        ))}
      </View>

      {/* Optioneel: meer over je huisdier (geboortedatum, chip, dierenarts, notitie). */}
      <Collapsible label={t('pet.more')} summary={t('pet.more.summary')}>
        <View onLayout={register('birth')}>
          <Field label={t('pet.field.birth')} value={birthDate} onChangeText={(v) => { setField('birthDate', v); clearErr('birth'); }}
            onBlur={() => validateField(rules, 'birth')}
            placeholder="2021-06-15" helper={t('pet.field.birth.helper')} error={errors.birth} />
        </View>
        <Field label={t('pet.field.chip')} value={chipNumber} onChangeText={(v) => setField('chipNumber', v)}
          placeholder={t('pet.field.chip.placeholder')} />
        <Field label={t('pet.field.vet')} value={vetName} onChangeText={(v) => setField('vetName', v)}
          placeholder={t('pet.field.vet.placeholder')} />
        <Field label={t('pet.field.notes')} value={notes} onChangeText={(v) => setField('notes', v)} multiline
          placeholder={t('pet.field.notes.placeholder')} style={{ marginBottom: 0 }} />
      </Collapsible>

      <View onLayout={register('visibility')}>
        <VisibilityPicker
          collapsible
          visibility={visibility} onChangeVisibility={(v) => { setField('visibility', v); clearErr('visibility'); }}
          shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setField('shareSubgroupId', v); clearErr('visibility'); }}
          shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
          subgroups={subgroups} members={members} />
        {errors.visibility ? (
          <Text style={[type.caption, { color: colors.danger, marginTop: space.xs }]}>{errors.visibility}</Text>
        ) : null}
      </View>
    </Editor>
  );
}

// Verticale tijdlijn: elke post (foto / notitie / gewicht) is een knooppunt op een
// doorlopende rail, nieuwste bovenaan. Tikken opent het detail-sheet.
function PetTimeline({ entries, onSelect }) {
  return (
    <View>
      {entries.map((e, i) => (
        <PetTimelineEntry key={e.id} entry={e} first={i === 0} last={i === entries.length - 1} onPress={() => onSelect(e)} />
      ))}
    </View>
  );
}

const TL_RAIL = 28;
const TL_DOT = 14;
const TL_DOT_TOP = 36;

function PetTimelineEntry({ entry, first, last, onPress }) {
  const isPhoto = !!entry.photo_path;
  const isWeight = entry.weight_grams != null && !isPhoto;
  const url = usePetPhotoUrl(entry.photo_path);
  const dateLabel = format(parseISO(entry.created_at), 'd MMMM yyyy', { locale: dateLocale() });
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={dateLabel}
      style={({ pressed }) => ({ flexDirection: 'row', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: TL_RAIL, alignItems: 'center' }}>
        {!first ? <View style={{ position: 'absolute', top: 0, left: TL_RAIL / 2 - 1, height: TL_DOT_TOP, width: 2, backgroundColor: colors.line }} /> : null}
        {!last ? <View style={{ position: 'absolute', top: TL_DOT_TOP, bottom: 0, left: TL_RAIL / 2 - 1, width: 2, backgroundColor: colors.line }} /> : null}
        <View style={{ marginTop: TL_DOT_TOP - TL_DOT / 2, width: TL_DOT, height: TL_DOT, borderRadius: TL_DOT / 2,
          backgroundColor: colors.forest, borderWidth: 3, borderColor: colors.bg }} />
      </View>
      <View style={{ flex: 1, paddingBottom: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center',
          backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden',
            backgroundColor: isPhoto ? colors.surfaceAlt : colors.forestSoft, alignItems: 'center', justifyContent: 'center' }}>
            {isPhoto
              ? (url ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} resizeMode="cover" /> : <Icon name="pets" size={20} color={colors.inkSoft} />)
              : <Icon name={isWeight ? 'weight' : 'note'} size={22} color={colors.forest} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { fontSize: 15 }]}>{dateLabel}</Text>
            {isWeight
              ? <Text style={[type.body, { color: colors.forest, marginTop: 2 }]}>{t('pet.weight.value', { kg: (entry.weight_grams / 1000).toFixed(2).replace('.', ',') })}</Text>
              : null}
            {entry.note
              ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]} numberOfLines={2}>{entry.note}</Text>
              : (!isWeight ? <Text style={[type.caption, { marginTop: 2 }]}>{isPhoto ? t('pet.timeline.photo') : t('pet.timeline.note')}</Text> : null)}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.xs }}>
      <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name={icon} size={16} color={colors.inkSoft} />
        <Text style={type.label}>{label}</Text>
      </View>
      <Text style={[type.body, { flex: 1 }]}>{value}</Text>
    </View>
  );
}
