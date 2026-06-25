// Fun-factor (V1): een simpel side-profiel autootje, getint op de RDW-kleur en met een
// silhouet naar de carrosserie. Puur presentatie; alle keuzes komen uit de geteste
// helpers in lib/vehicleAppearance.js. Onbekende kleur → neutrale themakleur, zodat het
// nooit "leeg" oogt. Geen kleur/carrosserie? Dan toont de caller gewoon het gewone icoon.
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from './theme';
import { colorHex, isLightColor, bodyKind } from './vehicleAppearance';

// Silhouet-geometrie per soort (viewBox 0 0 100 56): daklijn + carrosserie-hoogte.
const SHAPES = {
  hatchback: { bodyTop: 30, x1: 33, roofY: 15, x2: 64 },
  station: { bodyTop: 30, x1: 31, roofY: 15, x2: 73 },
  sedan: { bodyTop: 31, x1: 36, roofY: 17, x2: 60 },
  suv: { bodyTop: 26, x1: 32, roofY: 11, x2: 66 },
  van: { bodyTop: 21, x1: 27, roofY: 7, x2: 79 },
};

export function CarGlyph({ color, bodyType, size = 64, style }) {
  const s = SHAPES[bodyKind(bodyType)] ?? SHAPES.hatchback;
  const fill = colorHex(color) ?? colors.catVoertuig ?? colors.forest;
  const light = isLightColor(fill);
  const stroke = light ? '#00000026' : '#FFFFFF26';
  const glass = light ? '#00000018' : '#FFFFFF55';
  const { bodyTop, x1, roofY, x2 } = s;
  const bottom = 46;

  const d = [
    `M 8 ${bottom}`,
    `L 8 ${bodyTop + 5}`,
    `Q 8 ${bodyTop} 15 ${bodyTop}`,        // voorbumper afgerond
    `L 26 ${bodyTop}`,                      // motorkap
    `L ${x1} ${roofY + 5}`,                 // voorruit omhoog
    `Q ${x1 + 1} ${roofY} ${x1 + 7} ${roofY}`,
    `L ${x2 - 5} ${roofY}`,                 // dak
    `Q ${x2} ${roofY} ${x2 + 4} ${roofY + 6}`,
    `L 90 ${bodyTop}`,                      // achterkant omlaag
    `Q 93 ${bodyTop} 93 ${bodyTop + 5}`,
    `L 93 ${bottom}`,
    'Z',
  ].join(' ');

  const winY = roofY + 3;
  const winH = bodyTop - winY - 2;
  const half = (x2 - x1) / 2;

  return (
    <View style={style}>
      <Svg width={size} height={size * 0.56} viewBox="0 0 100 56">
        <Path d={d} fill={fill} stroke={stroke} strokeWidth={1.5} />
        {winH > 3 ? (
          <>
            <Rect x={x1 + 4} y={winY} width={half - 5} height={winH} rx={2} fill={glass} />
            <Rect x={x1 + half + 1} y={winY} width={half - 4} height={winH} rx={2} fill={glass} />
          </>
        ) : null}
        {[30, 70].map((wx) => (
          <React.Fragment key={wx}>
            <Circle cx={wx} cy={48} r={8.5} fill="#2B2B2B" />
            <Circle cx={wx} cy={48} r={3.6} fill="#6B7177" />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
