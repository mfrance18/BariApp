export interface OffNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
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
