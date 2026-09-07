import { Stack } from 'expo-router';

export default function LibraryLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Library', headerShown: false }} />
      <Stack.Screen name="food/new" options={{ title: 'New Food' }} />
      <Stack.Screen name="food/[id]" options={{ title: 'Edit Food' }} />
      <Stack.Screen name="recipe/new" options={{ title: 'New Recipe' }} />
      <Stack.Screen name="recipe/[id]" options={{ title: 'Edit Recipe' }} />
    </Stack>
  );
}
