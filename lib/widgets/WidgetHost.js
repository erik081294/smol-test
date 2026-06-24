import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Row } from '../ui';
import { Icon } from '../icons';
import { colors, radius, type, space, elevation } from '../theme';
import { widgetScheme } from './colorSchemes';

// WidgetTile — het gedeelde skelet van élke widget op de Vandaag-grid. Eén vorm en
// gedrag; de inhoud (stat/preview) is widget-eigen. Twee stijlen (VDG-5): playful
// (accent-wash + gekleurd icoon) of neutral (rustig oppervlak), per-module gekleurd
// (VDG-6). Vult zijn grid-cel (de grid bepaalt breedte/hoogte).
//
// Smalle tegel (1×1) — verticaal:        Brede tegel (2×1) mét details — side-by-side:
//   [icoon]                                [icoon]   │
//   Titel                                  Titel     │  preview / details
//   stat (accent)                          stat      │  (benut de horizontale ruimte)
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
  // Side-by-side: alleen in een bréde tegel, met details aan én iets om te tonen.
  const sideBySide = wide && showDetails && !!body;

  const iconChip = (
    <View style={{
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: style === 'playful' ? scheme.accent : colors.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={20} color={style === 'playful' ? colors.onDark : scheme.icon} />
    </View>
  );
  const heading = (
    <>
      <Text style={[type.title, { fontSize: 14, marginTop: space.sm }]} numberOfLines={2}>{title}</Text>
      {stat ? (
        <Text style={[type.title, { fontSize: 17, color: statColor ?? scheme.accent, fontWeight: '800', marginTop: 2 }]} numberOfLines={1}>
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
      {sideBySide ? (
        // Brede tegel: stat-blok links, preview rechts — benut de horizontale ruimte
        // (UX, batch 2) i.p.v. de preview eronder te proppen.
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ width: '44%', paddingRight: space.sm }}>
            {iconChip}
            {heading}
          </View>
          <View style={{ width: 1, backgroundColor: scheme.border, marginRight: space.sm }} />
          <View style={{ flex: 1, justifyContent: 'center' }}>{body}</View>
        </View>
      ) : (
        // Smalle tegel óf brede tegel zonder details: het vertrouwde verticale skelet.
        <>
          <Row justify="space-between" align="center">
            {iconChip}
            <Icon name="chevron" size={16} color={colors.inkFaint} />
          </Row>
          {heading}
        </>
      )}
    </Pressable>
  );
}
