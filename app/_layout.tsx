import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import { ensureSettingsSeeded } from '../src/db/repositories/settingsRepo';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { success: migrationsSuccess, error: migrationsError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!migrationsSuccess) return;
    ensureSettingsSeeded()
      .then(() => setSeeded(true))
      .catch((err: Error) => setSeedError(err));
  }, [migrationsSuccess]);

  if (migrationsError || seedError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Failed to set up the local database</Text>
        <Text style={styles.errorDetail}>
          {(migrationsError ?? seedError)?.message}
        </Text>
      </View>
    );
  }

  if (!migrationsSuccess || !seeded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log/[mealType]/pick-item" options={{ presentation: 'modal', headerShown: true, title: 'Add Item' }} />
          <Stack.Screen name="log/[mealType]/weigh" options={{ presentation: 'modal', headerShown: true, title: 'Weigh It' }} />
          <Stack.Screen name="scan-barcode" options={{ presentation: 'modal', headerShown: true, title: 'Scan Barcode' }} />
          <Stack.Screen name="weight-history" options={{ presentation: 'modal', headerShown: true, title: 'Weight History' }} />
          <Stack.Screen name="meds/manage" options={{ headerShown: true, title: 'Manage Vitamins & Meds' }} />
          <Stack.Screen name="meds/[id]/edit" options={{ headerShown: true, title: 'Edit Schedule' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
});
