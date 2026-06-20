import React from 'react';
import { View, Text } from 'react-native';
import { Card, Row } from '../ui';
import { Icon } from '../icons';
import { colors, type, space } from '../theme';

// ===========================================================================
// SummaryCard — het gedeelde skelet van élke module-samenvatting op het Home-
// dashboard. Eén herkenbare vorm en gedrag over alle modules heen; de inhoud
// (stat + preview) is module-eigen. Principe: "een kaart is zo groot als zijn
// nieuws" — laat `preview` weg als er niets te melden is, dan blijft de kaart
// rustig op één regel.
//
//   [icoon]  Titel                         [chevron]
//            statregel (tone-gekleurd)
//            preview (optioneel, caption)
//
// tone kleurt alléén de statregel; titel en preview blijven neutraal leesbaar.
// ===========================================================================
const TONES = {
  neutral:  colors.inkSoft,
  positive: colors.success, // niets open / gelijk / verzorgd
  urgent:   colors.warning,  // er staat iets te wachten
  danger:   colors.danger,
};

export function SummaryCard({ icon, title, stat, tone = 'neutral', preview, onPress, accessibilityLabel }) {
  const statColor = TONES[tone] ?? TONES.neutral;
  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel ?? `${title}. ${stat}`} style={{ marginBottom: space.md }}>
      <Row gap={space.md} align="center">
        <View style={{
          width: 44, height: 44, borderRadius: 22, backgroundColor: colors.forestTint,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={24} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{title}</Text>
          {stat ? <Text style={[type.body, { color: statColor, marginTop: 1 }]} numberOfLines={1}>{stat}</Text> : null}
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Row>
      {preview ? <View style={{ marginTop: space.sm }}>{preview}</View> : null}
    </Card>
  );
}
