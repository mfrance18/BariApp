CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`daily_fluid_goal_ml` real DEFAULT 1500 NOT NULL,
	`daily_protein_goal_g` real DEFAULT 60 NOT NULL,
	`daily_calorie_goal` real DEFAULT 1000 NOT NULL,
	`vesync_email` text,
	`vesync_connected` integer DEFAULT false NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fluid_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount_ml` real NOT NULL,
	`logged_at` text NOT NULL,
	`log_date` text NOT NULL,
	`source_label` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fluid_log_log_date` ON `fluid_log` (`log_date`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`basis_type` text DEFAULT 'per_100g' NOT NULL,
	`serving_size_g` real,
	`serving_label` text,
	`calories` real DEFAULT 0 NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real DEFAULT 0 NOT NULL,
	`sugar_g` real DEFAULT 0 NOT NULL,
	`sodium_mg` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_foods_barcode` ON `foods` (`barcode`);--> statement-breakpoint
CREATE TABLE `meal_log_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`item_type` text NOT NULL,
	`food_id` integer,
	`recipe_id` integer,
	`weight_g` real NOT NULL,
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
);
--> statement-breakpoint
CREATE INDEX `idx_meal_log_entries_log_date` ON `meal_log_entries` (`log_date`);--> statement-breakpoint
CREATE TABLE `med_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`med_schedule_id` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text NOT NULL,
	`taken_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`med_schedule_id`) REFERENCES `med_schedule`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_med_log_schedule_date` ON `med_log` (`med_schedule_id`,`scheduled_date`);--> statement-breakpoint
CREATE TABLE `med_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vitamin_med_id` integer NOT NULL,
	`time_of_day` text NOT NULL,
	`days_of_week` text NOT NULL,
	`notification_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`vitamin_med_id`) REFERENCES `vitamins_meds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_med_schedule_vitamin_med` ON `med_schedule` (`vitamin_med_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`food_id` integer NOT NULL,
	`quantity_g` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_recipe` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`servings` real DEFAULT 1 NOT NULL,
	`notes` text,
	`cached_calories_per_serving` real DEFAULT 0 NOT NULL,
	`cached_protein_g_per_serving` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `vitamins_meds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`dosage_label` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`weight_kg` real NOT NULL,
	`recorded_at` text NOT NULL,
	`source` text NOT NULL,
	`vesync_reading_id` text,
	`body_fat_pct` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_weight_log_vesync_reading` ON `weight_log` (`vesync_reading_id`) WHERE "weight_log"."vesync_reading_id" is not null;--> statement-breakpoint
CREATE INDEX `idx_weight_log_recorded_at` ON `weight_log` (`recorded_at`);