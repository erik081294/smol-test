import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseDataUrl, extFromUri } from './plantPhoto';
import { dialog } from './dialog';
import { t } from './i18n';

// Het originele asset zonder downscale, in onze genormaliseerde vorm.
function rawAsset(a) {
  const data = parseDataUrl(a.uri);
  return { uri: a.uri, base64: a.base64 ?? data?.base64 ?? null, ext: data?.ext ?? extFromUri(a.uri) };
}

// Downscale grote foto's bij de bron (PERF-7): telefoonfoto's zijn al snel 4000×3000px,
// wat in fotorijke lijsten decode-hitches/OOM geeft en de upload onnodig groot maakt.
// Schaal de langste zijde naar `maxSize` en her-encodeer als JPEG. Alleen verkleinen,
// nooit oprekken.
//
// expo-image-manipulator is een NATIVE module: importeren we 'm bovenaan, dan crasht
// élk scherm dat photoPicker gebruikt op een build die de module (nog) niet gelinkt heeft
// ("Cannot find native module 'ExpoImageManipulator'"). Daarom lazy `require` binnen een
// try/catch — photoPicker laadt altijd, en bij een ontbrekende module (of fout) vallen we
// stil terug op het originele asset. De resize activeert vanzelf zodra een dev-build de
// module bevat; de resize is een optimalisatie, geen vereiste.
//
// Faalt de require/manipulatie één keer (module ontbreekt in deze build), dan onthouden
// we dat: elke vólgende foto slaat de native poging meteen over. Zo blijft het bij hooguit
// één dev-redbox per sessie i.p.v. één per foto, en doen we geen zinloze her-requires.
let manipulatorUnavailable = false;
async function downscaleAsset(a, maxSize) {
  const longest = Math.max(a.width ?? 0, a.height ?? 0);
  if (!longest || longest <= maxSize || manipulatorUnavailable) return rawAsset(a);
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const action = (a.width ?? 0) >= (a.height ?? 0)
      ? { resize: { width: maxSize } }
      : { resize: { height: maxSize } };
    const out = await ImageManipulator.manipulateAsync(a.uri, [action], {
      compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return out?.base64 ? { uri: out.uri, base64: out.base64, ext: 'jpg' } : rawAsset(a);
  } catch {
    manipulatorUnavailable = true; // module ontbreekt: niet meer proberen deze sessie
    return rawAsset(a);
  }
}

// Gedeelde foto-picker (STR-4): kies een foto uit camera/bibliotheek en geef een
// genormaliseerd asset terug — { uri, base64, ext } — of null bij annuleren/weigeren.
// Géén state-effect, zodat zowel "bewaar tot opslaan" als "meteen uploaden" werkt.
// Gebruikt door alle foto-schermen: plant, huisdier, recept en de bon-scan.
export async function pickImageAsset(camera, { quality = 0.6, maxSize = 1280 } = {}) {
  try {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Op web is permission soms een no-op; alleen blokkeren als expliciet geweigerd.
    if (perm?.granted === false) { dialog.alert({ title: t('photo.noAccess') }); return null; }
    const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launch({ mediaTypes: ['images'], quality, base64: true });
    if (res.canceled) return null;
    // Downscale bij de bron (PERF-7); valt terug op het originele asset bij twijfel.
    // Native levert base64 + file://-uri; web vaak een data-URL.
    const asset = await downscaleAsset(res.assets[0], maxSize);
    if (!asset.base64) { dialog.alert({ title: t('photo.readError') }); return null; }
    return asset;
  } catch (e) {
    dialog.alert({ title: t('photo.error'), body: e?.message });
    return null;
  }
}

// Keuze camera/bibliotheek (+ optioneel verwijderen) via het eigen actiesheet —
// één codepad voor alle platforms (UX-6). `onPicked` krijgt het gekozen asset.
export async function offerImagePicker(onPicked, { allowRemove = false, onRemove, quality = 0.6 } = {}) {
  // PLT-10: de systeem-camera via expo-image-picker is op web-mobile onbetrouwbaar
  // (launchCameraAsync gooit/valt stil) → toon daar alleen de bibliotheek/bestand-keuze.
  // We sturen op `kind` i.p.v. een vaste index, zodat het weglaten van de camera-rij
  // de afhandeling niet verschuift.
  const actions = [
    ...(Platform.OS === 'web' ? [] : [{ label: t('photo.camera'), icon: 'photo', kind: 'camera' }]),
    { label: t('photo.library'), icon: 'library', kind: 'library' },
    ...(allowRemove ? [{ label: t('common.remove'), icon: 'delete', tone: 'danger', kind: 'remove' }] : []),
  ];
  const idx = await dialog.menu({ title: t('photo.source.title'), options: actions });
  if (idx == null) return;
  const kind = actions[idx]?.kind;
  if (kind === 'remove') { onRemove?.(); return; }
  const a = await pickImageAsset(kind === 'camera', { quality });
  if (a) onPicked(a);
}
