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

// Signed URL voor een private foto (default 1 uur). De buckets zijn bewust niet publiek.
export async function signedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

// Hook: opslagpad → toonbare (signed) URL. Herresolved bij pad-wijziging; `refreshKey`
// forceert een verse URL ook als het pad gelijk blijft (vervangen via upsert).
export function useSignedUrl(bucket, path, refreshKey) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    if (!path) { setUrl(null); return undefined; }
    signedUrl(bucket, path).then((u) => { if (on) setUrl(u); });
    return () => { on = false; };
  }, [bucket, path, refreshKey]);
  return url;
}
