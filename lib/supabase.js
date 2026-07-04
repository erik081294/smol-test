import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { secureStorage } from './secureStorage';

// Lees uit app.json -> expo.extra, of uit env. Vul je eigen project in (.env).
const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Huishoek] Supabase niet geconfigureerd. Zet EXPO_PUBLIC_SUPABASE_URL en ' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY in een .env bestand (zie .env.example).'
  );
}

// Op web gebruikt supabase localStorage automatisch (undefined). Op native bewaren
// we de sessie in SecureStore (hardware-backed) i.p.v. het onversleutelde
// AsyncStorage (SEC-3). Een sessie die ooit in AsyncStorage stond, wordt bij de
// eerste lees eenmalig gemigreerd en daar gewist — zo verdwijnt het oude,
// onversleutelde token (en lekt het niet meer via device-backups).
const nativeStorage = {
  async getItem(key) {
    const secure = await secureStorage.getItem(key);
    if (secure != null) return secure;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy != null) {
      await secureStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }
    return null;
  },
  setItem: (key, value) => secureStorage.setItem(key, value),
  removeItem: (key) => secureStorage.removeItem(key),
};

const storage = Platform.OS === 'web' ? undefined : nativeStorage;

export const supabase = createClient(
  SUPABASE_URL ?? 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY ?? 'placeholder',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Voor calls die buiten supabase-js om moeten (SSE-streaming naar een edge
// function: functions.invoke kan geen ReadableStream teruggeven).
export const supabaseUrl = SUPABASE_URL ?? '';
export const supabaseAnonKey = SUPABASE_ANON_KEY ?? '';
