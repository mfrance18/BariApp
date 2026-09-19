import { mapFdcFoodToFood } from './mapper';
import type { FdcFood } from './types';

describe('mapFdcFoodToFood', () => {
  it('maps a well-formed Branded food using labelNutrients directly, no scaling', () => {
    const food: FdcFood = {
      fdcId: 1,
      description: '  Mochi Ice Cream  ',
      dataType: 'Branded',
      brandName: 'My/Mo',
      brandOwner: 'My/Mo Mochi LLC',
      gtinUpc: '0123456789012',
      servingSize: 36,
      servingSizeUnit: 'g',
      labelNutrients: {
        calories: { value: 90 },
        protein: { value: 1 },
        fat: { value: 3 },
        carbohydrates: { value: 15 },
        fiber: { value: 0 },
        sugars: { value: 9 },
        sodium: { value: 15 },
      },
    };

    const mapped = mapFdcFoodToFood(food);

    expect(mapped.name).toBe('Mochi Ice Cream');
    expect(mapped.brand).toBe('My/Mo');
    expect(mapped.barcode).toBe('0123456789012');
    expect(mapped.source).toBe('usda_fdc');
    expect(mapped.servingAmount).toBe(36);
    expect(mapped.servingUnit).toBe('g');
    expect(mapped.calories).toBe(90);
    expect(mapped.proteinG).toBe(1);
    // Already in mg, unlike Open Food Facts's grams — no ×1000 conversion.
    expect(mapped.sodiumMg).toBe(15);
    expect(mapped.servingWeightG).toBeNull();
  });

  it('falls back to brandOwner when brandName is missing, and defaults missing nutrients to 0', () => {
    const food: FdcFood = {
      fdcId: 2,
      description: 'Some Snack',
      dataType: 'Branded',
      brandOwner: 'Snack Co',
      servingSize: 28,
      servingSizeUnit: 'g',
      labelNutrients: {},
    };

    const mapped = mapFdcFoodToFood(food);
    expect(mapped.brand).toBe('Snack Co');
    expect(mapped.calories).toBe(0);
    expect(mapped.sodiumMg).toBe(0);
    expect(mapped.barcode).toBeNull();
  });

  it('maps a generic Foundation/SR Legacy food via the per-100g nutrient-number table', () => {
    const food: FdcFood = {
      fdcId: 3,
      description: 'Chicken, broiler, breast, meat only, raw',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrient: { number: '208', name: 'Energy', unitName: 'kcal' }, amount: 120 },
        { nutrient: { number: '203', name: 'Protein', unitName: 'g' }, amount: 22.5 },
        { nutrient: { number: '204', name: 'Total lipid (fat)', unitName: 'g' }, amount: 2.6 },
        { nutrient: { number: '205', name: 'Carbohydrate, by difference', unitName: 'g' }, amount: 0 },
        { nutrient: { number: '291', name: 'Fiber, total dietary', unitName: 'g' }, amount: 0 },
        { nutrient: { number: '269', name: 'Sugars, total including NLEA', unitName: 'g' }, amount: 0 },
        { nutrient: { number: '307', name: 'Sodium, Na', unitName: 'mg' }, amount: 45 },
      ],
    };

    const mapped = mapFdcFoodToFood(food);
    expect(mapped.servingAmount).toBe(100);
    expect(mapped.servingUnit).toBe('g');
    expect(mapped.calories).toBe(120);
    expect(mapped.proteinG).toBe(22.5);
    expect(mapped.sodiumMg).toBe(45);
    expect(mapped.servingWeightG).toBeNull();
  });

  it('ignores foodNutrients entries with an unrecognized nutrient number', () => {
    const food: FdcFood = {
      fdcId: 4,
      description: 'Apple, raw',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrient: { number: '999', name: 'Some other nutrient', unitName: 'g' }, amount: 500 },
        { nutrient: { number: '208', name: 'Energy', unitName: 'kcal' }, amount: 52 },
      ],
    };

    const mapped = mapFdcFoodToFood(food);
    expect(mapped.calories).toBe(52);
    expect(mapped.proteinG).toBe(0);
  });

  it('defaults an unnamed Branded food to "Unknown food"', () => {
    const food: FdcFood = { fdcId: 5, dataType: 'Branded', labelNutrients: {} };
    const mapped = mapFdcFoodToFood(food);
    expect(mapped.name).toBe('Unknown food');
    expect(mapped.brand).toBeNull();
  });
});
