import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { clearStatus, getTodayChecklist, setStatus, type TodayChecklistItem } from '../../src/db/repositories/medsRepo';
import { isNotificationsSupported } from '../../src/services/notifications/environment';
import { ensureNotificationPermission } from '../../src/services/notifications/permissions';
import { todayLogDateKey } from '../../src/utils/date';

export default function MedsScreen() {
  const queryClient = useQueryClient();
  const scheduledDate = todayLogDateKey();

  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
  }, []);

  const { data: checklist } = useQuery({
    queryKey: ['medsChecklist', scheduledDate],
    queryFn: () => getTodayChecklist(scheduledDate),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ item }: { item: TodayChecklistItem }) =>
      item.status === 'taken'
        ? clearStatus(item.scheduleId, scheduledDate)
        : setStatus(item.scheduleId, scheduledDate, 'taken'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medsChecklist', scheduledDate] }),
  });

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={checklist ?? []}
      keyExtractor={(item) => String(item.scheduleId)}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.heading}>Today&apos;s Vitamins &amp; Meds</Text>
          {!isNotificationsSupported && (
            <Text style={styles.noticeText}>
              Reminders don&apos;t work in Expo Go — build a development build to get notifications.
            </Text>
          )}
          <Button title="Manage Vitamins & Meds" onPress={() => router.push('/meds/manage')} />
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, item.status === 'taken' && styles.rowTaken]}
          onPress={() => toggleMutation.mutate({ item })}
        >
          <View>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.dosageLabel ? `${item.dosageLabel} · ` : ''}
              {formatTime(item.timeOfDay)}
            </Text>
          </View>
          <Text style={styles.statusText}>{item.status === 'taken' ? '✓ Taken' : 'Mark Taken'}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>Nothing scheduled for today. Add one from Manage.</Text>
      }
    />
  );
}

function formatTime(timeOfDay: string): string {
  const [hourStr, minuteStr] = timeOfDay.split(':');
  const hour = Number(hourStr);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteStr} ${suffix}`;
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 8,
  },
  rowTaken: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 13,
    color: '#777',
  },
  statusText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
  noticeText: {
    fontSize: 12,
    color: '#a16207',
    backgroundColor: '#fef9c3',
    padding: 8,
    borderRadius: 8,
  },
});
