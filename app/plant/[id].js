import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Platform, Alert, Image, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import * as haptics from '../../lib/haptics';
import { usePlants, usePlantSpecies, searchSpecies, usePlantPhotoUrl, addPlantPhoto, usePlantDiary, deletePlantPhoto, updatePlantPhotoNote } from '../../lib/usePlants';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Field, Button, Chip, ModalHeader, Row, Editor } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { TaskRow } from '../../lib/TaskRow';
import { colors, radius, type, space } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { validateVisibility } from '../../lib/visibility';
import { careCard } from '../../lib/plantCare';
import { extFromUri, parseDataUrl } from '../../lib/plantPhoto';
import { useToast } from '../../lib/toast';
import { markPending, unmarkPending } from '../../lib/pendingDeletes';
import { t, dateLocale } from '../../lib/i18n';

const LOCATIONS = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Balkon', 'Tuin', 'Kantoor'];

export default function PlantScreen() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { addPlant, removePlant } = usePlants();
  const { species } = usePlantSpecies();
  const { tasks, completeTask, uncompleteTask } = useTasks();
  const { subgroups, members, activeId } = useHousehold();
  const { user } = useAuth();

  // ----- Nieuwe plant: formulier -----
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [speciesId, setSpeciesId] = useState(null);
  const [location, setLocation] = useState(null);
  const [waterDays, setWaterDays] = useState('7');
  const [visibility, setVisibility] = useState(VISIBILITY.HOUSEHOLD);
  const [shareSubgroupId, setShareSubgroupId] = useState(null);
  const [shareWith, setShareWith] = useState([]);
  const [photoAsset, setPhotoAsset] = useState(null); // { uri, base64, ext } of null
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // inline validatie i.p.v. Alert
  const clearErr = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const matches = useMemo(() => searchSpecies(species, query).slice(0, 8), [species, query]);
  const chosen = species.find((s) => s.id === speciesId) ?? null;

  const toggleShareWith = (pid) =>
    setShareWith((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));

  // Kies een foto (bibliotheek of camera) en geef het asset terug, of null bij
  // annuleren/weigeren. Géén state-effect — zo bruikbaar voor zowel de nieuwe
  // plant (asset bewaren tot opslaan) als een bestaande plant (meteen uploaden).
  const pickAsset = async (camera) => {
    try {
      const perm = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      // Op web is permission soms een no-op; alleen blokkeren als expliciet geweigerd.
      if (perm?.granted === false) {
        Alert.alert(t('plant.photo.noAccess.title'), t('plant.photo.noAccess.body')); return null;
      }
      const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      // Geen allowsEditing/aspect: op web niet ondersteund en kan het dialoog blokkeren.
      const res = await launch({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (res.canceled) return null;
      const a = res.assets[0];
      // Native levert base64 + file://-uri; web levert vaak een data-URL.
      const data = parseDataUrl(a.uri);
      const base64 = a.base64 ?? data?.base64 ?? null;
      const ext = data?.ext ?? extFromUri(a.uri);
      if (!base64) { Alert.alert(t('plant.photo.title'), t('plant.photo.readError')); return null; }
      return { uri: a.uri, base64, ext };
    } catch (e) {
      Alert.alert(t('plant.photo.title'), e.message ?? t('plant.photo.openError'));
      return null;
    }
  };

  // Op web werkt een Alert-actiesheet met knoppen niet (de callbacks vuren niet),
  // dus daar openen we direct de bibliotheek. `onPicked` krijgt het gekozen asset.
  const offerPicker = (onPicked, { allowRemove = false, onRemove } = {}) => {
    if (Platform.OS === 'web') { pickAsset(false).then((a) => { if (a) onPicked(a); }); return; }
    Alert.alert(t('plant.photo.source.title'), t('plant.photo.source.body'), [
      { text: t('plant.photo.camera'), onPress: async () => { const a = await pickAsset(true); if (a) onPicked(a); } },
      { text: t('plant.photo.library'), onPress: async () => { const a = await pickAsset(false); if (a) onPicked(a); } },
      ...(allowRemove ? [{ text: t('common.remove'), style: 'destructive', onPress: onRemove }] : []),
      { text: t('common.cancelLong'), style: 'cancel' },
    ]);
  };

  // Nieuwe-plant-flow: asset bewaren tot opslaan.
  const choosePhoto = () => offerPicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });

  const save = async () => {
    const e = {};
    if (!name.trim()) e.name = t('plant.error.name');
    if (!speciesId && !(parseInt(waterDays, 10) > 0)) {
      e.water = t('plant.error.water');
    }
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) e.visibility = visError;
    setErrors(e);
    if (Object.keys(e).length) { haptics.error(); return; }
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
      Alert.alert(t('plant.error.save'), e.message);
    } finally { setBusy(false); }
  };

  // ----- Bestaande plant: detail -----
  const [plant, setPlant] = useState(null);
  useEffect(() => {
    if (isNew) return;
    supabase.from('plants').select('*').eq('id', id).single()
      .then(({ data }) => { if (!data) router.back(); else setPlant(data); });
  }, [id]);
  // Hooks vóór de early-return (regels-volgorde): toonbare URL + busy-state + dagboek.
  const [photoNonce, setPhotoNonce] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const detailPhotoUrl = usePlantPhotoUrl(plant?.photo_path, photoNonce);
  const { photos: diary, reload: reloadDiary } = usePlantDiary(plant?.id);

  // Dagboekfoto-detail (modal): grote foto, notitie bewerken, verwijderen.
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [noteText, setNoteText] = useState('');
  const selectedPhotoUrl = usePlantPhotoUrl(selectedPhoto?.photo_path);
  useEffect(() => { setNoteText(selectedPhoto?.note ?? ''); }, [selectedPhoto?.id]);

  // Foto toevoegen aan een bestaande plant: dagboekfoto + meteen de nieuwe omslag.
  const changePhoto = () => offerPicker(async (asset) => {
    setPhotoBusy(true);
    try {
      const path = await addPlantPhoto({ householdId: activeId, plantId: plant.id, userId: user.id, asset });
      setPlant((p) => ({ ...p, photo_path: path }));
      setPhotoNonce((n) => n + 1); // verse signed URL
      reloadDiary();
    } catch (e) {
      Alert.alert(t('plant.photo.title'), e.message ?? t('plant.photo.uploadError'));
    } finally { setPhotoBusy(false); }
  });

  const saveNote = async () => {
    if (!selectedPhoto) return;
    await updatePlantPhotoNote(selectedPhoto.id, noteText);
    setSelectedPhoto(null);
    reloadDiary();
  };

  const removeSelectedPhoto = async () => {
    const ph = selectedPhoto;
    if (!ph) return;
    setSelectedPhoto(null);
    try {
      const newCover = await deletePlantPhoto({ photo: ph, plant });
      setPlant((p) => ({ ...p, photo_path: newCover }));
      setPhotoNonce((n) => n + 1);
      reloadDiary();
    } catch (e) {
      Alert.alert(t('plant.photo.title'), e.message ?? t('plant.photo.deleteError'));
    }
  };

  // Verwijder-bevestiging: Alert-knoppen vuren niet op web → daar window.confirm.
  const confirmRemovePhoto = () => {
    if (Platform.OS === 'web') {
       
      if (typeof window !== 'undefined' && window.confirm(t('plant.photo.confirmDelete.web'))) removeSelectedPhoto();
      return;
    }
    Alert.alert(t('plant.photo.delete.title'), t('plant.photo.delete.body'), [
      { text: t('common.cancelLong'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: removeSelectedPhoto },
    ]);
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
          catch (e) { Alert.alert(t('common.failed'), e.message); }
          finally { unmarkPending(plant.id); }
        },
      });
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={plant.name} onClose={() => router.back()} />
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
          </View>

          <Text style={[type.label, { marginBottom: space.sm }]}>{t('plant.careCard')}</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg }}>
            <CareRow icon="light" label={t('plant.care.light')} value={card.light} />
            <CareRow icon="water" label={t('plant.care.water')} value={card.waterText} />
            <CareRow icon="feed" label={t('plant.care.feed')} value={card.feedText} />
            {card.notes ? <CareRow icon="note" label={t('plant.care.tip')} value={card.notes} /> : null}
          </View>

          <Text style={[type.label, { marginTop: 20, marginBottom: 8 }]}>{t('plant.careTasks')}</Text>
          {plantTasks.length === 0
            ? <Text style={[type.caption]}>{t('plant.noTasks')}</Text>
            : plantTasks.map((task) => <TaskRow key={task.id} task={task} members={members} onToggle={toggle} />)}

          {/* Plantendagboek: foto's over tijd, nieuwste eerst. */}
          <Text style={[type.label, { marginTop: 20, marginBottom: 8 }]}>{t('plant.diary')}</Text>
          {diary.length === 0 ? (
            <Text style={[type.caption]}>{t('plant.diary.empty')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {diary.map((ph) => <DiaryThumb key={ph.id} photo={ph} onPress={() => setSelectedPhoto(ph)} />)}
            </ScrollView>
          )}

          <Button title={t('plant.deleteButton')} variant="ghost" onPress={confirmRemove} style={{ marginTop: 24 }} />
        </ScrollView>

        {/* Dagboekfoto-detail: groot beeld, notitie bewerken, verwijderen. */}
        <Modal visible={!!selectedPhoto} animationType="slide" transparent onRequestClose={() => setSelectedPhoto(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay ?? '#0008' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 18, paddingBottom: 28 }}>
              <ModalHeader title={t('plant.diary.photo')} onClose={() => setSelectedPhoto(null)} />
              <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden',
                backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                {selectedPhotoUrl
                  ? <Image source={{ uri: selectedPhotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <ActivityIndicator color={colors.forest} />}
              </View>
              {selectedPhoto ? (
                <Text style={[type.caption, { marginTop: 8 }]}>
                  {format(parseISO(selectedPhoto.created_at), 'd MMMM yyyy', { locale: dateLocale() })}
                </Text>
              ) : null}
              <View style={{ marginTop: space.md }}>
                <Field label={t('plant.field.note')} value={noteText} onChangeText={setNoteText} multiline
                  placeholder={t('plant.field.note.placeholder')}
                  style={{ marginBottom: 0 }} />
              </View>
              <Row gap={space.sm} style={{ marginTop: space.md }}>
                <View style={{ flex: 1 }}><Button title={t('common.remove')} icon="delete" variant="ghost" onPress={confirmRemovePhoto} /></View>
                <View style={{ flex: 1 }}><Button title={t('plant.note.save')} onPress={saveNote} /></View>
              </Row>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ----- Nieuwe plant -----
  return (
    <Editor title={t('plant.new')} onClose={() => router.back()} onConfirm={save} busy={busy}>
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

          <Field label={t('plant.field.name')} value={name} onChangeText={(v) => { setName(v); clearErr('name'); }}
            placeholder={t('plant.field.name.placeholder')} error={errors.name} />

          <Field label={t('plant.field.species')} value={query} onChangeText={(v) => { setQuery(v); setSpeciesId(null); }}
            placeholder={t('plant.field.species.placeholder')} />
          {query.length > 0 && !speciesId && (
            <View style={{ marginBottom: space.md }}>
              {matches.map((s) => (
                <Pressable key={s.id} onPress={() => { setSpeciesId(s.id); setQuery(s.common_name); clearErr('water'); }}
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
            <Field label={t('plant.field.water')} value={waterDays}
              onChangeText={(v) => { setWaterDays(v); clearErr('water'); }}
              placeholder="7" keyboardType="number-pad" error={errors.water} />
          )}

          <Text style={[type.label, { marginBottom: 6 }]}>{t('plant.field.location')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {LOCATIONS.map((loc) => (
              <Chip key={loc} label={loc} active={location === loc} onPress={() => setLocation(loc)} />
            ))}
          </View>

          <VisibilityPicker
            collapsible
            visibility={visibility} onChangeVisibility={(v) => { setVisibility(v); clearErr('visibility'); }}
            shareSubgroupId={shareSubgroupId} onChangeSubgroup={(v) => { setShareSubgroupId(v); clearErr('visibility'); }}
            shareWith={shareWith} onToggleMember={(p) => { toggleShareWith(p); clearErr('visibility'); }}
            subgroups={subgroups} members={members} />
          {errors.visibility ? (
            <Text style={[type.caption, { color: colors.danger, marginTop: space.xs }]}>{errors.visibility}</Text>
          ) : null}
    </Editor>
  );
}

// Eén dagboekfoto. Eigen component zodat de signed-URL-hook per foto kan draaien.
// Tikken opent het detail (notitie bewerken / verwijderen). Een hoekje toont of
// er een notitie bij hoort.
function DiaryThumb({ photo, onPress }) {
  const url = usePlantPhotoUrl(photo.photo_path);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('plant.diary.photo')} style={{ alignItems: 'center' }}>
      <View style={{ width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <Image source={{ uri: url }} style={{ width: 92, height: 92 }} resizeMode="cover" /> : <Icon name="plants" size={28} color={colors.inkSoft} />}
        {photo.note ? (
          <View style={{ position: 'absolute', right: space.xs, bottom: space.xs, backgroundColor: colors.forest,
            borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Icon name="note" size={11} color={colors.onDark} />
          </View>
        ) : null}
      </View>
      <Text style={[type.caption, { marginTop: space.xs }]} numberOfLines={1}>{format(parseISO(photo.created_at), 'd MMM', { locale: dateLocale() })}</Text>
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
