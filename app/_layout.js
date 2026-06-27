import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { HouseholdProvider, useHousehold } from '../lib/household';
import { appRoute } from '../lib/appRoute';
import { SplashWait } from '../lib/ui';
import { ToastProvider } from '../lib/toast';
import { DialogProvider } from '../lib/dialog';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { initMonitoring } from '../lib/monitoring';
import { useLang, initLocale } from '../lib/i18nRuntime';
import { useNotifications } from '../lib/useNotifications';
import { useTheme } from '../lib/useTheme';
import { colors } from '../lib/theme';

// Crash-/foutmonitoring zo vroeg mogelijk starten (no-op zonder DSN).
initMonitoring();

// Plant lokale herinneringen zodra er een actief huishouden is. Aparte component
// zodat de notificatie-hooks (useTasks/useMealPlan/usePantry) binnen de providers
// draaien en alleen mounten als de gebruiker is ingelogd met een huishouden.
function NotificationsMount() {
  useNotifications();
  return null;
}

function Gate({ themeMode }) {
  const { session, loading: authLoading } = useAuth();
  const { households, loading: hhLoading, hasFetched } = useHousehold();
  const segments = useSegments();
  const router = useRouter();
  const lang = useLang();

  // Eénmalig de taal bepalen (opgeslagen keuze → apparaat-taal → default).
  useEffect(() => { initLocale(); }, []);

  // Eén bron van waarheid voor de gate-beslissing (puur, unit-getest in household.js).
  const route = appRoute({ authLoading, session, hhLoading, hasFetched, households });

  useEffect(() => {
    if (route === 'loading') return;
    const group = segments[0];

    // Het uitnodigings-/join-scherm (PLT-7) regelt zijn eigen auth-staat (preview vóór
    // inloggen, accepteren erna). De Gate stuurt het niet weg, ongeacht in-/uitgelogd.
    if (group === 'join') return;

    if (route === 'auth') {
      if (group !== '(auth)') router.replace('/(auth)/welcome');
      return;
    }
    if (route === 'onboarding') {
      if (group !== 'onboarding') router.replace('/onboarding');
      return;
    }
    // route === 'app' -> naar de app als we nog in auth/onboarding/root zitten
    if (group === '(auth)' || group === 'onboarding' || group === undefined) {
      router.replace('/(tabs)/vandaag');
    }
  }, [route, segments]);

  // Toon het wachtscherm zolang auth/huishoudens nog laden. Pas hierna beslist de
  // redirect-useEffect, zodat een nog-niet-geladen lege lijst nooit het onboarding-
  // scherm laat flitsen (UX-8). Een merkvast scherm i.p.v. een kale spinner.
  if (route === 'loading') {
    return <SplashWait />;
  }

  return (
    <>
      {session && households.length > 0 ? <NotificationsMount /> : null}
      <Stack key={`${lang}-${themeMode}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="join" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="purchase" options={{ presentation: 'modal' }} />
        <Stack.Screen name="product" options={{ presentation: 'modal' }} />
        <Stack.Screen name="catalog" options={{ presentation: 'modal' }} />
        <Stack.Screen name="purchases" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe" options={{ presentation: 'modal' }} />
        <Stack.Screen name="herinneringen" options={{ presentation: 'modal' }} />
        <Stack.Screen name="beeldstijl" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recurring-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="kosten-inzichten" options={{ presentation: 'modal' }} />
        <Stack.Screen name="resource" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tijdlijn" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Past het licht/donker-palet toe en geeft de effectieve modus terug; die voedt de
  // root-remount-key (in Gate) en de statusbalk-stijl.
  const themeMode = useTheme();
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={themeMode === 'donker' ? 'light' : 'dark'} />
        <AuthProvider>
          <HouseholdProvider>
            <ToastProvider>
              <DialogProvider>
                <Gate themeMode={themeMode} />
              </DialogProvider>
            </ToastProvider>
          </HouseholdProvider>
        </AuthProvider>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
