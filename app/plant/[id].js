import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { usePlants, usePlantSpecies, searchSpecies, usePlantPhotoUrl, addPlantPhoto, usePlantDiary } from '../../lib/usePlants';
import { useTasks } from '../../lib/useTasks';
import { useHousehold } from '../../lib/household';
import { useAuth } from '../../lib/auth';
import { Field, Button, Chip, ModalHeader, Row } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { TaskRow } from '../../lib/TaskRow';
import { colors, radius, type } from '../../lib/theme';
import { VISIBILITY } from '../../lib/constants';
import { VisibilityPicker } from '../../lib/VisibilityPicker';
import { validateVisibility } from '../../lib/visibility';
import { careCard } from '../../lib/plantCare';
import { extFromUri, parseDataUrl } from '../../lib/plantPhoto';

const LOCATIONS = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Balkon', 'Tuin', 'Kantoor'];

export default function PlantScreen() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const router = useRouter();
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
        Alert.alert('Geen toegang', 'Geef toegang tot je foto’s om een plantfoto toe te voegen.'); return null;
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
      if (!base64) { Alert.alert('Foto', 'Kon de afbeelding niet lezen. Probeer een andere foto.'); return null; }
      return { uri: a.uri, base64, ext };
    } catch (e) {
      Alert.alert('Foto', e.message ?? 'Kon de fotokiezer niet openen.');
      return null;
    }
  };

  // Op web werkt een Alert-actiesheet met knoppen niet (de callbacks vuren niet),
  // dus daar openen we direct de bibliotheek. `onPicked` krijgt het gekozen asset.
  const offerPicker = (onPicked, { allowRemove = false, onRemove } = {}) => {
    if (Platform.OS === 'web') { pickAsset(false).then((a) => { if (a) onPicked(a); }); return; }
    Alert.alert('Plantfoto', 'Waarvandaan?', [
      { text: 'Camera', onPress: async () => { const a = await pickAsset(true); if (a) onPicked(a); } },
      { text: 'Bibliotheek', onPress: async () => { const a = await pickAsset(false); if (a) onPicked(a); } },
      ...(allowRemove ? [{ text: 'Verwijderen', style: 'destructive', onPress: onRemove }] : []),
      { text: 'Annuleren', style: 'cancel' },
    ]);
  };

  // Nieuwe-plant-flow: asset bewaren tot opslaan.
  const choosePhoto = () => offerPicker(setPhotoAsset, { allowRemove: !!photoAsset, onRemove: () => setPhotoAsset(null) });

  const save = async () => {
    if (!name.trim()) { Alert.alert('Geef je plant een naam'); return; }
    if (!speciesId && !(parseInt(waterDays, 10) > 0)) {
      Alert.alert('Waterinterval', 'Kies een soort, of vul zelf een waterinterval in dagen in.'); return;
    }
    const visError = validateVisibility({ visibility, shareSubgroupId, shareWith });
    if (visError) { Alert.alert('Delen met', visError); return; }
    setBusy(true);
    try {
      await addPlant({
        name: name.trim(), speciesId, location,
        waterDays: speciesId ? null : parseInt(waterDays, 10),
        visibility, shareSubgroupId, shareWith, photoAsset,
      }, chosen);
      router.back();
    } catch (e) {
      Alert.alert('Kon plant niet opslaan', e.message);
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

  // Foto toevoegen aan een bestaande plant: dagboekfoto + meteen de nieuwe omslag.
  const changePhoto = () => offerPicker(async (asset) => {
    setPhotoBusy(true);
    try {
      const path = await addPlantPhoto({ householdId: activeId, plantId: plant.id, userId: user.id, asset });
      setPlant((p) => ({ ...p, photo_path: path }));
      setPhotoNonce((n) => n + 1); // verse signed URL
      reloadDiary();
    } catch (e) {
      Alert.alert('Foto', e.message ?? 'Uploaden mislukt.');
    } finally { setPhotoBusy(false); }
  });

  if (!isNew) {
    if (!plant) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} />;
    const sp = species.find((s) => s.id === plant.species_id) ?? null;
    const card = careCard(sp, plant.location);
    const plantTasks = tasks.filter((t) => t.plant_id === plant.id);
    const toggle = (t) => (t.completed_at ? uncompleteTask(t.id) : completeTask(t));
    const confirmRemove = () => Alert.alert('Plant verwijderen?', 'De verzorgingstaken verdwijnen ook.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijder', style: 'destructive', onPress: async () => { await removePlant(plant.id); router.back(); } },
    ]);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Terug"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name="back" size={18} color={colors.forest} />
            <Text style={{ fontSize: 16, color: colors.forest }}>Terug</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <TouchableOpacity onPress={changePhoto} activeOpacity={0.8} disabled={photoBusy}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photoBusy
                  ? <ActivityIndicator color={colors.forest} />
                  : detailPhotoUrl
                    ? <Image source={{ uri: detailPhotoUrl }} style={{ width: 88, height: 88 }} />
                    : <Icon name="plants" size={44} color={colors.inkSoft} />}
              </View>
              <Text style={[type.caption, { color: colors.forest, marginTop: 6, textAlign: 'center' }]}>
                {detailPhotoUrl ? 'Foto wijzigen' : 'Foto toevoegen'}
              </Text>
            </TouchableOpacity>
            <Text style={[type.h1, { marginTop: 10 }]}>{plant.name}</Text>
            {sp ? <Text style={[type.body, { color: colors.inkSoft }]}>{sp.common_name} · {sp.latin_name}</Text> : null}
            {plant.location ? (
              <Row gap={4} align="center" style={{ marginTop: 2 }}>
                <Icon name="location" size={13} color={colors.inkFaint} />
                <Text style={[type.caption]}>{plant.location}</Text>
              </Row>
            ) : null}
          </View>

          <Text style={[type.label, { marginBottom: 8 }]}>Verzorgingskaart</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 }}>
            <CareRow icon="light" label="Licht" value={card.light} />
            <CareRow icon="water" label="Water" value={card.waterText} />
            <CareRow icon="feed" label="Voeding" value={card.feedText} />
            {card.notes ? <CareRow icon="note" label="Tip" value={card.notes} /> : null}
          </View>

          <Text style={[type.label, { marginTop: 20, marginBottom: 8 }]}>Verzorgingstaken</Text>
          {plantTasks.length === 0
            ? <Text style={[type.caption]}>Geen gekoppelde taken.</Text>
            : plantTasks.map((t) => <TaskRow key={t.id} task={t} members={members} onToggle={toggle} />)}

          {/* Plantendagboek: foto's over tijd, nieuwste eerst. */}
          <Text style={[type.label, { marginTop: 20, marginBottom: 8 }]}>Dagboek</Text>
          {diary.length === 0 ? (
            <Text style={[type.caption]}>Nog geen foto’s — voeg er een toe via de cirkel hierboven.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {diary.map((ph) => <DiaryThumb key={ph.id} photo={ph} />)}
            </ScrollView>
          )}

          <Button title="Plant verwijderen" variant="ghost" onPress={confirmRemove} style={{ marginTop: 24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- Nieuwe plant -----
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <ModalHeader title="Nieuwe plant" onClose={() => router.back()} />

          {/* Foto kiezen (camera/bibliotheek) — preview totdat we opslaan. */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={choosePhoto} activeOpacity={0.8}>
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderWidth: 2, borderColor: colors.line }}>
                {photoAsset?.uri
                  ? <Image source={{ uri: photoAsset.uri }} style={{ width: 96, height: 96 }} />
                  : <Icon name="plants" size={40} color={colors.inkSoft} />}
              </View>
            </TouchableOpacity>
            <Text style={[type.caption, { color: colors.forest, marginTop: 6 }]}>
              {photoAsset ? 'Foto wijzigen' : 'Foto toevoegen'}
            </Text>
          </View>

          <Field label="Naam" value={name} onChangeText={setName} placeholder="Bijv. Mostafa de Monstera" />

          <Field label="Soort zoeken" value={query} onChangeText={(v) => { setQuery(v); setSpeciesId(null); }}
            placeholder="Typ een soort, bijv. monstera" />
          {query.length > 0 && !speciesId && (
            <View style={{ marginBottom: 12 }}>
              {matches.map((s) => (
                <TouchableOpacity key={s.id} onPress={() => { setSpeciesId(s.id); setQuery(s.common_name); }}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                  <Text style={[type.body]}>{s.common_name}</Text>
                  <Text style={[type.caption]}>{s.latin_name}</Text>
                </TouchableOpacity>
              ))}
              {matches.length === 0 && (
                <Text style={[type.caption, { paddingVertical: 8 }]}>
                  Geen soort gevonden — vul hieronder zelf een waterinterval in.
                </Text>
              )}
            </View>
          )}
          {chosen && (
            <Row gap={4} align="center" style={{ marginBottom: 12 }}>
              <Icon name="check" size={14} color={colors.forest} weight="bold" />
              <Text style={[type.caption, { color: colors.forest, flex: 1 }]}>
                {chosen.common_name} gekozen — schema wordt automatisch ingesteld.
              </Text>
            </Row>
          )}

          {!speciesId && (
            <Field label="Waterinterval (dagen)" value={waterDays} onChangeText={setWaterDays}
              placeholder="7" keyboardType="number-pad" />
          )}

          <Text style={[type.label, { marginBottom: 6 }]}>Locatie</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {LOCATIONS.map((loc) => (
              <Chip key={loc} label={loc} active={location === loc} onPress={() => setLocation(loc)} />
            ))}
          </View>

          <VisibilityPicker
            visibility={visibility} onChangeVisibility={setVisibility}
            shareSubgroupId={shareSubgroupId} onChangeSubgroup={setShareSubgroupId}
            shareWith={shareWith} onToggleMember={toggleShareWith}
            subgroups={subgroups} members={members} />

          <Button title="Plant opslaan" onPress={save} loading={busy} style={{ marginTop: 12 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Eén dagboekfoto. Eigen component zodat de signed-URL-hook per foto kan draaien.
function DiaryThumb({ photo }) {
  const url = usePlantPhotoUrl(photo.photo_path);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <Image source={{ uri: url }} style={{ width: 92, height: 92 }} /> : <Icon name="plants" size={28} color={colors.inkSoft} />}
      </View>
      <Text style={[type.caption, { marginTop: 4 }]}>{format(parseISO(photo.created_at), 'd MMM', { locale: nl })}</Text>
    </View>
  );
}

function CareRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <View style={{ width: 96, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={colors.inkSoft} />
        <Text style={{ color: colors.inkSoft, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      </View>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{value}</Text>
    </View>
  );
}
