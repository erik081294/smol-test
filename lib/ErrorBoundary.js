// App-brede error boundary (INF-4). Vangt render-fouten op zodat de gebruiker een
// nette NL-fallback ziet i.p.v. een witte crash, en rapporteert de fout naar Sentry
// (no-op zonder DSN — zie lib/monitoring.js). Error boundaries móéten class-
// componenten zijn; de rest van de app blijft functioneel.
import React from 'react';
import { View, Text } from 'react-native';
import { colors, space, type } from './theme';
import { Button } from './ui';
import { captureException } from './monitoring';
import { t } from './i18n';

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
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Text style={[type.h2, { color: colors.ink, textAlign: 'center', marginBottom: space.sm }]}>
          {t('error.title')}
        </Text>
        <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center', marginBottom: space.xl }]}>
          {t('error.body')}
        </Text>
        <Button title={t('error.retry')} onPress={this.reset} fullWidth={false} />
      </View>
    );
  }
}
