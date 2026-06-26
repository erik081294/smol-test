import { useState, useCallback } from 'react';
import * as haptics from './haptics';
import { runRules, isValid } from './formValidation';

// Gedeelde formulier-ruggengraat voor de entity-editors (plant/uitgave/taak/…).
// Vervangt het per-scherm gekopieerde `errors + clearErr + validate + busy`-blok door
// één hook, zodat een nieuwe module-editor geen 20 losse useState's en een eigen
// validatie-steiger meer nodig heeft. De validatie zélf draait via de pure
// runRules() (lib/formValidation.js) — dat is de geteste, ratchet-bewaakte kern;
// deze hook is enkel de dunne React-schil eromheen (zoals elke andere lib/use*.js).
// Zie docs/architectuur.md (ARCH-1).
//
// Twee adoptie-niveaus:
//   1. Volledig — laat de hook óók de veldwaarden beheren (`values` + `setField`).
//      Aanbevolen voor NIEUWE editors.
//   2. Incrementeel — een bestaande editor houdt zijn eigen veld-state en gebruikt
//      alleen `errors` + `clearError` + `busy` + `validate(rules, subject)`. Zo
//      migreert een scherm gedragsneutraal, zonder grote herschrijving.
export function useEntityForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Eén veld zetten en meteen zijn eventuele fout wissen (zo verdwijnt de melding
  // zodra de gebruiker corrigeert).
  const setField = useCallback((key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  // Eén veldfout wissen (voor editors die hun eigen veld-state aanhouden).
  const clearError = useCallback((key) => {
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  // Draai de regels tegen `subject` (default: de interne values), zet de fouten en
  // geef true terug als alles klopt. Bij een fout geven we een haptische foutpuls —
  // exact wat de schermen zelf al deden — zodat migreren niets aan het gedrag verandert.
  const validate = useCallback((rules, subject = values) => {
    const e = runRules(subject, rules);
    setErrors(e);
    const ok = isValid(e);
    if (!ok) haptics.error();
    return ok;
  }, [values]);

  // Valideer → voer de async opslag uit met een busy-guard. Geeft true bij succes,
  // false als de validatie faalde. Een fout uit `fn` gooien we door (de aanroeper
  // toont z'n eigen dialog), maar busy zetten we altijd terug.
  const submit = useCallback(async (rules, fn, subject = values) => {
    if (!validate(rules, subject)) return false;
    setBusy(true);
    try { await fn(subject); return true; }
    finally { setBusy(false); }
  }, [values, validate]);

  return { values, setValues, setField, errors, setErrors, clearError, busy, setBusy, validate, submit };
}
