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
//
// Dit bestand blijft bewust PUUR (geen React/native imports) zodat het in node
// te unit-testen is. De React/native-glue (taal-detectie, persistentie, de
// useLang-hook) staat in lib/i18nRuntime.js.

import { nl, enUS } from 'date-fns/locale';

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
    'error.title': 'Er ging iets mis',
    'error.body': 'De app liep tegen een onverwacht probleem aan. Probeer het opnieuw.',
    'error.retry': 'Opnieuw proberen',
    'task.deleted': "'{name}' verwijderd",
    'expense.deleted': "'{name}' verwijderd",
    'plant.deleted': "'{name}' verwijderd",
    'common.failed': 'Mislukt',
    'common.remove': 'Verwijderen',
    'common.saveChanges': 'Wijzigingen bewaren',
    'common.signOut': 'Uitloggen',
    'common.back': 'Terug',
    'common.on': 'Aan',
    'common.off': 'Uit',
    'common.language': 'Taal',

    // Terugkeer & datums (lib/recurrence.js, lib/agenda.js)
    'recur.once': 'Eenmalig',
    'recur.daily.one': 'Elke dag',
    'recur.daily.other': 'Elke {n} dagen',
    'recur.monthly.one': 'Elke maand',
    'recur.monthly.other': 'Elke {n} maanden',
    'recur.weekly.one': 'Elke week',
    'recur.weekly.other': 'Elke {n} weken',
    'recur.weekly.days': 'Wekelijks: {days}',
    'due.today': 'Vandaag',
    'due.tomorrow': 'Morgen',
    'weekday.min.0': 'zo',
    'weekday.min.1': 'ma',
    'weekday.min.2': 'di',
    'weekday.min.3': 'wo',
    'weekday.min.4': 'do',
    'weekday.min.5': 'vr',
    'weekday.min.6': 'za',

    // Toegankelijkheid (screenreader)
    'a11y.checked': 'afgevinkt',
    'a11y.unchecked': 'niet afgevinkt',
    'a11y.tapToToggle': 'Tik om af te vinken',
    'a11y.selected': 'geselecteerd',

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
    'groceries.catalog': 'Catalogus',
    'groceries.receipt': 'Bon invoeren',
    'groceries.catalog.title': 'Productcatalogus',
    'groceries.catalog.empty': 'Nog geen producten — ze verschijnen zodra je bonnen invoert of boodschappen koppelt.',
    'groceries.suggest': 'Koppelen aan een product?',

    // Bon invoeren (BOO-2)
    'purchase.new': 'Nieuwe bon',
    'purchase.untitled': 'Bon',
    'purchase.field.store': 'Winkel',
    'purchase.field.store.placeholder': 'Bijv. Albert Heijn',
    'purchase.field.date': 'Datum',
    'purchase.field.lines': 'Producten op de bon',
    'purchase.line': 'Regel {n}',
    'purchase.line.remove': 'Regel verwijderen',
    'purchase.line.name.placeholder': 'Bijv. Halfvolle melk 1L',
    'purchase.line.quantity': 'Aantal',
    'purchase.line.price.placeholder': 'Prijs per stuk (€)',
    'purchase.linked': 'gekoppeld',
    'purchase.linkTo': 'Koppelen aan {name}?',
    'purchase.newProduct': 'Nieuw product',
    'purchase.addLine': 'Regel toevoegen',
    'purchase.field.total': 'Bontotaal (optioneel)',
    'purchase.field.total.placeholder': 'Totaal volgens de bon (€)',
    'purchase.runningTotal': 'Opgeteld: {amount}',
    'purchase.totalMismatch': 'Ingevoerd totaal ({entered}) wijkt af van de opgetelde regels ({running}).',
    'purchase.save': 'Bon opslaan',
    'purchase.error.noLines': 'Voeg minstens één regel met een naam toe.',
    'purchase.error.save': 'Kon de bon niet opslaan',

    // Productdetail / prijstracker (BOO-3)
    'product.title': 'Product',
    'product.empty.title': 'Nog geen prijsdata',
    'product.empty.subtitle': 'Voer een bon in met dit product om de prijs te volgen.',
    'product.latest': 'Laatste prijs',
    'product.trend': 'Trend',
    'product.min': 'Laagst',
    'product.max': 'Hoogst',
    'product.count': '{n} keer gekocht',
    'product.perStore': 'Per winkel',
    'product.noStore': 'Onbekende winkel',
    'product.history': 'Aankopen',

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

    // Auth / welkom
    'auth.supabaseMissing.title': 'Supabase ontbreekt',
    'auth.supabaseMissing.body': 'Vul je Supabase-gegevens in .env in. Zie README.',
    'auth.error.email': 'Vul je e-mail in',
    'auth.error.password': 'Vul je wachtwoord in',
    'auth.defaultName': 'Naamloos',
    'auth.signup.confirm.title': 'Bijna klaar',
    'auth.signup.confirm.body': 'Check je mail om je account te bevestigen, en log daarna in.',
    'auth.tagline': 'Eén plek voor het hele huishouden.\nKlusjes, boodschappen en planten — samen geregeld.',
    'auth.field.name': 'Je naam',
    'auth.field.name.placeholder': 'Bijv. Erik',
    'auth.field.email': 'E-mail',
    'auth.field.email.placeholder': 'jij@voorbeeld.nl',
    'auth.field.password': 'Wachtwoord',
    'auth.submit.signup': 'Account aanmaken',
    'auth.submit.signin': 'Inloggen',
    'auth.toggle.toSignin': 'Heb je al een account? Inloggen',
    'auth.toggle.toSignup': 'Nieuw hier? Maak een account',
    'auth.notConfigured': '⚠︎ Supabase nog niet ingesteld — zie README.',

    // Onboarding
    'onboarding.error.name': 'Geef je huishouden een naam',
    'onboarding.error.code': 'Vul de code in',
    'onboarding.title': 'Welkom!',
    'onboarding.subtitle': 'Start een nieuw huishouden, of sluit je aan bij een bestaand met een code.',
    'onboarding.tab.create': 'Nieuw',
    'onboarding.tab.join': 'Aansluiten',
    'onboarding.field.name': 'Naam van het huishouden',
    'onboarding.field.name.placeholder': 'Bijv. Familie de Vries',
    'onboarding.chooseIcon': 'Kies een icoon',
    'onboarding.create.submit': 'Huishouden aanmaken',
    'onboarding.field.code': 'Uitnodigingscode',
    'onboarding.field.code.placeholder': 'Bijv. 4F9K2A',

    // Huishouden
    'household.title': 'Huishouden',
    'household.members.one': '{n} lid',
    'household.members.other': '{n} leden',
    'household.shareCode': 'Uitnodigingscode delen',
    'household.inviteCode.label': 'UITNODIGINGSCODE',
    'household.inviteCode.hint': 'Deel deze code zodat anderen kunnen aansluiten.',
    'household.share.message': 'Doe mee in "{name}" op Huishoek! Gebruik deze code in de app: {code}',
    'household.section.members': 'Leden',
    'household.you': '(jij)',
    'household.role.owner': 'Beheerder',
    'household.section.groups': 'Groepen',
    'household.subgroup.new': 'Nieuwe groep',
    'household.subgroup.edit': 'Groep bewerken',
    'household.groups.empty': 'Nog geen groepen. Maak er een (bijv. "Ouders" of "Voetbal Tim") om taken met een vast clubje te delen in plaats van het hele huishouden.',
    'household.subgroup.noMembers': 'Geen leden',
    'household.tapToEdit': 'Tik om te bewerken',
    'household.section.myModules': 'Mijn modules',
    'household.module.disabledByHousehold': 'Uitgezet voor het hele huishouden',
    'household.myModules.hint': 'Kies welke modules jij in de tabbalk ziet. Vandaag en Huishouden staan altijd aan.',
    'household.section.householdModules': 'Modules voor het huishouden',
    'household.householdModules.hint': 'Als beheerder bepaal je welke modules beschikbaar zijn. Wat je hier uitzet, kan niemand in het huishouden voor zichzelf aanzetten.',
    'household.section.switch': 'Wissel van huishouden',
    'household.newOrJoin': 'Nieuw of aansluiten bij huishouden',
    'household.leave.button': 'Huishouden verlaten',
    'household.section.you': 'Jij',
    'household.subgroup.delete.title': 'Groep verwijderen?',
    'household.subgroup.delete.body': '"{name}" wordt verwijderd. Taken die ermee gedeeld waren blijven bestaan, maar verliezen deze groep.',
    'household.leave.title': 'Huishouden verlaten?',
    'household.leave.body': 'Je verlaat "{name}". Je kunt later opnieuw toetreden met de code.',
    'household.leave.confirm': 'Verlaten',
    'household.subgroup.error.name': 'Geef de groep een naam',
    'household.subgroup.error.members': 'Kies minstens één persoon',
    'household.subgroup.field.name': 'Naam van de groep',
    'household.subgroup.field.name.placeholder': 'Bijv. Ouders, Voetbal Tim',
    'household.subgroup.icon': 'Icoon',
    'household.subgroup.whoLabel': 'Wie zit in deze groep?',
    'household.subgroup.deleteButton': 'Groep verwijderen',
    'household.subgroup.create': 'Groep aanmaken',

    // Taak-editor
    'task.error.title': 'Geef de taak een titel',
    'task.error.recurDate': 'Een terugkerende taak heeft een startdatum nodig.',
    'task.delete.title': 'Taak verwijderen?',
    'task.new': 'Nieuwe taak',
    'task.edit': 'Taak bewerken',
    'task.field.title': 'Wat moet er gebeuren?',
    'task.field.title.placeholder': 'Bijv. Vuilnis buitenzetten',
    'task.field.category': 'Categorie',
    'task.field.zone': 'Zone (optioneel)',
    'task.zone.none': 'Geen zone',
    'task.field.assignee': 'Voor wie?',
    'task.field.when': 'Wanneer?',
    'task.date.none': 'Geen datum',
    'task.quick.today': 'Vandaag',
    'task.quick.tomorrow': 'Morgen',
    'task.quick.in3': 'Over 3 dagen',
    'task.quick.nextWeek': 'Volgende week',
    'task.field.repeat': 'Herhalen',
    'task.recur.once': 'Eenmalig',
    'task.recur.daily': 'Dagelijks',
    'task.recur.weekly': 'Wekelijks',
    'task.recur.monthly': 'Maandelijks',
    'task.interval.every': 'Elke',
    'task.unit.day.one': 'dag',
    'task.unit.day.other': 'dagen',
    'task.unit.week.one': 'week',
    'task.unit.week.other': 'weken',
    'task.unit.month.one': 'maand',
    'task.unit.month.other': 'maanden',
    'task.weekly.fixedDays': 'Of kies vaste dagen (dan vervalt het wekeninterval):',
    'task.recur.autoNext': 'Bij afvinken verschijnt automatisch de volgende keer.',
    'task.rotation.label': 'Rouleren tussen leden',
    'task.rotation.hint': 'Tik op de leden in de gewenste beurtvolgorde. Bij elke afvink-beurt gaat de taak naar de volgende.',
    'task.rotation.turn': ', beurt {n}',
    'task.field.notes': 'Notitie (optioneel)',
    'task.field.notes.placeholder': 'Extra details…',
    'task.deleteButton': 'Taak verwijderen',
    'task.date.prev': 'Dag eerder',
    'task.date.next': 'Dag later',

    // Uitgave-editor
    'expense.split.equal': 'Gelijk',
    'expense.split.shares': 'Op aandeel',
    'expense.split.exact': 'Exact bedrag',
    'expense.error.description': 'Geef de uitgave een omschrijving',
    'expense.error.amount': 'Vul een geldig bedrag in',
    'expense.error.paidBy': 'Kies wie betaald heeft',
    'expense.error.participants': 'Kies minstens één deelnemer',
    'expense.error.exact': 'Er moet nog {amount} verdeeld worden.',
    'expense.error.save': 'Kon uitgave niet opslaan',
    'expense.delete.title': 'Uitgave verwijderen?',
    'expense.delete.body': 'Dit kan niet ongedaan worden gemaakt.',
    'expense.new': 'Nieuwe uitgave',
    'expense.field.description': 'Omschrijving',
    'expense.field.description.placeholder': 'Boodschappen, etentje, ...',
    'expense.field.amount': 'Bedrag (€)',
    'expense.field.paidBy': 'Betaald door',
    'expense.field.split': 'Splitsing',
    'expense.field.participants': 'Deelnemers',
    'expense.a11y.participant': ', deelnemer',
    'expense.a11y.share': 'Aandeel {name}',
    'expense.exact.balanced': 'Bedragen kloppen',
    'expense.exact.remaining': 'Nog te verdelen: {amount}',
    'expense.save': 'Uitgave opslaan',
    'expense.detail.split': 'Verdeling',

    // Plant-editor
    'plant.error.name': 'Geef je plant een naam',
    'plant.error.water': 'Kies een soort, of vul zelf een waterinterval in dagen in.',
    'plant.error.save': 'Kon plant niet opslaan',
    'plant.photo.noAccess.title': 'Geen toegang',
    'plant.photo.noAccess.body': 'Geef toegang tot je foto’s om een plantfoto toe te voegen.',
    'plant.photo.title': 'Foto',
    'plant.photo.readError': 'Kon de afbeelding niet lezen. Probeer een andere foto.',
    'plant.photo.openError': 'Kon de fotokiezer niet openen.',
    'plant.photo.source.title': 'Plantfoto',
    'plant.photo.source.body': 'Waarvandaan?',
    'plant.photo.camera': 'Camera',
    'plant.photo.library': 'Bibliotheek',
    'plant.photo.uploadError': 'Uploaden mislukt.',
    'plant.photo.deleteError': 'Verwijderen mislukt.',
    'plant.photo.confirmDelete.web': 'Deze foto verwijderen?',
    'plant.photo.delete.title': 'Foto verwijderen?',
    'plant.photo.delete.body': 'Dit kan niet ongedaan worden gemaakt.',
    'plant.delete.title': 'Plant verwijderen?',
    'plant.delete.body': 'De verzorgingstaken verdwijnen ook.',
    'plant.photo.change': 'Foto wijzigen',
    'plant.photo.add': 'Foto toevoegen',
    'plant.careCard': 'Verzorgingskaart',
    'plant.care.light': 'Licht',
    'plant.care.water': 'Water',
    'plant.care.feed': 'Voeding',
    'plant.care.tip': 'Tip',
    'plant.careTasks': 'Verzorgingstaken',
    'plant.noTasks': 'Geen gekoppelde taken.',
    'plant.diary': 'Dagboek',
    'plant.diary.empty': 'Nog geen foto’s — voeg er een toe via de cirkel hierboven.',
    'plant.diary.photo': 'Dagboekfoto',
    'plant.field.note': 'Notitie',
    'plant.field.note.placeholder': 'Bijv. nieuw blad, verpot, gele blaadjes…',
    'plant.note.save': 'Notitie bewaren',
    'plant.deleteButton': 'Plant verwijderen',
    'plant.new': 'Nieuwe plant',
    'plant.field.name': 'Naam',
    'plant.field.name.placeholder': 'Bijv. Mostafa de Monstera',
    'plant.field.species': 'Soort zoeken',
    'plant.field.species.placeholder': 'Typ een soort, bijv. monstera',
    'plant.species.none': 'Geen soort gevonden — vul hieronder zelf een waterinterval in.',
    'plant.species.chosen': '{name} gekozen — schema wordt automatisch ingesteld.',
    'plant.field.water': 'Waterinterval (dagen)',
    'plant.field.location': 'Locatie',
    'plant.save': 'Plant opslaan',
  },
};

