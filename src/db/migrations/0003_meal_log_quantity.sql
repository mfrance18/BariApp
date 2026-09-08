PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meal_log_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`item_type` text NOT NULL,
	`food_id` integer,
	`recipe_id` integer,
	`weight_g` real,
	`quantity_amount` real,
	`quantity_unit` text,
	`weight_source` text NOT NULL,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real NOT NULL,
	`sugar_g` real NOT NULL,
	`sodium_mg` real NOT NULL,
	`logged_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
-- Backfill using the old foods.basis_type/serving_size_g (still present at
-- this point, dropped at the end of this migration) so that a historical
-- entry logged against a per_serving food recovers its original quantity
-- multiplier (weight_g / old serving_size_g) instead of just guessing "1".
INSERT INTO `__new_meal_log_entries`
  ("id", "log_date", "meal_type", "item_type", "food_id", "recipe_id", "weight_g", "quantity_amount", "quantity_unit", "weight_source", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg", "logged_at", "notes", "created_at", "updated_at")
SELECT
  m."id", m."log_date", m."meal_type", m."item_type", m."food_id", m."recipe_id",
  CASE WHEN f."basis_type" = 'per_serving' THEN NULL ELSE m."weight_g" END,
  CASE WHEN f."basis_type" = 'per_serving' AND f."serving_size_g" IS NOT NULL AND f."serving_size_g" > 0
       THEN m."weight_g" / f."serving_size_g" ELSE NULL END,
  CASE WHEN f."basis_type" = 'per_serving' THEN 'serving' ELSE NULL END,
  m."weight_source", m."calories", m."protein_g", m."carbs_g", m."fat_g", m."fiber_g", m."sugar_g", m."sodium_mg", m."logged_at", m."notes", m."created_at", m."updated_at"
FROM `meal_log_entries` m
LEFT JOIN `foods` f ON m."food_id" = f."id";--> statement-breakpoint
DROP TABLE `meal_log_entries`;--> statement-breakpoint
ALTER TABLE `__new_meal_log_entries` RENAME TO `meal_log_entries`;--> statement-breakpoint
CREATE INDEX `idx_meal_log_entries_log_date` ON `meal_log_entries` (`log_date`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `foods` DROP COLUMN `basis_type`;--> statement-breakpoint
ALTER TABLE `foods` DROP COLUMN `serving_size_g`;--> statement-breakpoint
ALTER TABLE `foods` DROP COLUMN `serving_size_unit`;--> statement-breakpoint
ALTER TABLE `foods` DROP COLUMN `serving_label`;
