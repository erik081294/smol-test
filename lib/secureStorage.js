// @ts-check
// SEC-3 — hardware-backed sessieopslag voor Supabase op native.
//
// Probleem: de Supabase-sessie (access + refresh token) stond in AsyncStorage =
// onversleutelde sqlite (Android) / plist (iOS) en reisde mee in device-backups.
// Oplossing: bewaar de sessie in expo-secure-store (Keychain/Keystore, hardware-
// backed). SecureStore heeft op Android een ~2048-byte limiet per waarde; een
// sessie-JSON is groter, dus we chunken.
//
// Opzet als "pure kern + impure schil": byteLen/splitByBytes/safeKey zijn puur en
// los unit-getest; expo-secure-store wordt lazy ge-require't (zoals
// lib/optionalNotifications.js) zodat dit bestand ook in node (tests) laadt zonder
// de native module — de require draait alleen op een echt toestel.

// SecureStore staat alleen [A-Za-z0-9._-] toe in keys; normaliseer voor de zekerheid.
export function safeKey(key) {
  return String(key).replace(/[^A-Za-z0-9._-]/g, '_');
}

// UTF-8 byte-lengte van een string, zonder TextEncoder (Hermes-safe).
export function byteLen(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate-paar → 4 bytes
    else n += 3;
  }
  return n;
}

// Splits een string in stukken van elk ≤ maxBytes UTF-8-bytes, zónder een code-point
// (bv. een emoji) doormidden te knippen. Lege invoer → [''].
export function splitByBytes(value, maxBytes) {
  const parts = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of value) { // for..of itereert per code point (emoji = 1 stap)
    const b = byteLen(ch);
    if (curBytes + b > maxBytes && cur) { parts.push(cur); cur = ''; curBytes = 0; }
    cur += ch;
    curBytes += b;
  }
  if (cur || parts.length === 0) parts.push(cur);
  return parts;
}

const CHUNK_BYTES = 1800; // ruime marge onder SecureStore's ~2048-byte limiet
const META = '__n';       // suffix: aantal chunks bij een gechunkte waarde

let SecureStore = null;
function store() {
  // Lazy: pas op het toestel laden; in node (tests) wordt dit nooit aangeroepen.
  if (!SecureStore) SecureStore = require('expo-secure-store');
  return SecureStore;
}

// Storage-adapter met de async getItem/setItem/removeItem die supabase-js verwacht.
export const secureStorage = {
  async getItem(key) {
    const S = store();
    const base = safeKey(key);
    const meta = await S.getItemAsync(base + META);
    if (meta == null) return S.getItemAsync(base); // niet-gechunkt (of afwezig)
    const n = parseInt(meta, 10);
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await S.getItemAsync(`${base}.${i}`);
      if (part == null) return null; // incompleet → behandel als afwezig
      out += part;
    }
    return out;
  },

  async setItem(key, value) {
    const S = store();
    const base = safeKey(key);
    await this.removeItem(key); // ruim eventuele oude (gechunkte) staat eerst op
    if (byteLen(value) <= CHUNK_BYTES) {
      await S.setItemAsync(base, value);
      return;
    }
    const parts = splitByBytes(value, CHUNK_BYTES);
    for (let i = 0; i < parts.length; i++) await S.setItemAsync(`${base}.${i}`, parts[i]);
    await S.setItemAsync(base + META, String(parts.length));
  },

  async removeItem(key) {
    const S = store();
    const base = safeKey(key);
    const meta = await S.getItemAsync(base + META);
    await S.deleteItemAsync(base).catch(() => {});
    if (meta != null) {
      const n = parseInt(meta, 10);
      for (let i = 0; i < n; i++) await S.deleteItemAsync(`${base}.${i}`).catch(() => {});
      await S.deleteItemAsync(base + META).catch(() => {});
    }
  },
};
