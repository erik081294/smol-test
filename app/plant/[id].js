import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { offerImagePicker } from '../../lib/photoPicker';
import { useEntityPhoto } from '../../lib/useEntityPhoto';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { usePlants, usePlantSpecies, searchSpecies, usePlantPhotoUrl, addPlantPhoto, addPlantNote, usePlantDiary, deletePlantPhoto, updatePlantPhotoNote } from '../../lib/usePlants';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { backLabelFor } from '../../lib/navMeta';
import { Field, Button, Chip, ModalHeader, Row, Editor, BottomSheet, SheetScrollView, SegmentedControl, Collapsible, useErrorScroll } from '../../lib/ui';
import { PhotoDetailSheet } from '../../lib/PhotoDetailSheet';
import { Icon } from '../../lib/icons';
import { TaskRow } from '../../lib/TaskRow';
import { colors, radius, type, space, font } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { visibilityRule } from '../../lib/visibility';
import { useEntityForm } from '../../lib/useEntityForm';
import { requiredText, when, runRules, firstErrorField } from '../../lib/formValidation';
import { toggleValue } from '../../lib/listField';
import { careCard } from '../../lib/plantCare';
import { useToast } from '../../lib/toast';
import { useDialog } from '../../lib/dialog';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t, dateLocale } from '../../lib/i18n';

const LOCATIONS = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Balkon', 'Tuin', 'Kantoor'];

// Prioriteit voor scroll-naar-eerste-fout (formulier-fundament): van boven naar onder.
const FIELD_ORDER = ['name', 'water', 'visibility'];

