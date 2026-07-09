import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { motion } from '../theme';
import { prefersReducedMotion } from '../motion';

// Cirkelvormige voortgangsring (VDG-7). Puur presentationeel; `pct` is 0..1 en
// `children` worden gecentreerd (bv. een score of icoon).
//
// De ring VULT (DESIGN.md "Vier de voortgang"): bij een wijziging — en bij de eerste
// keer tonen — loopt de streep zacht naar zijn nieuwe stand i.p.v. er hard heen te
// springen. Afvinken hoort goed te voelen. Bij "verminder beweging" zetten we de
// waarde direct, zonder animatie.
//
//   <ProgressRing pct={0.6} color={colors.ocher} trackColor="rgba(255,255,255,0.22)">
//     <Text>3/5</Text>
//   </ProgressRing>
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({ size = 72, stroke = 8, pct = 0, color, trackColor, children }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const offset = circumference * (1 - clamped);
  const mid = size / 2;

  // Start leeg (volledige offset) zodat de eerste render van 0 → stand animeert.
  const dash = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      dash.setValue(offset);
      return;
    }
    const anim = Animated.timing(dash, {
      toValue: offset,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset is geen transform/opacity → de native driver kan 'm niet.
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [offset, dash]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={mid} cy={mid} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {clamped > 0 ? (
          <AnimatedCircle
            cx={mid} cy={mid} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dash}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
