import { OZ_TO_ML } from './units';

/**
 * Grams represented by one of each recognized weight/volume unit. Volume
 * units (ml) assume water-equivalent density, same as the rest of the app.
 * Any unit not listed here (e.g. "bottle", "scoop", "slice") is treated as
 * a discrete, non-weighable count — logging asks "how many?" instead of
 * "how much do you weigh?".
 */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: OZ_TO_ML,
  ounce: OZ_TO_ML,
  ounces: OZ_TO_ML,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
};

/** Grams per single unit of `unit`, or null if it's not a recognized weight/volume unit. */
export function gramsPerUnit(unit: string): number | null {
  return GRAMS_PER_UNIT[unit.trim().toLowerCase()] ?? null;
}

export function isWeighableUnit(unit: string): boolean {
  return gramsPerUnit(unit) != null;
}

/** Grams represented by `amount` of `unit`, or null if the unit isn't weighable. */
export function servingToGrams(amount: number, unit: string): number | null {
  const perUnit = gramsPerUnit(unit);
  return perUnit == null ? null : amount * perUnit;
}
