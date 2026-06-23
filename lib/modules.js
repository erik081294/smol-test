// Eén registry van alle modules. Dit is het inplug-punt van het framework:
// een nieuwe module toevoegen betekent (1) hier een descriptor bijzetten,
// (2) een scherm onder app/(tabs)/<route>.js maken, en (3) de tabel via
// public.enable_module_rls('<table>') in een migratie aanzetten.
//
// kind:
//   'overview' — leest meerdere module-tabellen samen (bijv. Vandaag)
//   'data'     — een eigen module-tabel met het standaard zichtbaarheidscontract
//   'admin'    — beheer (huishouden, leden, groepen), geen module-tabel
//
// core:
//   true  — altijd aan, niet uit te schakelen (Vandaag, Huishouden). Vormt het
//           minimale skelet waar de app op kan rekenen.
//   false — toggle-baar: aan/uit per huishouden (door de owner) én per gebruiker.
//
// De volgorde hier is de volgorde van de tabbalk.
// primary:
//   true  — staat als eigen icoon in de tabbalk (de dagelijkse modules).
//   false — bereikbaar via de "Meer"-tab. Houdt de tabbalk leesbaar zodra er
//           meer dan een handvol modules aan staan, zonder modules te verbergen.
// icon: semantische naam uit lib/icons.js (Phosphor). De emoji's blijven als
// data staan maar worden niet meer in de UI gerenderd.
// Vandaag is het Home-dashboard ("Thuis"): focus op vandaag + een launchpad naar
// elke ingeschakelde module. Daarom is het de enige primaire "overzicht"-tab. De
// losse Agenda-tab is opgegaan in Taken (UX-27): Taken is het centrale afspraken-
// oppervlak met dag/week/maand/jaar-scopes. "Inzichten" (de jaar-activiteit) staat
// nu apart, bereikbaar via "Meer". Zo blijft de tabbalk kort
// (Thuis · Taken · Boodschappen · Meer).
// group: clustert verwante modules in de "Meer"-tab (en op het Thuis-launchpad) zodat
// de groeiende moduleset scanbaar blijft en samenhang zichtbaar is. Zie MODULE_GROUPS
// voor de volgorde/labels. `group: null` = niet als losse Meer-rij tonen (bereikbaar via
// een hub), bijv. Huishouden dat onder Instellingen valt; primaire tabs hebben hun eigen
// icoon en hoeven geen groep.
export const MODULES = [
  { key: 'vandaag', label: 'Thuis', emoji: '🏡', icon: 'home', route: 'vandaag', kind: 'overview', table: null, core: true, primary: true, group: null },
  { key: 'taken', label: 'Taken', emoji: '✅', icon: 'tasks', route: 'taken', kind: 'data', table: 'tasks', creatorColumn: 'created_by', core: false, primary: true, group: 'huis' },
  { key: 'inzichten', label: 'Inzichten', emoji: '📊', icon: 'insights', route: 'inzichten', kind: 'overview', table: null, core: false, primary: false, group: 'huis' },
  { key: 'boodschappen', label: 'Boodschappen', emoji: '🛒', icon: 'shopping', route: 'boodschappen', kind: 'data', table: 'groceries', creatorColumn: 'added_by', core: false, primary: true, group: 'eten' },
  { key: 'schoonmaak', label: 'Schoonmaak', emoji: '🧹', icon: 'cleaning', route: 'schoonmaak', kind: 'overview', table: null, core: false, primary: false, group: 'huis' },
  { key: 'kosten', label: 'Kosten', emoji: '💶', icon: 'expenses', route: 'kosten', kind: 'data', table: 'expenses', creatorColumn: 'created_by', core: false, primary: false, group: 'geld' },
  { key: 'planten', label: 'Planten', emoji: '🪴', icon: 'plants', route: 'planten', kind: 'data', table: 'plants', creatorColumn: 'created_by', core: false, primary: false, group: 'huis' },
  { key: 'huisdieren', label: 'Huisdieren', emoji: '🐾', icon: 'pets', route: 'huisdieren', kind: 'data', table: 'pets', creatorColumn: 'created_by', core: false, primary: false, group: 'huis' },
  { key: 'activiteit', label: 'Activiteit', emoji: '🔔', icon: 'feed', route: 'activiteit', kind: 'overview', table: null, core: false, primary: false, group: 'huis' },
  { key: 'maaltijden', label: 'Maaltijden', emoji: '🍳', icon: 'meals', route: 'maaltijden', kind: 'data', table: 'meal_plan_entries', creatorColumn: 'created_by', core: false, primary: false, group: 'eten' },
  { key: 'voorraad', label: 'Voorraad', emoji: '🥫', icon: 'pantry', route: 'voorraad', kind: 'data', table: 'pantry_items', creatorColumn: 'updated_by', core: false, primary: false, group: 'eten' },
  { key: 'delen', label: 'Samen', emoji: '🤝', icon: 'share', route: 'delen', kind: 'data', table: 'shared_resources', creatorColumn: 'created_by', core: false, primary: false, group: 'geld' },
  { key: 'huishouden', label: 'Huishouden', emoji: '🏡', icon: 'group', route: 'huishouden', kind: 'admin', table: null, core: true, primary: false, group: null },
  { key: 'instellingen', label: 'Instellingen', emoji: '⚙️', icon: 'settings', route: 'instellingen', kind: 'admin', table: null, core: true, primary: false, group: 'beheer' },
];

// Geordende groepen voor de "Meer"-tab. Labels lopen via i18n (more.group.<key>).
export const MODULE_GROUPS = ['eten', 'huis', 'geld', 'beheer'];

// De pseudo-route voor de overflow-tab. Geen echte module (geen tabel/scherm-
// contract), maar wel een tabbalk-item; daarom apart gehouden van MODULES.
export const MORE_TAB = { key: 'meer', label: 'Meer', emoji: '⋯', icon: 'more', route: 'meer' };

// Alleen de modules met een eigen tabel (handig voor tests/overzichten).
export const DATA_MODULES = MODULES.filter((m) => m.kind === 'data');

// De modules die een gebruiker/huishouden aan of uit kan zetten.
export const TOGGLEABLE_MODULES = MODULES.filter((m) => !m.core);

export const getModule = (key) => MODULES.find((m) => m.key === key) ?? null;

// ---------------------------------------------------------------------------
// Pure aan/uit-logica. Geen React/Supabase — zo los te unit-testen en één bron
// van waarheid voor wat de tabbalk uiteindelijk toont.
//
// DEFAULT-ON: een module is aan tenzij hij expliciet is uitgezet. We voeren de
// overrides daarom als "disabled"-verzamelingen aan (sleutels die op enabled=false
// staan in household_modules resp. user_module_prefs). Een kern-module is altijd
// aan. Een huishouden-uitzetting wint van de gebruiker (zet het huishouden een
// module uit, dan kan een lid 'm niet voor zichzelf terugzetten).
// ---------------------------------------------------------------------------
export function effectiveModules({ householdDisabled = [], userDisabled = [] } = {}) {
  const hd = new Set(householdDisabled);
  const ud = new Set(userDisabled);
  return MODULES.filter((m) => {
    if (m.core) return true;
    if (hd.has(m.key)) return false;
    if (ud.has(m.key)) return false;
    return true;
  });
}

// De modules die in dit huishouden beschikbaar zijn (kern + niet door de owner
// uitgezet). Dit is de set waaruit een gebruiker zijn persoonlijke keuze maakt.
export function availableModules({ householdDisabled = [] } = {}) {
  const hd = new Set(householdDisabled);
  return MODULES.filter((m) => m.core || !hd.has(m.key));
}
