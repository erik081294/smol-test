// Dynamische config: leest Supabase-keys uit de omgeving (.env) bij build/start.
export default ({ config }) => ({
  ...config,
  name: 'Huishoek',
  slug: 'huishoek',
  scheme: 'huishoek',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: { backgroundColor: '#0E3A2F' },
  ios: { supportsTablet: true, bundleIdentifier: 'app.huishoek' },
  android: { package: 'app.huishoek', adaptiveIcon: { backgroundColor: '#0E3A2F' } },
  web: { bundler: 'metro', output: 'single' },
  plugins: ['expo-router', 'expo-secure-store', 'expo-font', 'expo-localization'],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
