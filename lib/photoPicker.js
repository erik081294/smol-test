import * as ImagePicker from 'expo-image-picker';
import { parseDataUrl, extFromUri } from './plantPhoto';
import { dialog } from './dialog';
import { t } from './i18n';

// Gedeelde foto-picker (STR-4): kies een foto uit camera/bibliotheek en geef een
// genormaliseerd asset terug — { uri, base64, ext } — of null bij annuleren/weigeren.
// Géén state-effect, zodat zowel "bewaar tot opslaan" als "meteen uploaden" werkt.
// Gebruikt door alle foto-schermen: plant, huisdier, recept en de bon-scan.
export async function pickImageAsset(camera, { quality = 0.6 } = {}) {
  try {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Op web is permission soms een no-op; alleen blokkeren als expliciet geweigerd.
    if (perm?.granted === false) { dialog.alert({ title: t('photo.noAccess') }); return null; }
    const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launch({ mediaTypes: ['images'], quality, base64: true });
    if (res.canceled) return null;
    const a = res.assets[0];
    // Native levert base64 + file://-uri; web vaak een data-URL.
    const data = parseDataUrl(a.uri);
    const base64 = a.base64 ?? data?.base64 ?? null;
    const ext = data?.ext ?? extFromUri(a.uri);
    if (!base64) { dialog.alert({ title: t('photo.readError') }); return null; }
    return { uri: a.uri, base64, ext };
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
