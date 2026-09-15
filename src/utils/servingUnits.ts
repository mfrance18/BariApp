import { OZ_TO_G } from './units';

/**
 * Grams represented by one of each recognized weight/volume unit. Volume
 * units (ml) assume water-equivalent density, same as the rest of the app.
 * "oz" here is the mass ounce (28.3495 g) used for weighing food — distinct
 * from the fluid ounce (OZ_TO_ML, ~29.5735) used for fluid intake tracking;
 * don't conflate the two despite the shared name.
 * Any unit not listed here (e.g. "bottle", "scoop", "slice", or a US
 * customary volume unit like "cup" — see US_VOLUME_OZ_PER_UNIT below) is
 * treated as a discrete, non-weighable count — logging asks "how many?"
 * instead of "how much do you weigh?".
 */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: OZ_TO_G,
  ounce: OZ_TO_G,
  ounces: OZ_TO_G,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
};

/**
 * US customary volume units, as how many (mass) oz they're approximated to
 * hold — "a fluid ounce weighs an ounce" is the household kitchen
 * approximation any US recipe or package label uses (e.g. 1 cup = 8 fl oz =
 * 8 oz), even though it isn't exactly true for water. Deliberately kept out
 * of GRAMS_PER_UNIT/isWeighableUnit: these units aren't precise enough to
 * treat as directly weighable everywhere (recipes, scale logging) the way
 * g/oz/lb/kg/ml are, and imported products (Open Food Facts) sometimes give
 * a more precise measured serving weight alongside a "cup"/"fl oz" label —
 * that precise value should win over this approximation (see
 * openFoodFacts/mapper.ts). A food using one of these still needs a
 * captured servingWeightG like any other discrete unit; the Food form uses
 * this table to calculate that automatically instead of asking the user to
 * look it up.
 */
export const US_VOLUME_OZ_PER_UNIT: Record<string, number> = {
  cup: 8,
  cups: 8,
  tbsp: 0.5,
  tbsps: 0.5,
  tablespoon: 0.5,
  tablespoons: 0.5,
  tsp: 1 / 6,
  tsps: 1 / 6,
  teaspoon: 1 / 6,
  teaspoons: 1 / 6,
  'fl oz': 1,
  'fl. oz': 1,
  'fluid ounce': 1,
  'fluid ounces': 1,
  pint: 16,
  pints: 16,
  quart: 32,
  quarts: 32,
  gallon: 128,
  gallons: 128,
};

/** Oz-per-unit for a recognized US customary volume unit, or null. See US_VOLUME_OZ_PER_UNIT. */
export function ozPerUsVolumeUnit(unit: string): number | null {
  return US_VOLUME_OZ_PER_UNIT[unit.trim().toLowerCase()] ?? null;
}

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

/** Converts `grams` into an amount of `unit`, or null if the unit isn't weighable. */
export function gramsToServing(grams: number, unit: string): number | null {
  const perUnit = gramsPerUnit(unit);
  return perUnit == null ? null : grams / perUnit;
}

const MIXED_NUMBER_PATTERN = /^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/;
const SIMPLE_FRACTION_PATTERN = /^(\d+)\/(\d+)$/;

/**
 * Parses a serving amount that may be a plain decimal ("1.5"), a simple
 * fraction ("1/4"), or a mixed number ("1 1/2") — the ways US recipes
 * commonly state quantities. Returns null if it isn't a positive number.
 */
export function parseServingAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const mixed = trimmed.match(MIXED_NUMBER_PATTERN);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (!denominator) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = trimmed.match(SIMPLE_FRACTION_PATTERN);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
