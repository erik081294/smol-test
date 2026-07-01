// Dunne wrapper om Sentry (crash-/foutmonitoring, INF-4). Bewust env-gated: zonder
// een DSN in EXPO_PUBLIC_SENTRY_DSN initialiseert Sentry niet en is alles een no-op,
// zodat de app lokaal/op web draait zonder Sentry-account. In een build mét DSN
// (zie docs/eas-setup.md) vangt het crashes en gerapporteerde fouten op.
//
// Datahygiëne: sendDefaultPii staat uit; we sturen geen e-mail/namen/rij-inhoud mee.
// Roep captureException(e, context) aan met een kort context-label, niet met data.
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let enabled = false;

export function initMonitoring() {
  if (enabled || !DSN) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Spaarzaam met performance-traces; crashes/fouten zijn het doel.
    tracesSampleRate: 0.1,
    enabled: true,
    // Ruisfilter voor verouderde browsers/scanbots op de web-build. Een fout als
    // "X.at is not a function" kan ALLEEN vuren op een engine zonder ES2022
    // Array.prototype.at (pre-Chrome 92 / IE). Een reguliere gebruiker op een
    // actuele browser heeft die methode wél, en elke wenselijke bot (Googlebot,
    // WhatsApp/Slack link-previews) draait op evergreen Chromium — die raken we
    // hiermee dus per definitie niet. Veiliger dan op browserversie sniffen.
    ignoreErrors: [/\.at is not a function/i],
  });
  enabled = true;
}

export function isMonitoringEnabled() {
  return enabled;
}

// Rapporteer een fout. context is een kort label ('render', 'db: taken laden', …),
// nooit gebruikersdata. Buiten een Sentry-build valt dit terug op een dev-warning.
export function captureException(error, context) {
  if (enabled) {
    Sentry.captureException(error, context ? { tags: { context } } : undefined);
  } else if (__DEV__) {
    console.warn('[Huishoek] fout', context ? `(${context})` : '', error);
  }
}
