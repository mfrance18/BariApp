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
    expect(food.servingAmount).toBe(100);
    expect(food.servingUnit).toBe('g');
    expect(food.calories).toBe(97);
    expect(food.proteinG).toBe(9);
    expect(food.sodiumMg).toBeCloseTo(36);
    // "g" is already weighable, so no fallback weight equivalent is needed.
    expect(food.servingWeightG).toBeNull();
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

  it('uses OFF-provided per-serving nutrients and a label-matching serving size when available', () => {
    const product: OffProduct = {
      code: '333',
      product_name: 'Gatorade Zero',
      brands: 'Gatorade',
      serving_size: '1 bottle (591ml)',
      serving_quantity: 591,
      nutriments: {
        'energy-kcal_100g': 0,
        'energy-kcal_serving': 0,
        proteins_serving: 0,
        carbohydrates_serving: 0,
        fat_serving: 0,
        fiber_serving: 0,
        sugars_serving: 0,
        sodium_serving: 0.27,
      },
    };

    const food = mapOffProductToFood(product, '333');
    expect(food.servingAmount).toBe(1);
    expect(food.servingUnit).toBe('bottle');
    expect(food.calories).toBe(0);
    expect(food.sodiumMg).toBeCloseTo(270);
    // "bottle" isn't weighable, but OFF told us the serving's weight — capture
    // it as a fallback so this food can still be used in recipes / weighed.
    expect(food.servingWeightG).toBe(591);
  });

  it('scales per-100g values to the serving size when OFF has no per-serving nutrients', () => {
    const product: OffProduct = {
      code: '444',
      product_name: 'Orange Juice',
      serving_size: '8 fl oz (240ml)',
      serving_quantity: 240,
      nutriments: {
        'energy-kcal_100g': 45,
        proteins_100g: 0.7,
        carbohydrates_100g: 10,
        fat_100g: 0.2,
        fiber_100g: 0.2,
        sugars_100g: 8,
        sodium_100g: 0.001,
      },
    };

    const food = mapOffProductToFood(product, '444');
    expect(food.servingAmount).toBe(8);
    expect(food.servingUnit).toBe('fl oz');
    expect(food.calories).toBeCloseTo(108);
    expect(food.carbsG).toBeCloseTo(24);
    expect(food.sodiumMg).toBeCloseTo(2);
    expect(food.servingWeightG).toBe(240);
  });
});
