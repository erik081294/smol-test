const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js (v2.108+) doet een optionele dynamische import van
// '@opentelemetry/api' voor tracing. Metro negeert de webpackIgnore-hint en
// probeert die module bij het bundelen te resolven; omdat we OTEL niet
// gebruiken (en het pakket niet installeren) faalt de hele web-bundle dan met
// een 500 -> wit scherm. Stub de module naar leeg zodat de bundle compileert.
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
