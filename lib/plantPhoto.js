// @ts-check
// Pure helpers rond plantfoto-opslag. Géén React/Supabase/ImagePicker hier, zodat
// ze los te unit-testen zijn. De impure delen (kiezen, uploaden, signed URL) leven
// in lib/usePlants.js resp. het plant-scherm.

export const PLANT_BUCKET = 'plants';

// Opslagpad binnen de bucket: <household_id>/<plant_id>.<ext>. Het eerste segment
// is het household_id, zodat de storage-RLS (0010) er op kan scopen.
export function storagePath(householdId, plantId, ext = 'jpg') {
  return `${householdId}/${plantId}.${normalizeExt(ext)}`;
}

// Dagboek-opslagpad: <household_id>/<plant_id>/<key>.<ext>. Een uniek `key`
// (bijv. een timestamp) per foto, zodat oude dagboekfoto's blijven bestaan.
// Eerste segment blijft het household_id (storage-RLS scopet daarop).
export function diaryPhotoPath(householdId, plantId, key, ext = 'jpg') {
  return `${householdId}/${plantId}/${key}.${normalizeExt(ext)}`;
}

// Extensie uit een uri/filename (lowercase, zonder punt); valt terug op 'jpg'.
export function extFromUri(uri, fallback = 'jpg') {
  const m = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(uri ?? '');
  return normalizeExt(m ? m[1] : fallback);
}

export function normalizeExt(ext) {
  const e = (ext ?? 'jpg').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

// Web: de image-picker geeft soms een data-URL (data:image/png;base64,XXXX) en
// geen los base64-veld. Haal daar het base64-deel + de extensie uit. null als het
// geen base64 data-URL is.
export function parseDataUrl(uri) {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(uri ?? '');
  if (!m) return null;
  return { ext: normalizeExt(m[1]), base64: m[2] };
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

// MIME-type voor een extensie; default image/jpeg.
export function contentTypeForExt(ext) {
  return MIME[normalizeExt(ext)] ?? 'image/jpeg';
}

// Verzamel de unieke, niet-lege opslagpaden uit een set records (dagboek-/log-rijen),
// zodat hun foto's in één keer uit storage te verwijderen zijn als de parent verdwijnt
// (recept/voertuig). Pure tegenhanger van de impure deletePhotoObjects (photoStorage.js):
// filtert lege/ontbrekende paden weg en ontdubbelt (bv. een omslag die ook een dagboek-
// rij is). `field` is de kolomnaam (default 'photo_path').
export function collectPhotoPaths(rows, field = 'photo_path') {
  const seen = new Set();
  for (const r of rows ?? []) {
    const p = r?.[field];
    if (p) seen.add(p);
  }
  return [...seen];
}
