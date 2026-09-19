export interface FdcLabelNutrientValue {
  value: number;
}

/** The nutrient values exactly as printed on the product's label — see FdcFood.labelNutrients. */
export interface FdcLabelNutrients {
  calories?: FdcLabelNutrientValue;
  protein?: FdcLabelNutrientValue;
  fat?: FdcLabelNutrientValue;
  carbohydrates?: FdcLabelNutrientValue;
  fiber?: FdcLabelNutrientValue;
  sugars?: FdcLabelNutrientValue;
  sodium?: FdcLabelNutrientValue;
}

/**
 * The shape FDC's /v1/foods/search endpoint actually returns for each
 * foodNutrients entry — flat, not nested under a "nutrient" object (that
 * nested shape belongs to the separate /v1/food/{fdcId} detail endpoint,
 * which this app never calls). Confirmed against a real captured search
 * response — see mapper.ts's mapFoodNutrientsPer100g.
 */
export interface FdcFoodNutrient {
  /** The stable USDA nutrient number (e.g. "208" = Energy) — use this to match, not `nutrientName`, which varies slightly across dataTypes. */
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

export interface FdcFood {
  fdcId: number;
  description?: string;
  /** "Branded" (packaged products, has labelNutrients) vs "Foundation" / "SR Legacy" / "Survey (FNDDS)" (generic, per-100g via foodNutrients). */
  dataType?: string;
  brandName?: string;
  brandOwner?: string;
  /** Barcode — only present (and only meaningful) for Branded foods, and even then not always populated. */
  gtinUpc?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  labelNutrients?: FdcLabelNutrients;
  foodNutrients?: FdcFoodNutrient[];
}

export interface FdcSearchResponse {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: FdcFood[];
}
