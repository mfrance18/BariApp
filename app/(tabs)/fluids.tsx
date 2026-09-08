import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../src/components/ui/AppButton';
import { Card } from '../../src/components/ui/Card';
import { createEntry, deleteEntry, listEntriesForDate, type FluidLogEntry } from '../../src/db/repositories/fluidRepo';
import { getSettings } from '../../src/db/repositories/settingsRepo';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
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

          <Card style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <Ionicons name="water" size={20} color={colors.fluid} />
              <Text style={styles.progressText}>
                {formatOz(totalOz)} / {formatOz(goalOz)} oz
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </Card>

          <Text style={styles.sectionLabel}>CUPS</Text>
          <View style={styles.quickAddRow}>
            {CUPS_OZ.map((oz) => (
              <TouchableOpacity key={oz} style={styles.quickAddButton} onPress={() => addMutation.mutate(oz)}>
                <Ionicons name="cafe-outline" size={16} color={colors.fluid} />
                <Text style={styles.quickAddButtonText}>{oz} oz</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={styles.input}
              placeholder="Custom amount (oz)"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={setCustomAmount}
            />
            <AppButton
              title="Add"
              onPress={() => {
                const value = Number(customAmount);
                if (value > 0) addMutation.mutate(value);
              }}
            />
          </View>

          {(entries ?? []).length > 0 && <Text style={styles.sectionLabel}>TODAY</Text>}
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
      <Ionicons name="water-outline" size={18} color={colors.fluid} />
      <Text style={styles.rowText}>
        {formatOz(mlToOz(entry.amountMl))} oz ·{' '}
        {new Date(entry.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
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
    gap: spacing.sm,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  heading: {
    ...typography.title,
  },
  progressCard: {
    gap: spacing.sm,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.fluid,
  },
  sectionLabel: {
    ...typography.label,
    marginLeft: spacing.xs,
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.fluidLight,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickAddButtonText: {
    color: colors.fluid,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
