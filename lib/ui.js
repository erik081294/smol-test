// Huishoek componentenbibliotheek.
//
// Eén set bouwstenen waar élk scherm en élke module uit is opgebouwd. Een
// scherm verzint geen eigen knop of kaart; het stelt samen uit deze stukken.
// Zo ziet de hele app er hetzelfde uit en is toegankelijkheid één keer goed
// geregeld in plaats van overal half.
//
// Toegankelijk by default:
//   • alles wat tikbaar is, is ten minste `touchTarget` (48dp) groot;
//   • interactieve elementen dragen een accessibilityRole + -State + -Label;
//   • ingedrukte staat is altijd zichtbaar (Pressable);
//   • tekst schaalt mee met de systeeminstelling (we zetten dat nooit uit).
//
// Zie DESIGN.md voor de principes en lib/theme.js voor de tokens.

import React, { useRef, useEffect, useState, useCallback, useMemo, createContext, useContext } from 'react';
import { Text, TextInput, Pressable, View, ActivityIndicator, ScrollView, Animated, Platform, KeyboardAvoidingView, BackHandler, Modal, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  colors, radius, type, space, screenPadding, elevation, touchTarget, hitSlopFor, font,
} from './theme';
import { Icon } from './icons';
import { dialog } from './dialog';
import { Illustration } from './illustrations';
import { moduleHelp } from './moduleHelp';
import { prefersReducedMotion, animateNextLayout } from './motion';
import { tapLight } from './haptics';
import { format, addDays } from 'date-fns';
import { pickReadable } from './contrast';
import { getModule } from './modules';
import { t, dateLocale } from './i18n';
import Svg, { Polyline } from 'react-native-svg';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated';

// useNativeDriver kan niet op web (geen native animated-module → console-warning
// + JS-fallback). Eén plek zodat geen enkele animatie 'm per ongeluk aanzet.
const NATIVE_DRIVER = Platform.OS !== 'web';

// ===========================================================================
// Lay-out-primitives — gebruik deze i.p.v. losse View's met margins, dan blijft
// de ruimte consistent (4pt-grid via `gap`).
// ===========================================================================

export function Stack({ gap = space.md, style, children, ...rest }) {
  return <View style={[{ gap }, style]} {...rest}>{children}</View>;
}

export function Row({ gap = space.sm, align = 'center', justify = 'flex-start', wrap = false, style, children, ...rest }) {
  return (
    <View
      style={[{
        flexDirection: 'row', alignItems: align, justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap', gap,
      }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

// ===========================================================================
// Tekst — dunne wrapper rond Text die een typografie-token toepast. Voorkomt
// dat schermen losse fontSize/fontWeight gaan strooien.
//   <T variant="h1">Goedemorgen</T>
//   <T variant="body" color={colors.inkSoft}>…</T>
// ===========================================================================
export function T({ variant = 'body', color, center, style, children, ...rest }) {
  const base = type[variant] ?? type.body;
  return (
    <Text
      style={[base, color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ===========================================================================
// Button — primaire interactie. Eén per scherm primair; de rest ghost.
// variant: primary | accent | ghost | danger
// size:    md (48) | lg (56, voor sleutelacties en grote vingers)
// ===========================================================================
export function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled, loading, icon, fullWidth = true, accessibilityHint, style, testID,
}) {
  const palette = {
    primary: { bg: colors.forest,     bgPressed: colors.forestPressed, fg: colors.onDark, border: 'transparent' },
    accent:  { bg: colors.ocher,      bgPressed: '#CE9531',         fg: colors.onAccent, border: 'transparent' },
    soft:    { bg: colors.surfaceAlt, bgPressed: colors.lineStrong,  fg: colors.ink,   border: 'transparent' },
    ghost:   { bg: 'transparent',     bgPressed: colors.surfaceAlt, fg: colors.ink,    border: colors.lineStrong },
    danger:  { bg: colors.danger,     bgPressed: '#9E3A24',         fg: colors.onDark, border: 'transparent' },
  }[variant] ?? {};

  const minHeight = size === 'lg' ? 56 : touchTarget;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [{
        minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingHorizontal: space.xl,
        borderRadius: radius.md,
        backgroundColor: pressed && !isDisabled ? palette.bgPressed : palette.bg,
        borderWidth: variant === 'ghost' ? 1.5 : 0,
        borderColor: palette.border,
        opacity: isDisabled ? 0.5 : 1,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      }, style]}
    >
      {loading
        ? <ActivityIndicator color={palette.fg} />
        : (
          <>
            {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
            <Text style={[type.button, { color: palette.fg }]}>{title}</Text>
          </>
        )}
    </Pressable>
  );
}

// ===========================================================================
// IconButton — vierkante tikknop voor één icoon. `icon` is een semantische naam
// uit lib/icons.js. accessibilityLabel is verplicht: een icoon zonder label is
// onzichtbaar voor een screenreader.
// ===========================================================================
export function IconButton({ icon, onPress, accessibilityLabel, tint = colors.ink, size = 24, disabled, style, testID }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => [{
        width: touchTarget, height: touchTarget, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }, style]}
    >
      <Icon name={icon} size={size} color={tint} />
    </Pressable>
  );
}

// ===========================================================================
// FAB — zwevende primaire actie (bv. "toevoegen"). Geef `label` mee voor een
// uitgebreide FAB met tekst (beter herkenbaar, toegankelijker).
// ===========================================================================
export function FAB({ icon = 'add', label, onPress, accessibilityLabel, style, testID }) {
  const extended = !!label;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label || 'Toevoegen'}
      style={({ pressed }) => [{
        position: 'absolute', right: space.xl, bottom: space.xl,
        minWidth: 52, height: 52, borderRadius: 26,
        paddingHorizontal: extended ? space.lg : 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
        backgroundColor: pressed ? '#CE9531' : colors.ocher,
      }, elevation.e3, style]}
    >
      <Icon name={icon} size={extended ? 20 : 26} color={colors.onAccent} weight="bold" />
      {extended ? <Text style={[type.button, { color: colors.onAccent }]}>{label}</Text> : null}
    </Pressable>
  );
}

// ===========================================================================
// Stepper — numerieke teller met − en +. Grote tikvlakken (48dp), klemt tussen
// min/max en leest de huidige waarde voor. Voor "elke N dagen/weken" e.d.
// ===========================================================================
export function Stepper({ value, onChange, min = 1, max = 99, step = 1, formatValue, accessibilityLabel, compact = false }) {
  // Optimistisch: de getoonde waarde verandert meteen bij een tik (lokale staat), los van
  // de re-render die `value` later bijwerkt. Zo voelt +/− instant, ook als de bovenliggende
  // staat (boodschappenlijst/catalogus) er een tel over doet. Sync terug zodra `value` wijzigt.
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const apply = (next) => { setLocal(next); onChange(next); };
  const dec = () => apply(Math.max(min, local - step));
  const inc = () => apply(Math.min(max, local + step));
  // Compact: smallere knoppen + groter aanraakgebied via hitSlop — past op een lijstrij
  // zonder de 44px-aanraaknorm te breken.
  const dim = compact ? 34 : touchTarget;
  const btn = (label, onPress, disabled, sign) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={compact ? 8 : 0}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={{ fontSize: compact ? 20 : 24, color: colors.forest, marginTop: -2 }}>{sign}</Text>
    </Pressable>
  );
  return (
    <View
      // Adjustable (A11Y-1): de losse ±-knoppen waren niet bedienbaar via de screenreader.
      // De container is nu één "adjustable" element (veeg omhoog/omlaag = meer/minder);
      // de knoppen blijven zichtbaar/aantikbaar voor ziende gebruikers maar zijn voor de
      // screenreader verborgen, zodat er één heldere bediening is.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: local, text: String(formatValue ? formatValue(local) : local) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') inc();
        else if (e.nativeEvent.actionName === 'decrement') dec();
      }}
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
      }}
    >
      {btn('Minder', dec, local <= min, '−')}
      <Text style={[compact ? type.body : type.title, { minWidth: compact ? 22 : 36, textAlign: 'center' }]}>
        {formatValue ? formatValue(local) : local}
      </Text>
      {btn('Meer', inc, local >= max, '+')}
    </View>
  );
}

