import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { Notifications, Device, hasNotifications } from './optionalNotifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { rememberPushToken } from './pushTokenRegistry';
import { useAuth } from './auth';
import { useReminderSources } from './useReminderSources';
import { allReminders, remindersSignature } from './notifications';
import { getPrefs, subscribePrefs, NOTIF_DEFAULTS } from './notificationPrefs';

// Impure laag van de herinneringen (PLT-1, trap 1). Vraagt permissie, en (her)plant
// lokale notificaties op basis van de pure allReminders() telkens als de data of de
// voorkeuren wijzigen. Web/zonder hardware = stil no-op. Mount één keer (ingelogd).
const MAX = 60; // OS-limieten respecteren

export function useNotifications() {
  const { user } = useAuth();
  // ARCH-2: bron-data via de capability-laag i.p.v. directe zusterhook-imports.
  const { tasks, meals, pantry } = useReminderSources();
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
    if (Platform.OS === 'web' || !hasNotifications) return;
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
    if (Platform.OS === 'web' || !hasNotifications || !granted || !user || !Device.isDevice) return;
    (async () => {
      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId
          ?? Constants?.easConfig?.projectId;
        if (!projectId) return;
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!data) return;
        await supabase.from('push_tokens')
          .upsert({ profile_id: user.id, token: data, platform: Platform.OS }, { onConflict: 'profile_id,token' });
        // Onthoud het token zodat signOut de eigen rij kan opruimen (Plat-1).
        rememberPushToken(data);
      } catch { /* token-registratie is niet kritisch */ }
    })();
  }, [granted, user]);

  // (Her)plan idempotent: alles wissen en opnieuw plannen op basis van de pure set.
  // Debounce (PERF-8): tasks/meals/pantry wijzigen vaak in bursts (koud laden, realtime-
  // echo's, een reeks afvinkacties). Zonder demping zou elke wijziging een dure
  // cancelAll + herplanning van tot MAX notificaties triggeren. Eén timer collapse't de
  // burst tot één herplanning; de cleanup annuleert een nog-niet-gevuurde timer.
  //
  // Signature-guard (P1): tasks/meals/pantry krijgen bij élke realtime-reload een nieuwe
  // array-identiteit, óók als de inhoud gelijk blijft. Zonder deze check zou dat elke keer
  // een cancelAll + tot MAX scheduleNotificationAsync-calls doen. We plannen alleen opnieuw
  // als de berekende set inhoudelijk wijzigt (remindersSignature).
  const lastSigRef = useRef(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !hasNotifications || !granted) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const reminders = prefs.enabled
          ? allReminders({ tasks, meals, pantry }, prefs, new Date()).slice(0, MAX)
          : [];
        const sig = `${prefs.enabled ? '1' : '0'}:${remindersSignature(reminders)}`;
        if (sig === lastSigRef.current) return; // niets inhoudelijk gewijzigd → geen herplan
        await Notifications.cancelAllScheduledNotificationsAsync();
        for (const r of reminders) {
          if (cancelled) break;
          await Notifications.scheduleNotificationAsync({
            identifier: r.id,
            content: { title: r.title, body: r.body },
            trigger: r.fireAt,
          });
        }
        if (!cancelled) lastSigRef.current = sig; // pas onthouden na een geslaagde (volledige) herplan
      } catch { /* plannen niet kritisch */ }
    }, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [granted, prefs, tasks, meals, pantry]);
}
