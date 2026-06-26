import React from 'react';
import { View, TextInput, Pressable, Platform } from 'react-native';
import { Icon } from './icons';
import { colors, radius, space, touchTarget } from './theme';
import { t } from './i18n';

// Gedeelde zoekbalk (Picnic-stijl): zoek-icoon + invoerveld + wis-knop. De boodschappen-
// catalogus en de recepten-catalogus hadden hier identieke markup; dit is de gedeelde
// versie. `label` voedt zowel de placeholder als het toegankelijkheidslabel; `style` gaat
// naar de bordered container (bv. om de marginBottom te overschrijven). De wis-knop
// verschijnt zodra er tekst staat en leegt het veld via onChangeText('').
export function SearchField({ value, onChangeText, label, style }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: space.md, marginBottom: space.sm,
    }, style]}>
      <Icon name="search" size={20} color={colors.inkFaint} />
      <TextInput
        value={value} onChangeText={onChangeText}
        placeholder={label} placeholderTextColor={colors.inkFaint}
        autoCorrect={false} returnKeyType="search" accessibilityLabel={label}
        style={{
          flex: 1, minHeight: touchTarget, marginLeft: space.sm,
          paddingVertical: Platform.OS === 'ios' ? space.md : space.sm, fontSize: 16, color: colors.ink,
        }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
          <Icon name="close" size={18} color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}
