// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions/* draait op Deno (eigen globals/runtime), niet op de
    // Expo/React-Native-omgeving — lint die niet mee met de app-config.
    ignores: ["dist/*", "supabase/functions/**"],
    rules: {
      // De nieuwe React-19/compiler-regels uit eslint-config-expo 56 markeren
      // idiomatische, wérkende RN-patronen in de kern-UI: `useRef(...).current`
      // tijdens render (react-hooks/refs), een lokale render-helper-component
      // (react-hooks/static-components) en `setState` in een sync-effect
      // (react-hooks/set-state-in-effect). Ze opschonen is waardevol maar een
      // eigen, runtime te valideren slag — voorlopig zichtbaar als "warn" i.p.v.
      // CI-blokkerende "error". De correctheids-vangnetten (no-undef,
      // no-unused-vars, react/jsx-no-undef) blijven onverminderd actief.
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  }
]);
