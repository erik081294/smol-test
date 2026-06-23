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
//   [icoon]
//   Titel
//   stat (accent)            ← altijd; ook "alles oké" is een geldige stand
//   preview (alleen 2×1/2×2)
export function WidgetTile({
  moduleKey, style = 'playful', icon, title, stat, statColor, preview, onPress, size = '1x1', children,
}) {
  const scheme = widgetScheme(moduleKey, style, colors);
  const wide = size !== '1x1';
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
      <Row justify="space-between" align="center">
        {/* playful: gevulde accent-chip met wit icoon (vibrant, "app-achtig"); neutral:
            rustige vulling met een accent-getint icoon. */}
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: style === 'playful' ? scheme.accent : colors.surfaceAlt,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={20} color={style === 'playful' ? colors.onDark : scheme.icon} />
        </View>
        <Icon name="chevron" size={16} color={colors.inkFaint} />
      </Row>
      <Text style={[type.title, { fontSize: 14, marginTop: space.sm }]} numberOfLines={1}>{title}</Text>
      {stat ? (
        <Text style={[type.title, { fontSize: 17, color: statColor ?? scheme.accent, fontWeight: '800', marginTop: 2 }]} numberOfLines={1}>
          {stat}
        </Text>
      ) : null}
      {/* Preview vult de resterende hoogte van een brede tegel (flex:1) — zo benut een
          2×1-tegel zijn ruimte om de items te tónen i.p.v. die ongebruikt te laten,
          terwijl overflow:hidden 'm netjes binnen de tegel houdt (UX-24). */}
      {wide && preview ? <View style={{ marginTop: space.xs, flex: 1 }}>{preview}</View> : null}
      {wide && children ? <View style={{ marginTop: space.xs, flex: 1 }}>{children}</View> : null}
    </Pressable>
  );
}
