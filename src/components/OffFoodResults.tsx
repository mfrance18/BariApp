import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { navigateToExistingFoodByBarcode, navigateToPrefilledFoodForm, type FoodMatchContext } from '../services/openFoodFacts/navigation';
import type { OffProduct } from '../services/openFoodFacts/types';
import { colors, radius, spacing, typography } from '../theme/theme';

interface OffFoodResultsProps {
  results: OffProduct[];
  loading: boolean;
  context: FoodMatchContext;
}

/** Lets the user search Open Food Facts and pick a match, alongside whatever's already in the local library. */
export function OffFoodResults({ results, loading, context }: OffFoodResultsProps) {
  async function handlePress(product: OffProduct) {
    const handledExisting = await navigateToExistingFoodByBarcode(product.code, context);
    if (!handledExisting) {
      navigateToPrefilledFoodForm(product, product.code, context);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM OPEN FOOD FACTS</Text>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>FROM OPEN FOOD FACTS</Text>
        <Text style={styles.emptyText}>No matches on Open Food Facts.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>FROM OPEN FOOD FACTS</Text>
      {results.map((product) => (
        <TouchableOpacity key={product.code} style={styles.row} onPress={() => handlePress(product)}>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowTitle}>{product.product_name}</Text>
            {product.brands ? <Text style={styles.rowSubtitle}>{product.brands.split(',')[0]?.trim()}</Text> : null}
          </View>
          <Text style={styles.addLabel}>Add</Text>
        </TouchableOpacity>
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
});
