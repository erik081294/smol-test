import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { HouseholdProvider, useHousehold } from '../lib/household';
import { appRoute } from '../lib/appRoute';
import { needsDisplayName } from '../lib/otp';
import { SplashWait } from '../lib/ui';
import { ToastProvider } from '../lib/toast';
import { DialogProvider } from '../lib/dialog';
import { AssistantProvider } from '../lib/assistantProvider';
import { AssistantSheet } from '../lib/AssistantSheet';
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

  // PLT-8: een account dat via de e-mail-inlogcode is ontstaan heeft nog geen
  // weergavenaam (user_metadata.display_name ontbreekt; wachtwoord-signups zetten
  // 'm altijd al). Die vragen we éérst op /naam, vóór onboarding/app. In de
  // effect-deps zodat de redirect ook loopt zodra updateUser de metadata zet
  // (USER_UPDATED verandert `session` maar niet `route`).
  const needsName = needsDisplayName(session?.user);

  useEffect(() => {
    if (route === 'loading') return;
    const group = segments[0];

    // Het uitnodigings-/join-scherm (PLT-7) regelt zijn eigen auth-staat (preview vóór
    // inloggen, accepteren erna). De Gate stuurt het niet weg, ongeacht in-/uitgelogd.
    if (group === 'join') return;

    // Het wachtwoord-herstelscherm (UX-P5) draait op een tijdelijke PASSWORD_RECOVERY-
    // sessie. Die maakt `session` truthy → zonder deze uitzondering zou de Gate de
    // gebruiker meteen de app in kaatsen vóór hij een nieuw wachtwoord kan zetten.
    if (group === 'herstel') return;

    // Eerste OTP-login zonder naam → eerst het naam-scherm (zie hierboven).
    if (needsName) {
      if (group !== 'naam') router.replace('/naam');
      return;
    }

    if (route === 'auth') {
      if (group !== '(auth)') router.replace('/(auth)/welcome');
      return;
    }
    if (route === 'onboarding') {
      if (group !== 'onboarding') router.replace('/onboarding');
      return;
    }
    // route === 'app' -> naar de app als we nog in auth/root zitten. NIET vanuit 'onboarding':
    // een lid met een huishouden mag dat scherm bewust openen om een TWEEDE huishouden aan te
    // maken of toe te treden (FND-5). Zou de gate 'onboarding' hier wegkaatsen, dan is dat scherm
    // onbereikbaar voor bestaande leden (de "Nieuw of aansluiten"-knop deed dan niets). Onboarding
    // navigeert zélf de app in na een succesvolle create — óók voor het eerste huishouden.
    // 'naam' telt hier ook: is de naam (net) gezet, dan moet dat scherm door naar de app.
    if (group === '(auth)' || group === 'naam' || group === undefined) {
      router.replace('/(tabs)/vandaag');
    }
  }, [route, needsName, segments]);

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
        <Stack.Screen name="herstel" />
        <Stack.Screen name="naam" />
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
                {/* Assistent app-breed (AI-10): één gespreksstate voor tab én
                    overlay-sheet; de sheet rendert boven elk scherm. */}
                <AssistantProvider>
                  <Gate themeMode={themeMode} />
                  <AssistantSheet />
                </AssistantProvider>
              </DialogProvider>
            </ToastProvider>
          </HouseholdProvider>
        </AuthProvider>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
