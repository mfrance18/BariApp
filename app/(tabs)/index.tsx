import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { deleteEntry, listEntriesForDate, type MealLogEntryWithName } from '../../src/db/repositories/mealLogRepo';
import { groupEntriesByMeal, MEAL_TYPES, sumEntries, type MealType } from '../../src/services/nutrition/totals';
import { formatDisplayDate, toLogDateKey, todayLogDateKey } from '../../src/utils/date';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLogDateKey(date);
}

export default function DashboardScreen() {
  const [logDate, setLogDate] = useState(todayLogDateKey());
  const queryClient = useQueryClient();

  const { data: entries } = useQuery({
    queryKey: ['mealLogEntries', logDate],
    queryFn: () => listEntriesForDate(logDate),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mealLogEntries', logDate] }),
  });

  const grouped = groupEntriesByMeal(entries ?? []);
  const dailyTotals = sumEntries(entries ?? []);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={MEAL_TYPES}
      keyExtractor={(meal) => meal}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.dateNavRow}>
            <Text style={styles.navArrow} onPress={() => setLogDate((d) => addDays(d, -1))}>
              ‹
            </Text>
            <Text style={styles.dateHeading}>{formatDisplayDate(logDate)}</Text>
            <Text style={styles.navArrow} onPress={() => setLogDate((d) => addDays(d, 1))}>
              ›
            </Text>
          </View>
          <View style={styles.totalsBox}>
            <Text style={styles.totalsText}>{Math.round(dailyTotals.calories)} kcal</Text>
            <Text style={styles.totalsSubtext}>{Math.round(dailyTotals.proteinG)} g protein today</Text>
          </View>
        </View>
      }
      renderItem={({ item: meal }) => (
        <MealSection
          meal={meal}
          entries={grouped[meal]}
          logDate={logDate}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}
    />
  );
}

function MealSection({
  meal,
  entries,
  logDate,
  onDelete,
}: {
  meal: MealType;
  entries: MealLogEntryWithName[];
  logDate: string;
  onDelete: (id: number) => void;
}) {
  const mealTotal = sumEntries(entries);

  return (
    <View style={styles.mealSection}>
      <View style={styles.mealHeaderRow}>
        <Text style={styles.mealLabel}>{MEAL_LABELS[meal]}</Text>
        <Text style={styles.mealTotalText}>{Math.round(mealTotal.calories)} kcal</Text>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No items logged yet</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entryRow}>
            <View style={styles.entryTextGroup}>
              <Text style={styles.entryName}>{entry.itemName}</Text>
              <Text style={styles.entrySubtext}>
                {entry.weightG} g · {Math.round(entry.calories)} kcal
              </Text>
            </View>
            <Text style={styles.removeLink} onPress={() => onDelete(entry.id)}>
              Remove
            </Text>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() =>
          router.push({ pathname: '/log/[mealType]/pick-item', params: { mealType: meal, logDate } })
        }
      >
        <Text style={styles.addButtonText}>+ Add to {MEAL_LABELS[meal]}</Text>
      </TouchableOpacity>
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
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navArrow: {
    fontSize: 24,
    paddingHorizontal: 16,
    color: '#555',
  },
  dateHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalsBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  totalsText: {
    fontSize: 22,
    fontWeight: '700',
  },
  totalsSubtext: {
    color: '#666',
  },
  mealSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mealLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  mealTotalText: {
    color: '#666',
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  entryTextGroup: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
  },
  entrySubtext: {
    fontSize: 12,
    color: '#888',
  },
  removeLink: {
    color: '#c00',
    fontSize: 13,
  },
  addButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
