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

export interface FdcFoodNutrient {
  nutrient?: {
    /** The stable USDA nutrient number (e.g. "208" = Energy) — use this to match, not `name`, which varies slightly across dataTypes. */
    number?: string;
    name?: string;
    unitName?: string;
  };
  amount?: number;
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