export default function PlantScreen() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const { addPlant, updatePlant, removePlant } = usePlants();
  const { species } = usePlantSpecies();
  const { tasks, completeTask, uncompleteTask } = useTasks();
  const { subgroups, members, activeId } = useHousehold();
  const { user } = useAuth();

  // ----- Formulier-state -----
  // Gedeelde formulier-ruggengraat (ARCH-1) in full-mode: de hook beheert de velden, plus
  // dirty (discard-guard, via een genormaliseerde serialize) en onBlur-live-validatie. Deze
  // state bedient zowel de nieuw-plant-Editor als de bewerk-sheet van een bestaande plant
  // (via `reset` in openEdit). De omslagfoto (photoAsset) blijft lokaal — alleen nieuw-flow.
  const serialize = (v) => JSON.stringify({
    name: v.name.trim(), speciesId: v.speciesId, location: v.location, waterDays: v.waterDays,
    visibility: v.visibility, shareSubgroupId: v.shareSubgroupId, shareWith: [...v.shareWith].sort(),
  });
  const form = useEntityForm({
    name: '', query: '', speciesId: null, location: null, waterDays: '7',
    visibility: VISIBILITY.HOUSEHOLD, shareSubgroupId: null, shareWith: [],
  }, { serialize });
  const { values, setField, setValues, reset, dirty: fieldsDirty, errors, clearError: clearErr, busy, setBusy, validate, validateField } = form;
  const { name, query, speciesId, location, waterDays, visibility, shareSubgroupId, shareWith } = values;
  const [photoAsset, setPhotoAsset] = useState(null); // { uri, base64, ext } of null
  const { scrollRef, register, scrollToField } = useErrorScroll();

  const matches = useMemo(() => searchSpecies(species, query).slice(0, 8), [species, query]);
  const chosen = species.find((s) => s.id === speciesId) ?? null;

  // De validatieregels — gedeeld door de submit (alle fouten) en de onBlur-live-check.
  const rules = [
    requiredText('name', t('plant.error.name')),
    when('water', (v) => !!v.speciesId || parseInt(v.waterDays, 10) > 0, t('plant.error.water')),
    visibilityRule('visibility'),
  ];

  const toggleShareWith = (pid) =>
    setValues((v) => ({ ...v, shareWith: toggleValue(v.shareWith, pid) }));

  // Nieuwe-plant-flow: asset bewaren tot opslaan. Foto kiezen via de gedeelde
  // picker (`lib/photoPicker.js`, STR-4) — één codepad voor alle modules/platforms.
  const choosePhoto = () => offerImagePicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });

  const save = async () => {
    if (!validate(rules)) {
      scrollToField(firstErrorField(runRules(values, rules), FIELD_ORDER));
      return;
    }
    setBusy(true);
    try {
      await addPlant({
        name: name.trim(), speciesId, location,
        waterDays: speciesId ? null : parseInt(waterDays, 10),
        visibility, shareSubgroupId, shareWith, photoAsset,
      }, chosen);
      haptics.success();
      router.back();
    } catch (e) {
      haptics.error();
      dialog.alert({ title: t('plant.error.save'), body: e.message });
    } finally { setBusy(false); }
  };

  // ----- Bestaande plant: detail -----
  const [plant, setPlant] = useState(null);
  useEffect(() => {
    if (isNew) return;
    supabase.from('plants').select('*').eq('id', id).single()
      .then(({ data }) => { if (!data) router.back(); else setPlant(data); });
  }, [id]);
  // Hooks vóór de early-return (regels-volgorde): toonbare URL + gedeelde foto-flow + dagboek.
  const { busy: photoBusy, nonce: photoNonce, pick: pickPhoto, refresh: refreshPhoto } = useEntityPhoto({
    onError: (e) => dialog.alert({ title: t('plant.photo.title'), body: e.message ?? t('plant.photo.uploadError') }),
  });
  const detailPhotoUrl = usePlantPhotoUrl(plant?.photo_path, photoNonce);
  const { photos: diary, reload: reloadDiary } = usePlantDiary(plant?.id);

  // Tijdlijnpost-detail (modal): grote foto (indien aanwezig), notitie bewerken,
  // verwijderen.
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  // Weergave van de tijdlijn: 'compact' (rustige rij-rail) of 'photos' (grote foto's,
  // Reddit-stijl). Lokale voorkeur, geen persistentie nodig.
  const [diaryView, setDiaryView] = useState('compact');
  const [noteText, setNoteText] = useState('');
  const selectedPhotoUrl = usePlantPhotoUrl(selectedPhoto?.photo_path);
  useEffect(() => { setNoteText(selectedPhoto?.note ?? ''); }, [selectedPhoto?.id]);

  // Losse notitie toevoegen aan de tijdlijn (zonder foto).
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);
  const saveComposedNote = async () => {
    if (!composeText.trim()) return;
    setComposeBusy(true);
    try {
      await addPlantNote({ householdId: activeId, plantId: plant.id, userId: user.id, note: composeText });
      setComposing(false);
      setComposeText('');
      reloadDiary();
    } catch (e) {
      dialog.alert({ title: t('plant.timeline.noteError'), body: e.message });
    } finally { setComposeBusy(false); }
  };

  // Foto toevoegen aan een bestaande plant: dagboekfoto + meteen de nieuwe omslag.
  const changePhoto = () => pickPhoto(async (asset) => {
    const path = await addPlantPhoto({ householdId: activeId, plantId: plant.id, userId: user.id, asset });
    setPlant((p) => ({ ...p, photo_path: path }));
    reloadDiary();
  });

  const saveNote = async () => {
    if (!selectedPhoto) return;
    // Een notitie-only post zonder tekst heeft geen betekenis (en de DB weigert 'm):
    // leegmaken + bewaren betekent dan "verwijderen".
    if (!selectedPhoto.photo_path && !noteText.trim()) { removeSelectedPhoto(); return; }
    try {
      await updatePlantPhotoNote(selectedPhoto.id, noteText);
      setSelectedPhoto(null);
      reloadDiary();
    } catch (e) {
      dialog.alert({ title: t('plant.timeline.noteError'), body: e.message });
    }
  };

  const removeSelectedPhoto = async () => {
    const ph = selectedPhoto;
    if (!ph) return;
    setSelectedPhoto(null);
    try {
      const newCover = await deletePlantPhoto({ photo: ph, plant });
      setPlant((p) => ({ ...p, photo_path: newCover }));
      refreshPhoto();
      reloadDiary();
    } catch (e) {
      dialog.alert({ title: t('plant.photo.title'), body: e.message ?? t('plant.photo.deleteError') });
    }
  };

  // Verwijder-bevestiging via het eigen dialoogsysteem (UX-6) — één codepad.
  const confirmRemovePhoto = async () => {
    if (await dialog.confirm({
      title: t('plant.photo.delete.title'), body: t('plant.photo.delete.body'),
      confirmLabel: t('common.delete'), cancelLabel: t('common.cancelLong'), tone: 'danger',
    })) removeSelectedPhoto();
  };

  // Bestaande plant bewerken (UX-21): naam/soort/locatie aanpassen via een sheet.
  // Hergebruikt het formulier-state van de nieuw-plant-flow (in detail ongebruikt),
  // voorgevuld uit de plant. updatePlant = c.update (optimistisch + server).
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const openEdit = () => {
    reset({
      ...values,
      name: plant.name ?? '',
      speciesId: plant.species_id ?? null,
      query: species.find((s) => s.id === plant.species_id)?.common_name ?? '',
      location: plant.location ?? null,
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!validate([requiredText('name', t('plant.error.name'))])) return;
    setEditBusy(true);
    try {
      const patch = { name: name.trim(), species_id: speciesId, location };
      await updatePlant(plant.id, patch);
      setPlant((p) => ({ ...p, ...patch }));
      haptics.success();
      setEditing(false);
    } catch (e) {
      dialog.alert({ title: t('plant.error.save'), body: e.message });
    } finally { setEditBusy(false); }
  };

  if (!isNew) {
    if (!plant) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const sp = species.find((s) => s.id === plant.species_id) ?? null;
    const card = careCard(sp, plant.location);
    const plantTasks = tasks.filter((pt) => pt.plant_id === plant.id);
    const toggle = (task) => (task.completed_at ? uncompleteTask(task.id) : completeTask(task));
    // Verwijderen met ongedaan-maken (zelfde patroon als de taak-/uitgave-editor):
    // de plant verdwijnt meteen uit de lijst, de echte delete volgt pas als de toast
    // verloopt. Geen blokkerende Alert — undo is het vangnet en werkt óók op web.
    const confirmRemove = () => {
      markPending(plant.id);
      router.back();
      toast.show({
        message: t('plant.deleted', { name: plant.name }),
        actionLabel: t('common.undo'),
        onAction: () => unmarkPending(plant.id),
        onExpire: async () => {
          try { await removePlant(plant.id); }
          catch (e) { dialog.alert({ title: t('common.failed'), body: e.message }); }
          finally { unmarkPending(plant.id); }
        },
      });
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={plant.name} onClose={() => router.back()} backLabel={backLabelFor('plant')} />
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
          <View style={{ alignItems: 'center', marginVertical: space.lg }}>
            <Pressable onPress={changePhoto} disabled={photoBusy} accessibilityRole="button"
              accessibilityLabel={detailPhotoUrl ? t('plant.photo.change') : t('plant.photo.add')}>
              <View style={{ width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photoBusy
                  ? <ActivityIndicator color={colors.forest} />
                  : detailPhotoUrl
                    ? <Image source={{ uri: detailPhotoUrl }} style={{ width: 88, height: 88 }} />
                    : <Icon name="plants" size={44} color={colors.inkSoft} />}
              </View>
              <Text style={[type.caption, { color: colors.forest, marginTop: space.sm, textAlign: 'center' }]}>
                {detailPhotoUrl ? t('plant.photo.change') : t('plant.photo.add')}
              </Text>
            </Pressable>
            <Text style={[type.h1, { marginTop: 10 }]}>{plant.name}</Text>
            {sp ? <Text style={[type.body, { color: colors.inkSoft }]}>{sp.common_name} · {sp.latin_name}</Text> : null}
            {plant.location ? (
              <Row gap={4} align="center" style={{ marginTop: 2 }}>
                <Icon name="location" size={13} color={colors.inkFaint} />
                <Text style={[type.caption]}>{plant.location}</Text>
              </Row>
            ) : null}
            {/* Zichtbare bewerk-affordance (UX-21): naam/soort/locatie aanpassen. */}
            <Pressable onPress={openEdit} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={t('plant.edit')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.sm, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="settings" size={15} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest, fontFamily: font.semi }]}>{t('plant.edit')}</Text>
            </Pressable>
          </View>

          {/* Verzorgingskaart inklapbaar (standaard open): de altijd-uitgeklapte kaart
              duwde taken en tijdlijn ver naar onderen — inklapbaar haalt je sneller bij
              de actie zonder de info te verliezen. */}
          <Collapsible label={t('plant.careCard')} summary={t('plant.careCard.summary')} defaultOpen>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg }}>
              <CareRow icon="light" label={t('plant.care.light')} value={card.light} />
              <CareRow icon="water" label={t('plant.care.water')} value={card.waterText} />
              <CareRow icon="feed" label={t('plant.care.feed')} value={card.feedText} />
              {card.notes ? <CareRow icon="note" label={t('plant.care.tip')} value={card.notes} /> : null}
            </View>
          </Collapsible>

          {/* Verzorgingstaken (PLA-10): per-plant grip op één plek. Een taakrij opent
              de taak-editor (interval/frequentie/weekdagen/einde aanpassen of pauzeren) —
              vóór PLA-10 viel 'ie via taskHref terug op deze plant zelf (dode tik). De
              "Taak toevoegen"-knop maakt een eigen verzorgingstaak voor deze plant. */}
          <Row justify="space-between" align="center" style={{ marginTop: 20, marginBottom: 8 }}>
            <Text style={type.label}>{t('plant.careTasks')}</Text>
            <Pressable onPress={() => router.push(`/task/new?plant=${plant.id}`)} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={t('plant.careTask.add')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="add" size={16} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]}>{t('plant.careTask.add')}</Text>
            </Pressable>
          </Row>
          {plantTasks.length === 0
            ? <Text style={[type.caption]}>{t('plant.noTasks')}</Text>
            : plantTasks.map((task) => <TaskRow key={task.id} task={task} members={members} onToggle={toggle}
                onPress={() => router.push(`/task/${task.id}`)} />)}

          {/* Tijdlijn: foto's én losse notities over tijd, nieuwste eerst — een
              rustige verticale rail om de groei terug te bladeren. Een foto voeg je
              toe via de cirkel bovenaan; een losse notitie via de knop hiernaast. */}
          <Row justify="space-between" align="center" style={{ marginTop: 20, marginBottom: 8 }}>
            <Text style={type.label}>{t('plant.timeline')}</Text>
            <Pressable onPress={() => setComposing(true)} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={t('plant.timeline.addNote')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="add" size={16} color={colors.forest} />
              <Text style={[type.caption, { color: colors.forest }]}>{t('plant.timeline.addNote')}</Text>
            </Pressable>
          </Row>
          {diary.length === 0 ? (
            <Text style={[type.caption]}>{t('plant.timeline.empty')}</Text>
          ) : (
            <>
              {/* Weergave-toggle (Reddit-stijl): rustige lijst of grote foto's. */}
              <SegmentedControl
                value={diaryView}
                onChange={setDiaryView}
                options={[
                  { value: 'compact', label: t('plant.timeline.view.compact') },
                  { value: 'photos', label: t('plant.timeline.view.photos') },
                ]}
                style={{ marginBottom: space.md }}
              />
              <DiaryTimeline
                photos={diary}
                view={diaryView}
                nameOf={(uid) => members.find((m) => m.id === uid)?.display_name}
                onSelect={setSelectedPhoto}
              />
            </>
          )}

          <Button title={t('plant.deleteButton')} variant="ghost" onPress={confirmRemove} style={{ marginTop: 24 }} />
        </ScrollView>

        {/* Tijdlijnpost-detail: (bij een foto) groot beeld, notitie bewerken,
            verwijderen. De sheet houdt zelf de onderrand vrij van de systeem-
            navigatie en wijkt voor het toetsenbord als je de notitie bewerkt. */}
        <PhotoDetailSheet
          visible={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          title={selectedPhoto?.photo_path ? t('plant.timeline.photo') : t('plant.timeline.note')}
          hasPhoto={!!selectedPhoto?.photo_path}
          imageUrl={selectedPhotoUrl}
          dateText={selectedPhoto ? format(parseISO(selectedPhoto.created_at), 'd MMMM yyyy', { locale: dateLocale() }) : null}
          noteValue={noteText}
          onChangeNote={setNoteText}
          noteLabel={t('plant.field.note')}
          notePlaceholder={t('plant.field.note.placeholder')}
          saveLabel={t('plant.note.save')}
          onSave={saveNote}
          onRemove={confirmRemovePhoto}
        />

        {/* Losse notitie toevoegen aan de tijdlijn (zonder foto). */}
        <BottomSheet visible={composing} onClose={() => setComposing(false)} avoidKeyboard>
          <ModalHeader title={t('plant.timeline.addNote')} onClose={() => setComposing(false)} />
          <SheetScrollView contentContainerStyle={{ paddingHorizontal: 18 }} keyboardShouldPersistTaps="handled">
            <Field label={t('plant.field.note')} value={composeText} onChangeText={setComposeText} multiline
              placeholder={t('plant.field.note.placeholder')} autoFocus style={{ marginBottom: 0 }} />
            <Button title={t('plant.note.save')} onPress={saveComposedNote} loading={composeBusy}
              disabled={!composeText.trim()} style={{ marginTop: space.md }} />
          </SheetScrollView>
        </BottomSheet>

        {/* Plant bewerken (UX-21): naam, soort en locatie. */}
        <BottomSheet visible={editing} onClose={() => setEditing(false)} avoidKeyboard>
          <ModalHeader title={t('plant.edit')} onClose={() => setEditing(false)}
            onConfirm={saveEdit} busy={editBusy} />
          <SheetScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">
            <Field label={t('plant.field.name')} value={name} onChangeText={(v) => setField('name', v)} onBlur={() => validateField(rules, 'name')}
              placeholder={t('plant.field.name.placeholder')} error={errors.name} />

            <Field label={t('plant.field.species')} value={query} onChangeText={(v) => setValues((p) => ({ ...p, query: v, speciesId: null }))}
              placeholder={t('plant.field.species.placeholder')} />
            {query.length > 0 && !speciesId && (
              <View style={{ marginBottom: space.md }}>
                {matches.map((s) => (
                  <Pressable key={s.id} onPress={() => setValues((p) => ({ ...p, speciesId: s.id, query: s.common_name }))}
                    accessibilityRole="button" accessibilityLabel={s.common_name}
                    style={({ pressed }) => ({ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line,
                      backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                    <Text style={type.body}>{s.common_name}</Text>
                    <Text style={type.caption}>{s.latin_name}</Text>
                  </Pressable>
                ))}
                {matches.length === 0 && (
                  <Text style={[type.caption, { paddingVertical: space.sm }]}>{t('plant.species.none')}</Text>
                )}
              </View>
            )}
            {chosen && (
              <Row gap={4} align="center" style={{ marginBottom: 12 }}>
                <Icon name="check" size={14} color={colors.forest} weight="bold" />
                <Text style={[type.caption, { color: colors.forest, flex: 1 }]}>
                  {t('plant.species.chosen', { name: chosen.common_name })}
                </Text>
              </Row>
            )}

            <Text style={[type.label, { marginBottom: 6 }]}>{t('plant.field.location')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LOCATIONS.map((loc) => (
                <Chip key={loc} label={loc} active={location === loc} onPress={() => setField('location', location === loc ? null : loc)} />
              ))}
            </View>
          </SheetScrollView>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  // ----- Nieuwe plant -----
  return (
    <Editor title={t('plant.new')} onClose={() => router.back()} onConfirm={save} busy={busy}
      dirty={fieldsDirty || !!photoAsset} scrollRef={scrollRef}>
          {/* Foto kiezen (camera/bibliotheek) — preview totdat we opslaan. */}
          <View style={{ alignItems: 'center', marginBottom: space.lg }}>
            <Pressable onPress={choosePhoto} accessibilityRole="button"
              accessibilityLabel={photoAsset ? t('plant.photo.change') : t('plant.photo.add')}>
              <View style={{ width: 96, height: 96, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderWidth: 2, borderColor: colors.line }}>
                {photoAsset?.uri
                  ? <Image source={{ uri: photoAsset.uri }} style={{ width: 96, height: 96 }} />
                  : <Icon name="plants" size={40} color={colors.inkSoft} />}
              </View>
            </Pressable>
            <Text style={[type.caption, { color: colors.forest, marginTop: space.sm }]}>
              {photoAsset ? t('plant.photo.change') : t('plant.photo.add')}
            </Text>
            <Text style={type.caption}>{t('plant.photo.optional')}</Text>
          </View>

          <Field label={t('plant.field.name')} value={name} onChangeText={(v) => setField('name', v)} onBlur={() => validateField(rules, 'name')}
            placeholder={t('plant.field.name.placeholder')} error={errors.name} />

          <Field label={t('plant.field.species')} value={query} onChangeText={(v) => setValues((p) => ({ ...p, query: v, speciesId: null }))}
            placeholder={t('plant.field.species.placeholder')} />
          {query.length > 0 && !speciesId && (
            <View style={{ marginBottom: space.md }}>
              {matches.map((s) => (
                <Pressable key={s.id} onPress={() => { setValues((p) => ({ ...p, speciesId: s.id, query: s.common_name })); clearErr('water'); }}
                  accessibilityRole="button" accessibilityLabel={s.common_name}
                  style={({ pressed }) => ({ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line,
                    backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                  <Text style={type.body}>{s.common_name}</Text>
                  <Text style={type.caption}>{s.latin_name}</Text>
                </Pressable>
              ))}
              {matches.length === 0 && (
                <Text style={[type.caption, { paddingVertical: space.sm }]}>
                  {t('plant.species.none')}
                </Text>
              )}
            </View>
          )}
          {chosen && (
            <Row gap={4} align="center" style={{ marginBottom: 12 }}>
              <Icon name="check" size={14} color={colors.forest} weight="bold" />
              <Text style={[type.caption, { color: colors.forest, flex: 1 }]}>
                {t('plant.species.chosen', { name: chosen.common_name })}
              </Text>
            </Row>
          )}

          {!speciesId && (
            <View onLayout={register('water')}>
              <Field label={t('plant.field.water')} value={waterDays}
                onChangeText={(v) => { setField('waterDays', v); clearErr('water'); }}
                onBlur={() => validateField(rules, 'water')}
                placeholder="7" keyboardType="number-pad" error={errors.water} />
            </View>
          )}

          <Text style={[type.label, { marginBottom: 6 }]}>{t('plant.field.location')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {LOCATIONS.map((loc) => (
              <Chip key={loc} label={loc} active={location === loc} onPress={() => setField('location', loc)} />
            ))}
          </View>

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

// Verticale tijdlijn van de plant: elke post (foto of notitie) is een knooppunt op
// een doorlopende rail, nieuwste bovenaan. Rustig terugbladeren door de groei;
// tikken opent het detail-sheet (notitie bewerken / verwijderen).
function DiaryTimeline({ photos, view = 'compact', nameOf, onSelect }) {
  // Grote-foto-weergave (Reddit-stijl): elke post als ruime kaart, los van de rail.
  if (view === 'photos') {
    return (
      <View>
        {photos.map((ph) => (
          <TimelinePhotoCard key={ph.id} photo={ph} nameOf={nameOf} onPress={() => onSelect(ph)} />
        ))}
      </View>
    );
  }
  // Compacte weergave: rustige verticale rail.
  return (
    <View>
      {photos.map((ph, i) => (
        <TimelineEntry
          key={ph.id}
          photo={ph}
          first={i === 0}
          last={i === photos.length - 1}
          nameOf={nameOf}
          onPress={() => onSelect(ph)}
        />
      ))}
    </View>
  );
}

// Grote kaart voor de "Groot"-weergave. Een foto-post toont het vol-bleed beeld; een
// notitie-only post is géén nep-beeld maar een duidelijke tekstkaart met de notitie
// groot en leesbaar. Datum + wie het plaatste staan eronder.
function TimelinePhotoCard({ photo, nameOf, onPress }) {
  const isNote = !photo.photo_path;
  const url = usePlantPhotoUrl(photo.photo_path);
  const dateLabel = format(parseISO(photo.created_at), 'd MMMM yyyy', { locale: dateLocale() });
  const author = nameOf?.(photo.created_by);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isNote ? t('plant.timeline.note') : t('plant.timeline.photo')} · ${dateLabel}`}
      style={({ pressed }) => ({ marginBottom: space.lg, opacity: pressed ? 0.85 : 1 })}
    >
      {isNote ? (
        // Notitie-only: een leesbare tekstkaart i.p.v. een beeld-placeholder. De notitie
        // staat hier groot; daarom wordt 'ie in de voet niet nog eens herhaald.
        <View style={{ backgroundColor: colors.forestTint, borderRadius: radius.md, padding: space.lg }}>
          <Row gap={space.xs} align="center" style={{ marginBottom: space.sm }}>
            <Icon name="note" size={18} color={colors.brandText} />
            <Text style={[type.label, { color: colors.brandText }]}>{t('plant.timeline.note')}</Text>
          </Row>
          <Text style={[type.bodyLg, { color: colors.ink }]}>{photo.note || t('plant.timeline.noNote')}</Text>
        </View>
      ) : url ? (
        <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plants" size={32} color={colors.inkFaint} />
        </View>
      )}
      <View style={{ marginTop: space.sm }}>
        <Row justify="space-between" align="center" gap={space.sm}>
          <Text style={[type.title, { fontSize: 15, flex: 1 }]}>{dateLabel}</Text>
          {author ? <Text style={type.caption}>{t('plant.timeline.by', { name: author })}</Text> : null}
        </Row>
        {/* Bij een foto-post de notitie eronder; bij een notitie-only post staat 'ie al in de kaart. */}
        {!isNote && photo.note ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>{photo.note}</Text> : null}
      </View>
    </Pressable>
  );
}

// Maatvoering van de rail: de stip zit op DOT_TOP zodat 'ie verticaal uitlijnt met
// het midden van de kaart-thumbnail; de lijn loopt er doorheen naar boven en onder.
const TL_RAIL = 28;
const TL_DOT = 14;
const TL_DOT_TOP = 36;

function TimelineEntry({ photo, first, last, nameOf, onPress }) {
  const isNote = !photo.photo_path; // notitie-only post (geen foto)
  const url = usePlantPhotoUrl(photo.photo_path);
  const dateLabel = format(parseISO(photo.created_at), 'd MMMM yyyy', { locale: dateLocale() });
  const author = nameOf?.(photo.created_by);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isNote ? t('plant.timeline.note') : t('plant.timeline.photo')} · ${dateLabel}`}
      style={({ pressed }) => ({ flexDirection: 'row', opacity: pressed ? 0.7 : 1 })}
    >
      {/* Rail-kolom: doorlopende lijn (boven/onder het knooppunt) + de stip. */}
      <View style={{ width: TL_RAIL, alignItems: 'center' }}>
        {/* Absolute kinderen negeren `alignItems`, dus de lijn expliciet centreren (left). */}
        {!first ? <View style={{ position: 'absolute', top: 0, left: TL_RAIL / 2 - 1, height: TL_DOT_TOP, width: 2, backgroundColor: colors.line }} /> : null}
        {!last ? <View style={{ position: 'absolute', top: TL_DOT_TOP, bottom: 0, left: TL_RAIL / 2 - 1, width: 2, backgroundColor: colors.line }} /> : null}
        <View style={{
          marginTop: TL_DOT_TOP - TL_DOT / 2,
          width: TL_DOT, height: TL_DOT, borderRadius: TL_DOT / 2,
          backgroundColor: colors.forest, borderWidth: 3, borderColor: colors.bg,
        }} />
      </View>
      {/* Inhoud: kaart met thumbnail, datum en (optioneel) notitie. */}
      <View style={{ flex: 1, paddingBottom: space.md }}>
        <View style={{
          flexDirection: 'row', gap: space.md, alignItems: 'center',
          backgroundColor: colors.surface, borderRadius: radius.md,
          borderWidth: 1, borderColor: colors.line, padding: space.sm,
        }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden',
            backgroundColor: isNote ? colors.forestPressed : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            {isNote
              ? <Icon name="note" size={22} color={colors.onDark} />
              : url ? <Image source={{ uri: url }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                : <Icon name="plants" size={20} color={colors.inkSoft} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { fontSize: 15 }]}>{dateLabel}</Text>
            {/* Geen "Geen notitie"-ruis meer: zonder notitie tonen we alleen datum + wie. */}
            {photo.note
              ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]} numberOfLines={2}>{photo.note}</Text>
              : null}
            {author ? <Text style={[type.caption, { marginTop: 2 }]}>{t('plant.timeline.by', { name: author })}</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CareRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }}>
      <View style={{ width: 96, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name={icon} size={16} color={colors.inkSoft} />
        <Text style={type.label}>{label}</Text>
      </View>
      <Text style={[type.body, { flex: 1 }]}>{value}</Text>
    </View>
  );
}
