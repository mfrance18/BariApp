import { Stack } from 'expo-router';

import { colors } from '../../../src/theme/theme';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Library', headerShown: false }} />
      <Stack.Screen name="recipe/new" options={{ title: 'New Recipe' }} />
      <Stack.Screen name="recipe/[id]" options={{ title: 'Edit Recipe' }} />
    </Stack>
  );
}
