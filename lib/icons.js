// Huishoek icon-systeem.
//
// Eén bron van waarheid voor álle semantische UI-iconen, net zoals lib/theme.js
// dat is voor kleur/ruimte/type. Schermen en componenten verzinnen geen eigen
// icoon; ze vragen er een op semantische naam: <Icon name="agenda" />. Zo kun je
// het hele icon-pack op één plek wisselen en blijft de betekenis los van de
// concrete tekening.
//
// Pack: Phosphor (warm, rond, vriendelijk — past bij de huiselijke identiteit).
// Emoji's die GEBRUIKERSDATA zijn (avatar_emoji, household-emoji, zone-emoji)
// vallen hier bewust buiten: dat zijn keuzes van de gebruiker, geen UI-iconen.

import React from 'react';
import {
  // modules / tabs
  Sun, CheckCircle, CalendarBlank, ShoppingCart, Broom, Coins, Plant, House, DotsThreeOutline,
  // categorieën
  Wrench, Sparkle, PushPin,
  // verzorging / inline
  Drop, Leaf, NoteBlank, Camera, MapPin,
  // meta / acties
  Repeat, Lock, UsersThree, CaretLeft, CaretRight, X, Plus, Check, Gear, SignOut, Bell, Export,
  Toolbox, CalendarCheck, ArrowsClockwise, Trash, ListBullets, Receipt, ChartLineUp, MagnifyingGlass,
  CookingPot, Jar, Palette,
  // status
  Info, Warning,
  // lege staten
  CloudSun, ClipboardText,
} from 'phosphor-react-native';
import { colors } from './theme';

// Semantische naam → Phosphor-component. Voeg hier toe wanneer een scherm een
// nieuw icoon nodig heeft; gebruik nooit een Phosphor-import rechtstreeks.
const MAP = {
  // modules / tabbalk
  today: Sun,
  tasks: CheckCircle,
  agenda: CalendarBlank,
  shopping: ShoppingCart,
  cleaning: Broom,
  expenses: Coins,
  plants: Plant,
  home: House,
  more: DotsThreeOutline,

  // taakcategorieën (categoryMeta in theme.js verwijst hiernaar)
  klus: Wrench,
  huishouden: Sparkle,
  plant: Plant,
  afspraak: CalendarBlank,
  overig: PushPin,

  // verzorging / inline labels
  water: Drop,
  light: Sun,
  feed: Leaf,
  note: NoteBlank,
  photo: Camera,
  location: MapPin,

  // meta / acties
  repeat: Repeat,
  shared: Lock,
  group: UsersThree,
  back: CaretLeft,
  forward: CaretRight,
  close: X,
  add: Plus,
  check: Check,
  delete: Trash,
  chevron: CaretRight,
  settings: Gear,
  appearance: Palette,   // beeldstijl / thema (Instellingen-hub)
  signout: SignOut,
  bell: Bell,
  share: Export,
  library: Toolbox,    // klus-bibliotheek (KLU-2)
  season: CalendarCheck, // seizoenssuggesties (KLU-3)
  rotation: ArrowsClockwise, // beurtrotatie (KLU-4)
  catalog: ListBullets,  // productcatalogus (BOO-5)
  search: MagnifyingGlass, // producten zoeken/bladeren (Open Food Facts-catalogus)
  receipt: Receipt,      // bon invoeren (BOO-2)
  price: ChartLineUp,    // prijstracker (BOO-3)
  meals: CookingPot,     // maaltijden/weekmenu (MLT-1)
  pantry: Jar,           // voorraad (VOO-1)

  // status (Banner/feedback)
  info: Info,
  warning: Warning,
  success: CheckCircle,

  // lege staten (overige hergebruiken de module-iconen)
  emptyToday: CloudSun,
  emptyTasks: ClipboardText,
};

// De enige icoon-API van de app.
//   name   — semantische sleutel uit MAP
//   size   — px (default 24); kies ≥20 voor leesbaarheid
//   color  — token-kleur (default ink)
//   weight — Phosphor-gewicht: 'regular' (rust) of 'fill' (actief/nadruk)
export function Icon({ name, size = 24, color = colors.ink, weight = 'regular', ...rest }) {
  const Cmp = MAP[name];
  if (!Cmp) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`Icon: onbekende naam "${name}"`);
    return null;
  }
  return <Cmp size={size} color={color} weight={weight} {...rest} />;
}

export const ICON_NAMES = Object.keys(MAP);
