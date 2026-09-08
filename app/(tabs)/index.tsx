import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '../../src/components/ui/Card';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { SwipeToDelete } from '../../src/components/ui/SwipeToDelete';
import { listEntriesForDate as listFluidEntriesForDate } from '../../src/db/repositories/fluidRepo';
import { deleteEntry, listEntriesForDate, type MealLogEntryWithName } from '../../src/db/repositories/mealLogRepo';
import { getSettings } from '../../src/db/repositories/settingsRepo';
import { getLatestWeightLogEntry } from '../../src/db/repositories/weightRepo';
import { groupEntriesByMeal, MEAL_TYPES, sumEntries, type MealType } from '../../src/services/nutrition/totals';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
import { formatDisplayDate, toLogDateKey, todayLogDateKey } from '../../src/utils/date';
import { mlToOz } from '../../src/utils/units';

const KG_TO_LB = 2.20462;

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
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

  const { data: settings } = useQuery({ queryKey: ['app_settings'], queryFn: getSettings });
  const { data: latestWeight } = useQuery({ queryKey: ['weightLog', 'latest'], queryFn: getLatestWeightLogEntry });
  const { data: fluidEntries } = useQuery({
    queryKey: ['fluidLog', logDate],
    queryFn: () => listFluidEntriesForDate(logDate),
  });

  const grouped = groupEntriesByMeal(entries ?? []);
  const fluidTotalMl = (fluidEntries ?? []).reduce((sum, e) => sum + e.amountMl, 0);
  const fluidGoalMl = settings?.dailyFluidGoalMl ?? 1500;
  const dailyTotals = sumEntries(entries ?? []);

  const calorieGoal = settings?.dailyCalorieGoal ?? 0;
  const caloriesRemaining = Math.round(calorieGoal - dailyTotals.calories);
  const overGoal = calorieGoal > 0 && dailyTotals.calories > calorieGoal;
  const ringProgress = calorieGoal > 0 ? dailyTotals.calories / calorieGoal : 0;
  const proteinGoal = settings?.dailyProteinGoalG ?? 0;
  const proteinProgress = proteinGoal > 0 ? Math.min(1, dailyTotals.proteinG / proteinGoal) : 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={MEAL_TYPES}
      keyExtractor={(meal) => meal}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.dateNavRow}>
            <TouchableOpacity onPress={() => setLogDate((d) => addDays(d, -1))} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.dateHeading}>{formatDisplayDate(logDate)}</Text>
            <TouchableOpacity onPress={() => setLogDate((d) => addDays(d, 1))} hitSlop={12}>
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Card style={styles.calorieCard}>
            <ProgressRing
              size={148}
              strokeWidth={14}
              progress={ringProgress}
              color={overGoal ? colors.danger : colors.primary}
              trackColor={colors.border}
            >
              <Text style={[styles.ringValue, overGoal && styles.ringValueDanger]}>
                {Math.abs(caloriesRemaining)}
              </Text>
              <Text style={styles.ringLabel}>{overGoal ? 'kcal over' : 'kcal left'}</Text>
            </ProgressRing>

            <View style={styles.calorieStatsColumn}>
              <CalorieStat label="Goal" value={Math.round(calorieGoal)} />
              <CalorieStat label="Food" value={Math.round(dailyTotals.calories)} />
              <CalorieStat label="Remaining" value={caloriesRemaining} highlight={overGoal} />
            </View>
          </Card>

          <Card style={styles.macrosCard}>
            <MacroBar
              label="Protein"
              value={dailyTotals.proteinG}
              goal={proteinGoal}
              progress={proteinProgress}
              color={colors.protein}
              unit="g"
            />
            <View style={styles.macroChipsRow}>
              <MacroChip label="Carbs" value={dailyTotals.carbsG} unit="g" color={colors.carbs} />
              <MacroChip label="Fat" value={dailyTotals.fatG} unit="g" color={colors.fat} />
              <MacroChip label="Fiber" value={dailyTotals.fiberG} unit="g" color={colors.fiber} />
              <MacroChip label="Sodium" value={dailyTotals.sodiumMg} unit="mg" color={colors.sodium} />
            </View>
          </Card>

          <View style={styles.statCardsRow}>
            <TouchableOpacity style={styles.statCardWrapper} onPress={() => router.push('/fluids')}>
              <Card style={styles.statCard}>
                <Ionicons name="water" size={20} color={colors.fluid} />
                <Text style={styles.statCardValue}>
                  {mlToOz(fluidTotalMl).toFixed(0)} <Text style={styles.statCardUnit}>oz</Text>
                </Text>
                <Text style={styles.statCardLabel}>of {mlToOz(fluidGoalMl).toFixed(0)} oz goal</Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardWrapper}
              onPress={() => router.push('/weight-history')}
              disabled={!latestWeight}
            >
              <Card style={styles.statCard}>
                <Ionicons name="trending-down" size={20} color={colors.weight} />
                {latestWeight ? (
                  <>
                    <Text style={styles.statCardValue}>
                      {(settings?.weightUnit === 'kg' ? latestWeight.weightKg : latestWeight.weightKg * KG_TO_LB).toFixed(
                        1,
                      )}{' '}
                      <Text style={styles.statCardUnit}>{settings?.weightUnit ?? 'lb'}</Text>
                    </Text>
                    <Text style={styles.statCardLabel}>
                      {new Date(latestWeight.recordedAt).toLocaleDateString()}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.statCardLabel}>No weigh-ins yet</Text>
                )}
              </Card>
            </TouchableOpacity>
          </View>

          <Text style={styles.mealsHeading}>Meals</Text>
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

function CalorieStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.calorieStatRow}>
      <Text style={styles.calorieStatLabel}>{label}</Text>
      <Text style={[styles.calorieStatValue, highlight && styles.ringValueDanger]}>{value}</Text>
    </View>
  );
}

function MacroBar({
  label,
  value,
  goal,
  progress,
  color,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  progress: number;
  color: string;
  unit: string;
}) {
  return (
    <View style={styles.macroBarBlock}>
      <View style={styles.macroBarHeaderRow}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>
          {Math.round(value)} / {Math.round(goal)} {unit}
        </Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MacroChip({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.macroChip}>
      <View style={[styles.macroChipDot, { backgroundColor: color }]} />
      <Text style={styles.macroChipValue}>
        {Math.round(value)}
        {unit}
      </Text>
      <Text style={styles.macroChipLabel}>{label}</Text>
    </View>
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
    <Card style={styles.mealSection}>
      <View style={styles.mealHeaderRow}>
        <View style={styles.mealHeaderLeft}>
          <Ionicons name={MEAL_ICONS[meal]} size={18} color={colors.textSecondary} />
          <Text style={styles.mealLabel}>{MEAL_LABELS[meal]}</Text>
        </View>
        <Text style={styles.mealTotalText}>{Math.round(mealTotal.calories)} kcal</Text>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No items logged yet</Text>
      ) : (
        entries.map((entry) => (
          <SwipeToDelete key={entry.id} onDelete={() => onDelete(entry.id)}>
            <View style={styles.entryRow}>
              <TouchableOpacity
                style={styles.entryTextGroup}
                onPress={() =>
                  router.push({
                    pathname: '/log/[mealType]/weigh',
                    params: {
                      mealType: entry.mealType,
                      itemType: entry.itemType,
                      itemId: String(entry.itemType === 'food' ? entry.foodId : entry.recipeId),
                      logDate: entry.logDate,
                      entryId: String(entry.id),
                    },
                  })
                }
              >
                <Text style={styles.entryName}>{entry.itemName}</Text>
                <Text style={styles.entrySubtext}>
                  {entry.weightG != null ? `${entry.weightG} g` : `${entry.quantityAmount} ${entry.quantityUnit}`} ·{' '}
                  {Math.round(entry.calories)} kcal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(entry.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </SwipeToDelete>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push({ pathname: '/log/[mealType]/pick-item', params: { mealType: meal, logDate } })}
      >
        <Ionicons name="add-circle" size={18} color={colors.primary} />
        <Text style={styles.addButtonText}>ADD FOOD</Text>
      </TouchableOpacity>
    </Card>
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
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  dateHeading: {
    ...typography.heading,
  },
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  ringValueDanger: {
    color: colors.danger,
  },
  ringLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  calorieStatsColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  calorieStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  calorieStatLabel: {
    ...typography.caption,
  },
  calorieStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  macrosCard: {
    gap: spacing.md,
  },
  macroBarBlock: {
    gap: spacing.xs,
  },
  macroBarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroBarLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  macroBarValue: {
    ...typography.caption,
  },
  macroBarTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
  },
  macroChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroChip: {
    alignItems: 'center',
    gap: 2,
  },
  macroChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  macroChipValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  macroChipLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    alignItems: 'flex-start',
    gap: 4,
    padding: spacing.md,
  },
  statCardValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statCardUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statCardLabel: {
    ...typography.caption,
  },
  mealsHeading: {
    ...typography.label,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  mealSection: {
    gap: spacing.sm,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mealTotalText: {
    ...typography.caption,
  },
  emptyText: {
    color: colors.textMuted,
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
    color: colors.textPrimary,
  },
  entrySubtext: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
