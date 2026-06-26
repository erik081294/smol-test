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
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.huishoek',
    // Universal Links: een huishoek.app/join/<token>-link opent de app i.p.v. de browser.
    // Apple verifieert dit tegen /.well-known/apple-app-site-association op huishoek.app.
    associatedDomains: ['applinks:huishoek.app'],
  },
  android: {
    package: 'app.huishoek',
    adaptiveIcon: { backgroundColor: '#0E3A2F' },
    // Android App Links: zelfde handoff, geverifieerd tegen /.well-known/assetlinks.json
    // (autoVerify). Alleen het /join-pad — de rest van het web blijft in de browser.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'huishoek.app', pathPrefix: '/join' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { bundler: 'metro', output: 'single' },
  // Lazy routes in dev: alleen het startscherm zit in de eerste bundle, de rest
  // streamt binnen bij navigatie. Korter "grijs scherm" bij opstarten. Op
  // 'development' gescoped → productie-builds bundelen gewoon eager (geen impact).
  experiments: { asyncRoutes: 'development' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-localization',
    // Sentry-config-plugin schrijft sentry.properties voor de native source-map-upload.
    // org/project/url staan hier; de auth-token NOOIT hier (zou gecommit worden) → via de
    // SENTRY_AUTH_TOKEN-env op de EAS-build. url = EU-region (project leeft op de.sentry.io).
    ['@sentry/react-native', { organization: 'evdn', project: 'huishoek', url: 'https://de.sentry.io/' }],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: '21c400af-8a3c-4b50-ba7c-fc600638cc41' },
  },
});
