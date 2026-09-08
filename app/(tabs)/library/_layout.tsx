import { Stack } from 'expo-router';

export default function LibraryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Library', headerShown: false }} />
      <Stack.Screen name="recipe/new" options={{ title: 'New Recipe' }} />
      <Stack.Screen name="recipe/[id]" options={{ title: 'Edit Recipe' }} />
    </Stack>
  );
}
