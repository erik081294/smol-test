import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useTasks } from './useTasks';
import { useMealPlan } from './useMealPlan';
import { usePantry } from './usePantry';
import { allReminders } from './notifications';
import { getPrefs, subscribePrefs, NOTIF_DEFAULTS } from './notificationPrefs';

// Impure laag van de herinneringen (PLT-1, trap 1). Vraagt permissie, en (her)plant
// lokale notificaties op basis van de pure allReminders() telkens als de data of de
// voorkeuren wijzigen. Web/zonder hardware = stil no-op. Mount één keer (ingelogd).
const MAX = 60; // OS-limieten respecteren

export function useNotifications() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { entries: meals } = useMealPlan(new Date());
  const { items: pantry } = usePantry();
  const [prefs, setPrefsState] = useState(NOTIF_DEFAULTS);
  const [granted, setGranted] = useState(false);

  // Voorkeuren laden + op wijzigingen abonneren.
  useEffect(() => {
    let on = true;
    getPrefs().then((p) => { if (on) setPrefsState(p); });
    const unsub = subscribePrefs((p) => setPrefsState(p));
    return () => { on = false; unsub(); };
  }, []);

  // Permissie + handler + Android-kanaal (alleen mobiel).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
      }),
    });
    (async () => {
      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted' && prefs.enabled) {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        setGranted(status === 'granted');
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Herinneringen', importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
      } catch { /* permissie/feature niet beschikbaar → stil */ }
    })();
  }, [prefs.enabled]);

  // Remote push (trap 2, best-effort): registreer het Expo-token voor deze
  // gebruiker zodra permissie er is. Faalt stil als de tabel (0018) nog niet live
  // is of er geen EAS-projectId is. De Edge Function `notify` gebruikt het token.
  useEffect(() => {
    if (Platform.OS === 'web' || !granted || !user || !Device.isDevice) return;
    (async () => {
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId
          ?? Constants?.easConfig?.projectId;
        if (!projectId) return;
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!data) return;
        await supabase.from('push_tokens')
          .upsert({ profile_id: user.id, token: data, platform: Platform.OS }, { onConflict: 'profile_id,token' });
      } catch { /* token-registratie is niet kritisch */ }
    })();
  }, [granted, user]);

  // (Her)plan idempotent: alles wissen en opnieuw plannen op basis van de pure set.
  useEffect(() => {
    if (Platform.OS === 'web' || !granted) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (!prefs.enabled) return;
        const reminders = allReminders({ tasks, meals, pantry }, prefs, new Date()).slice(0, MAX);
        for (const r of reminders) {
          if (cancelled) break;
          await Notifications.scheduleNotificationAsync({
            identifier: r.id,
            content: { title: r.title, body: r.body },
            trigger: r.fireAt,
          });
        }
      } catch { /* plannen niet kritisch */ }
    })();
    return () => { cancelled = true; };
  }, [granted, prefs, tasks, meals, pantry]);
}
