import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
import { useSelectedLogDate } from '../../src/hooks/useSelectedLogDate';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
import { formatDisplayDate, todayLogDateKey } from '../../src/utils/date';
import { mlToOz, ozToMl } from '../../src/utils/units';

/** Combines a "YYYY-MM-DD" log date with the current wall-clock time — used
 * as the default logged-at moment when adding a fluid for a non-today date. */
function combineDateKeyWithNow(dateKey: string): Date {
  const now = new Date();
  const combined = new Date(`${dateKey}T00:00:00`);
  combined.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return combined;
}

const CUPS_OZ = [4, 8, 12, 16, 20];

function formatOz(oz: number): string {
  return Number.isInteger(oz) ? String(oz) : oz.toFixed(1);
}

type FluidModalState = { mode: 'add'; amountOz: number | null } | { mode: 'edit'; entry: FluidLogEntry };

export default function FluidsScreen() {
  const queryClient = useQueryClient();
  const { logDate } = useSelectedLogDate();
  const [modalState, setModalState] = useState<FluidModalState | null>(null);

  const { data: settings } = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });
  const { data: entries } = useQuery({
    queryKey: ['fluidLog', logDate],
    queryFn: () => listEntriesForDate(logDate),
  });

  const addMutation = useMutation({
    mutationFn: ({ amountOz, label, loggedAt }: { amountOz: number; label: string; loggedAt: Date }) =>
      createEntry({ amountMl: ozToMl(amountOz), loggedAt, logDate, sourceLabel: label || undefined }),
    onSuccess: () => {
      setModalState(null);
      queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] });
    },
    onError: (error: Error) => Alert.alert('Could not add', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => {
      setModalState(null);
      queryClient.invalidateQueries({ queryKey: ['fluidLog', logDate] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; amountMl: number; loggedAt: string; sourceLabel: string | null }) =>
      updateEntry(id, patch),
    onSuccess: () => {
      setModalState(null);
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
          <Text style={styles.heading}>
            {logDate === todayLogDateKey() ? "Today's Fluids" : `${formatDisplayDate(logDate)} Fluids`}
          </Text>

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
                onPress={() => setModalState({ mode: 'add', amountOz: oz })}
              >
                <Ionicons name="cafe-outline" size={16} color={colors.fluid} />
                <Text style={styles.quickAddButtonText}>{oz} oz</Text>
              </TouchableOpacity>
            ))}
          </View>

          <AppButton
            title="Custom Amount"
            variant="secondary"
            onPress={() => setModalState({ mode: 'add', amountOz: null })}
          />

          {(entries ?? []).length > 0 && (
            <Text style={styles.sectionLabel}>{logDate === todayLogDateKey() ? 'TODAY' : formatDisplayDate(logDate).toUpperCase()}</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <FluidRow
          entry={item}
          onPress={() => setModalState({ mode: 'edit', entry: item })}
          onDelete={() => deleteMutation.mutate(item.id)}
        />
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          Nothing logged {logDate === todayLogDateKey() ? 'yet today' : 'for this day'}
        </Text>
      }
    />
    {modalState && (
      <FluidModal
        state={modalState}
        logDate={logDate}
        onClose={() => setModalState(null)}
        onAdd={(data) => addMutation.mutate(data)}
        onUpdate={(id, patch) => updateMutation.mutate({ id, ...patch })}
        onDelete={(id) => deleteMutation.mutate(id)}
        saving={addMutation.isPending || updateMutation.isPending}
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

function FluidModal({
  state,
  logDate,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  saving,
}: {
  state: FluidModalState;
  logDate: string;
  onClose: () => void;
  onAdd: (data: { amountOz: number; label: string; loggedAt: Date }) => void;
  onUpdate: (id: number, patch: { amountMl: number; loggedAt: string; sourceLabel: string | null }) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}) {
  const isEdit = state.mode === 'edit';
  const [amountInput, setAmountInput] = useState(
    isEdit ? formatOz(mlToOz(state.entry.amountMl)) : state.amountOz != null ? formatOz(state.amountOz) : '',
  );
  const [label, setLabel] = useState(isEdit ? (state.entry.sourceLabel ?? '') : '');
  const [loggedAt, setLoggedAt] = useState(
    isEdit ? new Date(state.entry.loggedAt) : combineDateKeyWithNow(logDate),
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  function handleTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !date) return;
    setLoggedAt(date);
  }

  function handleSave() {
    const amountOz = Number(amountInput);
    if (!amountOz || amountOz <= 0) return;
    if (isEdit) {
      onUpdate(state.entry.id, { amountMl: ozToMl(amountOz), loggedAt: loggedAt.toISOString(), sourceLabel: label.trim() || null });
    } else {
      onAdd({ amountOz, label: label.trim(), loggedAt });
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Card style={styles.modalCard}>
          <Text style={styles.modalTitle}>{isEdit ? 'Edit Fluid' : 'Add Fluid'}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Amount (oz)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={amountInput}
                onChangeText={setAmountInput}
                selectTextOnFocus
                autoFocus={!isEdit && state.amountOz == null}
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
          </ScrollView>

          <AppButton title={saving ? 'Saving…' : isEdit ? 'Save' : 'Add'} onPress={handleSave} disabled={saving} />
          {isEdit ? (
            <View style={styles.modalButtonRow}>
              <AppButton
                title="Delete"
                variant="danger"
                style={styles.flexButton}
                onPress={() => onDelete(state.entry.id)}
              />
              <AppButton title="Cancel" variant="secondary" style={styles.flexButton} onPress={onClose} />
            </View>
          ) : (
            <AppButton title="Cancel" variant="secondary" onPress={onClose} />
          )}
        </Card>
      </KeyboardAvoidingView>
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
    maxHeight: '90%',
  },
  modalScrollContent: {
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
