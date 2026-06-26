import { useEffect, useState } from 'react';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { contentTypeForExt } from './plantPhoto';

// Generieke foto-opslag op Supabase Storage, gedeeld door planten (0010) én recepten
// (0034). Het eerste pad-segment is altijd het household_id, zodat de bucket-RLS
// (is_member op storage.foldername(name)[1]) erop kan scopen. De impure picker leeft in
// lib/photoPicker.js; de pad-helpers in lib/plantPhoto.js.

export async function uploadPhoto({ bucket, path, base64, ext }) {
  if (!base64) throw new Error('Geen afbeeldingsdata');
  const { error } = await supabase.storage.from(bucket).upload(
    path, decode(base64), { contentType: contentTypeForExt(ext), upsert: true },
  );
  if (error) throw new Error(error.message);
  return path;
}

// Verwijder één of meer opslag-objecten uit een bucket. Wordt gebruikt om foto's op te
// ruimen wanneer hun parent-record verdwijnt (recept-cover, voertuig-boekjefoto's), zodat
// er geen storage-wezen achterblijven. Best-effort: lege paden slaan we over en een
// mislukte cleanup mag het verwijderen van het record niet blokkeren (vandaar de catch) —
// dezelfde redenering als de bestaande plant/pet-opruiming. De pad-verzameling gebeurt
// puur via collectPhotoPaths (lib/plantPhoto.js).
export async function deletePhotoObjects(bucket, paths) {
  const list = (paths ?? []).filter(Boolean);
  if (list.length === 0) return;
  await supabase.storage.from(bucket).remove(list).catch(() => {});
}

// In-memory cache van uitgegeven signed URLs (sessie-breed). Een feed als de tijdlijn
// toont dezelfde thumbnails herhaaldelijk (scrollen, terug naar de tab); zonder cache
// is dat één createSignedUrl-roundtrip per thumbnail per render — N+1 netwerkcalls bij
// veel foto's. We cachen op (bucket, pad, tag) tot kort vóór de echte expiry.
const _urlCache = new Map(); // key → { url, exp }
const URL_CACHE_MARGIN_MS = 5 * 60 * 1000; // 5 min vóór de echte expiry verversen

function pruneUrlCache(now) {
  for (const [k, v] of _urlCache) if (v.exp <= now) _urlCache.delete(k);
}

// Signed URL voor een private foto (default 1 uur). De buckets zijn bewust niet publiek.
// `cacheTag` scheidt cache-entries voor hetzelfde pad (bv. na een upsert-vervanging →
// verse URL met nieuw token, zodat een CDN-cache op de oude URL niet de oude foto toont).
export async function signedUrl(bucket, path, expiresIn = 3600, cacheTag = '') {
  if (!path) return null;
  const key = `${bucket}:${path}:${cacheTag}`;
  const now = Date.now();
  const hit = _urlCache.get(key);
  if (hit && hit.exp > now) return hit.url;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  const url = data?.signedUrl ?? null;
  if (url) {
    if (_urlCache.size > 500) pruneUrlCache(now); // lichte begrenzing tegen ongebreidelde groei
    _urlCache.set(key, { url, exp: now + expiresIn * 1000 - URL_CACHE_MARGIN_MS });
  }
  return url;
}

// Hook: opslagpad → toonbare (signed) URL. Herresolved bij pad-wijziging; `refreshKey`
// forceert een verse URL ook als het pad gelijk blijft (vervangen via upsert).
export function useSignedUrl(bucket, path, refreshKey) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    if (!path) { setUrl(null); return undefined; }
    // refreshKey als cache-tag: gelijk blijven → cache-hit; wijzigen → verse URL.
    signedUrl(bucket, path, 3600, refreshKey != null ? String(refreshKey) : '').then((u) => { if (on) setUrl(u); });
    return () => { on = false; };
  }, [bucket, path, refreshKey]);
  return url;
}