// De ondersteunde talen, in voorkeursvolgorde. Eén bron van waarheid voor de
// schakelaar én de tests (pariteit gaat over precies deze set).
export const SUPPORTED_LANGS = ['nl', 'en'];

let lang = 'nl';

// Abonnees voor taalwijziging (useSyncExternalStore in i18nRuntime leunt hierop).
// Een externe store i.p.v. React-context: t() blijft een gewone functie die ook
// in niet-component-code (lib, tests) werkt, terwijl de UI tóch herrendert.
const listeners = new Set();
const emit = () => { for (const l of listeners) l(); };

export function subscribeLang(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Pure setter: wisselt de taal en notificeert. Persistentie zit bewust in de
// runtime-wrapper (setLanguage in i18nRuntime), niet hier — dit bestand blijft puur.
export function setLang(l) {
  if (DICT[l] && l !== lang) { lang = l; emit(); }
}

export function getLang() {
  return lang;
}

// Voor tests en latere talen: een (deel-)dictionary registreren of aanvullen.
export function registerDict(l, dict) {
  DICT[l] = { ...(DICT[l] ?? {}), ...dict };
}

// Het woordenboek van een taal (alleen-lezen gebruik in de pariteitstest).
export function getDict(l) {
  return DICT[l] ?? {};
}

// date-fns-locale voor de actieve taal. Schermen die datums formatteren vragen
// dit op i.p.v. `nl` hard te importeren, zodat datums meebewegen met de taal.
const DATE_LOCALES = { nl, en: enUS };
export function dateLocale() {
  return DATE_LOCALES[lang] ?? nl;
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
