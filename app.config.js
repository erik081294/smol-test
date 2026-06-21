// Dynamische config: leest Supabase-keys uit de omgeving (.env) bij build/start.
export default ({ config }) => ({
  ...config,
  name: 'Huishoek',
  slug: 'huishoek',
  owner: 'evdns-team',
  scheme: 'huishoek',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',  // app respecteert het apparaat-schema; 'Systeem'-thema werkt zo
  newArchEnabled: true,
  splash: { backgroundColor: '#0E3A2F' },
  ios: { supportsTablet: true, bundleIdentifier: 'app.huishoek' },
  android: { package: 'app.huishoek', adaptiveIcon: { backgroundColor: '#0E3A2F' } },
  web: { bundler: 'metro', output: 'single' },
  // Lazy routes in dev: alleen het startscherm zit in de eerste bundle, de rest
  // streamt binnen bij navigatie. Korter "grijs scherm" bij opstarten. Op
  // 'development' gescoped → productie-builds bundelen gewoon eager (geen impact).
  experiments: { asyncRoutes: 'development' },
  plugins: ['expo-router', 'expo-secure-store', 'expo-font', 'expo-localization', '@sentry/react-native'],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: '21c400af-8a3c-4b50-ba7c-fc600638cc41' },
  },
});
