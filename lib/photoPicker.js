import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseDataUrl, extFromUri } from './plantPhoto';
import { t } from './i18n';

// Gedeelde foto-picker (STR-4): kies een foto uit camera/bibliotheek en geef een
// genormaliseerd asset terug — { uri, base64, ext } — of null bij annuleren/weigeren.
// Géén state-effect, zodat zowel "bewaar tot opslaan" als "meteen uploaden" werkt.
// (De plant-/bon-schermen hebben nog hun eigen variant; die migreren later hierheen.)
export async function pickImageAsset(camera, { quality = 0.6 } = {}) {
  try {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Op web is permission soms een no-op; alleen blokkeren als expliciet geweigerd.
    if (perm?.granted === false) { Alert.alert(t('photo.noAccess')); return null; }
    const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launch({ mediaTypes: ['images'], quality, base64: true });
    if (res.canceled) return null;
    const a = res.assets[0];
    // Native levert base64 + file://-uri; web vaak een data-URL.
    const data = parseDataUrl(a.uri);
    const base64 = a.base64 ?? data?.base64 ?? null;
    const ext = data?.ext ?? extFromUri(a.uri);
    if (!base64) { Alert.alert(t('photo.readError')); return null; }
    return { uri: a.uri, base64, ext };
  } catch (e) {
    Alert.alert(t('photo.error'), e?.message);
    return null;
  }
}

// Web: een Alert-actiesheet vuurt niet, dus direct de bibliotheek. Native: keuze
// camera/bibliotheek (+ optioneel verwijderen). `onPicked` krijgt het gekozen asset.
export function offerImagePicker(onPicked, { allowRemove = false, onRemove, quality = 0.6 } = {}) {
  if (Platform.OS === 'web') { pickImageAsset(false, { quality }).then((a) => { if (a) onPicked(a); }); return; }
  Alert.alert(t('photo.source.title'), undefined, [
    { text: t('photo.camera'), onPress: async () => { const a = await pickImageAsset(true, { quality }); if (a) onPicked(a); } },
    { text: t('photo.library'), onPress: async () => { const a = await pickImageAsset(false, { quality }); if (a) onPicked(a); } },
    ...(allowRemove ? [{ text: t('common.remove'), style: 'destructive', onPress: onRemove }] : []),
    { text: t('common.cancelLong'), style: 'cancel' },
  ]);
}
