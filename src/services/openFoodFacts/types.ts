export interface OffNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;

  // Per-serving values, present when the product lists a serving_size.
  'energy-kcal_serving'?: number;
  energy_serving?: number;
  proteins_serving?: number;
  carbohydrates_serving?: number;
  fat_serving?: number;
  fiber_serving?: number;
  sugars_serving?: number;
  sodium_serving?: number;
}

export interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: OffNutriments;
}

export interface OffProductResponse {
  status: 0 | 1;
  product?: OffProduct;
}

export interface OffSearchResponse {
  products?: OffProduct[];
}
