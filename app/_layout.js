import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { HouseholdProvider, useHousehold } from '../lib/household';
import { colors } from '../lib/theme';

function Gate() {
  const { session, loading: authLoading } = useAuth();
  const { households, loading: hhLoading } = useHousehold();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || (session && hhLoading)) return;
    const group = segments[0];

    if (!session) {
      if (group !== '(auth)') router.replace('/(auth)/welcome');
      return;
    }
    // Ingelogd maar geen huishouden -> onboarding
    if (households.length === 0) {
      if (group !== 'onboarding') router.replace('/onboarding');
      return;
    }
    // Ingelogd mét huishouden -> naar app als we nog in auth/onboarding zitten
    if (group === '(auth)' || group === 'onboarding' || group === undefined) {
      router.replace('/(tabs)/vandaag');
    }
  }, [session, authLoading, hhLoading, households.length, segments]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <HouseholdProvider>
          <Gate />
        </HouseholdProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
