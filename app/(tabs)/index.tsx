import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Card } from '../../src/components/ui/Card';
import { ProgressRing } from '../../src/components/ui/ProgressRing';
import { SwipeToDelete } from '../../src/components/ui/SwipeToDelete';
import { listEntriesForDate as listFluidEntriesForDate } from '../../src/db/repositories/fluidRepo';
import { deleteEntry, listEntriesForDate, type MealLogEntryWithName } from '../../src/db/repositories/mealLogRepo';
import { clearStatus, getTodayChecklist, setStatus, type TodayChecklistItem } from '../../src/db/repositories/medsRepo';
import { getSettings } from '../../src/db/repositories/settingsRepo';
import { getLatestWeightLogEntry } from '../../src/db/repositories/weightRepo';
import { useSelectedLogDate } from '../../src/hooks/useSelectedLogDate';
import { getDailyActivity, hasHealthConnectAccess } from '../../src/services/healthConnect/adapter';
import { groupEntriesByMeal, MEAL_TYPES, sumEntries, type MealType } from '../../src/services/nutrition/totals';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
import { formatDisplayDate, formatTimeOfDay, toLogDateKey } from '../../src/utils/date';
import { mlToOz } from '../../src/utils/units';
import { gramsToServing } from '../../src/utils/servingUnits';

function formatWeightOz(weightG: number): string {
  const oz = gramsToServing(weightG, 'oz') ?? weightG;
  return `${Math.round(oz * 10) / 10} oz`;
}

const KG_TO_LB = 2.20462;

// The app is portrait-locked, so a static width computed once is fine.
const CAROUSEL_CARD_WIDTH = Dimensions.get('window').width - spacing.lg * 2;
const DASHBOARD_CARD_COUNT = 3;

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
  const { logDate, setLogDate } = useSelectedLogDate();
  const queryClient = useQueryClient();
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  function handleCarouselMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_CARD_WIDTH);
    setActiveCardIndex(Math.max(0, Math.min(DASHBOARD_CARD_COUNT - 1, index)));
  }

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
  const { data: healthAccess } = useQuery({ queryKey: ['healthConnectAccess'], queryFn: hasHealthConnectAccess });
  const { data: activity } = useQuery({
    queryKey: ['dailyActivity', logDate],
    queryFn: () => getDailyActivity(logDate),
    enabled: !!healthAccess,
  });

  const { data: medsChecklist } = useQuery({
    queryKey: ['medsChecklist', logDate],
    queryFn: () => getTodayChecklist(logDate, new Date(`${logDate}T00:00:00`)),
  });

  const toggleMedMutation = useMutation({
    mutationFn: (item: TodayChecklistItem) =>
      item.status === 'taken' ? clearStatus(item.scheduleId, logDate) : setStatus(item.scheduleId, logDate, 'taken'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['medsChecklist', logDate] }),
  });

  const grouped = groupEntriesByMeal(entries ?? []);
  const fluidTotalMl = (fluidEntries ?? []).reduce((sum, e) => sum + e.amountMl, 0);
  const fluidGoalMl = settings?.dailyFluidGoalMl ?? 1500;
  const fluidProgress = fluidGoalMl > 0 ? Math.min(1, fluidTotalMl / fluidGoalMl) : 0;
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

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleCarouselMomentumEnd}
          >
            <View style={styles.carouselPage}>
              <Card style={styles.carouselCard}>
                <View style={styles.ringCardRow}>
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

                  <View style={styles.ringStatsColumn}>
                    <RingStat label="Goal" value={Math.round(calorieGoal)} />
                    <RingStat label="Food" value={Math.round(dailyTotals.calories)} />
                    <RingStat label="Remaining" value={caloriesRemaining} highlight={overGoal} />
                  </View>
                </View>

                <View style={styles.macrosSection}>
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
                </View>
              </Card>
            </View>

            <TouchableOpacity style={styles.carouselPage} onPress={() => router.push('/fluids')} activeOpacity={0.8}>
              <Card style={[styles.carouselCard, styles.fluidCard]}>
                <ProgressRing size={148} strokeWidth={14} progress={fluidProgress} color={colors.fluid} trackColor={colors.border}>
                  <Text style={styles.ringValue}>{Math.round(mlToOz(fluidTotalMl))}</Text>
                  <Text style={styles.ringLabel}>oz today</Text>
                </ProgressRing>

                <View style={styles.statChipsRow}>
                  <StatChip label="Goal" value={Math.round(mlToOz(fluidGoalMl))} />
                  <StatChip label="Logged" value={Math.round(mlToOz(fluidTotalMl))} highlight />
                  <StatChip
                    label="Remaining"
                    value={Math.max(0, Math.round(mlToOz(fluidGoalMl) - mlToOz(fluidTotalMl)))}
                  />
                </View>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity style={styles.carouselPage} onPress={() => router.push('/weight-history')} activeOpacity={0.8}>
              <Card style={[styles.carouselCard, styles.weightCard]}>
                <View style={styles.weightIconCircle}>
                  <Ionicons name="trending-down" size={28} color={colors.weight} />
                </View>
                {latestWeight ? (
                  <>
                    <Text style={styles.ringValue}>
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
                  <Text style={styles.statCardLabel}>Tap to log your weight</Text>
                )}

                {healthAccess && activity && (activity.steps != null || activity.caloriesBurned != null) && (
                  <View style={styles.statChipsRow}>
                    {activity.steps != null && <StatChip label="Steps" value={activity.steps} />}
                    {activity.caloriesBurned != null && (
                      <StatChip
                        label={activity.caloriesSource === 'total' ? 'Cal Burned (total)' : 'Cal Burned'}
                        value={Math.round(activity.caloriesBurned)}
                      />
                    )}
                  </View>
                )}
                {healthAccess && activity && activity.stepsDataOrigins.length > 0 && (
                  <Text style={styles.debugText}>Steps sources: {activity.stepsDataOrigins.join(', ')}</Text>
                )}
              </Card>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.dotsRow}>
            {Array.from({ length: DASHBOARD_CARD_COUNT }).map((_, index) => (
              <View key={index} style={[styles.dot, index === activeCardIndex && styles.dotActive]} />
            ))}
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
      ListFooterComponent={
        medsChecklist && medsChecklist.length > 0 ? (
          <Card style={styles.medsCard}>
            <View style={styles.medsHeaderRow}>
              <Text style={styles.mealsHeading}>Vitamins &amp; Meds</Text>
              <TouchableOpacity onPress={() => router.push('/meds')} hitSlop={8}>
                <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {medsChecklist.map((item) => (
              <TouchableOpacity
                key={item.scheduleId}
                style={[styles.medRow, item.status === 'taken' && styles.medRowTaken]}
                onPress={() => toggleMedMutation.mutate(item)}
              >
                <View style={styles.medRowIcon}>
                  <Ionicons
                    name={item.type === 'vitamin' ? 'nutrition-outline' : 'medkit-outline'}
                    size={18}
                    color={item.status === 'taken' ? colors.success : colors.primary}
                  />
                </View>
                <View style={styles.medTextGroup}>
                  <Text style={styles.medName}>{item.name}</Text>
                  <Text style={styles.medMeta}>
                    {item.dosageLabel ? `${item.dosageLabel} · ` : ''}
                    {formatTimeOfDay(item.timeOfDay)}
                  </Text>
                </View>
                {item.status === 'taken' ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                ) : (
                  <View style={styles.medCheckCircle} />
                )}
              </TouchableOpacity>
            ))}
          </Card>
        ) : null
      }
    />
  );
}

function RingStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.ringStatRow}>
      <Text style={styles.ringStatLabel}>{label}</Text>
      <Text style={[styles.ringStatValue, highlight && styles.ringValueDanger]}>{value}</Text>
    </View>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statChipValue, highlight && styles.statChipValueHighlight]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
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
          <Ionicons name={MEAL_ICONS[meal]} size={20} color={colors.primary} />
          <Text style={styles.mealLabel}>{MEAL_LABELS[meal]}</Text>
        </View>
        <View style={styles.mealHeaderRight}>
          {entries.length > 0 && (
            <Text style={styles.mealTotalText}>{Math.round(mealTotal.calories)} kcal</Text>
          )}
          <TouchableOpacity
            style={styles.logButton}
            onPress={() => router.push({ pathname: '/log/[mealType]/pick-item', params: { mealType: meal, logDate } })}
          >
            <Text style={styles.logButtonText}>Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>No items logged yet</Text>
      ) : (
        entries.map((entry) => (
          <SwipeToDelete key={entry.id} onDelete={() => onDelete(entry.id)}>
            <View style={styles.entryRow}>
              <Ionicons name={MEAL_ICONS[meal]} size={16} color={colors.textMuted} style={styles.entryIcon} />
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
                  {entry.weightG != null ? formatWeightOz(entry.weightG) : `${entry.quantityAmount} ${entry.quantityUnit}`}{' '}
                  ·{' '}
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
  ringCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
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
  ringStatsColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  ringStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  ringStatLabel: {
    ...typography.caption,
  },
  ringStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  macrosSection: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
  carouselPage: {
    width: CAROUSEL_CARD_WIDTH,
  },
  carouselCard: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  fluidCard: {
    alignItems: 'center',
  },
  weightCard: {
    alignItems: 'center',
  },
  weightIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  statChipsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statChipValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statChipValueHighlight: {
    color: colors.fluid,
  },
  statChipLabel: {
    ...typography.caption,
  },
  debugText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
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
  medsCard: {
    gap: spacing.sm,
  },
  medsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  medRowTaken: {
    backgroundColor: colors.successLight,
  },
  medRowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTextGroup: {
    flex: 1,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  medMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  medCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
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
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mealTotalText: {
    ...typography.caption,
  },
  logButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  logButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  entryIcon: {
    opacity: 0.8,
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
    marginTop: 2,
  },
});
