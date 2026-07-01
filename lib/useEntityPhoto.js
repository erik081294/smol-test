import { useState, useCallback } from 'react';
import { offerImagePicker } from './photoPicker';

// Gedeelde foto-flow voor een BESTAANDE entiteit (plant/huisdier/recept, en hun tijdlijnen):
// kies een foto → upload meteen → verse signed URL (nonce++) → herlaad. De busy-indicator,
// de nonce (forceert een verse URL bij `useXPhotoUrl(path, nonce)`) en de picker/try-catch-
// plumbing waren per scherm gekopieerd; deze hook bundelt die mechaniek. Wat per module
// verschílt — de uploader (bv. `addPlantPhoto` + `setPlant` + `reloadDiary`) en de
// foutmelding — geeft het scherm mee. De React-schil rond de pure lagen (zie useEntityForm /
// useDiscardGuard); geen mutatietest (net als de andere lib/use*.js).
//
//   const { busy, nonce, pick, refresh } = useEntityPhoto({ onError });
//   const coverUrl = usePlantPhotoUrl(plant?.photo_path, nonce);
//   // wisselen:   pick(async (asset) => { const p = await addPlantPhoto({…, asset}); setPlant(x => ({…x, photo_path: p})); reloadDiary(); });
//   // verwijderen: … await deletePlantPhoto(…); refresh();   (alleen de URL verversen)
export function useEntityPhoto({ onError } = {}) {
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Ververs de getoonde foto-URL (na een upload of verwijdering) zonder verdere plumbing.
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Voer een foto-mutatie uit met busy-guard; bij succes de URL verversen, bij een fout
  // de melding aan het scherm overlaten (module-specifieke tekst).
  const run = useCallback(async (fn) => {
    setBusy(true);
    try { await fn(); setNonce((n) => n + 1); }
    catch (e) { onError?.(e); }
    finally { setBusy(false); }
  }, [onError]);

  // Kies een foto (camera/bibliotheek via de gedeelde picker) → draai de uploader.
  const pick = useCallback((uploader, pickerOptions) => {
    offerImagePicker((asset) => run(() => uploader(asset)), pickerOptions);
  }, [run]);

  return { busy, nonce, refresh, pick, run };
}
