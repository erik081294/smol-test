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
// Per-icoon subpath-imports i.p.v. de barrel `from 'phosphor-react-native'` (PERF-3).
// De barrel re-exporteert alle ~756 iconen en wordt door Metro niet getree-shaket, dus
// daarmee belandt het hele pack in de bundle voor de ~57 die we gebruiken. Elk
// `src/icons/<Naam>`-bestand trekt alléén dat icoon + de gedeelde IconBase mee. Voeg bij
// een nieuw icoon één import-regel toe en breid `MAP` uit — nooit de barrel terugzetten.
// modules / tabs
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ShoppingCart } from 'phosphor-react-native/src/icons/ShoppingCart';
import { Broom } from 'phosphor-react-native/src/icons/Broom';
import { Coins } from 'phosphor-react-native/src/icons/Coins';
import { Plant } from 'phosphor-react-native/src/icons/Plant';
import { House } from 'phosphor-react-native/src/icons/House';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { DotsThreeOutline } from 'phosphor-react-native/src/icons/DotsThreeOutline';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { PaperPlaneRight } from 'phosphor-react-native/src/icons/PaperPlaneRight';
// categorieën
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { PushPin } from 'phosphor-react-native/src/icons/PushPin';
// verzorging / inline
import { Drop } from 'phosphor-react-native/src/icons/Drop';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { NoteBlank } from 'phosphor-react-native/src/icons/NoteBlank';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { LinkSimple } from 'phosphor-react-native/src/icons/LinkSimple';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
// meta / acties
import { Repeat } from 'phosphor-react-native/src/icons/Repeat';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { UsersThree } from 'phosphor-react-native/src/icons/UsersThree';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { X } from 'phosphor-react-native/src/icons/X';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { SignOut } from 'phosphor-react-native/src/icons/SignOut';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { Export } from 'phosphor-react-native/src/icons/Export';
import { Toolbox } from 'phosphor-react-native/src/icons/Toolbox';
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Receipt } from 'phosphor-react-native/src/icons/Receipt';
import { ChartLineUp } from 'phosphor-react-native/src/icons/ChartLineUp';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { ArrowsOutLineHorizontal } from 'phosphor-react-native/src/icons/ArrowsOutLineHorizontal';
import { ArrowsInLineHorizontal } from 'phosphor-react-native/src/icons/ArrowsInLineHorizontal';
import { CookingPot } from 'phosphor-react-native/src/icons/CookingPot';
import { Jar } from 'phosphor-react-native/src/icons/Jar';
import { Palette } from 'phosphor-react-native/src/icons/Palette';
import { ClockCounterClockwise } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { StopCircle } from 'phosphor-react-native/src/icons/StopCircle';
import { FunnelSimple } from 'phosphor-react-native/src/icons/FunnelSimple';
// personen / toewijzing
import { User } from 'phosphor-react-native/src/icons/User';
// huisdieren (HUI-1)
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { Scales } from 'phosphor-react-native/src/icons/Scales';
import { Cake } from 'phosphor-react-native/src/icons/Cake';
import { Stethoscope } from 'phosphor-react-native/src/icons/Stethoscope';
import { IdentificationCard } from 'phosphor-react-native/src/icons/IdentificationCard';
// status
import { Info } from 'phosphor-react-native/src/icons/Info';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
// lege staten
import { CloudSun } from 'phosphor-react-native/src/icons/CloudSun';
import { ClipboardText } from 'phosphor-react-native/src/icons/ClipboardText';
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
  pets: PawPrint,
  home: House,
  more: DotsThreeOutline,
  assistant: ChatCircleDots,
  send: PaperPlaneRight,
  history: ClockCounterClockwise,
  stop: StopCircle,

  // taakcategorieën (categoryMeta in theme.js verwijst hiernaar)
  klus: Wrench,
  huishouden: Sparkle,
  plant: Plant,
  huisdier: PawPrint,
  afspraak: CalendarBlank,
  overig: PushPin,
  voertuig: Car,   // module + taakcategorie 'voertuig' (VTG-1)

  // verzorging / inline labels
  water: Drop,
  light: Sun,
  feed: Leaf,          // plant-voeding (blad) — NIET voor de tijdlijn (zie 'pinboard')
  pinboard: PushPin,   // tijdlijn/prikbord (📌) — los van de voeding-leaf
  note: NoteBlank,
  photo: Camera,
  location: MapPin,

  // meta / acties
  repeat: Repeat,
  shared: Lock,
  group: UsersThree,
  person: User,        // "Voor mij"-filter / toewijzing aan één persoon
  back: CaretLeft,
  forward: CaretRight,
  close: X,
  add: Plus,
  check: Check,
  delete: Trash,
  edit: PencilSimple,    // recept bewerken (MLT)
  link: LinkSimple,      // bron-/receptlink (MLT)
  chevron: CaretRight,
  settings: Gear,
  appearance: Palette,   // beeldstijl / thema (Instellingen-hub)
  signout: SignOut,
  bell: Bell,
  share: Export,
  library: Toolbox,    // klus-bibliotheek (KLU-2)
  season: CalendarCheck, // seizoenssuggesties (KLU-3)
  rotation: ArrowsClockwise, // beurtrotatie (KLU-4)
  widen: ArrowsOutLineHorizontal,  // widget smaller → breder (1×1 → 2×1)
  narrow: ArrowsInLineHorizontal,  // widget breder → smaller (2×1 → 1×1)
  catalog: ListBullets,  // productcatalogus (BOO-5)
  timeline: ClockCounterClockwise, // cross-plant tijdlijn-feed (PLA-8)
  filter: FunnelSimple, // schaalbare filter-bediening (TKN-3)
  search: MagnifyingGlass, // producten zoeken/bladeren (Open Food Facts-catalogus)
  receipt: Receipt,      // bon invoeren (BOO-2)
  price: ChartLineUp,    // prijstracker (BOO-3)
  insights: ChartLineUp, // jaar-inzichten / activiteit-heatmap (UX-33)
  meals: CookingPot,     // maaltijden/weekmenu (MLT-1)
  pantry: Jar,           // voorraad (VOO-1)
  weight: Scales,        // gewicht-log huisdier (HUI-1)
  birthday: Cake,        // geboortedatum/leeftijd huisdier
  vet: Stethoscope,      // dierenarts
  chip: IdentificationCard, // chip-/registratienummer

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
