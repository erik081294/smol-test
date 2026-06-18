// Lichtgewicht i18n — in-house, geen zware dep.
//
// `t(key, vars?)` zoekt een string op in de actieve taal, valt terug op de
// sleutel zélf als die ontbreekt (zichtbaar in de UI i.p.v. een crash), en vult
// {naam}-placeholders. We beginnen met alleen `nl`; locale-detectie via
// expo-localization komt later (default blijft `nl`). Datum/tijd loopt al via
// date-fns/locale.
//
// Sleutelconventie: `domein.subdomein.naam` (`task.add`, `expense.split.equal`).
// Regel: nieuwe code gebruikt t(...); bestaande schermen migreren we incrementeel.

const DICT = {
  nl: {
    // Gedeeld
    'common.all': 'Alle',
    'common.cancel': 'Annuleer',
    'common.save': 'Opslaan',
    'common.delete': 'Verwijder',

    // Taken-scherm
    'tasks.title': 'Taken',
    'tasks.subtitle': 'Alles wat er te doen is in huis.',
    'tasks.filter.open': 'Open',
    'tasks.filter.done': 'Afgerond',
    'tasks.empty.open.title': 'Geen open taken',
    'tasks.empty.open.subtitle': 'Voeg een taak toe met de + knop.',
    'tasks.empty.done.title': 'Nog niets afgerond',
    'tasks.empty.done.subtitle': 'Afgevinkte taken verschijnen hier.',

    // Taak (gedeeld met editor)
    'task.add': 'Taak toevoegen',

    // Klussen
    'chores.library': 'Klus-bibliotheek',
  },
};

let lang = 'nl';

export function setLang(l) {
  if (DICT[l]) lang = l;
}

export function getLang() {
  return lang;
}

// Voor tests en latere talen: een (deel-)dictionary registreren of aanvullen.
export function registerDict(l, dict) {
  DICT[l] = { ...(DICT[l] ?? {}), ...dict };
}

export function t(key, vars) {
  const table = DICT[lang] ?? {};
  let str = table[key];
  if (str == null) str = key; // zichtbare fallback: liever de sleutel dan leeg/crash
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  }
  return str;
}

// Eenvoudige pluralisatie: kies de 'één'- of 'meer'-sleutel op basis van n, en
// geef n als {n}-var door. Genoeg voor NL ("1 deelnemer" vs "3 deelnemers");
// til pas op naar ICU/intl als een taal met complexere regels echt komt.
export function plural(n, oneKey, otherKey, vars) {
  return t(n === 1 ? oneKey : otherKey, { n, ...vars });
}