// ===========================================================================
// Field — tekstinvoer met label, optionele helper- en fouttekst. Het label is
// gekoppeld als accessibilityLabel; de foutmelding wordt voorgelezen.
// ===========================================================================
export function Field({ label, helper, error, style, ...props }) {
  return (
    <View style={[{ gap: space.xs, marginBottom: space.lg }, style]}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={label}
        style={{
          minHeight: touchTarget,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.line,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          fontSize: 16,
          color: colors.ink,
        }}
        {...props}
      />
      {error
        ? <Text style={[type.caption, { color: colors.danger }]} accessibilityLiveRegion="polite">{error}</Text>
        : helper ? <Text style={type.caption}>{helper}</Text> : null}
    </View>
  );
}

// ===========================================================================
// Card — basisoppervlak. Geef `onPress` mee om 'm aantikbaar te maken (krijgt
// dan automatisch een button-rol en ingedrukte staat).
// ===========================================================================
export function Card({ children, onPress, accessibilityLabel, raised = true, style }) {
  const base = [{
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  }, raised ? elevation.e1 : null, style];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...base, pressed ? { backgroundColor: colors.surfaceAlt } : null]}
    >
      {children}
    </Pressable>
  );
}

// ===========================================================================
// ItemRow — de gedeelde lijstrij-anatomie: [leading] · titel + meta · [trailing].
// Taken, boodschappen en uitgaven gebruiken dezelfde rij, zodat een lijst overal
// hetzelfde aanvoelt. `leading` is meestal een Checkbox of Icon; `trailing` een
// Avatar, bedrag of chevron. `meta` is de tweede regel (vrij in te vullen).
// ===========================================================================
export function ItemRow({
  leading, title, titleColor, strikethrough, meta, trailing, chevron,
  onPress, onLongPress, borderColor, dimmed, accessibilityLabel, accessibilityHint, style,
}) {
  // Ingedrukt-staat van het tikbare deel, opgetild naar de buitenste rij zodat
  // de hele rij tint (niet alleen het inhoudsblok). Op web/native gelijk.
  const [pressed, setPressed] = useState(false);

  // leading + titel + meta vormen het tikbare inhoudsblok. `trailing` en `chevron`
  // staan ernáást — niet erbinnen — want een tikbare trailing (zoals een IconButton)
  // zou anders als <button> in de rij-<button> belanden: ongeldige HTML op web
  // (validateDOMNesting-warning) en functioneel een geneste knop.
  const body = (
    <>
      {leading ?? null}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={[
            type.title, { fontSize: 16 },
            titleColor ? { color: titleColor } : null,
            strikethrough ? { textDecorationLine: 'line-through' } : null,
          ]}
        >
          {title}
        </Text>
        {meta ? <View style={{ marginTop: 3 }}>{meta}</View> : null}
      </View>
    </>
  );

  const bodyStyle = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md };

  return (
    <View
      style={[{
        flexDirection: 'row', alignItems: 'center', gap: space.md,
        backgroundColor: pressed && onPress ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.md, padding: space.md, marginBottom: 10,
        borderWidth: 1, borderColor: borderColor || colors.line,
        opacity: dimmed ? 0.55 : 1,
      }, style]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={bodyStyle}
        >
          {body}
        </Pressable>
      ) : (
        <View style={bodyStyle}>{body}</View>
      )}
      {trailing ?? null}
      {/* "Dit is tikbaar"-affordance voor navigerende rijen. Niet op afvink-rijen
          (die hebben al een checkbox als signaal). */}
      {chevron ? <Icon name="chevron" size={20} color={colors.inkFaint} /> : null}
    </View>
  );
}

