import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getSettings } from '../../src/db/repositories/settingsRepo';

export default function SettingsScreen() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: getSettings,
  });

  if (isLoading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Section title="VeSync Scale">
        <Text style={styles.rowText}>
          {settings.vesyncConnected ? `Connected as ${settings.vesyncEmail}` : 'Not connected'}
        </Text>
      </Section>
      <Section title="Daily Goals">
        <Text style={styles.rowText}>Calories: {settings.dailyCalorieGoal}</Text>
        <Text style={styles.rowText}>Protein: {settings.dailyProteinGoalG} g</Text>
        <Text style={styles.rowText}>Fluid: {settings.dailyFluidGoalMl} mL</Text>
      </Section>
      <Section title="Units">
        <Text style={styles.rowText}>Weight unit: {settings.weightUnit}</Text>
      </Section>
    </View>
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
    gap: 4,
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
});
