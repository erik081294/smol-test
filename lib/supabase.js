import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

// Op web gebruikt supabase localStorage automatisch; op native AsyncStorage.
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

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
