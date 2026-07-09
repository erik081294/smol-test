// Huishoek illustratie-systeem — voor lege staten.
//
// Eén beeldtaal voor álle lege schermen, net zoals lib/icons.js dat is voor
// iconen en lib/theme.js voor kleur. Een scherm verzint geen eigen tekening; het
// vraagt er een op semantische naam: <Illustration name="groceries" />.
//
// ── BEELDTAAL (de regels die de hele set consistent houden) ──────────────────
//   • Vierkant canvas 120×120, gecentreerde compositie, ruime witruimte.
//   • Vaste ronde "stage" (cirkel r=50 op forestTint) + zachte grond-ellips
//     achter élk object — dé visuele anker die de set samenbindt.
//   • Plat en geometrisch, géén outlines (op een enkel functioneel lijntje na).
//     Ronde hoeken (rx) in de geest van radius.* . Max ~4 tinten per beeld, alle
//     uit het palet: forest / forestPressed / forestTint, ocher / ocherSoft,
//     surface, done.
//   • Eén hoofdobject (~55–65% van de stage) + één speels accent (blad, vonk,
//     stip). Simpel, speels, functioneel — niet rond/rommelig.
//
// Nieuw leeg scherm? Voeg hier een component toe dat Stage gebruikt en bovenstaande
// regels volgt; registreer 'm in MAP. Zo blijft alles dezelfde taal spreken.

import React, { useRef, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import Svg, { Circle, Rect, Path, Ellipse } from 'react-native-svg';
import { colors } from './theme';
import { prefersReducedMotion } from './motion';

const NATIVE_DRIVER = Platform.OS !== 'web';

// Bladvorm-helper: een spitse lens van basis (cx,by) naar punt (cx,ty), met halve
// breedte hw. Roteer met een transform rond de basis om bladeren te laten waaieren.
const leaf = (cx, by, ty, hw) =>
  `M${cx} ${by} Q${cx + hw} ${(by + ty) / 2} ${cx} ${ty} Q${cx - hw} ${(by + ty) / 2} ${cx} ${by} Z`;

// Zachte contact-schaduw — twee ellipsen over elkaar geven een vage rand (een
// brede, lichte halo + een smallere, iets donkerdere kern) zonder dat we op
// wisselend-ondersteunde SVG-blur hoeven te leunen. `rx` is de footprint: per
// illustratie te tunen zodat het object écht op de grond staat i.p.v. zweeft.
function Shadow({ cx = 60, cy = 91, rx = 22 }) {
  return (
    <>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={Math.max(rx * 0.17, 3)} fill={colors.forest} opacity={0.07} />
      <Ellipse cx={cx} cy={cy + 0.5} rx={rx * 0.6} ry={Math.max(rx * 0.1, 2)} fill={colors.forest} opacity={0.1} />
    </>
  );
}

// Gedeelde achtergrond — de constante die elke illustratie verbindt. `shadow` =
// footprint-breedte van de contact-schaduw (0 = geen).
function Stage({ children, shadow = 22 }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={50} fill={colors.forestTint} />
      {shadow > 0 && <Shadow rx={shadow} />}
      {children}
    </Svg>
  );
}

// ── Vandaag — een rustige dag: een warme mok (huiselijk, "lekker bezig") ──────
function Today() {
  return (
    <Stage shadow={18}>
      {/* stoom */}
      <Path d="M53 46 C49 41 57 38 53 33" stroke={colors.forest} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.45} />
      <Path d="M67 46 C63 41 71 38 67 33" stroke={colors.forest} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.45} />
      {/* oor */}
      <Path d="M76 60 C88 60 88 78 76 78" stroke={colors.ocher} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* mok */}
      <Rect x={44} y={52} width={32} height={32} rx={9} fill={colors.ocher} />
      {/* koffie-oppervlak */}
      <Ellipse cx={60} cy={56} rx={14} ry={3.5} fill={colors.ocherSoft} />
      {/* speels blaadje op het schoteltje */}
      <Path d="M84 84 C80 80 88 78 90 84 C88 88 84 88 84 84 Z" fill={colors.done} />
    </Stage>
  );
}