// ===========================================================================
// SwipeRow — veeg-acties op een lijstrij (UX-17). Eén herbruikbaar primitief
// bovenop `ReanimatedSwipeable` (react-native-gesture-handler). App-brede conventie
// (UX-43, zie DESIGN.md): naar LINKS vegen = de DESTRUCTIEVE actie (`left`, verwijderen);
// naar RECHTS vegen = de neutrale/positieve actie (`right`, uitstellen/afvinken). Dezelfde
// richting betekent dus overal hetzelfde; een scherm zónder verwijderen laat `left` leeg
// (bv. Vandaag) i.p.v. er een niet-destructieve actie op te hangen. De acties zijn declaratieve
// descriptors — `{ icon, label, color, onTrigger, fullSwipe }` — zodat er later
// andere acties (archiveren, toewijzen) inpluggen zonder dit component te wijzigen.
//
// Belangrijk:
//  - De zichtbare knop in de rij (bv. een delete-IconButton) blíjft bestaan als
//    toegankelijke + web-fallback; de swipe is een snellere ingang naar hetzelfde.
//  - `left` (verwijderen) toont fysiek rechts (`renderRightActions`, onthuld bij
//    naar-links-vegen); `right` (uitstellen) toont fysiek links (`renderLeftActions`,
//    bij naar-rechts-vegen). gesture-handler rapporteert echter de *veegrichting*:
//    naar-links → 'left', naar-rechts → 'right' (op toestel geverifieerd) — zie de
//    mapping in `onWillOpen` hieronder.
//  - Op web (waar veeg-gestures onbetrouwbaar zijn) renderen we de kale rij; de
//    knop-fallback dekt daar de actie.
//  - Triggert op `onSwipeableWillOpen` zodat een besliste veeg meteen voelt, en
//    sluit de rij daarna weer (de actie zelf — undo-toast etc. — leeft in onTrigger).
// ===========================================================================
// Het gekleurde veeg-vlak achter de rij. `side`: 'left' (panel links, links
// uitgelijnd) of 'right' (panel rechts). Benoemde component (geen anonieme
// render-arrow) zodat de actie-descriptor netjes herbruikbaar blijft.
function SwipeActionPanel({ action, side }) {
  return (
    <View style={{
      flex: 1, marginBottom: 10, borderRadius: radius.md,
      backgroundColor: action.color ?? (side === 'right' ? colors.danger : colors.forest),
      flexDirection: 'row', alignItems: 'center',
      justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
      paddingHorizontal: space.lg,
    }}>
      <Row gap={space.xs} align="center">
        {action.icon ? <Icon name={action.icon} size={20} color={colors.onDark} weight="bold" /> : null}
        {action.label ? <Text style={{ ...type.button, color: colors.onDark }}>{action.label}</Text> : null}
      </Row>
    </View>
  );
}

