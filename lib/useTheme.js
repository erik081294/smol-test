import { useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { applyTheme } from './theme';
import { getThemePrefs, subscribeThemePrefs } from './themePrefs';

// Effectieve thema-modus ('licht' | 'donker') uit de voorkeur (systeem|licht|donker)
// gecombineerd met het apparaat-schema. Past het palet toe via applyTheme() en geeft
// de modus terug; gebruik die als key-suffix op de root (key={`${lang}-${mode}`}) zodat
// de boom remount en alle `colors.x`-referenties de nieuwe waarden lezen — hetzelfde
// patroon als de bestaande taalwissel met key={lang}.
function resolve(pref) {
  if (pref === 'licht' || pref === 'donker') return pref;
  return Appearance.getColorScheme() === 'dark' ? 'donker' : 'licht';
}

export function useTheme() {
  // Init synchroon op het apparaat-schema (voorkomt een flits); de opgeslagen
  // voorkeur corrigeert zo nodig zodra die geladen is.
  const [mode, setMode] = useState(() => {
    const eff = resolve('systeem');
    applyTheme(eff);
    return eff;
  });

  useEffect(() => {
    let pref = 'systeem';
    const update = () => {
      const eff = resolve(pref);
      applyTheme(eff);
      setMode(eff);
    };
    getThemePrefs().then((p) => { pref = p.mode; update(); });
    const unsub = subscribeThemePrefs((p) => { pref = p.mode; update(); });
    const sub = Appearance.addChangeListener(update); // reageert op systeem-wissel (dag/nacht)
    return () => { unsub(); sub?.remove?.(); };
  }, []);

  return mode;
}
