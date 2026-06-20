import AsyncStorage from '@react-native-async-storage/async-storage';

// Beeldstijl-voorkeur (lokaal). De keuze wordt nu al bewaard, maar nog niet
// toegepast: een werkende donkere modus vraagt eerst het hele palet (lib/theme.js)
// achter een theme-context te zetten — dat is een aparte, latere slag. Deze pref is
// de scaffold zodat dark mode straks alleen nog "aangezet" hoeft te worden.
const KEY = 'huishoek.themePrefs';

export const THEME_MODES = ['systeem', 'licht', 'donker'];
export const THEME_DEFAULTS = { mode: 'systeem' };

export const withDefaults = (p) => ({ ...THEME_DEFAULTS, ...(p || {}) });

const listeners = new Set();
export const subscribeThemePrefs = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export async function getThemePrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return withDefaults(raw ? JSON.parse(raw) : {});
  } catch {
    return withDefaults({});
  }
}

export async function setThemePrefs(patch) {
  const next = withDefaults(patch);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* lokale opslag mag falen */ }
  listeners.forEach((fn) => fn(next));
  return next;
}
