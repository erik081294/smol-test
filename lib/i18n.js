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
    'common.cancelLong': 'Annuleren',
    'common.save': 'Opslaan',
    'common.delete': 'Verwijder',
    'common.add': 'Toevoegen',
    'common.everyone': 'Iedereen',
    'common.someone': 'Iemand',
    'common.undo': 'Ongedaan maken',
    'common.failed': 'Mislukt',

    // Toegankelijkheid (screenreader)
    'a11y.checked': 'afgevinkt',
    'a11y.unchecked': 'niet afgevinkt',
    'a11y.tapToToggle': 'Tik om af te vinken',

    // Taken-scherm
    'tasks.title': 'Taken',
    'tasks.subtitle': 'Alles wat er te doen is in huis.',
    'tasks.filter.open': 'Open',
    'tasks.filter.done': 'Afgerond',
    'tasks.empty.open.title': 'Geen open taken',
    'tasks.empty.open.subtitle': 'Voeg een taak toe met de + knop.',
    'tasks.empty.done.title': 'Nog niets afgerond',
    'tasks.empty.done.subtitle': 'Afgevinkte taken verschijnen hier.',

    // Vandaag-scherm
    'greeting.night': 'Goedenacht',
    'greeting.morning': 'Goedemorgen',
    'greeting.afternoon': 'Goedemiddag',
    'greeting.evening': 'Goedenavond',
    'today.section.overdue': 'Achterstallig',
    'today.section.today': 'Voor vandaag',
    'today.section.done': 'Afgerond vandaag',
    'today.allDone': 'Niets meer te doen vandaag. Lekker bezig!',
    'today.remaining.one': '{n} taak te gaan.',
    'today.remaining.other': '{n} taken te gaan.',
    'today.empty.title': 'Een rustige dag',
    'today.empty.subtitle': 'Geen taken voor vandaag. Voeg er een toe via het tabblad Taken.',

    // Taak (gedeeld met editor)
    'task.add': 'Taak toevoegen',
    'task.shared': 'Gedeeld',
    'task.rotates': 'Rouleert',

    // Klussen
    'chores.library': 'Klus-bibliotheek',

    // Meer-scherm
    'more.title': 'Meer',
    'more.subtitle': 'De overige modules van je huishouden.',

    // Agenda-scherm
    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Je taken op de kalender — per groep te filteren.',
    'agenda.prevMonth': 'Vorige maand',
    'agenda.nextMonth': 'Volgende maand',
    'agenda.empty.title': 'Niets op deze dag',
    'agenda.empty.subtitle': 'Tik op + om iets toe te voegen.',
    'agenda.addOnDay': 'Toevoegen op deze dag',

    // Kosten-scherm
    'expenses.title': 'Kosten',
    'expenses.subtitle': 'Wie betaalt wat — eerlijk verdeeld.',
    'expenses.balance.positive': 'Jij krijgt nog {amount}',
    'expenses.balance.negative': 'Jij bent nog {amount} schuldig',
    'expenses.balance.even': 'Je staat gelijk',
    'expenses.settle.show': 'Bekijk vereffening ({n})',
    'expenses.settle.hide': 'Verberg vereffening ({n})',
    'expenses.row.paid': '{name} betaalde',
    'expenses.participants.one': '{n} deelnemer',
    'expenses.participants.other': '{n} deelnemers',
    'expenses.empty.title': 'Nog geen uitgaven',
    'expenses.empty.subtitle': 'Voeg een gedeelde uitgave toe met de + knop.',
    'expense.add': 'Uitgave toevoegen',

    // Planten-scherm
    'plants.title': 'Planten',
    'plants.subtitle': 'Op tijd water, op maat verzorgd.',
    'plants.empty.title': 'Nog geen planten',
    'plants.empty.subtitle': 'Voeg je eerste plant toe met de + knop.',
    'plant.add': 'Plant toevoegen',

    // Boodschappen-scherm
    'groceries.title': 'Boodschappen',
    'groceries.subtitle': 'Gedeelde lijst — iedereen ziet hetzelfde, live.',
    'groceries.placeholder': 'Voeg toe… bijv. melk, brood',
    'groceries.addLabel': 'Boodschap toevoegen',
    'groceries.section.open': 'Te halen',
    'groceries.section.done': 'Afgevinkt',
    'groceries.clearChecked': 'Afgevinkte wissen',
    'groceries.empty.title': 'Lijst is leeg',
    'groceries.empty.subtitle': 'Typ hierboven om iets toe te voegen.',
    'groceries.deleted': "'{name}' gewist",
    'groceries.deleteItem': "'{name}' verwijderen",
    'groceries.clearedChecked': '{n} afgevinkt gewist',
    'groceries.error.add': 'Kon niet toevoegen',
    'groceries.error.delete': 'Kon niet verwijderen',

    // Schoonmaak-scherm
    'cleaning.title': 'Schoonmaak',
    'cleaning.subtitle': 'Je taken per ruimte — afvinken werkt overal door.',
    'cleaning.fairness.title': 'Wie deed hoeveel',
    'cleaning.fairness.empty': 'Nog geen afgevinkte schoonmaaktaken in deze periode. Telt vanaf nu.',
    'cleaning.period.week': 'Week',
    'cleaning.period.month': 'Maand',
    'cleaning.period.all': 'Alles',
    'cleaning.zone.empty': 'Nog geen taken in deze zone.',
    'cleaning.setup': 'Weekschema opzetten',
    'cleaning.confirm': 'Opzetten',
    'cleaning.empty.title': 'Nog geen schoonmaakzones',
    'cleaning.empty.subtitle': 'Zet in één keer een weekschema op — kies een sjabloon en je rooster staat klaar.',
    'cleaning.preview.tasks.one': '{n} taak',
    'cleaning.preview.tasks.other': '{n} taken',
    'cleaning.preview.newZones': ' · {n} nieuwe zones',
    'cleaning.preview.existingZones': ' · gebruikt bestaande zones',
    'cleaning.error.setup': 'Kon schema niet opzetten',
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
