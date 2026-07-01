// App-brede error boundary (INF-4). Vangt render-fouten op zodat de gebruiker een
// nette NL-fallback ziet i.p.v. een witte crash, en rapporteert de fout naar Sentry
// (no-op zonder DSN — zie lib/monitoring.js). Error boundaries móéten class-
// componenten zijn; de rest van de app blijft functioneel.
//
// Twee niveaus:
//   • ErrorBoundary (class) — de ROOT-vangnet in app/_layout.js (rond de providers).
//   • RouteErrorBoundary    — de expo-router per-segment-boundary (named export
//     `ErrorBoundary` in een route/_layout). Vangt een render-fout BINNEN dat segment
//     op, zodat één kapot scherm de rest van de app (navigatie, andere tabs) niet
//     meesleept. Signatuur { error, retry } komt van expo-router.
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { colors, space, type } from './theme';
import { Button } from './ui';
import { captureException } from './monitoring';
import { t } from './i18n';

// Gedeelde fallback-UI voor beide niveaus.
function ErrorFallback({ onRetry }) {
  return (
    // testID zodat de geautomatiseerde rooktest (.maestro/00-crash-sweep) betrouwbaar
    // op een gevangen render-fout kan asserten (assertNotVisible id=t-error-boundary),
    // los van de zichtbare NL-tekst.
    <View testID="t-error-boundary" style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <Text style={[type.h2, { color: colors.ink, textAlign: 'center', marginBottom: space.sm }]}>
        {t('error.title')}
      </Text>
      <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center', marginBottom: space.xl }]}>
        {t('error.body')}
      </Text>
      <Button title={t('error.retry')} onPress={onRetry} fullWidth={false} />
    </View>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureException(error, 'render');
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback onRetry={this.reset} />;
  }
}

// Per-segment-boundary voor expo-router. Re-exporteer 'm als `ErrorBoundary` vanuit een
// route- of _layout-bestand om dát segment te isoleren (zie app/(tabs)/_layout.js).
export function RouteErrorBoundary({ error, retry }) {
  useEffect(() => { captureException(error, 'render'); }, [error]);
  return <ErrorFallback onRetry={retry} />;
}
