import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Cirkelvormige voortgangsring (VDG-7). Puur presentationeel én statisch — geen
// animatie, dus deterministisch en web-/native-veilig (net als lib/illustrations.js).
// `pct` is 0..1; `children` worden gecentreerd (bv. een score of icoon).
//
//   <ProgressRing pct={0.6} color={colors.ocher} trackColor="rgba(255,255,255,0.22)">
//     <Text>3/5</Text>
//   </ProgressRing>
export function ProgressRing({ size = 72, stroke = 8, pct = 0, color, trackColor, children }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const offset = circumference * (1 - clamped);
  const mid = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={mid} cy={mid} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {clamped > 0 ? (
          <Circle
            cx={mid} cy={mid} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
