import {
  addNutrition,
  computeRecipeTotals,
  getReferenceWeightG,
  roundNutritionForDisplay,
  scaleNutrition,
  scaleRecipePortion,
  ZERO_NUTRITION,
} from './scaling';

const chickenBreastPer100g = {
  servingAmount: 100,
  servingUnit: 'g',
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 74,
};

const proteinBarPerServing = {
  servingAmount: 60,
  servingUnit: 'g',
  calories: 200,
  proteinG: 20,
  carbsG: 22,
  fatG: 7,
  fiberG: 3,
  sugarG: 1,
  sodiumMg: 210,
};

describe('getReferenceWeightG', () => {
  it('returns 100 for a food defined per 100 g', () => {
    expect(getReferenceWeightG(chickenBreastPer100g)).toBe(100);
  });

  it('returns servingAmount for a food defined per a smaller gram amount', () => {
    expect(getReferenceWeightG(proteinBarPerServing)).toBe(60);
  });

  it('converts a non-gram weight unit to grams', () => {
    expect(getReferenceWeightG({ servingAmount: 1, servingUnit: 'oz' })).toBeCloseTo(28.349523125);
  });

  it('throws for a discrete, non-weighable unit', () => {
    expect(() => getReferenceWeightG({ servingAmount: 1, servingUnit: 'bottle' })).toThrow();
  });

  it('falls back to servingWeightG for a discrete unit with a captured weight equivalent', () => {
    expect(getReferenceWeightG({ servingAmount: 1, servingUnit: 'bottle', servingWeightG: 355 })).toBe(355);
  });

  it('still throws when servingWeightG is null or non-positive', () => {
    expect(() => getReferenceWeightG({ servingAmount: 1, servingUnit: 'bottle', servingWeightG: null })).toThrow();
    expect(() => getReferenceWeightG({ servingAmount: 1, servingUnit: 'bottle', servingWeightG: 0 })).toThrow();
  });
});

describe('scaleNutrition', () => {
  it('scales down a per-100g food to a smaller measured weight', () => {
    const scaled = scaleNutrition(chickenBreastPer100g, 100, 50);
    expect(scaled.calories).toBeCloseTo(82.5);
    expect(scaled.proteinG).toBeCloseTo(15.5);
    expect(scaled.sodiumMg).toBeCloseTo(37);
  });

  it('scales up a per-serving food to a larger measured weight', () => {
    const scaled = scaleNutrition(proteinBarPerServing, 60, 90);
    expect(scaled.calories).toBeCloseTo(300);
    expect(scaled.proteinG).toBeCloseTo(30);
  });

  it('is a no-op when measured weight equals the reference weight', () => {
    const scaled = scaleNutrition(chickenBreastPer100g, 100, 100);
    expect(scaled).toEqual({
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 74,
    });
  });

  it('throws for a non-positive reference weight', () => {
    expect(() => scaleNutrition(chickenBreastPer100g, 0, 50)).toThrow();
  });
});

describe('addNutrition', () => {
  it('sums each macro field', () => {
    const sum = addNutrition(
      { ...ZERO_NUTRITION, calories: 100, proteinG: 10 },
      { ...ZERO_NUTRITION, calories: 50, proteinG: 5 },
    );
    expect(sum.calories).toBe(150);
    expect(sum.proteinG).toBe(15);
  });
});

describe('computeRecipeTotals + scaleRecipePortion', () => {
  it('sums ingredient contributions by their scaled weight, then scales a portion of the batch', () => {
    // 200g of chicken breast + 60g protein bar mixed in (contrived, just for math coverage)
    const recipeTotals = computeRecipeTotals([
      { food: chickenBreastPer100g, quantityG: 200 },
      { food: proteinBarPerServing, quantityG: 60 },
    ]);

    expect(recipeTotals.totalWeightG).toBe(260);
    // chicken: 165*2 = 330 kcal; protein bar: 200 kcal (full serving) => 530 total
    expect(recipeTotals.totals.calories).toBeCloseTo(530);
    // protein: 31*2 = 62 + 20 = 82
    expect(recipeTotals.totals.proteinG).toBeCloseTo(82);

    // Logging half the batch by weight (130g) should yield exactly half the nutrition.
    const portion = scaleRecipePortion(recipeTotals, 130);
    expect(portion.calories).toBeCloseTo(265);
    expect(portion.proteinG).toBeCloseTo(41);
  });

  it('throws when scaling a portion of a recipe with no ingredient weight', () => {
    const empty = computeRecipeTotals([]);
    expect(() => scaleRecipePortion(empty, 50)).toThrow();
  });
});

describe('roundNutritionForDisplay', () => {
  it('rounds calories and sodium to whole numbers, macros to one decimal', () => {
    const rounded = roundNutritionForDisplay({
      calories: 82.53,
      proteinG: 15.549,
      carbsG: 0.04,
      fatG: 1.851,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 37.6,
    });
    expect(rounded).toEqual({
      calories: 83,
      proteinG: 15.5,
      carbsG: 0,
      fatG: 1.9,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 38,
    });
  });
});
