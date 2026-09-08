import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createEntry, deleteEntry, listEntriesForDate, type FluidLogEntry } from '../../src/db/repositories/fluidRepo';
import { getSettings } from '../../src/db/repositories/settingsRepo';
import { todayLogDateKey } from '../../src/utils/date';
import { mlToOz, ozToMl } from '../../src/utils/units';

const CUPS_OZ = [4, 8, 12, 16, 20];

function formatOz(oz: number): string {
  return Number.isInteger(oz) ? String(oz) : oz.toFixed(1);
}

export default function FluidsScreen() {
  const queryClient = useQueryClient();
  const logDate = todayLogDateKey();
  const [customAmount, setCustomAmount] = useState('');

  const { data: settings } = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });
  const { data: entries } = useQuery({
    queryKey: ['fluidLog', logDate],
    queryFn: () => listEntriesForDate(logDate),
  });

  const addMutation = useMutation({
    mutationFn: (amountOz: number) => createEntry(ozToMl(amountOz)),
    onSuccess: () => {
      setCustomAmount('');
      queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] }),
  });

  const totalOz = mlToOz((entries ?? []).reduce((sum, e) => sum + e.amountMl, 0));
  const goalOz = mlToOz(settings?.dailyFluidGoalMl ?? 1500);
  const progress = Math.min(1, totalOz / goalOz);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.heading}>Today&apos;s Fluids</Text>
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              {formatOz(totalOz)} / {formatOz(goalOz)} oz
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Cups</Text>
          <View style={styles.quickAddRow}>
            {CUPS_OZ.map((oz) => (
              <TouchableOpacity key={oz} style={styles.quickAddButton} onPress={() => addMutation.mutate(oz)}>
                <Text style={styles.quickAddButtonText}>{oz} oz</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={styles.input}
              placeholder="Custom amount (oz)"
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={setCustomAmount}
            />
            <Button
              title="Add"
              onPress={() => {
                const value = Number(customAmount);
                if (value > 0) addMutation.mutate(value);
              }}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => <FluidRow entry={item} onDelete={() => deleteMutation.mutate(item.id)} />}
      ListEmptyComponent={<Text style={styles.emptyText}>Nothing logged yet today</Text>}
    />
  );
}

function FluidRow({ entry, onDelete }: { entry: FluidLogEntry; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>
        {formatOz(mlToOz(entry.amountMl))} oz ·{' '}
        {new Date(entry.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text style={styles.removeLink} onPress={onDelete}>
        Remove
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
    gap: 8,
  },
  header: {
    gap: 12,
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  progressBox: {
    gap: 6,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAddButton: {
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickAddButtonText: {
    color: '#0369a1',
    fontWeight: '600',
  },
  customRow: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowText: {
    fontSize: 15,
  },
  removeLink: {
    color: '#c00',
    fontSize: 13,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});
