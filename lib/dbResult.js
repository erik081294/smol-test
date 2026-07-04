// @ts-check
// Pure hulplaag onder lib/db.js — géén React/Supabase/RN-imports, dus node-toetsbaar.
// Hier woont de fout-vorm-logica die run()/mutate()/runResult() delen; db.js voegt daar
// alleen de UI-kant (dialog-notify) aan toe. Zo valt het gedrag dat de P0-review raakte
// (fout ≠ leeg) onder de unit-tests + mutatie-ratchet, terwijl db.js zelf (RN-import via
// dialog) buiten de node-testgrens blijft.

/** @param {any} error @returns {string} */
export function describe(error) {
  if (!error) return 'Onbekende fout';
  return error.message || error.hint || String(error);
}

// runResult(): voert een lees-query uit en geeft een gediscrimineerd { data, error } terug
// i.p.v. stil een fallback. Zo kan een hook een échte laadfout (offline/server) onderscheiden
// van "geen data" en de bestaande (gecachete) lijst vasthouden i.p.v. 'm naar leeg te
// overschrijven — de root-cause uit de review van 2026-07-02 (P0). Bij succes is `error` null
// en is `data` de rijen (of null); bij een fout is `data` null en draagt `error` de oorzaak.
/**
 * @template T
 * @param {PromiseLike<{ data: T | null, error: any }>} promise
 * @param {{ context?: string }} [opts]
 * @returns {Promise<{ data: T | null, error: any }>}
 */
export async function runResult(promise, { context = '' } = {}) {
  try {
    const { data, error } = await promise;
    if (error) {
      console.warn(`[Huishoek] Laadfout${context ? ` (${context})` : ''}: ${describe(error)}`);
      return { data: null, error };
    }
    return { data: data ?? null, error: null };
  } catch (e) {
    console.warn(`[Huishoek] Onverwachte fout${context ? ` (${context})` : ''}: ${describe(e)}`);
    return { data: null, error: e };
  }
}
