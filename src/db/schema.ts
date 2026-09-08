import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
};

export const foods = sqliteTable(
  'foods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    source: text('source', { enum: ['manual', 'open_food_facts'] })
      .notNull()
      .default('manual'),
    // Nutrition values below are "per servingAmount servingUnit" (e.g. per
    // 100 g, or per 1 bottle). Whether logging this food weighs it or just
    // counts servings is inferred from whether servingUnit resolves to a
    // weight/volume unit — see src/utils/servingUnits.ts.
    servingAmount: real('serving_amount').notNull().default(1),
    servingUnit: text('serving_unit').notNull().default('g'),
    // Optional weight equivalent (in grams) of one servingAmount/servingUnit,
    // for foods whose serving unit isn't itself weighable (e.g. "1 bottle").
    // Lets such a food still be used in recipes / weighed when logging — see
    // getReferenceWeightG in src/services/nutrition/scaling.ts.
    servingWeightG: real('serving_weight_g'),
    calories: real('calories').notNull().default(0),
    proteinG: real('protein_g').notNull().default(0),
    carbsG: real('carbs_g').notNull().default(0),
    fatG: real('fat_g').notNull().default(0),
    fiberG: real('fiber_g').notNull().default(0),
    sugarG: real('sugar_g').notNull().default(0),
    sodiumMg: real('sodium_mg').notNull().default(0),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_foods_barcode').on(table.barcode)],
);

export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  servings: real('servings').notNull().default(1),
  notes: text('notes'),
  cachedCaloriesPerServing: real('cached_calories_per_serving').notNull().default(0),
  cachedProteinGPerServing: real('cached_protein_g_per_serving').notNull().default(0),
  ...timestamps,
  archivedAt: text('archived_at'),
});

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id),
    quantityG: real('quantity_g').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('idx_recipe_ingredients_recipe').on(table.recipeId)],
);

export const mealLogEntries = sqliteTable(
  'meal_log_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    logDate: text('log_date').notNull(),
    mealType: text('meal_type', {
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    }).notNull(),
    itemType: text('item_type', { enum: ['food', 'recipe'] }).notNull(),
    foodId: integer('food_id').references(() => foods.id),
    recipeId: integer('recipe_id').references(() => recipes.id),
    // Exactly one of (weightG) or (quantityAmount + quantityUnit) is set,
    // depending on whether the food's serving unit was weighable at log
    // time (see src/utils/servingUnits.ts) — a discrete unit like "bottle"
    // or "scoop" has no gram equivalent, so it's logged as a count instead.
    weightG: real('weight_g'),
    quantityAmount: real('quantity_amount'),
    quantityUnit: text('quantity_unit'),
    weightSource: text('weight_source', { enum: ['vesync_scale', 'manual'] }).notNull(),
    calories: real('calories').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g').notNull(),
    sugarG: real('sugar_g').notNull(),
    sodiumMg: real('sodium_mg').notNull(),
    loggedAt: text('logged_at').notNull(),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [index('idx_meal_log_entries_log_date').on(table.logDate)],
);

export const fluidLog = sqliteTable(
  'fluid_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    amountMl: real('amount_ml').notNull(),
    loggedAt: text('logged_at').notNull(),
    logDate: text('log_date').notNull(),
    sourceLabel: text('source_label'),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('idx_fluid_log_log_date').on(table.logDate)],
);

export const vitaminsMeds = sqliteTable('vitamins_meds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['vitamin', 'medication'] }).notNull(),
  dosageLabel: text('dosage_label'),
  notes: text('notes'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const medSchedule = sqliteTable(
  'med_schedule',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vitaminMedId: integer('vitamin_med_id')
      .notNull()
      .references(() => vitaminsMeds.id, { onDelete: 'cascade' }),
    timeOfDay: text('time_of_day').notNull(),
    daysOfWeek: text('days_of_week').notNull(),
    notificationId: text('notification_id'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index('idx_med_schedule_vitamin_med').on(table.vitaminMedId)],
);

export const medLog = sqliteTable(
  'med_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    medScheduleId: integer('med_schedule_id')
      .notNull()
      .references(() => medSchedule.id, { onDelete: 'cascade' }),
    scheduledDate: text('scheduled_date').notNull(),
    status: text('status', { enum: ['taken', 'missed', 'skipped'] }).notNull(),
    takenAt: text('taken_at'),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('idx_med_log_schedule_date').on(table.medScheduleId, table.scheduledDate),
  ],
);

export const weightLog = sqliteTable(
  'weight_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    weightKg: real('weight_kg').notNull(),
    recordedAt: text('recorded_at').notNull(),
    source: text('source', { enum: ['vesync_scale', 'manual'] }).notNull(),
    vesyncReadingId: text('vesync_reading_id'),
    bodyFatPct: real('body_fat_pct'),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('idx_weight_log_vesync_reading')
      .on(table.vesyncReadingId)
      .where(sql`${table.vesyncReadingId} is not null`),
    index('idx_weight_log_recorded_at').on(table.recordedAt),
  ],
);

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  dailyFluidGoalMl: real('daily_fluid_goal_ml').notNull().default(1500),
  dailyProteinGoalG: real('daily_protein_goal_g').notNull().default(60),
  dailyCalorieGoal: real('daily_calorie_goal').notNull().default(1000),
  vesyncEmail: text('vesync_email'),
  vesyncConnected: integer('vesync_connected', { mode: 'boolean' }).notNull().default(false),
  weightUnit: text('weight_unit', { enum: ['lb', 'kg'] })
    .notNull()
    .default('lb'),
  ...timestamps,
});
