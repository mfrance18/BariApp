import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { AppButton } from '../src/components/ui/AppButton';
import { Card } from '../src/components/ui/Card';
import { getSettings } from '../src/db/repositories/settingsRepo';
import { addManualWeight, listWeightLog, type WeightLogEntry } from '../src/db/repositories/weightRepo';
import { syncWeightHistoryToDb } from '../src/services/vesync/adapter';
import { colors, radius, spacing } from '../src/theme/theme';

const KG_TO_LB = 2.20462;

export default function WeightHistoryScreen() {
  const queryClient = useQueryClient();
  const [manualWeight, setManualWeight] = useState('');

  const { data: settings } = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });
  const { data: entries } = useQuery({ queryKey: ['weightLog'], queryFn: () => listWeightLog() });

  const syncMutation = useMutation({
    mutationFn: () => syncWeightHistoryToDb(30),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weightLog'] }),
  });

  const addManualMutation = useMutation({
    mutationFn: (weightKg: number) => addManualWeight(weightKg),
    onSuccess: () => {
      setManualWeight('');
      queryClient.invalidateQueries({ queryKey: ['weightLog'] });
    },
  });

  const unit = settings?.weightUnit ?? 'lb';
  const toDisplayUnit = (kg: number) => (unit === 'lb' ? kg * KG_TO_LB : kg);

  const chronological = useMemo(() => [...(entries ?? [])].reverse(), [entries]);

  function handleAddManual() {
    const value = Number(manualWeight);
    if (!value || value <= 0) return;
    const kg = unit === 'lb' ? value / KG_TO_LB : value;
    addManualMutation.mutate(kg);
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          {chronological.length > 1 && (
            <Card style={styles.chartCard}>
              <LineChart
                data={{
                  labels: chronological.map(() => ''),
                  datasets: [{ data: chronological.map((e) => toDisplayUnit(e.weightKg)) }],
                }}
                width={Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2}
                height={180}
                yAxisSuffix={unit}
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(11, 87, 208, ${opacity})`,
                  labelColor: () => colors.textSecondary,
                }}
                bezier
                style={styles.chart}
              />
            </Card>
          )}

          <Card style={styles.manualEntryCard}>
            <View style={styles.manualEntryRow}>
              <TextInput
                style={styles.input}
                placeholder={`Weight (${unit})`}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={manualWeight}
                onChangeText={setManualWeight}
              />
              <AppButton title="Add" onPress={handleAddManual} disabled={addManualMutation.isPending} />
            </View>

            {settings?.vesyncConnected && (
              <AppButton
                title={syncMutation.isPending ? 'Syncing…' : 'Sync from VeSync Scale'}
                variant="secondary"
                onPress={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              />
            )}
          </Card>
        </View>
      }
      renderItem={({ item }) => <WeightRow entry={item} unit={unit} toDisplayUnit={toDisplayUnit} />}
      ListEmptyComponent={<Text style={styles.emptyText}>No weight history yet</Text>}
    />
  );
}

function WeightRow({
  entry,
  unit,
  toDisplayUnit,
}: {
  entry: WeightLogEntry;
  unit: string;
  toDisplayUnit: (kg: number) => number;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowWeight}>
        {toDisplayUnit(entry.weightKg).toFixed(1)} {unit}
      </Text>
      <Text style={styles.rowMeta}>
        {new Date(entry.recordedAt).toLocaleDateString()} · {entry.source === 'vesync_scale' ? 'Scale' : 'Manual'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  chartCard: {
    alignItems: 'center',
  },
  chart: {
    borderRadius: radius.md,
  },
  manualEntryCard: {
    gap: spacing.sm,
  },
  manualEntryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  rowWeight: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
