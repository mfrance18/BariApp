import { mapOffProductToFood } from './mapper';
import type { OffProduct } from './types';

describe('mapOffProductToFood', () => {
  it('maps a well-formed product using energy-kcal_100g directly', () => {
    const product: OffProduct = {
      code: '0123456789012',
      product_name: '  Greek Yogurt  ',
      brands: 'Fage, Some Distributor',
      serving_size: '150g',
      nutriments: {
        'energy-kcal_100g': 97,
        proteins_100g: 9,
        carbohydrates_100g: 4,
        fat_100g: 5,
        fiber_100g: 0,
        sugars_100g: 4,
        sodium_100g: 0.036,
      },
    };

    const food = mapOffProductToFood(product, '0123456789012');

    expect(food.name).toBe('Greek Yogurt');
    expect(food.brand).toBe('Fage');
    expect(food.barcode).toBe('0123456789012');
    expect(food.source).toBe('open_food_facts');
    expect(food.basisType).toBe('per_100g');
    expect(food.calories).toBe(97);
    expect(food.proteinG).toBe(9);
    expect(food.sodiumMg).toBeCloseTo(36);
  });

  it('falls back to converting energy_100g (kJ) when kcal is missing', () => {
    const product: OffProduct = {
      code: '111',
      nutriments: { energy_100g: 418.4 },
    };

    const food = mapOffProductToFood(product, '111');
    expect(food.calories).toBeCloseTo(100);
  });

  it('defaults missing nutrients to 0 and missing name/brand sensibly', () => {
    const product: OffProduct = { code: '222' };

    const food = mapOffProductToFood(product, '222');
    expect(food.name).toBe('Unknown product');
    expect(food.brand).toBeNull();
    expect(food.calories).toBe(0);
    expect(food.proteinG).toBe(0);
    expect(food.sodiumMg).toBe(0);
  });
});