export function SwipeRow({ left, right, children, friction = 2, threshold = 44 }) {
  const ref = useRef(null);

  // Web: geen betrouwbare veeg → render de kale rij (knop-fallback dekt de actie).
  if (Platform.OS === 'web' || (!left && !right)) return children;

  const onWillOpen = (direction) => {
    // `direction` is de richting van de veeg-beweging (op toestel geverifieerd):
    // naar LINKS vegen → 'left' → de `left`-actie (verwijderen, rood, rechter-paneel);
    // naar RECHTS vegen → 'right' → de `right`-actie (uitstellen, groen, linker-paneel).
    const action = direction === 'left' ? left : right;
    ref.current?.close?.();
    action?.onTrigger?.();
  };

  // Veegacties ook bereikbaar zonder vegen (A11Y-1): VoiceOver/TalkBack kunnen ze niet
  // uitvoeren, dus we bieden ze als custom accessibility-acties aan (rotor/acties-menu).
  const a11yActions = [
    ...(left ? [{ name: 'leftAction', label: left.label }] : []),
    ...(right ? [{ name: 'rightAction', label: right.label }] : []),
  ];
  const onA11yAction = (e) => {
    const action = e.nativeEvent.actionName === 'leftAction' ? left : right;
    action?.onTrigger?.();
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={friction}
      leftThreshold={threshold}
      rightThreshold={threshold}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={right ? () => <SwipeActionPanel action={right} side="left" /> : undefined}
      renderRightActions={left ? () => <SwipeActionPanel action={left} side="right" /> : undefined}
      onSwipeableWillOpen={onWillOpen}
    >
      <View accessibilityActions={a11yActions} onAccessibilityAction={onA11yAction}>
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}

// ===========================================================================
// Chip — filter/keuze-pil. `active` reflecteert in accessibilityState.selected.
// ===========================================================================
export function Chip({ label, icon, active, color, onPress, onLongPress, longPressActionLabel, accessibilityHint }) {
  const tint = color || colors.forest;
  // Actief: de chip vult met de (dynamische) tint — kies de voorgrond op RUNTIME zodat
  // wit óf donkergroen de meest leesbare is. Vaste witte tekst zakt op de warme
  // categorie-/tagkleuren onder 3:1 (bv. oker ≈ 2.0:1). Inactief: normale soft-tekst.
  const fg = active ? pickReadable(tint, colors.onAccent, colors.onDark) : colors.inkSoft;
  // Long-press-actie ook bereikbaar voor de screenreader (A11Y-2/A9): een long-press is
  // niet uitvoerbaar via VoiceOver/TalkBack, dus bieden we 'm als custom actie aan.
  const longPressA11y = onLongPress && longPressActionLabel ? {
    accessibilityActions: [{ name: 'longpress', label: longPressActionLabel }],
    onAccessibilityAction: (e) => { if (e.nativeEvent.actionName === 'longpress') onLongPress(); },
  } : null;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!active }}
      {...longPressA11y}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 44, // 44pt-aanraaknorm (A11Y-2/A5)
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        alignSelf: 'center', // niet verticaal meerekken in een (ScrollView-)rij
        marginRight: space.sm, // chips beheren hun eigen tussenruimte (ook in ScrollViews)
        paddingHorizontal: space.md,
        justifyContent: 'center',
        borderRadius: radius.md, // zacht-vierkant i.p.v. volledige pil
        backgroundColor: active ? tint : (pressed ? colors.surfaceAlt : colors.surface),
        borderWidth: 1.5,
        borderColor: active ? tint : colors.line,
      })}
    >
      {icon ? <Icon name={icon} size={16} color={fg} weight={active ? 'fill' : 'regular'} /> : null}
      <Text style={{ color: fg, fontFamily: font.semi, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

// ===========================================================================
// ReactionBar — emoji-reacties op een tijdlijn-doel (post of systeem-event; TML-3).
// Teller-chips (emoji + aantal, opgelicht als jij zelf reageerde) + een "+"-knop die
// een klein vast setje emoji uitklapt. De aggregatie/togglelogica leeft buiten dit
// component (lib/timeline.js + lib/useReactions.js); dit is puur presentatie.
// ===========================================================================

// Vast, klein setje reactie-emoji: dekt de gangbare top-reacties zonder een volledig
// emoji-toetsenbord. Volgorde = weergavevolgorde in de picker.
export const REACTION_EMOJI = ['👍', '❤️', '😂', '🎉', '👏', '😮'];

export function ReactionBar({ reactions = [], onToggle, style }) {
  const [picking, setPicking] = useState(false);
  // Chip-boxstijl gedeeld tussen teller-chip en picker-emoji: één rustige pil-vorm.
  const box = (mine, pressed) => ({
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34,
    paddingHorizontal: space.sm, borderRadius: radius.md, justifyContent: 'center',
    backgroundColor: mine ? colors.forestTint : (pressed ? colors.surfaceAlt : colors.surface),
    borderWidth: 1.5, borderColor: mine ? colors.forest : colors.line,
  });
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }, style]}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onToggle?.(r.emoji)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${r.emoji} ${r.count}`}
          accessibilityState={{ selected: r.mine }}
          style={({ pressed }) => box(r.mine, pressed)}
        >
          <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
          <Text style={{ fontSize: 13, fontFamily: font.semi, color: r.mine ? colors.brandText : colors.inkSoft }}>{r.count}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => setPicking((v) => !v)}
        hitSlop={hitSlopFor(34)}
        accessibilityRole="button"
        accessibilityLabel={t('timeline.react')}
        accessibilityState={{ expanded: picking }}
        style={({ pressed }) => ({
          width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderWidth: 1.5, borderColor: colors.line,
        })}
      >
        <Icon name="add" size={16} color={colors.inkSoft} />
      </Pressable>
      {picking ? REACTION_EMOJI.map((e) => (
        <Pressable
          key={e}
          onPress={() => { setPicking(false); onToggle?.(e); }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={e}
          style={({ pressed }) => ({
            minHeight: 34, paddingHorizontal: space.xs, borderRadius: radius.md, justifyContent: 'center',
            backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
          })}
        >
          <Text style={{ fontSize: 22 }}>{e}</Text>
        </Pressable>
      )) : null}
    </View>
  );
}

// ===========================================================================
// Checkbox — afvinken. Toegankelijk (rol checkbox + checked-state) en altijd
// ten minste 48dp tikbaar via hitSlop, ook al is het vinkje klein.
// ===========================================================================
export function Checkbox({ checked, onPress, color = colors.forest, size = 26, shape = 'square', accessibilityLabel, testID }) {
  // "Vier de voortgang": het vinkje popt zacht op bij afvinken. Niet bij het
  // uitvinken, en niet bij "verminder beweging".
  const scale = useRef(new Animated.Value(1)).current;
  const wasChecked = useRef(checked);
  useEffect(() => {
    if (checked && !wasChecked.current && !prefersReducedMotion()) {
      scale.setValue(0.4);
      Animated.spring(scale, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 4, tension: 160 }).start();
    }
    wasChecked.current = checked;
  }, [checked, scale]);
  return (
    <Pressable
      onPress={() => { tapLight(); onPress?.(); }}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: !!checked }}
      hitSlop={hitSlopFor(size)}
      style={{
        width: size, height: size, borderRadius: shape === 'round' ? size / 2 : 8,
        borderWidth: 2,
        borderColor: checked ? colors.done : color,
        backgroundColor: checked ? colors.done : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {checked ? (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Icon name="check" size={size * 0.72} color={colors.onDark} weight="bold" />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

// ===========================================================================
// Badge — klein statuslabel of telling. tone: neutral|success|warning|danger|info|brand
// ===========================================================================
export function Badge({ label, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: colors.surfaceAlt,   fg: colors.inkSoft },
    success: { bg: colors.successSoft,  fg: colors.success },
    warning: { bg: colors.warningSoft,  fg: colors.warning },
    danger:  { bg: colors.dangerSoft,   fg: colors.danger },
    info:    { bg: colors.infoSoft,     fg: colors.info },
    brand:   { bg: colors.forestTint,   fg: colors.brandText },
    // Kenteken: een herkenbaar geel NL-plaatje. Donkere tekst is hier hardgecodeerd
    // (níét via `ink`): een plaatje is altijd zwart-op-geel, ook in donkere modus.
    plate:   { bg: colors.ocher,        fg: '#1A2420' },
  }[tone] ?? {};
  const isPlate = tone === 'plate';
  return (
    <View style={{ backgroundColor: tones.bg, borderRadius: isPlate ? radius.sm : radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: tones.fg, fontSize: 12, fontFamily: font.semi, letterSpacing: isPlate ? 1 : 0 }}>{label}</Text>
    </View>
  );
}

// ===========================================================================
// Avatar — gebruiker als emoji of initiaal.
// ===========================================================================
export function Avatar({ emoji, name, size = 36 }) {
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: colors.ocherSoft,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji || (name?.[0] ?? '🙂')}</Text>
    </View>
  );
}

// ===========================================================================
// AvatarSelect — horizontale keuzerij van leden (één selectie). Vervangt de
// losse "wie?"-pickers die schermen eerst zelf bouwden (taak-toewijzing,
// uitgave-betaler). Geef `includeEveryone` mee voor een "Iedereen"-optie
// vooraan; dan staat `selectedId === null` voor iedereen.
// ===========================================================================
export function AvatarSelect({ members, selectedId, onSelect, includeEveryone = false, everyoneLabel = 'Iedereen', style }) {
  const Cell = ({ label, selected, onPress, children }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      style={{ alignItems: 'center', marginRight: space.md, opacity: selected ? 1 : 0.5 }}
    >
      <View style={{ borderWidth: 2, borderRadius: radius.pill, borderColor: selected ? colors.forest : 'transparent' }}>
        {children}
      </View>
      <Text style={[type.caption, { marginTop: space.xs }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
      {includeEveryone ? (
        <Cell label={everyoneLabel} selected={selectedId == null} onPress={() => onSelect(null)}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="group" size={22} color={colors.forest} />
          </View>
        </Cell>
      ) : null}
      {members.map((m) => (
        <Cell key={m.id} label={m.display_name?.split(' ')[0]} selected={selectedId === m.id} onPress={() => onSelect(m.id)}>
          <Avatar emoji={m.avatar_emoji} name={m.display_name} size={48} />
        </Cell>
      ))}
    </ScrollView>
  );
}

// ===========================================================================
// SectionHeader — kop boven een lijst-sectie, met optionele telling, tint en
// actie rechts. Vervangt de losse <Text style={type.label}>-koppen.
// ===========================================================================
export function SectionHeader({ title, count, tint = colors.inkSoft, action }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, marginTop: space.xs }}>
      <Text style={[type.label, { color: tint }]}>
        {title}{count != null ? ` · ${count}` : ''}
      </Text>
      {action ?? null}
    </View>
  );
}

// ===========================================================================
// SegmentedControl — rij van gelijke segmenten, precies één actief. Generiek
// (options/value/onChange) zodat 'ie overal herbruikbaar is (bv. de tijdscope-
// switcher Dag·Week·Maand). Animeert de wissel met animateNextLayout (no-op bij
// reduced motion/web).
//   options: [{ value, label }]
// ===========================================================================
export function SegmentedControl({ options, value, onChange, style }) {
  return (
    <View style={[{
      flexDirection: 'row', backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md, padding: 3,
    }, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => { if (!active) { animateNextLayout(); onChange(opt.value); } }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            hitSlop={6}
            style={[{
              flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', // 44pt-norm (A11Y-2/A5)
              borderRadius: radius.sm,
              backgroundColor: active ? colors.surface : 'transparent',
            }, active ? elevation.e1 : null]}
          >
            <Text style={[type.button, { fontSize: 14, color: active ? colors.forest : colors.inkSoft }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ===========================================================================
// ScreenHeader — vaste kop bovenaan een scherm: grote titel + korte subtitel,
// optioneel een actie rechts. Eén kop-vorm door de hele app = voorspelbaar.
//
// `module` (optioneel): de module-key. Dan draagt de kop het gekleurde icoonvlak van
// die module (DESIGN.md "Module-kleuren") — zo is in één oogopslag te zien in welke
// module je bent, zónder dat kleur het énige signaal is: de titel noemt 'm gewoon.
// De tint komt uit de registry (lib/modules.js) → hetzelfde token dat de widget-tegel
// gebruikt. Het vlak is puur decoratief en blijft dus buiten de screenreader.
// ===========================================================================
export function ScreenHeader({ title, subtitle, right, module, style }) {
  const meta = module ? getModule(module) : null;
  const tint = meta?.colorToken ? colors[meta.colorToken] : null;
  return (
    <View style={[{ paddingHorizontal: screenPadding, paddingTop: screenPadding, paddingBottom: space.sm }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {tint ? (
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 40, height: 40, borderRadius: radius.md, backgroundColor: tint,
              alignItems: 'center', justifyContent: 'center', marginRight: space.sm,
            }}
          >
            <Icon name={meta.icon} size={22} color={pickReadable(tint, colors.onAccent, colors.onDark)} />
          </View>
        ) : null}
        {/* Header-rol (A11Y-1): de screenreader kondigt 'm als kop aan en kan per kop navigeren. */}
        <Text accessibilityRole="header" style={[type.h1, { flex: 1 }]}>{title}</Text>
        {right ?? null}
      </View>
      {subtitle ? <Text style={[type.body, { color: colors.inkSoft, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

// ===========================================================================
// ModuleHelpButton — de rustige "hoe werkt dit?"-ingang in de kop-rechts-zone van
// een module. Eén cross-module patroon (DESIGN.md "voorspelbaar"): overal dezelfde
// info-knop die een drawer opent met uitleg van de huidige module — waarvóór is het
// en hoe werkt het (tekst uit lib/moduleHelp.js). Vervangt losse, cryptische
// kop-icoonknoppen. Optioneel `actions`: module-specifieke snelkoppelingen die
// duidelijk gelabeld onderin de drawer landen (de drawer sluit vóór het navigeren).
// ===========================================================================
export function ModuleHelpButton({ module, actions }) {
  const [open, setOpen] = useState(false);
  const help = moduleHelp[module];
  if (!help) return null;
  const runAction = (fn) => { setOpen(false); fn?.(); };
  return (
    <>
      <IconButton icon="info" accessibilityLabel={t('help.button')} tint={colors.forest} onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          <Text accessibilityRole="header" style={[type.h2, { marginBottom: space.xs }]}>{help.title}</Text>
          <Text style={[type.bodyLg, { color: colors.inkSoft, marginBottom: space.md }]}>{help.intro}</Text>
          {help.points.map((point, i) => (
            <Row key={i} align="flex-start" gap={space.sm} style={{ marginBottom: space.sm }}>
              <View style={{ marginTop: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ocher }} />
              <Text style={[type.body, { flex: 1 }]}>{point}</Text>
            </Row>
          ))}
          {actions?.length ? (
            <View style={{ marginTop: space.md }}>
              <Text style={[type.label, { marginBottom: space.sm }]}>{t('help.actions')}</Text>
              {actions.map((a, i) => (
                <ItemRow
                  key={i}
                  leading={<Icon name={a.icon} size={22} color={colors.forest} />}
                  title={a.label}
                  chevron
                  onPress={() => runAction(a.onPress)}
                />
              ))}
            </View>
          ) : null}
        </SheetScrollView>
      </BottomSheet>
    </>
  );
}

// ===========================================================================
// ModalHeader — kop van een modaal scherm (editor). Twee vormen:
//   • met onConfirm → Annuleer · titel · Bewaar (drie kolommen, tekstacties);
//   • zonder onConfirm → grote titel + ✕ sluiten rechts.
// Béíde vormen zijn zelf-gepadded (paddingHorizontal: space.lg) zodat een scherm de
// kop direct onder een SafeAreaView/sheet kan plaatsen zónder eigen rand — anders
// plakt de titel tegen de hoek. Wrap de kop dus níét nog eens in een padded View.
// ===========================================================================
export function ModalHeader({ title, onClose, onConfirm, confirmLabel = 'Bewaar', cancelLabel = 'Annuleer', busy, confirmDisabled = false, backLabel }) {
  if (onConfirm) {
    // De bevestig-knop is "dood" zolang 'ie bezig is óf de invoer ongeldig is
    // (confirmDisabled): gedimd én niet-tikbaar, zodat het scherm zelf vertelt dat er
    // nog iets ontbreekt i.p.v. een tik die stilletjes niks doet (UX-conventie: een
    // primaire actie is alleen actief als 'ie ook iets dóet).
    const inert = !!busy || !!confirmDisabled;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md }}>
        {/* Tekstacties zijn maar ~22pt hoog; hitSlopFor trekt het tikvlak naar de
            aanraaknorm zonder de kop hoger te maken (a11y-review 2026-07-02). */}
        <Pressable onPress={onClose} testID="t-cancel" hitSlop={hitSlopFor(22)} accessibilityRole="button" accessibilityLabel={cancelLabel}>
          <Text style={[type.title, { fontFamily: font.semi, color: colors.inkSoft }]}>{cancelLabel}</Text>
        </Pressable>
        <Text style={type.title}>{title}</Text>
        <Pressable onPress={onConfirm} disabled={inert} testID="t-save" hitSlop={hitSlopFor(22)} accessibilityRole="button" accessibilityLabel={confirmLabel} accessibilityState={{ busy: !!busy, disabled: inert }}>
          <Text style={[type.title, { fontFamily: font.semi, color: colors.forest, opacity: inert ? 0.5 : 1 }]}>{confirmLabel}</Text>
        </Pressable>
      </View>
    );
  }
  // Met een herkomst-naam (UX-10): een ‹-lintje bovenaan dat tikbaar terugkeert,
  // i.p.v. de naamloze ✕ — zo zie je wáár je naartoe gaat. Zónder backLabel valt
  // 'ie terug op de bestaande titel + ✕-vorm.
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
      {backLabel ? (
        <Pressable
          onPress={onClose} hitSlop={hitSlopFor(24)}
          accessibilityRole="button" accessibilityLabel={t('common.backTo', { label: backLabel })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: space.xs, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="back" size={20} color={colors.forest} />
          <Text style={[type.title, { color: colors.forest, fontFamily: font.semi }]} numberOfLines={1}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.h1, { flex: 1 }]}>{title}</Text>
        {backLabel ? null : <IconButton icon="close" accessibilityLabel={t('common.close')} tint={colors.inkSoft} onPress={onClose} />}
      </View>
    </View>
  );
}

// ===========================================================================
// Editor — gedeeld omhulsel voor een modaal bewerk-/aanmaakscherm: veilige rand,
// toetsenbord-ontwijking, een **vaste** ModalHeader bovenaan (de Bewaar-knop blijft
// dus altijd in beeld, ook bij een lang formulier) en een scrollend inhoudsvlak met
// standaard padding. Eén omhulsel = elke editor voelt hetzelfde en de "één
// confirm-plek"-conventie (DESIGN.md) is structureel geborgd.
// ===========================================================================
// Bevestiging bij het weggooien van niet-bewaarde wijzigingen, via het eigen
// dialoogsysteem (UX-6) — één codepad voor alle platforms (de oude web-tak met
// window.confirm vervalt). Bevestigt de gebruiker, dan pas sluiten we echt.
function confirmDiscard(onConfirm) {
  dialog.confirm({
    title: t('common.discard.title'),
    body: t('common.discard.body'),
    confirmLabel: t('common.discard.confirm'),
    cancelLabel: t('common.discard.stay'),
    tone: 'danger',
  }).then((ok) => { if (ok) onConfirm?.(); });
}

// ===========================================================================
// useDiscardGuard — de discard-guard van de Editor als losse hook, zodat schermen
// die níet in de `Editor` zitten (bv. de voertuig-editor met z'n eigen ModalHeader)
// dezelfde bescherming krijgen: sluiten-met-wijzigingen vraagt eerst om bevestiging,
// en de Android hardware-back wordt onderschept zolang er niet-bewaarde wijzigingen zijn.
// Geeft `requestClose` terug — hang die aan de sluit-/annuleer-actie.
// ===========================================================================
export function useDiscardGuard(dirty, onClose) {
  const requestClose = useCallback(() => {
    if (dirty) confirmDiscard(onClose);
    else onClose?.();
  }, [dirty, onClose]);

  // Android hardware-back onderscheppen zolang er niet-bewaarde wijzigingen zijn.
  useEffect(() => {
    if (!dirty || Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { requestClose(); return true; });
    return () => sub.remove();
  }, [dirty, requestClose]);

  return requestClose;
}

export function Editor({
  title, onClose, onConfirm, busy, confirmLabel, cancelLabel,
  children, scrollRef, contentContainerStyle, dirty = false, confirmDisabled = false,
}) {
  // Sluiten met niet-bewaarde wijzigingen vraagt eerst om bevestiging, zodat een per
  // ongeluk ingedrukte terug-knop (of de Annuleer-knop) een ingevuld formulier niet
  // weggooit. Schoon formulier ⇒ direct sluiten, geen frictie.
  const requestClose = useDiscardGuard(dirty, onClose);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Android edge-to-edge duwt de content niet vanzelf boven het toetsenbord; 'height'
          krimpt de KAV tot het zichtbare gebied zodat de ScrollView (en het actieve veld)
          zichtbaar blijven. iOS: 'padding'. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ModalHeader
          title={title} onClose={requestClose} onConfirm={onConfirm} busy={busy}
          confirmLabel={confirmLabel} cancelLabel={cancelLabel} confirmDisabled={confirmDisabled}
        />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxl }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ===========================================================================
// useErrorScroll — scroll-naar-eerste-fout voor een Editor (formulier-fundament).
// De editor registreert per gevalideerd veld z'n y-positie (onLayout) en scrollt
// daar bij een gefaalde submit naartoe, zodat een fout onderin (bv. "voor wie?")
// nooit onzichtbaar onder de vouw blijft. Ontbreekt een positie nog, dan is het
// een veilige no-op. Werkt samen met `firstError(order)` uit useEntityForm:
//   const { scrollRef, register, scrollToField } = useErrorScroll();
//   <Editor scrollRef={scrollRef}> <View onLayout={register('title')}>…</View>
//   if (!ok) scrollToField(form.firstError(FIELD_ORDER));
// ===========================================================================
export function useErrorScroll() {
  const scrollRef = useRef(null);
  const positions = useRef({});
  const register = useCallback((key) => (e) => {
    positions.current[key] = e.nativeEvent.layout.y;
  }, []);
  const scrollToField = useCallback((key) => {
    if (!key) return;
    const y = positions.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
  }, []);
  return { scrollRef, register, scrollToField };
}

// ===========================================================================
// RevealLink — de rustige "+ label"-actie die een optioneel veld onthult
// (beschrijving, herhaal-einde …). Eén affordance voor progressieve onthulling
// zodat elk formulier optionele velden op dezelfde manier bijschakelt, i.p.v. een
// eigen tekstlink per scherm. Geef marges mee via `style`.
// ===========================================================================
export function RevealLink({ label, onPress, icon = 'add', style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // De link zelf is maar één tekstregel (~18pt); hitSlopFor trekt het tikvlak
      // naar de aanraaknorm zonder de formulier-lay-out te verstoren (a11y-review).
      hitSlop={hitSlopFor(18)}
      style={({ pressed }) => ([{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 }, style])}
    >
      <Icon name={icon} size={16} color={colors.forest} />
      <Text style={[type.label, { color: colors.forest }]}>{label}</Text>
    </Pressable>
  );
}

// ===========================================================================
// BottomSheet — gedeeld onderaan-ingeschoven paneel (recept kiezen, boodschappen-
// preview, dagboekfoto …). Eén omhulsel zodat élke sheet:
//   • een gedimde, aantikbare achtergrond heeft (tik ernaast = sluiten);
//   • zijn onderkant vrijhoudt van de Android-systeemnavigatie en de iOS-home-
//     indicator via `useSafeAreaInsets()` — anders valt de laatste knop/inhoud
//     onder de native controls (backlog UX-5);
//   • optioneel met het toetsenbord meebeweegt (`avoidKeyboard`) zodat een
//     invoerveld niet onder het toetsenbord verdwijnt.
// Geef de kop (ModalHeader) en inhoud als children mee; de sheet pad zichzelf
// onderaan, dus voeg daar geen eigen safe-area-padding meer toe.
// ===========================================================================
// Context waarmee een sheet zijn scrollpositie + native-scroll-gesture deelt met de
// BottomSheet, zodat de omlaag-sleep-om-te-sluiten samenwerkt met scrollen (UX, batch 2).
const SheetScrollContext = createContext(null);

// SheetScrollView — gebruik dit i.p.v. een kale ScrollView ín een BottomSheet wanneer de
// inhoud verticaal scrollt. Het deelt de scrollpositie zodat de hele drawer naar beneden
// geveegd kan worden om te sluiten, terwijl **scrollen voorrang houdt**: de sheet schuift
// pas mee zodra de lijst bovenaan staat (scrollY ≤ 0). Buiten een BottomSheet valt 'ie
// terug op een gewone ScrollView.
export function SheetScrollView({ children, ...props }) {
  const ctx = useContext(SheetScrollContext);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { if (ctx) ctx.scrollY.value = e.contentOffset.y; },
  });
  if (!ctx) return <ScrollView {...props}>{children}</ScrollView>;
  return (
    <GestureDetector gesture={ctx.nativeScroll}>
      <Reanimated.ScrollView {...props} scrollEventThrottle={16} onScroll={onScroll}>
        {children}
      </Reanimated.ScrollView>
    </GestureDetector>
  );
}

export function BottomSheet({ visible, onClose, children, maxHeight = '90%', avoidKeyboard = false }) {
  const insets = useSafeAreaInsets();

  // Omlaag-swipen op de HELE drawer om te sluiten (UX, batch 2). De Pan loopt **simultaan**
  // met de (optionele) scroll, dus scrollen wordt nóóit geblokkeerd; de sheet schuift alleen
  // mee als de lijst al bovenaan staat (`scrollY ≤ 0`) en je omlaag trekt. Voorbij de drempel
  // of met genoeg snelheid → sluiten (de Modal-slide schuift 'm uit). Sheets zonder scroll
  // (scrollY blijft 0) zijn zo overal sleepbaar; scrollende sheets gebruiken SheetScrollView.
  const ty = useSharedValue(0);
  const scrollY = useSharedValue(0);
  useEffect(() => { if (visible) { ty.value = 0; scrollY.value = 0; } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => onClose?.(), [onClose]);
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY(14)               // alleen op een duidelijke verticale beweging
    .onUpdate((e) => { 'worklet'; if (scrollY.value <= 0 && e.translationY > 0) ty.value = e.translationY; })
    .onEnd((e) => {
      'worklet';
      if (scrollY.value <= 0 && (e.translationY > 120 || e.velocityY > 800)) runOnJS(close)();
      else ty.value = withSpring(0, { damping: 22, stiffness: 240 });
    })
    .simultaneousWithExternalGesture(nativeScroll),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [close, nativeScroll]);
  const sheetAnim = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const ctxValue = useMemo(() => ({ scrollY, nativeScroll }), [scrollY, nativeScroll]);

  const panel = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
      />
      <GestureDetector gesture={pan}>
        <Reanimated.View
          style={[{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
            maxHeight,
            paddingBottom: Math.max(insets.bottom, space.md),
          }, elevation.e2, sheetAnim]}
        >
          {/* Grijp-handvat: de affordance voor swipe-to-dismiss (de hele sheet is sleepbaar). */}
          <View accessibilityRole="adjustable" accessibilityLabel={t('common.close')}
            style={{ height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          </View>
          <SheetScrollContext.Provider value={ctxValue}>
            {children}
          </SheetScrollContext.Provider>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {avoidKeyboard ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            {panel}
          </KeyboardAvoidingView>
        ) : panel}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ===========================================================================
// Collapsible — inklapbaar blok met een rustige samenvattingsrij. Voor
// geavanceerde, zelden-gewijzigde opties (zoals "Delen met") die de hoofd-flow
// van een formulier niet horen te onderbreken: standaard dicht met een
// één-regel-samenvatting, opent bij tikken. Geef `defaultOpen` mee om 'm open te
// starten (bv. wanneer de waarde afwijkt van de standaard).
// ===========================================================================
export function Collapsible({ label, summary, defaultOpen = false, children, style }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => { animateNextLayout(); setOpen((o) => !o); };
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget }}
      >
        <View style={{ flex: 1 }}>
          <Text style={type.label}>{label}</Text>
          {!open && summary ? <Text style={[type.caption, { marginTop: 2 }]}>{summary}</Text> : null}
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
      </Pressable>
      {open ? <View style={{ marginTop: space.sm }}>{children}</View> : null}
    </View>
  );
}

// ===========================================================================
// DateStepper — dag-voor-dag datumkiezer (‹ wo 4 juni ›). Geen native picker,
// zodat web/iOS/Android gelijk zijn. Eén gedeelde versie voor elke editor
// (taken, uitgaven, terugkerend, bonnen, reserveren). `style` voor marges.
// ===========================================================================
export function DateStepper({ date, onChange, style }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5,
      borderColor: colors.line, padding: space.xs,
    }, style]}>
      <IconButton icon="back" tint={colors.forest} accessibilityLabel={t('task.date.prev')}
        onPress={() => onChange(addDays(date, -1))} />
      <Text style={[type.title, { fontFamily: font.semi }]}>
        {format(date, 'EEEE d MMMM', { locale: dateLocale() })}
      </Text>
      <IconButton icon="forward" tint={colors.forest} accessibilityLabel={t('task.date.next')}
        onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}

// ===========================================================================
// Banner — inline boodschap (uitleg, succes, waarschuwing, fout). Voor korte
// menselijke meldingen in de flow; niet voor blokkerende dialogen.
// ===========================================================================
export function Banner({ tone = 'info', icon, title, children, style }) {
  const tones = {
    info:    { bg: colors.infoSoft,    fg: colors.info,    icon: 'info' },
    success: { bg: colors.successSoft, fg: colors.success, icon: 'success' },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' },
    danger:  { bg: colors.dangerSoft,  fg: colors.danger,  icon: 'warning' },
  }[tone] ?? {};
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[{ flexDirection: 'row', gap: space.sm, backgroundColor: tones.bg, borderRadius: radius.md, padding: space.md }, style]}
    >
      <Icon name={icon ?? tones.icon} size={18} color={tones.fg} weight="fill" />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={{ ...type.title, fontSize: 15, color: tones.fg }}>{title}</Text> : null}
        {typeof children === 'string'
          ? <Text style={[type.body, { color: colors.ink }]}>{children}</Text>
          : children}
      </View>
    </View>
  );
}

// ===========================================================================
// Empty — vriendelijke lege staat. Optioneel een actieknop eronder, zodat een
// leeg scherm meteen een volgende stap aanbiedt i.p.v. een dood einde.
// ===========================================================================
export function Empty({ icon, emoji, illustration, title, subtitle, actionTitle, onAction }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.xs }}>
      {illustration ? (
        <Illustration name={illustration} size={148} style={{ marginBottom: space.sm }} />
      ) : (
        <View style={{
          width: 88, height: 88, borderRadius: 44, marginBottom: space.sm,
          backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
        }}>
          {icon
            ? <Icon name={icon} size={40} color={colors.inkSoft} />
            : <Text style={{ fontSize: 40 }}>{emoji}</Text>}
        </View>
      )}
      <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text>
      {subtitle ? <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center' }]}>{subtitle}</Text> : null}
      {actionTitle && onAction
        ? <Button title={actionTitle} variant="accent" fullWidth={false} onPress={onAction} style={{ marginTop: space.md, alignSelf: 'center' }} />
        : null}
    </View>
  );
}

// ===========================================================================
// Celebrate — korte "vier de voortgang"-overlay (STR-11 / DESIGN-principe 6): een
// zachte schaal+fade van een berichtje midden in beeld wanneer je iets helemaal
// afrondt ("alles af vandaag"). Houdt even vast en verdwijnt dan vanzelf. Bij
// "verminder beweging" tonen we 'm zonder animatie en verbergen 'm direct weer,
// zodat de viering nooit afleidt. `show` true → speelt af, roept `onDone` aan.
// ===========================================================================
export function Celebrate({ show, message, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;
  // onDone via ref zodat een nieuwe functie-identiteit per render het effect (en
  // dus de animatie) niet opnieuw start; we draaien puur op het omslaan van `show`.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!show) return undefined;
    const done = () => onDoneRef.current?.();
    if (prefersReducedMotion()) {
      const id = setTimeout(done, 900);
      return () => clearTimeout(id);
    }
    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: NATIVE_DRIVER, friction: 5, tension: 140 }),
      Animated.delay(900),
      Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: NATIVE_DRIVER }),
    ]);
    seq.start(({ finished }) => { if (finished) done(); });
    return () => seq.stop();
  }, [show, anim]);

  if (!show) return null;
  const reduced = prefersReducedMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}
      accessibilityLiveRegion="polite" accessibilityRole="alert">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{
          opacity: reduced ? 1 : anim,
          transform: reduced ? [] : [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          backgroundColor: colors.forest, borderRadius: radius.lg,
          paddingVertical: space.md, paddingHorizontal: space.lg, maxWidth: '80%',
        }}>
          <Text style={{ ...type.title, color: colors.onDark, textAlign: 'center' }}>{message}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ===========================================================================
// SplashWait — merkvast wachtscherm tijdens het opstarten (auth/huishoudens laden).
// Vervangt de kale spinner: één rustige illustratie met zachte entree (respecteert
// "verminder beweging" via Illustration) + de app-naam en tagline. Thema-bewust via
// tokens, dus ook in donkere modus rustig. Decoratief — geen interactie.
// ===========================================================================
export function SplashWait() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl }}>
      <Illustration name="today" size={168} />
      <Text style={[type.h1, { color: colors.forest, marginTop: space.md }]}>Huishoek</Text>
      <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center' }]}>{t('auth.tagline')}</Text>
    </SafeAreaView>
  );
}

// ===========================================================================
// EmojiPicker — rij keuzevakjes om een emoji-icoon te kiezen (huishouden,
// subgroep, onboarding). Eén keer goed: tikvlak ≥ touchTarget, geselecteerde
// staat via accessibilityState, token-kleuren. Geef de toegestane `options` mee.
// ===========================================================================
export function EmojiPicker({ options, value, onChange, size = 48, style }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, style]}>
      {options.map((e) => {
        const selected = value === e;
        return (
          <Pressable
            key={e}
            onPress={() => onChange(e)}
            accessibilityRole="button"
            accessibilityLabel={`Icoon ${e}`}
            accessibilityState={{ selected }}
            style={{
              width: size, height: size, borderRadius: radius.md,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: selected ? colors.ocherSoft : colors.surfaceAlt,
              borderWidth: 1.5, borderColor: selected ? colors.ocher : 'transparent',
            }}
          >
            <Text style={{ fontSize: size * 0.5 }}>{e}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ===========================================================================
// ListSkeleton — zachte laad-placeholder in de vorm van een paar lijstrijen,
// i.p.v. content die abrupt inpopt. Pulseert rustig (respecteert "verminder
// beweging"). Gebruik tijdens de eerste `loading` van een lijstscherm.
// ===========================================================================
export function ListSkeleton({ count = 5, style }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[{ opacity: pulse }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md,
            backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
            marginBottom: 10, borderWidth: 1, borderColor: colors.line,
          }}
        >
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surfaceAlt }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '60%', height: 14, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }} />
            <View style={{ width: '35%', height: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

// ===========================================================================
// Sparkline — kleine lijngrafiek (geen chart-library), schaalt op min/max van de
// reeks. `data`: [{ cents }]. Toont niets bij < 2 punten. Decoratief (cijfers staan
// los in de UI). Gebruikt o.a. door de prijstracker en kosten-inzichten.
// ===========================================================================
export function Sparkline({ data, width = 300, height = 56, stroke = colors.forest }) {
  if (!data || data.length < 2) return null;
  const cents = data.map((p) => p.cents);
  const min = Math.min(...cents), max = Math.max(...cents);
  const range = max - min || 1;
  const pad = 4;
  const pts = data.map((p, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((p.cents - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={pts} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ===========================================================================
// BarChart — eenvoudige staafgrafiek voor categorische/maandelijkse totalen.
// `data`: [{ label, value, highlight? }]. Schaalt op de hoogste waarde; staven met
// 0 krijgen een minimale stip-hoogte. Labels onder de staven. Decoratief: de
// schermtekst draagt de exacte cijfers. Eén accentkleur voor `highlight`.
// ===========================================================================
export function BarChart({ data = [], height = 140, barColor = colors.forest, highlightColor = colors.ocher }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const chartH = height - 22; // ruimte voor labels
  const gap = space.sm;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap }}>
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.value / max) * (chartH - 4)));
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{
                width: '100%', height: h, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm,
                backgroundColor: d.highlight ? highlightColor : barColor, opacity: d.value === 0 ? 0.25 : 1,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={[type.caption, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}
