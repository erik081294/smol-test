import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
// nooit oprekken. Faalt de manipulator (bv. native module ontbreekt in een oudere build),
// val dan stil terug op het originele asset — de resize is een optimalisatie, geen vereiste.
async function downscaleAsset(a, maxSize) {
  const longest = Math.max(a.width ?? 0, a.height ?? 0);
  if (!longest || longest <= maxSize) return rawAsset(a);
  try {
    const action = (a.width ?? 0) >= (a.height ?? 0)
      ? { resize: { width: maxSize } }
      : { resize: { height: maxSize } };
    const out = await ImageManipulator.manipulateAsync(a.uri, [action], {
      compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return out?.base64 ? { uri: out.uri, base64: out.base64, ext: 'jpg' } : rawAsset(a);
  } catch {
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
  const options = [
    { label: t('photo.camera'), icon: 'photo' },
    { label: t('photo.library'), icon: 'library' },
    ...(allowRemove ? [{ label: t('common.remove'), icon: 'delete', tone: 'danger' }] : []),
  ];
  const idx = await dialog.menu({ title: t('photo.source.title'), options });
  if (idx == null) return;
  if (idx <= 1) {
    const a = await pickImageAsset(idx === 0, { quality }); // 0 = camera, 1 = bibliotheek
    if (a) onPicked(a);
  } else {
    onRemove?.();
  }
}
