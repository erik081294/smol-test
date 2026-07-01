// @ts-check
// Pure validatie-runner voor de entity-editors (plant/uitgave/taak/voertuig/…).
// Géén React/Supabase: los te unit-testen en bewaakt door de mutatie-ratchet — de
// schermen leunen op deze logica voor hun foutmeldingen, dus ze hoort onder de tests
// (en niet meer gekopieerd in elk scherm). Zie docs/architectuur.md (ARCH-1).
//
// Een *regel* is een functie (values) => { field, message } | null. runRules draait
// de regels op volgorde en houdt PER VELD de eerste fout vast — zo wint de eerste,
// meest-specifieke melding en stapelen twee regels op één veld niet. De editor levert
// de NL-`message` aan zodat alle teksten via i18n (lib/i18n.js) lopen.

export function runRules(values = {}, rules = []) {
  const errors = {};
  for (const rule of rules) {
    if (typeof rule !== 'function') continue;
    const res = rule(values);
    if (res && res.field && errors[res.field] === undefined) {
      errors[res.field] = res.message;
    }
  }
  return errors;
}

// Een foutobject is 'geldig' als het geen enkel veld bevat.
export function isValid(errors) {
  return Object.keys(errors ?? {}).length === 0;
}

// --- Herbruikbare regel-fabrieken -------------------------------------------
// Elke fabriek geeft een regel terug; `field` is zowel de gelezen sleutel als de
// foutsleutel (bij `when` mogen die verschillen).

// Tekstveld dat niet leeg mag zijn (na trim): naam, omschrijving.
export function requiredText(field, message) {
  return (values) => (String(values?.[field] ?? '').trim() ? null : { field, message });
}

// Strikt positief getal: bedragen (centen), dagen, aantallen. `0`, negatief en NaN falen.
export function positive(field, message) {
  return (values) => (Number(values?.[field]) > 0 ? null : { field, message });
}

// Vrije voorwaarde: legt de fout op `field` als predicate(values) NIET klopt. Voor
// alles wat niet in een standaardregel past — voorwaardelijke velden, niet-lege
// selecties, kruisveld-checks. De fout-`field` mag verschillen van het gelezen veld.
export function when(field, predicate, message) {
  return (values) => (predicate(values) ? null : { field, message });
}

// --- Full-mode-helpers (formulier-fundament) --------------------------------
// Pure hulpjes voor de volwaardige useEntityForm: naar welk veld scrollt de Editor
// bij een gefaalde submit, en is het formulier gewijzigd (discard-guard). Los te
// testen + ratchet-bewaakt, zodat de hook een dunne React-schil blijft.

// Het eerste veld — in de opgegeven prioriteits-volgorde — met een niet-lege fout.
// Zo weet de Editor naar welk veld te scrollen. Een fout die naar `undefined` is
// gewist (clearError) telt niet mee. Is `order` leeg, dan telt de eerste sleutel
// met een fout uit `errors` zelf. Geen enkele fout → null.
export function firstErrorField(errors = {}, order = []) {
  const keys = order.length ? order : Object.keys(errors);
  for (const key of keys) {
    if (errors[key]) return key;
  }
  return null;
}

// Is het formulier gewijzigd t.o.v. de baseline? Vergelijkt via `serialize`
// (default JSON.stringify). De aanroeper mag een genormaliseerde serialisatie
// meegeven (bv. getrimde tekst, datums als 'yyyy-MM-dd') zodat cosmetische
// verschillen niet als 'gewijzigd' tellen.
export function isDirty(current, baseline, serialize = JSON.stringify) {
  return serialize(current) !== serialize(baseline);
}
