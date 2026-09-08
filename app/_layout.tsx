import 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import { ensureSettingsSeeded } from '../src/db/repositories/settingsRepo';
import { rescheduleAll } from '../src/services/notifications/scheduler';
import { colors } from '../src/theme/theme';

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

  useEffect(() => {
    if (!seeded) return;
    rescheduleAll().catch(() => {
      // Best-effort: reminders simply won't fire until the next successful reschedule.
    });
  }, [seeded]);

  if (migrationsError || seedError) {
    return (
      <GestureHandlerRootView style={styles.flexFill}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Failed to set up the local database</Text>
          <Text style={styles.errorDetail}>
            {(migrationsError ?? seedError)?.message}
          </Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!migrationsSuccess || !seeded) {
    return (
      <GestureHandlerRootView style={styles.flexFill}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flexFill}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: colors.card },
              headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
              headerTintColor: colors.primary,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="log/[mealType]/pick-item" options={{ presentation: 'modal', headerShown: true, title: 'Add Item' }} />
            <Stack.Screen name="log/[mealType]/weigh" options={{ presentation: 'modal', headerShown: true, title: 'Weigh It' }} />
            <Stack.Screen name="scan-barcode" options={{ presentation: 'modal', headerShown: true, title: 'Scan Barcode' }} />
            <Stack.Screen name="weight-history" options={{ presentation: 'modal', headerShown: true, title: 'Weight History' }} />
            <Stack.Screen name="food/new" options={{ presentation: 'modal', headerShown: true, title: 'New Food' }} />
            <Stack.Screen name="food/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit Food' }} />
            <Stack.Screen name="meds/[id]/edit" options={{ headerShown: true, title: 'Edit Schedule' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  errorDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
