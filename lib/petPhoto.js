// Pure helpers rond huisdierfoto-opslag. Géén React/Supabase/ImagePicker, zodat ze
// los te unit-testen zijn. Spiegelt lib/plantPhoto.js: de pad-helpers (storagePath/
// diaryPhotoPath) én de extensie-/MIME-/data-URL-helpers zijn domein-onafhankelijk
// (alleen het eerste segment is household_id, de rest een entity-id), dus we
// hergebruiken ze daarvandaan (DRY). Alleen de bucket verschilt per domein.

export {
  storagePath, diaryPhotoPath,
  extFromUri, normalizeExt, parseDataUrl, contentTypeForExt,
} from './plantPhoto';

export const PET_BUCKET = 'pets';
