// React/native-glue rond de pure i18n-kern (lib/i18n.js): de useLang-hook, het
// detecteren van de apparaat-taal bij eerste start, en het persisteren van de
// keuze. Bewust gescheiden van i18n.js zodat dát bestand puur en node-testbaar
// blijft (deze module trekt AsyncStorage + expo-localization aan).

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { getLang, setLang, subscribeLang, SUPPORTED_LANGS } from './i18n';

const STORAGE_KEY = 'huishoek.lang';

// Herrendert componenten bij een taalwijziging. Plaats hoog in de boom (root
// `key={useLang()}`) zodat de hele app hertaalt; losse t()-calls eronder pikken
// de nieuwe taal vanzelf op.
export function useLang() {
  return useSyncExternalStore(subscribeLang, getLang, getLang);
}

// Bij start: opgeslagen keuze wint; anders de apparaat-taal als we die spreken;
// anders de default ('nl'). Fire-and-forget — tot het klaar is staat de UI op nl.
export async function initLocale() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) { setLang(saved); return; }
  } catch {
    // storage onbereikbaar — val door naar detectie
  }
  try {
    const device = Localization.getLocales?.()[0]?.languageCode;
    if (device && SUPPORTED_LANGS.includes(device)) setLang(device);
  } catch {
    // geen localization-module — blijf op de default
  }
}

// De taal wisselen én onthouden. De schakelaar in Huishouden roept dit aan.
export async function setLanguage(l) {
  setLang(l);
  try { await AsyncStorage.setItem(STORAGE_KEY, l); } catch {
    // niet kunnen opslaan is niet fataal; de wissel werkt deze sessie sowieso
  }
}