// ── Taken — een klembord met een afvinkbare lijst ────────────────────────────
// Alle drie de vakjes delen exact dezelfde geometrie (x=46, 10×10, rx=3,
// strokeWidth=2) — ook het afgevinkte krijgt een stroke in zijn eigen kleur —
// zodat hun randen pixel-voor-pixel uitlijnen. De regels staan op een vast
// 12px-ritme en zijn verticaal gecentreerd t.o.v. hun vakje.
function Tasks() {
  const rows = [48, 60, 72]; // y-top per vakje
  return (
    <Stage>
      {/* bord */}
      <Rect x={40} y={37} width={40} height={50} rx={8} fill={colors.surface} stroke={colors.line} strokeWidth={1.5} />
      {/* klem */}
      <Rect x={52} y={32} width={16} height={9} rx={3.5} fill={colors.forest} />
      <Rect x={56} y={29.5} width={8} height={5} rx={2.5} fill={colors.forestPressed} />
      {/* regel 1 — afgevinkt */}
      <Rect x={46} y={rows[0]} width={10} height={10} rx={3} fill={colors.done} stroke={colors.done} strokeWidth={2} />
      <Path d="M48.8 53 L50.9 55.2 L54.2 51.2" stroke={colors.surface} strokeWidth={1.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={60} y={rows[0] + 3} width={12} height={4} rx={2} fill={colors.line} />
      {/* regel 2 */}
      <Rect x={46} y={rows[1]} width={10} height={10} rx={3} fill={colors.surface} stroke={colors.forestPressed} strokeWidth={2} />
      <Rect x={60} y={rows[1] + 3} width={14} height={4} rx={2} fill={colors.line} />
      {/* regel 3 */}
      <Rect x={46} y={rows[2]} width={10} height={10} rx={3} fill={colors.surface} stroke={colors.forestPressed} strokeWidth={2} />
      <Rect x={60} y={rows[2] + 3} width={9} height={4} rx={2} fill={colors.line} />
      {/* speels accent */}
      <Circle cx={80} cy={41} r={3.2} fill={colors.ocher} />
    </Stage>
  );
}

// ── Boodschappen — een lege boodschappenkar (leeg = lege lijst) ──────────────
function Groceries() {
  return (
    <Stage>
      {/* duwbeugel */}
      <Path d="M32 45 H39 L48 60" stroke={colors.forest} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* mand (trapezium, breder bovenaan) */}
      <Path d="M45 60 H81 L76 78 H50 Z" fill={colors.ocher} />
      {/* bovenrand iets lichter */}
      <Path d="M44 60 H82" stroke={colors.ocherSoft} strokeWidth={4} strokeLinecap="round" />
      {/* subtiele rooster-lijntjes */}
      <Path d="M56 62 L57 76 M64 62 L64 76 M72 62 L71 76" stroke={colors.forest} strokeWidth={1.4} opacity={0.16} strokeLinecap="round" />
      <Path d="M47 69 H79" stroke={colors.forest} strokeWidth={1.4} opacity={0.16} strokeLinecap="round" />
      {/* pootjes naar de wieltjes */}
      <Path d="M54 78 L57 84 M73 78 L71 84" stroke={colors.forest} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* wieltjes */}
      <Circle cx={57} cy={86} r={4.5} fill={colors.forest} />
      <Circle cx={71} cy={86} r={4.5} fill={colors.forest} />
      {/* speels accent */}
      <Circle cx={85} cy={52} r={3} fill={colors.ocher} />
    </Stage>
  );
}

// ── Planten — een plant in een pot ───────────────────────────────────────────
function Plants() {
  return (
    <Stage shadow={12}>
      {/* stelen vanuit de aarde */}
      <Path
        d="M60 67 V40 M60 59 C55 55 51 54 47 52 M60 56 C65 53 69 52 73 50"
        stroke={colors.forest} strokeWidth={2} fill="none" strokeLinecap="round"
      />
      {/* zijbladeren (achter, zachter groen) — herkenbare aparte bladvormen */}
      <Path d={leaf(47, 52, 41, 6)} transform="rotate(-36 47 52)" fill={colors.done} />
      <Path d={leaf(73, 50, 39, 6)} transform="rotate(36 73 50)" fill={colors.done} />
      {/* middenblad (voor, donker) */}
      <Path d={leaf(60, 43, 27, 7.5)} fill={colors.forest} />
      {/* pot (lichte taps, ronde onderhoeken) */}
      <Path d="M51 66 H69 L66.5 84 C66.4 85.2 65.4 86 64.2 86 H55.8 C54.6 86 53.6 85.2 53.5 84 Z" fill={colors.ocher} />
      {/* potrand / aarde */}
      <Rect x={49} y={63} width={22} height={6} rx={3} fill={colors.ocherSoft} />
      {/* speels accent — zonnetje (los van de plant, ankert op de stage) */}
      <Circle cx={84} cy={45} r={3.2} fill={colors.ocher} />
    </Stage>
  );
}

