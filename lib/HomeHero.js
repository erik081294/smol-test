import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ProgressRing } from './widgets/ProgressRing';
import { Icon } from './icons';
import { colors, type, space, radius, elevation } from './theme';
import { t, plural } from './i18n';

// Hero-kaart bovenaan Vandaag: het persoonlijke, branded ankerpunt van het scherm.
// Toont huishouden + groet + een voortgangsring met de stand van vandaag (done/total
// dagtaken), met een feestelijke "alles-gedaan"-staat en een rustige-dag-staat. Eén
// blik = "hoe sta ik ervoor vandaag". Puur presentationeel; data komt via `progress`
// (lib/widgets/summaries.js → dayProgress) en `remaining` (de focuslijst-telling).

// Diepgroene merkkaart → witte tekst (zelfde contract als de primaire knop). Een
// halftransparante witte ring-track + oker voortgang lichten op tegen het groen.
const ON_DARK_SOFT = 'rgba(255,255,255,0.78)';
const ON_DARK_FAINT = 'rgba(255,255,255,0.62)';
const RING_TRACK = 'rgba(255,255,255,0.22)';

export function HomeHero({ householdName, householdEmoji, greeting, firstName, progress, remaining, loading = false, onPress }) {
  const { done, total, overdue, pct, allDone, nothingToday } = progress;

  // Tijdens de eerste (koude) laadbeurt is `tasks` nog leeg; toon dan een rustige
  // "laden"-tekst i.p.v. het misleidende "Een rustige dag" (UX-23) — anders lijkt
  // het scherm leeg/af terwijl er nog data onderweg is.
  const coldLoading = loading && total === 0 && overdue === 0;
  const subtitle = coldLoading ? t('today.loading')
    : nothingToday ? t('today.empty.title')
      : allDone ? t('today.allDone')
        : plural(remaining, 'today.remaining.one', 'today.remaining.other');

  // Ring-midden: vier de voltooiing, waarschuw bij pure achterstand, anders de score.
  let center;
  let ringPct = total ? pct : 0;
  if (coldLoading) {
    ringPct = 0;
    center = <Icon name="today" size={26} color={ON_DARK_FAINT} />;
  } else if (total > 0 && allDone) {
    ringPct = 1;
    center = <Icon name="check" size={30} color={colors.onDark} />;
  } else if (total > 0) {
    center = (
      <Text style={[type.title, { color: colors.onDark, fontWeight: '800' }]}>
        {done}<Text style={{ color: ON_DARK_FAINT }}>/{total}</Text>
      </Text>
    );
  } else if (overdue > 0) {
    center = <Icon name="warning" size={26} color={colors.ocher} />;
  } else {
    center = <Icon name="today" size={26} color={ON_DARK_SOFT} />;
  }

  const a11y = total > 0
    ? t('today.progress.a11y', { done, total })
    : (overdue > 0 ? plural(overdue, 'today.overdue.one', 'today.overdue.other') : t('today.empty.title'));

  const ring = (
    <ProgressRing size={76} stroke={8} pct={ringPct} color={colors.ocher} trackColor={RING_TRACK}>
      {center}
    </ProgressRing>
  );

  const inner = (
    <>
      <View style={{ flex: 1 }}>
        {householdName ? (
          <Text style={[type.caption, { color: ON_DARK_FAINT, textTransform: 'uppercase', letterSpacing: 1 }]} numberOfLines={1}>
            {householdEmoji} {householdName}
          </Text>
        ) : null}
        <Text style={[type.h2, { color: colors.onDark, marginTop: 2 }]} numberOfLines={1}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={[type.body, { color: ON_DARK_SOFT, marginTop: 4 }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {ring}
    </>
  );

  const cardStyle = [{
    backgroundColor: colors.forest, borderRadius: radius.lg, padding: space.lg,
    marginBottom: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md,
  }, elevation.e1];

  // Hele kaart → Taken (UX-22, batch 2): niet alleen de ring maar het volledige
  // groene kader is het tikdoel — dat las eerder als "dode" tekst. Eén knop met
  // een samengestelde a11y-omschrijving (groet + stand) zodat een screenreader de
  // kaart in één keer voorleest; zonder onPress blijft 'ie een statusindicator.
  if (onPress) {
    const cardA11y = `${greeting}${firstName ? `, ${firstName}` : ''}. ${subtitle} ${a11y}`;
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={cardA11y}
        accessibilityHint={t('today.progress.hint')}
        style={({ pressed }) => [...cardStyle, pressed ? { opacity: 0.85 } : null]}>
        {inner}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={a11y} style={cardStyle}>
      {inner}
    </View>
  );
}
