import { StyleSheet, Text, View } from 'react-native';

import { formatDisplayDate, todayLogDateKey } from '../../src/utils/date';

const MEAL_SECTIONS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
] as const;

export default function DashboardScreen() {
  const logDate = todayLogDateKey();

  return (
    <View style={styles.container}>
      <Text style={styles.dateHeading}>{formatDisplayDate(logDate)}</Text>
      {MEAL_SECTIONS.map((meal) => (
        <View key={meal.key} style={styles.mealSection}>
          <Text style={styles.mealLabel}>{meal.label}</Text>
          <Text style={styles.emptyText}>No items logged yet</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  dateHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  mealSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
  },
  mealLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
  },
});
