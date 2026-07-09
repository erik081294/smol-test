import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Row } from '../ui';
import { Icon } from '../icons';
import { colors, radius, type, space, elevation, font } from '../theme';
import { widgetScheme } from './colorSchemes';

// WidgetTile — het gedeelde skelet van élke widget op de Vandaag-grid. Eén vorm en
// gedrag; de inhoud (stat/preview) is widget-eigen. Twee stijlen (VDG-5): playful
// (accent-wash + gekleurd icoon) of neutral (rustig oppervlak), per-module gekleurd
// (VDG-6). Vult zijn grid-cel (de grid bepaalt breedte/hoogte).
//
// Smalle tegel (1×1) — verticaal:        Brede tegel (2×1) mét details — kop boven, lijst eronder:
//   [icoon]                                [icoon] Titel ……………… stat   ›
//   Titel                                  ─ regel 1
//   stat (accent)                          ─ regel 2 · +N meer
//
// `showDetails` (default aan) bepaalt of een bréde tegel zijn preview toont; uit ⇒
// een rustige, brede stat-tegel zonder preview. In 1×1 is er geen ruimte voor details.
export function WidgetTile({
  moduleKey, style = 'playful', icon, title, stat, statColor, preview, onPress,
  size = '1x1', showDetails = true, children,
}) {
  const scheme = widgetScheme(moduleKey, style, colors);
  const wide = size !== '1x1';
  const body = preview ?? children ?? null;
  // Lijst-layout: alleen in een bréde tegel, met details aan én iets om te tonen. De titel
  // staat dan vol-breed bovenaan (valt netjes, kapt niet af) met de lijst eronder gestapeld.
  const listLayout = wide && showDetails && !!body;

  const iconChip = (dim) => (
    <View style={{
      width: dim, height: dim, borderRadius: dim / 2,
      backgroundColor: style === 'playful' ? scheme.accent : colors.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={Math.round(dim * 0.52)} color={style === 'playful' ? scheme.onAccent : scheme.icon} />
    </View>
  );
  const heading = (
    <>
      <Text style={[type.title, { fontSize: 14, marginTop: space.sm }]} numberOfLines={2}>{title}</Text>
      {stat ? (
        <Text style={[type.title, { fontSize: 17, color: statColor ?? scheme.stat, fontFamily: font.semi, marginTop: 2 }]} numberOfLines={2}>
          {stat}
        </Text>
      ) : null}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${stat ?? ''}`}
      // flex:1 → vult de (vaste) gridcel; overflow:hidden borgt dat een wat langere
      // preview binnen de tegel blíjft i.p.v. over de buur-tegel te tekenen (UX-24).
      style={({ pressed }) => [{
        flex: 1, minHeight: 116, borderRadius: radius.lg, padding: space.md,
        backgroundColor: scheme.bg, borderWidth: 1, borderColor: scheme.border,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      }, style === 'neutral' ? elevation.e1 : null]}
    >
      {listLayout ? (
        // Brede tegel: compacte kop (icoon + titel vol-breed + stat) bovenaan, dan de lijst
        // eronder gestapeld — i.p.v. de titel in een smalle kolom naast de inhoud te knijpen.
        <View style={{ flex: 1 }}>
          <Row align="center" gap={space.sm} style={{ marginBottom: space.xs }}>
            {iconChip(32)}
            <Text style={[type.title, { fontSize: 14, flex: 1 }]} numberOfLines={1}>{title}</Text>
            {stat ? (
              <Text style={[type.caption, { color: statColor ?? scheme.stat, fontFamily: font.semi, maxWidth: '46%' }]} numberOfLines={1}>
                {stat}
              </Text>
            ) : null}
            <Icon name="chevron" size={16} color={colors.inkFaint} />
          </Row>
          <View style={{ flex: 1 }}>{body}</View>
        </View>
      ) : (
        // Smalle tegel óf brede tegel zonder details: het vertrouwde verticale skelet.
        <>
          <Row justify="space-between" align="center">
            {iconChip(38)}
            <Icon name="chevron" size={16} color={colors.inkFaint} />
          </Row>
          {heading}
        </>
      )}
    </Pressable>
  );
}
