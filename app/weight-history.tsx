import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Dimensions, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { addManualWeight, listWeightLog, type WeightLogEntry } from '../src/db/repositories/weightRepo';
import { getSettings } from '../src/db/repositories/settingsRepo';
import { syncWeightHistoryToDb } from '../src/services/vesync/adapter';

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
            <LineChart
              data={{
                labels: chronological.map(() => ''),
                datasets: [{ data: chronological.map((e) => toDisplayUnit(e.weightKg)) }],
              }}
              width={Dimensions.get('window').width - 32}
              height={180}
              yAxisSuffix={unit}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: () => '#666',
              }}
              bezier
              style={styles.chart}
            />
          )}

          <View style={styles.manualEntryRow}>
            <TextInput
              style={styles.input}
              placeholder={`Weight (${unit})`}
              keyboardType="decimal-pad"
              value={manualWeight}
              onChangeText={setManualWeight}
            />
            <Button title="Add" onPress={handleAddManual} disabled={addManualMutation.isPending} />
          </View>

          {settings?.vesyncConnected && (
            <Button
              title={syncMutation.isPending ? 'Syncing…' : 'Sync from VeSync Scale'}
              onPress={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            />
          )}
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
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 12,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 12,
  },
  manualEntryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowWeight: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    color: '#888',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});
