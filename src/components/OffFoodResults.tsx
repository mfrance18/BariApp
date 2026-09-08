import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { navigateToExistingFoodByBarcode, navigateToPrefilledFoodForm, type FoodMatchContext } from '../services/openFoodFacts/navigation';
import type { OffProduct } from '../services/openFoodFacts/types';
import { colors, radius, spacing, typography } from '../theme/theme';

interface OffFoodResultsProps {
  results: OffProduct[];
  loading: boolean;
  context: FoodMatchContext;
}

/** Shown when a food search comes up empty locally: lets the user pick a match from Open Food Facts instead. */
export function OffFoodResults({ results, loading, context }: OffFoodResultsProps) {
  async function handlePress(product: OffProduct) {
    const handledExisting = await navigateToExistingFoodByBarcode(product.code, context);
    if (!handledExisting) {
      navigateToPrefilledFoodForm(product, product.code, context);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (results.length === 0) {
    return <Text style={styles.emptyText}>Not in your library, and no matches on Open Food Facts.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>NOT IN YOUR LIBRARY — FROM OPEN FOOD FACTS</Text>
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
    marginTop: 24,
  },
});
