import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../lib/theme';

// Indexroute voor de kale URL "/". Zonder dit bestand matcht "/" geen enkele
// route en toont expo-router "Unmatched Route". De daadwerkelijke navigatie
// gebeurt in de Gate in app/_layout.js (op basis van sessie + huishouden);
// hier tonen we enkel de laad-indicator zodat de root altijd matcht.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );
}
