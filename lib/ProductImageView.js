import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors, radius } from './theme';
import { resolveProductImage } from './productImage';
import { useSignedUrl } from './photoStorage';
import { PRODUCT_BUCKET } from './useProducts';

// Rendert het beeld bij een product/catalogus-item. Voorrangsorde: (1) een door de
// gebruiker geüploade foto (BOO-13, `imagePath` → signed URL uit de private bucket); anders
// (2) de pure resolver (lib/productImage.js): een PNG/OpenMoji-asset, of de emoji/categorie-
// emoji als placeholder. In een vast rond tegeltje. Decoratief — de naam ernaast draagt de
// betekenis, dus voor screenreaders verborgen.
//
// ASSETS is de key→assetSource-map; nu leeg (alles valt terug op emoji). Hier komen
// later de gebundelde OpenMoji/PNG-bestanden in via require(); de resolver pikt ze op.
const ASSETS = {};

export function ProductImageView({ item, imagePath = null, size = 40, style }) {
  const img = resolveProductImage(item, { assets: ASSETS });
  // refreshKey = imagePath: bij een nieuwe upload verandert het pad → verse signed URL
  // (de cache in photoStorage voorkomt N+1 calls in lijsten). Null pad → null URL.
  const photoUrl = useSignedUrl(PRODUCT_BUCKET, imagePath, imagePath);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{
        width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }, style]}
    >
      {imagePath && photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: size, height: size }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : img.kind === 'asset' ? (
        <Image source={img.source} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.55) }}>{img.char}</Text>
      )}
    </View>
  );
}
