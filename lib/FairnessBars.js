import React from 'react';
import { View, Text } from 'react-native';
import { colors, type, radius, space } from './theme';
import { Avatar } from './ui';
import { t } from './i18n';

// Eerlijkheidsoverzicht "wie deed hoeveel" (SCH-3). Toont per lid een avatar,
// naam, een balk op `pct` breedte en de telling. Herbruikbaar: voed het met de
// uitvoer van lib/fairness.js → tally().
//
// rows: [{ profileId, name, emoji, count, pct }]  (al gesorteerd door tally)
export function FairnessBars({ rows }) {
  if (!rows?.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r) => (
        <View key={r.profileId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Avatar emoji={r.emoji} name={r.name} size={30} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{r.name}</Text>
              {/* 0 = expliciet "nog niets" i.p.v. een kale "0" naast een lege balk (die als
                  laad-skeleton leest, UXR-10 #10). */}
              <Text style={[type.caption, { color: r.count > 0 ? colors.inkSoft : colors.inkFaint }]}>
                {r.count > 0 ? r.count : t('fairness.none')}
              </Text>
            </View>
            {/* Balk: lengte naar rato van de koploper, zodat verschillen zichtbaar zijn. */}
            <View
              accessibilityLabel={`${r.name}: ${r.count} voltooiingen`}
              style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
            >
              <View style={{
                width: `${(r.count / max) * 100}%`,
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: r.count > 0 ? colors.done : 'transparent',
              }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
