import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface ScheduleDraft {
  id?: number;
  hour: string;
  minute: string;
  days: number[];
}

function pad(n: string): string {
  return n.padStart(2, '0');
}

function newScheduleDraft(): ScheduleDraft {
  return { hour: '08', minute: '00', days: [...ALL_DAYS] };
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
        hour: s.timeOfDay.split(':')[0],
        minute: s.timeOfDay.split(':')[1],
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
        const timeOfDay = `${pad(s.hour)}:${pad(s.minute)}`;
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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="Name" value={name} onChangeText={setName} />

      <Text style={styles.sectionLabel}>Type</Text>
      <View style={styles.segmentRow}>
        <SegmentButton label="Vitamin" active={type === 'vitamin'} onPress={() => setType('vitamin')} />
        <SegmentButton label="Medication" active={type === 'medication'} onPress={() => setType('medication')} />
      </View>

      <Field label="Dosage (e.g. 500mg)" value={dosageLabel} onChangeText={setDosageLabel} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

      <Text style={styles.sectionLabel}>Reminder Times</Text>
      {schedules.map((schedule, index) => (
        <View key={index} style={styles.scheduleCard}>
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
            <Text style={styles.removeLink} onPress={() => removeScheduleDraft(index)}>
              Remove
            </Text>
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
        </View>
      ))}
      <Button title="+ Add Time" onPress={() => setSchedules((prev) => [...prev, newScheduleDraft()])} />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        title={saveMutation.isPending ? 'Saving…' : 'Save'}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      />

      {!isNew && (
        <View style={styles.deleteRow}>
          <Button title="Archive" color="#c00" onPress={() => archiveMutation.mutate()} />
        </View>
      )}
    </ScrollView>
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
      />
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#555',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    color: '#333',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  segmentButtonActive: {
    backgroundColor: '#dbeafe',
    fontWeight: '700',
  },
  scheduleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeInput: {
    width: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 16,
  },
  timeColon: {
    fontSize: 16,
  },
  removeLink: {
    marginLeft: 'auto',
    color: '#c00',
    fontSize: 13,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  dayChipActive: {
    backgroundColor: '#2563eb',
  },
  dayChipText: {
    fontSize: 12,
    color: '#555',
  },
  dayChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#c00',
    fontSize: 13,
  },
  deleteRow: {
    marginTop: 8,
  },
});
