import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TaskLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
