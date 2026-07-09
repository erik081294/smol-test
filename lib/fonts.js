// De twee merk-letters, op één plek. Alleen de gewichten die het design-systeem
// gebruikt — Bricolage 500/600 voor koppen, Hanken 400/500/600 voor tekst & UI.
// Zwaarder laden we bewust niet: de ronding van Bricolage geeft al warmte, extra
// gewicht maakt het bombastisch (DESIGN.md "Typografie").
//
// Deze map voedt `useFonts()` in app/_layout.js. De sleutels zijn exact de
// fontFamily-namen die `font.*` in lib/theme.js teruggeeft.
//
// We laden de .ttf's uit `assets/fonts/` en NIET uit `@expo-google-fonts/*`. Twee
// redenen, allebei kostten ons een kapotte web-deploy:
//   1. `wrangler pages deploy` slaat élke `node_modules`-map over. Expo exporteert
//      package-assets naar `dist/assets/node_modules/…`, dus die fonts landden nooit
//      op huishoek.app — web viel stil terug op het systeemfont.
//   2. De package-index doet een `require()` per gewicht, dus één import trok alle
//      25 gewichten (1,9 MB) de bundle in i.p.v. de 5 die we gebruiken (388 KB).
//
// Bron: @expo-google-fonts/bricolage-grotesque + /hanken-grotesk (SIL OFL-1.1;
// licenties staan naast de bestanden). Nieuw gewicht nodig? Kopieer de .ttf hierheen.
import BricolageGrotesque_500Medium from '../assets/fonts/BricolageGrotesque_500Medium.ttf';
import BricolageGrotesque_600SemiBold from '../assets/fonts/BricolageGrotesque_600SemiBold.ttf';
import HankenGrotesk_400Regular from '../assets/fonts/HankenGrotesk_400Regular.ttf';
import HankenGrotesk_500Medium from '../assets/fonts/HankenGrotesk_500Medium.ttf';
import HankenGrotesk_600SemiBold from '../assets/fonts/HankenGrotesk_600SemiBold.ttf';

export const FONT_ASSETS = {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
};
