/** Fluid ounce -> mL, for volume (fluid intake). Not the same unit as a mass ounce — see OZ_TO_G. */
export const OZ_TO_ML = 29.5735;

/** Mass ounce (avoirdupois) -> grams, for weighing food. Not the same unit as a fluid ounce — see OZ_TO_ML. */
export const OZ_TO_G = 28.349523125;

export function ozToMl(oz: number): number {
  return oz * OZ_TO_ML;
}

export function mlToOz(ml: number): number {
  return ml / OZ_TO_ML;
}
