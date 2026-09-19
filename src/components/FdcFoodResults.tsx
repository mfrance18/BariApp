import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { navigateToExistingFoodByBarcode, navigateToPrefilledFoodForm, type FoodMatchContext } from '../services/openFoodFacts/navigation';
import { mapFdcFoodToFood } from '../services/fdc/mapper';
import type { FdcFood } from '../services/fdc/types';
import { colors, radius, spacing, typography } from '../theme/theme';
import { AppButton } from './ui/AppButton';

interface FdcFoodResultsProps {
  results: FdcFood[];
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  needsApiKey?: boolean;
  /** Default behavior: navigate to the existing/new food screen. Required unless onSelect is given. */
  context?: FoodMatchContext;
  /** Overrides the default navigation with a custom handler (e.g. create-and-use-inline instead of navigating away). */
  onSelect?: (food: FdcFood) => void;
}

/** Lets the user search USDA FoodData Central and pick a match, alongside whatever's already in the local library. */
export function FdcFoodResults({
  results,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  needsApiKey,
  context,
  onSelect,
}: FdcFoodResultsProps) {
  async function handlePress(food: FdcFood) {
    if (onSelect) {
      onSelect(food);
      return;
    }
    if (!context) return;
    const barcode = food.gtinUpc?.trim();
    const handledExisting = barcode ? await navigateToExistingFoodByBarcode(barcode, context) : false;
    if (!handledExisting) {
      navigateToPrefilledFoodForm(mapFdcFoodToFood(food), barcode ?? '', context);
    }
  }

  if (needsApiKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM USDA FOODDATA CENTRAL</Text>
        <Text style={styles.emptyText}>
          Add your free USDA FoodData Central API key in Settings to search here.{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://api.data.gov/signup')}>
            Get one at api.data.gov/signup
          </Text>
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM USDA FOODDATA CENTRAL</Text>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM USDA FOODDATA CENTRAL</Text>
        <Text style={styles.emptyText}>Couldn't reach FoodData Central: {error.message}</Text>
        {onRetry && <AppButton title="Retry" variant="secondary" onPress={onRetry} />}
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM USDA FOODDATA CENTRAL</Text>
        <Text style={styles.emptyText}>No matches on FoodData Central.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>FROM USDA FOODDATA CENTRAL</Text>
      {results.map((food) => (
        <TouchableOpacity key={food.fdcId} style={styles.row} onPress={() => handlePress(food)}>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowTitle}>{food.description}</Text>
            {(food.brandName || food.brandOwner) && <Text style={styles.rowSubtitle}>{food.brandName || food.brandOwner}</Text>}
          </View>
          <Text style={styles.addLabel}>Add</Text>
        </TouchableOpacity>
      ))}
      {hasMore &&
        (loadingMore ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          onLoadMore && <AppButton title="Load More" variant="secondary" onPress={onLoadMore} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  center: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  sectionLabel: {
    ...typography.label,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowTextGroup: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
