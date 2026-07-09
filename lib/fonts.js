// De twee merk-letters, op één plek. Alleen de gewichten die het design-systeem
// gebruikt — Bricolage 500/600 voor koppen, Hanken 400/500/600 voor tekst & UI.
// Zwaarder laden we bewust niet: de ronding van Bricolage geeft al warmte, extra
// gewicht maakt het bombastisch (DESIGN.md "Typografie").
//
// Deze map voedt `useFonts()` in app/_layout.js. De sleutels zijn exact de
// fontFamily-namen die `font.*` in lib/theme.js teruggeeft.
import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';

export const FONT_ASSETS = {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
};
