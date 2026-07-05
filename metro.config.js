// getSentryExpoConfig == expo's getDefaultConfig + de Sentry-serializer die debug-ID's
// in de bundle injecteert en source maps genereert. Nodig zodat de EAS-build de maps
// kan uploaden en stack traces in Sentry leesbaar (gesymboliceerd) zijn (zie
// docs/eas-setup.md). Zonder SENTRY_AUTH_TOKEN draait de build gewoon door; de upload
// wordt dan overgeslagen.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// @supabase/supabase-js (v2.108+) doet een optionele dynamische import van
// '@opentelemetry/api' voor tracing. Metro negeert de webpackIgnore-hint en
// probeert die module bij het bundelen te resolven; zonder resolutie faalt de
// hele web-bundle met een 500 -> wit scherm. Stub de module naar leeg zodat de
// bundle compileert. Het pakket staat (alleen) in devDependencies zodat
// supabase-js 'm onder Node (tests/scripts) kan vinden — in de app-bundle
// hoort hij niet (Plat-5, review-addendum 2026-07-04).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  );
};

module.exports = config;
