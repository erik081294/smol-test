import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';

// Per-segment foutvangnet (expo-router): een fout in compose/[id] valt op de nette
// fallback i.p.v. de hele app mee te slepen.
export { RouteErrorBoundary as ErrorBoundary } from '../../lib/ErrorBoundary';

export default function TijdlijnLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
