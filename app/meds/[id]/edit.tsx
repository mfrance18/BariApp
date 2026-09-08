import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { AppButton } from '../../../src/components/ui/AppButton';
import { Card } from '../../../src/components/ui/Card';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import {
  archiveVitaminMed,
  createSchedule,
  createVitaminMed,
  deleteSchedule,
  getVitaminMedById,
  listSchedulesForVitaminMed,
  updateSchedule,
  updateVitaminMed,
} from '../../../src/db/repositories/medsRepo';
import { ensureNotificationPermission } from '../../../src/services/notifications/permissions';
import { rescheduleAll } from '../../../src/services/notifications/scheduler';
import { colors, radius, spacing, typography } from '../../../src/theme/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface ScheduleDraft {
  id?: number;
  /** 1-12, paired with `period` — not 24-hour. */
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  days: number[];
}

function pad(n: string): string {
  return n.padStart(2, '0');
}

function newScheduleDraft(): ScheduleDraft {
  return { hour: '8', minute: '00', period: 'AM', days: [...ALL_DAYS] };
}

/** "20:00" -> { hour: '8', minute: '00', period: 'PM' } */
function timeOfDayTo12Hour(timeOfDay: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  const [h, m] = timeOfDay.split(':');
  const hour24 = Number(h);
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour: String(hour12), minute: m, period };
}

/** { hour: '8', minute: '00', period: 'PM' } -> "20:00" */
function to24HourTimeOfDay(hour: string, minute: string, period: 'AM' | 'PM'): string {
  const hour12 = Number(hour) % 12;
  const hour24 = period === 'PM' ? hour12 + 12 : hour12;
  return `${pad(String(hour24))}:${pad(minute)}`;
}

export default function EditVitaminMedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const vitaminMedId = isNew ? null : Number(id);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<'vitamin' | 'medication'>('vitamin');
  const [dosageLabel, setDosageLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(isNew ? [newScheduleDraft()] : []);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(isNew);

  const medQuery = useQuery({
    queryKey: ['vitaminsMeds', vitaminMedId],
    queryFn: () => getVitaminMedById(vitaminMedId!),
    enabled: !isNew,
  });

  const schedulesQuery = useQuery({
    queryKey: ['medSchedules', vitaminMedId],
    queryFn: () => listSchedulesForVitaminMed(vitaminMedId!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew || initialized) return;
    if (!medQuery.data || !schedulesQuery.data) return;
    setName(medQuery.data.name);
    setType(medQuery.data.type);
    setDosageLabel(medQuery.data.dosageLabel ?? '');
    setNotes(medQuery.data.notes ?? '');
    setSchedules(
      schedulesQuery.data.map((s) => ({
        id: s.id,
        ...timeOfDayTo12Hour(s.timeOfDay),
        days: s.daysOfWeek.split(',').map(Number),
      })),
    );
    setInitialized(true);
  }, [isNew, initialized, medQuery.data, schedulesQuery.data]);

  function updateSchedule_(index: number, patch: Partial<ScheduleDraft>) {
    setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function toggleDay(index: number, day: number) {
    setSchedules((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const days = s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day].sort();
        return { ...s, days };
      }),
    );
  }

  function removeScheduleDraft(index: number) {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      for (const s of schedules) {
        if (s.days.length === 0) throw new Error('Each reminder time needs at least one day selected');
      }

      const medInput = {
        name: name.trim(),
        type,
        dosageLabel: dosageLabel.trim() || null,
        notes: notes.trim() || null,
      };

      let medId = vitaminMedId;
      if (isNew) {
        const created = await createVitaminMed(medInput);
        medId = created.id;
      } else {
        await updateVitaminMed(medId!, medInput);
      }

      const existingIds = new Set((schedulesQuery.data ?? []).map((s) => s.id));
      const keptIds = new Set(schedules.filter((s) => s.id != null).map((s) => s.id!));
      for (const oldId of existingIds) {
        if (!keptIds.has(oldId)) await deleteSchedule(oldId);
      }

      for (const s of schedules) {
        const timeOfDay = to24HourTimeOfDay(s.hour, s.minute, s.period);
        const daysOfWeek = s.days.join(',');
        if (s.id != null) {
          await updateSchedule(s.id, { timeOfDay, daysOfWeek });
        } else {
          await createSchedule({ vitaminMedId: medId!, timeOfDay, daysOfWeek });
        }
      }

      await ensureNotificationPermission();
      await rescheduleAll();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitaminsMeds'] });
      queryClient.invalidateQueries({ queryKey: ['medsChecklist'] });
      router.back();
    },
    onError: (err: Error) => setError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await archiveVitaminMed(vitaminMedId!);
      await rescheduleAll();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitaminsMeds'] });
      queryClient.invalidateQueries({ queryKey: ['medsChecklist'] });
      router.back();
    },
  });

  if (!isNew && !initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={StyleSheet.flatten(styles.content)}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={120}
      keyboardOpeningTime={0}
    >
      <Card style={styles.card}>
        <Field label="Name" value={name} onChangeText={setName} />

        <Text style={styles.sectionLabel}>TYPE</Text>
        <SegmentedControl
          options={[
            { label: 'Vitamin', value: 'vitamin' },
            { label: 'Medication', value: 'medication' },
          ]}
          value={type}
          onChange={setType}
        />

        <Field label="Dosage (e.g. 500mg)" value={dosageLabel} onChangeText={setDosageLabel} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Text style={styles.sectionLabel}>REMINDER TIMES</Text>
      {schedules.map((schedule, index) => (
        <Card key={index} style={styles.scheduleCard}>
          <View style={styles.timeRow}>
            <TextInput
              style={styles.timeInput}
              value={schedule.hour}
              onChangeText={(v) => updateSchedule_(index, { hour: v })}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              style={styles.timeInput}
              value={schedule.minute}
              onChangeText={(v) => updateSchedule_(index, { minute: v })}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={styles.periodControl}>
              <SegmentedControl
                options={[
                  { label: 'AM', value: 'AM' as const },
                  { label: 'PM', value: 'PM' as const },
                ]}
                value={schedule.period}
                onChange={(period) => updateSchedule_(index, { period })}
              />
            </View>
            <TouchableOpacity style={styles.removeButton} onPress={() => removeScheduleDraft(index)} hitSlop={8}>
              <Text style={styles.removeLink}>Remove</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, day) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, schedule.days.includes(day) && styles.dayChipActive]}
                onPress={() => toggleDay(index, day)}
              >
                <Text style={[styles.dayChipText, schedule.days.includes(day) && styles.dayChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      ))}
      <AppButton
        title="+ Add Time"
        variant="secondary"
        onPress={() => setSchedules((prev) => [...prev, newScheduleDraft()])}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <AppButton
        title={saveMutation.isPending ? 'Saving…' : 'Save'}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      />

      {!isNew && (
        <View style={styles.deleteRow}>
          <AppButton title="Archive" variant="danger" onPress={() => archiveMutation.mutate()} />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
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
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  card: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    ...typography.label,
    marginLeft: spacing.xs,
  },
  scheduleCard: {
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeInput: {
    width: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 16,
    color: colors.textPrimary,
  },
  timeColon: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  periodControl: {
    width: 96,
  },
  removeButton: {
    marginLeft: 'auto',
  },
  removeLink: {
    color: colors.danger,
    fontSize: 13,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
  },
  dayChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  deleteRow: {
    marginTop: spacing.sm,
  },
});
