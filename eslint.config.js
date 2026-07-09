// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    // Globale ignores (los object zónder andere keys, anders geldt het niet globaal):
    // build-output, Deno-edge-functions (eigen runtime/URL-imports), de Claude-
    // skill-scripts (los tooling met eigen deps) en de meegeleverde runtime van de
    // visuele style guide (vendored, geen app-code) horen niet bij de app-lint.
    ignores: [
      "dist/*", "supabase/functions/**", ".claude/**", "reports/**", ".stryker-tmp/**",
      "Huishoek new design system/**",
    ],
  },
  expoConfig,
  {
    rules: {
      // De nieuwe React-19/compiler-regels uit eslint-config-expo 56 markeren
      // idiomatische, wérkende RN-patronen in de kern-UI: `useRef(...).current`
      // tijdens render (react-hooks/refs), een lokale render-helper-component
      // (react-hooks/static-components), `setState` in een sync-effect
      // (react-hooks/set-state-in-effect) en het muteren van een Reanimated
      // `sharedValue.value` binnen een worklet/scroll-handler (react-hooks/
      // immutability — de compiler-analyse modelleert Reanimated shared values
      // niet, zie BottomSheet/SheetScrollView in lib/ui.js). Ze opschonen is
      // waardevol maar een eigen, runtime te valideren slag — voorlopig
      // zichtbaar als "warn" i.p.v. CI-blokkerende "error". De correctheids-
      // vangnetten (no-undef, no-unused-vars, react/jsx-no-undef) blijven
      // onverminderd actief.
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  }
]);
