import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton } from '../../src/components/ui/AppButton';
import { clearStatus, getTodayChecklist, setStatus, type TodayChecklistItem } from '../../src/db/repositories/medsRepo';
import { isNotificationsSupported } from '../../src/services/notifications/environment';
import { ensureNotificationPermission } from '../../src/services/notifications/permissions';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
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
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Reminders don&apos;t work in Expo Go — build a development build to get notifications.
              </Text>
            </View>
          )}
          <AppButton title="Manage Vitamins & Meds" variant="secondary" onPress={() => router.push('/meds/manage')} />
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, item.status === 'taken' && styles.rowTaken]}
          onPress={() => toggleMutation.mutate({ item })}
        >
          <View style={styles.rowIcon}>
            <Ionicons
              name={item.type === 'vitamin' ? 'nutrition-outline' : 'medkit-outline'}
              size={18}
              color={item.status === 'taken' ? colors.success : colors.primary}
            />
          </View>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.dosageLabel ? `${item.dosageLabel} · ` : ''}
              {formatTime(item.timeOfDay)}
            </Text>
          </View>
          {item.status === 'taken' ? (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          ) : (
            <View style={styles.checkCircle} />
          )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  rowTaken: {
    backgroundColor: colors.successLight,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextGroup: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  noticeBox: {
    backgroundColor: '#FEF6E7',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  noticeText: {
    fontSize: 12,
    color: '#8A5A00',
  },
});
