import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../src/components/ui/AppButton';
import { Card } from '../../src/components/ui/Card';
import { KeyboardAvoidingScreen } from '../../src/components/ui/KeyboardAvoidingScreen';
import { SwipeToDelete } from '../../src/components/ui/SwipeToDelete';
import {
  createEntry,
  deleteEntry,
  listEntriesForDate,
  updateEntry,
  type FluidLogEntry,
} from '../../src/db/repositories/fluidRepo';
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
  const [customLabel, setCustomLabel] = useState('');
  const [editingEntry, setEditingEntry] = useState<FluidLogEntry | null>(null);

  const { data: settings } = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });
  const { data: entries } = useQuery({
    queryKey: ['fluidLog', logDate],
    queryFn: () => listEntriesForDate(logDate),
  });

  const addMutation = useMutation({
    mutationFn: ({ amountOz, label }: { amountOz: number; label?: string }) =>
      createEntry(ozToMl(amountOz), label),
    onSuccess: () => {
      setCustomAmount('');
      setCustomLabel('');
      queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; amountMl: number; loggedAt: string; sourceLabel: string | null }) =>
      updateEntry(id, patch),
    onSuccess: () => {
      setEditingEntry(null);
      queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] });
    },
    onError: (error: Error) => Alert.alert('Could not save', error.message),
  });

  const totalOz = mlToOz((entries ?? []).reduce((sum, e) => sum + e.amountMl, 0));
  const goalOz = mlToOz(settings?.dailyFluidGoalMl ?? 1500);
  const progress = Math.min(1, totalOz / goalOz);

  return (
    <KeyboardAvoidingScreen>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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
              <TouchableOpacity
                key={oz}
                style={styles.quickAddButton}
                onPress={() => addMutation.mutate({ amountOz: oz })}
              >
                <Ionicons name="cafe-outline" size={16} color={colors.fluid} />
                <Text style={styles.quickAddButtonText}>{oz} oz</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.input, styles.customAmountInput]}
              placeholder="Amount (oz)"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={setCustomAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textMuted}
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          </View>
          <AppButton
            title="Add"
            onPress={() => {
              const value = Number(customAmount);
              if (value > 0) addMutation.mutate({ amountOz: value, label: customLabel.trim() || undefined });
            }}
          />

          {(entries ?? []).length > 0 && <Text style={styles.sectionLabel}>TODAY</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <FluidRow entry={item} onPress={() => setEditingEntry(item)} onDelete={() => deleteMutation.mutate(item.id)} />
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Nothing logged yet today</Text>}
    />
    {editingEntry && (
      <EditFluidModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={(patch) => updateMutation.mutate({ id: editingEntry.id, ...patch })}
        onDelete={() => {
          deleteMutation.mutate(editingEntry.id);
          setEditingEntry(null);
        }}
        saving={updateMutation.isPending}
      />
    )}
    </KeyboardAvoidingScreen>
  );
}

function FluidRow({
  entry,
  onPress,
  onDelete,
}: {
  entry: FluidLogEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <SwipeToDelete onDelete={onDelete}>
      <TouchableOpacity style={styles.row} onPress={onPress}>
        <Ionicons name="water-outline" size={18} color={colors.fluid} />
        <Text style={styles.rowText}>
          {entry.sourceLabel ? `${entry.sourceLabel} · ` : ''}
          {formatOz(mlToOz(entry.amountMl))} oz ·{' '}
          {new Date(entry.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </SwipeToDelete>
  );
}

function EditFluidModal({
  entry,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  entry: FluidLogEntry;
  onClose: () => void;
  onSave: (patch: { amountMl: number; loggedAt: string; sourceLabel: string | null }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [amountInput, setAmountInput] = useState(formatOz(mlToOz(entry.amountMl)));
  const [label, setLabel] = useState(entry.sourceLabel ?? '');
  const [loggedAt, setLoggedAt] = useState(new Date(entry.loggedAt));
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  function handleTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !date) return;
    setLoggedAt(date);
  }

  function handleSave() {
    const amountOz = Number(amountInput);
    if (!amountOz || amountOz <= 0) return;
    onSave({ amountMl: ozToMl(amountOz), loggedAt: loggedAt.toISOString(), sourceLabel: label.trim() || null });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Card style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Fluid</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Amount (oz)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={setAmountInput}
              selectTextOnFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Gatorade, Protein shake"
              placeholderTextColor={colors.textMuted}
              value={label}
              onChangeText={setLabel}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Time</Text>
            {Platform.OS === 'android' ? (
              <TouchableOpacity style={styles.timeButton} onPress={() => setShowPicker(true)}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.timeButtonText}>
                  {loggedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker value={loggedAt} mode="time" display="spinner" onChange={handleTimeChange} />
            )}
          </View>
          {Platform.OS === 'android' && showPicker && (
            <DateTimePicker value={loggedAt} mode="time" display="default" onChange={handleTimeChange} />
          )}

          <AppButton title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
          <View style={styles.modalButtonRow}>
            <AppButton title="Delete" variant="danger" style={styles.flexButton} onPress={onDelete} />
            <AppButton title="Cancel" variant="secondary" style={styles.flexButton} onPress={onClose} />
          </View>
        </Card>
      </View>
    </Modal>
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
  customAmountInput: {
    flex: 0.6,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.heading,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
});