// ── Kosten — muntstapel + een munt met € ─────────────────────────────────────
function Expenses() {
  return (
    <Stage>
      {/* muntstapel (van opzij) */}
      <Rect x={40} y={80} width={24} height={6} rx={3} fill={colors.ocher} />
      <Rect x={42} y={74} width={24} height={6} rx={3} fill={colors.ocherSoft} />
      <Rect x={40} y={68} width={24} height={6} rx={3} fill={colors.ocher} />
      {/* grote munt */}
      <Circle cx={71} cy={56} r={16} fill={colors.ocher} />
      <Circle cx={71} cy={56} r={16} fill="none" stroke={colors.ocherSoft} strokeWidth={3} />
      {/* € */}
      <Path d="M76 50 C70 47 64 51 64 56 C64 61 70 65 76 62 M61 54 H72 M61 58 H70" stroke={colors.forest} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* speels accent */}
      <Circle cx={50} cy={48} r={3} fill={colors.done} />
    </Stage>
  );
}

// ── Agenda — een kalenderblad met één gemarkeerde dag ─────────────────────────
function Agenda() {
  return (
    <Stage>
      {/* ringbandjes */}
      <Rect x={50} y={36} width={4} height={11} rx={2} fill={colors.forest} />
      <Rect x={66} y={36} width={4} height={11} rx={2} fill={colors.forest} />
      {/* blad */}
      <Rect x={42} y={43} width={36} height={42} rx={6} fill={colors.surface} stroke={colors.line} strokeWidth={1.5} />
      {/* kop */}
      <Path d="M42 49 C42 45.7 44.7 43 48 43 H72 C75.3 43 78 45.7 78 49 V53 H42 Z" fill={colors.forest} />
      {/* dagen */}
      <Circle cx={50} cy={62} r={2} fill={colors.line} />
      <Circle cx={60} cy={62} r={2} fill={colors.line} />
      <Circle cx={70} cy={62} r={2} fill={colors.line} />
      <Circle cx={50} cy={71} r={2} fill={colors.line} />
      <Circle cx={60} cy={71} r={3.4} fill={colors.ocher} />
      <Circle cx={70} cy={71} r={2} fill={colors.line} />
      <Circle cx={50} cy={80} r={2} fill={colors.line} />
      <Circle cx={60} cy={80} r={2} fill={colors.line} />
      <Circle cx={70} cy={80} r={2} fill={colors.line} />
    </Stage>
  );
}

// ── Schoonmaak — een bezem met een glim-accent ───────────────────────────────
function Cleaning() {
  return (
    <Stage>
      {/* steel */}
      <Path d="M74 40 L56 66" stroke={colors.forest} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      {/* band */}
      <Path d="M47 64 H65 L63 72 H49 Z" fill={colors.forest} opacity={0.85} />
      {/* borstelharen (waaier) */}
      <Path d="M49 72 H63 L67 88 C67 88 56 91 45 88 Z" fill={colors.ocher} />
      <Path d="M53 73 L52 88 M57 73 L57 89 M61 73 L62 88" stroke={colors.ocherSoft} strokeWidth={1.6} opacity={0.8} strokeLinecap="round" />
      {/* speels accent — glim/schoon */}
      <Path d="M78 53 L79.6 57.4 L84 59 L79.6 60.6 L78 65 L76.4 60.6 L72 59 L76.4 57.4 Z" fill={colors.ocher} />
    </Stage>
  );
}

// ── Groepen — twee eenvoudige figuurtjes ─────────────────────────────────────
function Groups() {
  return (
    <Stage>
      {/* persoon achter */}
      <Circle cx={72} cy={56} r={9} fill={colors.ocherSoft} />
      <Path d="M59 84 C59 73 65 68 72 68 C79 68 85 73 85 84 Z" fill={colors.ocherSoft} />
      {/* persoon voor */}
      <Circle cx={51} cy={57} r={11} fill={colors.done} />
      <Path d="M35 86 C35 73 43 67 51 67 C59 67 67 73 67 86 Z" fill={colors.done} />
      {/* speels accent — hartje */}
      <Path d="M66 39 C64 36 60 37 60 41 C60 44 66 48 66 48 C66 48 72 44 72 41 C72 37 68 36 66 39 Z" fill={colors.ocher} />
    </Stage>
  );
}

