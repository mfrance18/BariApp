import type { MealLogEntryWithName } from '../../db/repositories/mealLogRepo';
import { groupEntriesByMeal, sumEntries } from './totals';

function makeEntry(overrides: Partial<MealLogEntryWithName>): MealLogEntryWithName {
  return {
    id: 1,
    logDate: '2026-01-01',
    mealType: 'breakfast',
    itemType: 'food',
    foodId: 1,
    recipeId: null,
    weightG: 100,
    weightSource: 'manual',
    calories: 100,
    proteinG: 10,
    carbsG: 5,
    fatG: 2,
    fiberG: 1,
    sugarG: 1,
    sodiumMg: 50,
    loggedAt: '2026-01-01T08:00:00.000Z',
    notes: null,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
    itemName: 'Test food',
    ...overrides,
  };
}

describe('groupEntriesByMeal', () => {
  it('buckets entries into their meal type, leaving empty meals as empty arrays', () => {
    const entries = [
      makeEntry({ id: 1, mealType: 'breakfast' }),
      makeEntry({ id: 2, mealType: 'snack' }),
      makeEntry({ id: 3, mealType: 'breakfast' }),
    ];
    const grouped = groupEntriesByMeal(entries);
    expect(grouped.breakfast.map((e) => e.id)).toEqual([1, 3]);
    expect(grouped.snack.map((e) => e.id)).toEqual([2]);
    expect(grouped.lunch).toEqual([]);
    expect(grouped.dinner).toEqual([]);
  });
});

describe('sumEntries', () => {
  it('sums the nutrition snapshot fields across entries', () => {
    const entries = [
      makeEntry({ calories: 100, proteinG: 10 }),
      makeEntry({ calories: 250, proteinG: 20 }),
    ];
    const total = sumEntries(entries);
    expect(total.calories).toBe(350);
    expect(total.proteinG).toBe(30);
  });

  it('returns zeroed totals for an empty list', () => {
    const total = sumEntries([]);
    expect(total.calories).toBe(0);
    expect(total.proteinG).toBe(0);
  });
});
