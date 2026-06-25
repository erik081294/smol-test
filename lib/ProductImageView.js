import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors, radius } from './theme';
import { resolveProductImage } from './productImage';

// Rendert het beeld bij een product/catalogus-item via de pure resolver
// (lib/productImage.js): een (later geleverde) PNG/OpenMoji-asset, of anders de
// emoji als placeholder, in een vast rond tegeltje. Decoratief — de naam ernaast
// draagt de betekenis, dus voor screenreaders verborgen.
//
// ASSETS is de key→assetSource-map; nu leeg (alles valt terug op emoji). Hier komen
// later de gebundelde OpenMoji/PNG-bestanden in via require(); de resolver pikt ze op.
const ASSETS = {};

export function ProductImageView({ item, size = 40, style }) {
  const img = resolveProductImage(item, { assets: ASSETS });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{
        width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }, style]}
    >
      {img.kind === 'asset' ? (
        <Image source={img.source} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.55) }}>{img.char}</Text>
      )}
    </View>
  );
}