// ── Maaltijden — een pan met deksel + stoom (wat eten we?) ───────────────────
function Meals() {
  return (
    <Stage shadow={20}>
      {/* stoom */}
      <Path d="M53 44 C49 39 57 36 53 31" stroke={colors.forest} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.4} />
      <Path d="M67 44 C63 39 71 36 67 31" stroke={colors.forest} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.4} />
      {/* deksel + knop */}
      <Rect x={42} y={52} width={36} height={8} rx={4} fill={colors.ocherSoft} />
      <Circle cx={60} cy={50} r={2.6} fill={colors.forest} />
      {/* oren/handvatten */}
      <Path d="M45 66 C38 66 38 74 45 74" stroke={colors.forest} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M75 66 C82 66 82 74 75 74" stroke={colors.forest} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* pan-body (lichte taps, ronde onderhoeken) */}
      <Path d="M45 61 H75 L72 83 C71.9 84.2 70.9 85 69.7 85 H50.3 C49.1 85 48.1 84.2 48 83 Z" fill={colors.ocher} />
      {/* speels accent — kruidenblaadje op de rand */}
      <Path d={leaf(84, 52, 44, 4.5)} transform="rotate(28 84 52)" fill={colors.done} />
    </Stage>
  );
}

// ── Voorraad — een voorraadpot met deksel en label (wat is in huis?) ──────────
function Pantry() {
  return (
    <Stage shadow={16}>
      {/* deksel + rand */}
      <Rect x={49} y={37.5} width={22} height={4} rx={2} fill={colors.forestPressed} />
      <Rect x={46} y={40} width={28} height={9} rx={4} fill={colors.forest} />
      {/* pot-body (glas) */}
      <Rect x={47} y={48} width={26} height={38} rx={8} fill={colors.surface} stroke={colors.line} strokeWidth={1.5} />
      {/* inhoud (vrucht/voorraad) boven het label */}
      <Circle cx={54} cy={56} r={2.6} fill={colors.done} />
      <Circle cx={60} cy={55} r={3.2} fill={colors.ocher} />
      <Circle cx={66} cy={56} r={2.6} fill={colors.done} />
      {/* label + tekstlijntjes */}
      <Rect x={51} y={62} width={18} height={15} rx={3} fill={colors.ocher} />
      <Path d="M54.5 67 H65.5 M54.5 71 H62.5" stroke={colors.ocherSoft} strokeWidth={1.6} strokeLinecap="round" />
      {/* speels accent */}
      <Circle cx={84} cy={50} r={3} fill={colors.done} />
    </Stage>
  );
}

// ── Huisdieren — een pootafdruk (één hoofdkussen + vier teenkussentjes) ───────
function Pets() {
  return (
    <Stage shadow={16}>
      {/* hoofdkussen */}
      <Ellipse cx={60} cy={67} rx={13} ry={11} fill={colors.ocher} />
      {/* teenkussentjes (buitenste zachter, binnenste donker) — licht gewaaierd */}
      <Ellipse cx={46} cy={55} rx={4.6} ry={6} fill={colors.done} transform="rotate(-18 46 55)" />
      <Ellipse cx={55} cy={48} rx={4.6} ry={6.6} fill={colors.forest} />
      <Ellipse cx={65} cy={48} rx={4.6} ry={6.6} fill={colors.forest} />
      <Ellipse cx={74} cy={55} rx={4.6} ry={6} fill={colors.done} transform="rotate(18 74 55)" />
      {/* speels accent — hartje (genegenheid) */}
      <Path d="M83 43 C81 40 77 41 77 45 C77 48 83 52 83 52 C83 52 89 48 89 45 C89 41 85 40 83 43 Z" fill={colors.ocher} />
    </Stage>
  );
}

// Semantische naam → illustratie. Voeg hier toe wanneer een leeg scherm er een nodig heeft.
const MAP = {
  today: Today,
  tasks: Tasks,
  groceries: Groceries,
  plants: Plants,
  pets: Pets,
  expenses: Expenses,
  agenda: Agenda,
  cleaning: Cleaning,
  groups: Groups,
  meals: Meals,
  pantry: Pantry,
};

// De enige illustratie-API. Decoratief: voor screenreaders verborgen (de
// Empty-titel/subtitel dragen de betekenis), nooit tikbaar.
//
// Lichte entree: bij verschijnen veert de illustratie zacht omhoog in beeld
// (opacity + scale + een kleine lift). Eén keer, subtiel — nooit een doorlopende
// loop die van een lege staat afleidt. Respecteert "verminder beweging".
export function Illustration({ name, size = 148, style }) {
  const Cmp = MAP[name];
  const reduced = prefersReducedMotion();
  const p = useRef(new Animated.Value(reduced ? 1 : 0)).current; // 0→1 entree-voortgang

  useEffect(() => {
    if (reduced) return;
    Animated.spring(p, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 6, tension: 90 }).start();
  }, [p, reduced, name]);

  if (!Cmp) return null;
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, pointerEvents: 'none', opacity: p, transform: [{ translateY }, { scale }] },
        style,
      ]}
    >
      <Cmp />
    </Animated.View>
  );
}

export const ILLUSTRATION_NAMES = Object.keys(MAP);
