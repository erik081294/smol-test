import AsyncStorage from '@react-native-async-storage/async-storage';

// Lokale notificatie-voorkeuren (geen server nodig). Default-on per domein; de
// pure beslislogica (lib/notifications.allReminders) leest deze vorm.
const KEY = 'huishoek.notifPrefs';

export const NOTIF_DEFAULTS = {
  enabled: true,
  leadMinutes: 0,            // X min vóór de vervaltijd
  dailySummaryTime: '08:00', // ook het moment van de voorraad-alert
  mealReminderTime: '16:30',
  taken: true,
  plantzorg: true,
  maaltijden: true,
  voorraad: true,
};

export const withDefaults = (p) => ({ ...NOTIF_DEFAULTS, ...(p || {}) });

// Mini pub/sub zodat de hook live herplant zodra de instellingen wijzigen.
const listeners = new Set();
export const subscribePrefs = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export async function getPrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return withDefaults(raw ? JSON.parse(raw) : {});
  } catch {
    return withDefaults({});
  }
}

export async function setPrefs(patch) {
  const next = withDefaults(patch);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* lokale opslag mag falen */ }
  listeners.forEach((fn) => fn(next));
  return next;
}
