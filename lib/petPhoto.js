// Pure helpers rond huisdierfoto-opslag. Géén React/Supabase/ImagePicker, zodat ze
// los te unit-testen zijn. Spiegelt lib/plantPhoto.js; de extensie-/MIME-/data-URL-
// helpers zijn generiek en hergebruiken we daarvandaan (DRY).

export { extFromUri, normalizeExt, parseDataUrl, contentTypeForExt } from './plantPhoto';

export const PET_BUCKET = 'pets';

// Coverfoto-pad binnen de bucket: <household_id>/<pet_id>.<ext>. Het eerste segment
// is het household_id, zodat de storage-RLS (0038) erop kan scopen.
export function storagePath(householdId, petId, ext = 'jpg') {
  return `${householdId}/${petId}.${norm(ext)}`;
}

// Tijdlijn-foto-pad: <household_id>/<pet_id>/<key>.<ext>. Een uniek `key` per foto,
// zodat oude tijdlijnfoto's blijven bestaan. Eerste segment blijft het household_id.
export function diaryPhotoPath(householdId, petId, key, ext = 'jpg') {
  return `${householdId}/${petId}/${key}.${norm(ext)}`;
}

function norm(ext) {
  const e = (ext ?? 'jpg').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}
