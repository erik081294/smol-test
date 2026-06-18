// Haptische feedback — één plek, overal hergebruikt.
//
// Drie semantische signalen i.p.v. de ruwe Expo-API, zodat schermen niet zelf
// over ImpactFeedbackStyle/NotificationFeedbackType hoeven na te denken:
//   • tapLight()  — een lichte tik: afvinken, een keuze maken.
//   • success()   — iets is gelukt: opslaan, voltooien.
//   • error()     — een validatiefout of mislukte actie.
//
// Stilletjes niets doen waar het niet kan: op web (geen trilmotor) en als de
// aanroep om welke reden dan ook gooit. Haptiek is bijzaak; het mag een actie
// nooit blokkeren. Bewust async-fire-and-forget — we wachten nooit op de tik.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn) {
  if (!enabled) return;
  try {
    fn();
  } catch {
    // Geen hardware of geen toestemming — stil overslaan.
  }
}

export const tapLight = () =>
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

export const success = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const error = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
