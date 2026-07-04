// @ts-check
// Onthoudt welk Expo-push-token dit toestel voor de huidige login registreerde,
// zodat uitloggen de eigen `push_tokens`-rij kan opruimen (privacy: een gedeeld
// of afgedankt toestel mag geen pushes van het oude account blijven ontvangen —
// platform-review 2026-07-04, Plat-1). Los van React/auth om een importcirkel
// auth ⇄ useNotifications te vermijden; de supabase-client komt als argument mee.

let current = null;

/**
 * Bewaar het zojuist geregistreerde token (aangeroepen na de upsert).
 * @param {string|null|undefined} token
 */
export function rememberPushToken(token) {
  current = typeof token === 'string' && token.length > 0 ? token : null;
}

/** Alleen voor tests/diagnose. @returns {string|null} */
export function registeredPushToken() {
  return current;
}

/**
 * Verwijder de eigen token-rij (vóór `auth.signOut()`, zolang de sessie er nog
 * is — RLS staat alleen het wissen van eigen rijen toe). Idempotent en stil:
 * uitloggen mag hier nooit op stranden.
 * @param {{ from: (table: string) => any }} db supabase-client
 * @returns {Promise<void>}
 */
export async function unregisterPushToken(db) {
  const token = current;
  current = null;
  if (!token) return;
  try {
    await db.from('push_tokens').delete().eq('token', token);
  } catch {
    // Offline of tabel niet live: stil overslaan — het token sterft dan via
    // DeviceNotRegistered-opruiming in de notify-functie.
  }
}
