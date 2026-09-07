import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getSettings } from '../../src/db/repositories/settingsRepo';
import { login, logout, syncWeightHistoryToDb } from '../../src/services/vesync/adapter';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: getSettings,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (result) => {
      if (result.ok) {
        setPassword('');
        queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncWeightHistoryToDb(30),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weightLog'] }),
  });

  if (isLoading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="VeSync Scale">
        {settings.vesyncConnected ? (
          <>
            <Text style={styles.rowText}>Connected as {settings.vesyncEmail}</Text>
            <View style={styles.buttonRow}>
              <Button
                title={syncMutation.isPending ? 'Syncing…' : 'Sync Now'}
                onPress={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              />
              <Button title="Disconnect" color="#c00" onPress={() => logoutMutation.mutate()} />
            </View>
            {syncMutation.data && (
              <Text style={styles.helperText}>Synced {syncMutation.data.synced} new reading(s).</Text>
            )}
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="VeSync email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              title={loginMutation.isPending ? 'Connecting…' : 'Connect'}
              onPress={() => loginMutation.mutate()}
              disabled={loginMutation.isPending || !email || !password}
            />
            {loginMutation.data && !loginMutation.data.ok && (
              <Text style={styles.errorText}>{loginMutation.data.error}</Text>
            )}
          </>
        )}
      </Section>
      <Section title="Daily Goals">
        <Text style={styles.rowText}>Calories: {settings.dailyCalorieGoal}</Text>
        <Text style={styles.rowText}>Protein: {settings.dailyProteinGoalG} g</Text>
        <Text style={styles.rowText}>Fluid: {settings.dailyFluidGoalMl} mL</Text>
      </Section>
      <Section title="Units">
        <Text style={styles.rowText}>Weight unit: {settings.weightUnit}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: '#555',
  },
  rowText: {
    fontSize: 15,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    color: '#c00',
    fontSize: 13,
  },
});
