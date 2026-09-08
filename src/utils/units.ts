export const OZ_TO_ML = 29.5735;

export function ozToMl(oz: number): number {
  return oz * OZ_TO_ML;
}

export function mlToOz(ml: number): number {
  return ml / OZ_TO_ML;
}
