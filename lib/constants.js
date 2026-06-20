// Eén bron van waarheid voor waarden die anders los door de app (en de SQL
// CHECK-constraints) zouden zwerven. De database blijft de autoriteit; deze
// constants moeten daarmee in sync blijven. Zie supabase/migrations/0001_init.sql.

// Taakcategorieën — moeten matchen met de CHECK op tasks.category
export const CATEGORIES = ['klus', 'huishouden', 'plant', 'afspraak', 'overig'];

// Zichtbaarheid — moeten matchen met de CHECK op tasks.visibility / groceries.visibility
export const VISIBILITY = {
  HOUSEHOLD: 'household',
  SUBGROUP: 'subgroup',
  CUSTOM: 'custom',
};
export const VISIBILITY_VALUES = Object.values(VISIBILITY);

// Herhaalfrequenties — moeten matchen met de CHECK op tasks.recur_freq
export const RECUR = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};
export const RECUR_VALUES = Object.values(RECUR);

// Rollen binnen een huishouden
export const ROLE = { OWNER: 'owner', MEMBER: 'member' };

// Maaltijdtypen — moeten matchen met de CHECK op meal_plan_entries.meal_type (0016)
export const MEAL_TYPES = ['ontbijt', 'lunch', 'diner', 'snack'];

// Voorraadlocaties — moeten matchen met de CHECK op pantry_items.location (0016)
export const PANTRY_LOCATIONS = ['koelkast', 'vriezer', 'kast', 'overig'];

// Eenheden — vrije UI-suggestielijst (géén DB-CHECK; kolom is vrije tekst zodat
// catalogus/Open Food Facts-eenheden er ook in passen). 'stuk' is de default.
export const UNITS = ['stuk', 'g', 'kg', 'ml', 'l', 'pak', 'blik', 'bos', 'snee'];

// Uitgave-categorieën — moeten matchen met de CHECK op expenses.category (0019)
export const EXPENSE_CATEGORIES = ['boodschappen', 'wonen', 'energie', 'vervoer', 'vrije tijd', 'overig'];
